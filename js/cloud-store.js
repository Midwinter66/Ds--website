/* =============================================================
 * CloudStore —— 把 App.Storage（localStorage 同步 API）镜像到 Supabase
 *
 * 设计要点：
 *  1. 现有 7 个模块全是「同步」调用 Storage.get/set，不能改成 await。
 *     所以这里不改 API 形态：get 仍然读本地，set 仍然写本地，
 *     只是在 set 之后异步把变更推到云端（debounce 1.2s）。
 *  2. 启动时全量拉取一次云端数据，按 updated_at 做「最后写入者胜」合并。
 *  3. 未配置 config.js 或断网时，静默降级为纯本地模式，不影响任何功能。
 * ============================================================= */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : this;
  var App = root.App = root.App || {};
  var Storage = App.Storage;

  if (!Storage) {
    console.warn('[CloudStore] App.Storage 未加载，云同步已跳过');
    return;
  }

  // 需要上云的键（app_psychology_tab 是纯 UI 状态，不同步）
  var SYNC_KEYS = [
    'app_tasks',
    'app_research',
    'app_psychology',
    'app_fitness',
    'app_games',
    'app_cooking',
    'app_memos',
    'app_settings'
  ];

  var META_KEY = 'app_cloud_meta';      // { key: ISO时间戳 }
  var DEBOUNCE_MS = 1200;
  var PULL_INTERVAL_MS = 60000;
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

  var client = null;
  var anonClient = null; // 匿名只读 client，用于首页拉公开文章
  var dirty = {};
  var pushTimer = null;
  var pullTimer = null;
  var pushing = false;
  var pulling = false;

  var state = {
    mode: 'local',        // local（未启用） | cloud（已启用）
    status: 'init',       // init | local | connecting | synced | syncing | offline | error | signed-out
    user: null,
    message: '',
    lastSyncAt: null,
    pending: 0
  };

  var listeners = [];

  function onStatus(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { console.error(e); }
    }
    if (typeof document !== 'undefined') {
      try {
        document.dispatchEvent(new CustomEvent('cloud:status', { detail: state }));
      } catch (e) { /* 老浏览器忽略 */ }
    }
  }

  function setStatus(status, message) {
    state.status = status;
    state.message = message || '';
    emit();
  }

  /* ---------------- 本地元数据 ---------------- */

  function getMeta() {
    return Storage.get(META_KEY, {}) || {};
  }

  function setMetaKey(key, iso) {
    var meta = getMeta();
    meta[key] = iso;
    Storage.set(META_KEY, meta);
  }

  function isSyncKey(key) {
    return SYNC_KEYS.indexOf(key) !== -1;
  }

  /* ---------------- SDK 加载 ---------------- */

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (root.supabase && root.supabase.createClient) return resolve(root.supabase);
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = function () {
        if (root.supabase && root.supabase.createClient) resolve(root.supabase);
        else reject(new Error('Supabase SDK 加载异常'));
      };
      s.onerror = function () { reject(new Error('Supabase SDK 加载失败（检查网络）')); };
      document.head.appendChild(s);
    });
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    var cfg = root.APP_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      state.mode = 'local';
      setStatus('local', '未配置 Supabase，当前为纯本地模式');
      console.info('[CloudStore] 未检测到 APP_CONFIG，已降级为本地模式');
      installHooks();
      return Promise.resolve(state);
    }

    setStatus('connecting', '正在连接云端…');
    return loadSdk()
      .then(function (sdk) {
        client = sdk.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
        state.mode = 'cloud';

        client.auth.onAuthStateChange(function (_event, session) {
          state.user = (session && session.user) || null;
          if (state.user) {
            setStatus('syncing', '已登录，正在同步…');
            fullSync();
          } else {
            setStatus('signed-out', '未登录，数据仅保存在本机');
          }
        });

        return client.auth.getSession();
      })
      .then(function (res) {
        var session = res && res.data ? res.data.session : null;
        state.user = (session && session.user) || null;
        if (state.user) return fullSync();
        setStatus('signed-out', '未登录，数据仅保存在本机');
      })
      .catch(function (err) {
        console.error('[CloudStore]', err);
        state.mode = 'local';
        setStatus('error', err.message || '云端连接失败，已降级为本地模式');
      })
      .then(function () {
        installHooks();
        startTimers();
        return state;
      });
  }

  /* ---------------- 拦截本地写入 ---------------- */

  var hooked = false;

  function installHooks() {
    if (hooked) return;
    hooked = true;

    var origSet = Storage.set;
    Storage.set = function (key, value) {
      origSet.call(Storage, key, value);
      if (key !== META_KEY && isSyncKey(key)) {
        setMetaKey(key, new Date().toISOString());
        dirty[key] = true;
        schedulePush();
      }
    };

    var origRemove = Storage.remove;
    Storage.remove = function (key) {
      origRemove.call(Storage, key);
      if (isSyncKey(key)) {
        setMetaKey(key, new Date().toISOString());
        dirty[key] = true;
        schedulePush();
      }
    };

    var origImport = Storage.importAll;
    Storage.importAll = function (data) {
      origImport.call(Storage, data);
      for (var i = 0; i < SYNC_KEYS.length; i++) dirty[SYNC_KEYS[i]] = true;
      schedulePush();
    };

    var origClear = Storage.clearAll;
    Storage.clearAll = function () {
      origClear.call(Storage);
      for (var i = 0; i < SYNC_KEYS.length; i++) dirty[SYNC_KEYS[i]] = true;
      schedulePush();
    };
  }

  /* ---------------- 推送 ---------------- */

  function schedulePush() {
    if (state.mode !== 'cloud' || !state.user) return;
    state.pending = Object.keys(dirty).length;
    emit();
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(push, DEBOUNCE_MS);
  }

  function push() {
    if (state.mode !== 'cloud' || !client || !state.user || pushing) return Promise.resolve();
    pushing = true;
    setStatus('syncing', '正在上传…');

    var meta = getMeta();
    var keys = Object.keys(dirty);
    var jobs = keys.map(function (key) {
      var value = Storage.get(key, null);
      var at = meta[key] || new Date().toISOString();
      return client
        .rpc('sync_store', { p_key: key, p_value: value, p_updated_at: at })
        .then(function (res) {
          if (res && res.error) throw res.error;
          var accepted = res && res.data;
          // 云端返回更新值 → 说明云端比本地新，覆盖本地
          if (accepted !== undefined && JSON.stringify(accepted) !== JSON.stringify(value)) {
            origWriteLocal(key, accepted, at);
          }
          delete dirty[key];
        });
    });

    return Promise.all(jobs)
      .then(function () {
        state.pending = 0;
        state.lastSyncAt = new Date();
        setStatus('synced', '已同步 · ' + formatTime(state.lastSyncAt));
      })
      .catch(function (err) {
        console.error('[CloudStore] 上传失败', err);
        setStatus('offline', '上传失败，改动已留在本地待重试');
      })
      .then(function () {
        pushing = false;
        emit();
      });
  }

  // 不触发 dirty 的本地写入
  function origWriteLocal(key, value, iso) {
    localStorage.setItem(key, JSON.stringify(value));
    setMetaKey(key, iso);
  }

  /* ---------------- 拉取 ---------------- */

  function pull() {
    if (state.mode !== 'cloud' || !client || !state.user || pulling) return Promise.resolve();
    pulling = true;
    return client
      .rpc('pull_store')
      .then(function (res) {
        if (res && res.error) throw res.error;
        var rows = (res && res.data) || [];
        var meta = getMeta();
        var changed = false;

        rows.forEach(function (row) {
          if (!isSyncKey(row.key)) return;
          var remoteAt = new Date(row.updated_at).getTime();
          var localAt = meta[row.key] ? new Date(meta[row.key]).getTime() : 0;

          if (remoteAt > localAt) {
            origWriteLocal(row.key, row.value, row.updated_at);
            delete dirty[row.key];
            changed = true;
          } else if (remoteAt < localAt) {
            dirty[row.key] = true; // 本地更新，稍后推上去
          }
        });

        if (changed) {
          if (typeof document !== 'undefined') {
            try { document.dispatchEvent(new CustomEvent('cloud:pulled')); } catch (e) {}
          }
        }
        if (Object.keys(dirty).length) return push();
        state.lastSyncAt = new Date();
        setStatus('synced', '已同步 · ' + formatTime(state.lastSyncAt));
      })
      .catch(function (err) {
        console.error('[CloudStore] 拉取失败', err);
        setStatus('offline', '同步失败，稍后自动重试');
      })
      .then(function () { pulling = false; });
  }

  function fullSync() {
    return pull().then(function () {
      if (Object.keys(dirty).length) return push();
    });
  }

  /* ---------------- 认证 ---------------- */

  function signUp(email, password) {
    if (!client) return Promise.reject(new Error('云端未启用'));
    return client.auth.signUp({ email: email, password: password });
  }

  function signIn(email, password) {
    if (!client) return Promise.reject(new Error('云端未启用'));
    return client.auth.signInWithPassword({ email: email, password: password });
  }

  function signOut() {
    if (!client) return Promise.resolve();
    return client.auth.signOut().then(function () {
      state.user = null;
      setStatus('signed-out', '已退出登录');
    });
  }

  /* ---------------- 定时器 / 事件 ---------------- */

  function startTimers() {
    if (pullTimer) clearInterval(pullTimer);
    pullTimer = setInterval(function () {
      if (state.mode === 'cloud' && state.user) pull();
    }, PULL_INTERVAL_MS);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && state.mode === 'cloud' && state.user) pull();
      });
    }
    window.addEventListener('online', function () {
      if (state.mode === 'cloud' && state.user) fullSync();
    });
  }

  function formatTime(d) {
    if (!d) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ---------------- 导出 ---------------- */

  App.CloudStore = {
    SYNC_KEYS: SYNC_KEYS,
    init: init,
    onStatus: onStatus,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    pull: pull,
    push: push,
    fullSync: fullSync,
    markDirtyForPush: function (key) { dirty[key] = true; },
    getState: function () { return state; },
    // 暴露原始 client 供 posts/notes 等行级模块做直接 CRUD
    getClient: function () { return client; },
    // 云端就绪（已登录）？
    isReady: function () { return state.mode === 'cloud' && !!client && !!state.user; },
    // 匿名只读客户端（用于首页拉公开文章，无需登录）
    getAnonClient: function () {
      if (anonClient) return anonClient;
      var cfg = root.APP_CONFIG || {};
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !root.supabase) return null;
      anonClient = root.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      return anonClient;
    },
    statusText: function () {
      var map = {
        init: '初始化中',
        local: '本地模式',
        connecting: '连接中',
        signed_out: '未登录',
        'signed-out': '未登录',
        syncing: '同步中',
        synced: '已同步',
        offline: '离线待同步',
        error: '连接异常'
      };
      return map[state.status] || state.status;
    }
  };
})();
