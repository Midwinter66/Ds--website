/* =============================================================
 * desk.js —— 工作台入口粘合层
 *   1. 博客 / 工作台 双入口切换
 *   2. 启动云同步
 *   3. 顶栏同步状态指示
 *   4. 设置页注入「云同步」面板
 *   5. 移动端侧栏抽屉
 * ============================================================= */
(function () {
  'use strict';

  var App = window.App = window.App || {};
  var Storage = App.Storage;
  var Router = App.Router;
  var Cloud = App.CloudStore;

  /* ---------------- 视图切换 ---------------- */

  function showDesk() {
    var welcome = document.getElementById('welcome-screen');
    var blog = document.getElementById('main-app');
    var desk = document.getElementById('desk-app');
    if (welcome) welcome.classList.add('hidden');
    if (blog) blog.classList.add('hidden');
    if (desk) {
      desk.classList.remove('hidden');
      desk.classList.add('active');
    }
    try { sessionStorage.setItem('winter_entered', 'true'); } catch (e) {}
  }

  function showBlog() {
    var blog = document.getElementById('main-app');
    var desk = document.getElementById('desk-app');
    var welcome = document.getElementById('welcome-screen');
    if (desk) {
      desk.classList.remove('active');
      desk.classList.add('hidden');
    }
    if (welcome) welcome.classList.add('hidden');
    if (blog) {
      blog.classList.remove('hidden');
      blog.classList.add('visible');
    }
  }

  /* ---------------- 顶栏同步状态 ---------------- */

  function renderSyncChip(st) {
    var chip = document.getElementById('sync-chip');
    if (!chip) return;
    var text = Cloud.statusText();
    var cls = 'sync-chip';
    if (st.status === 'synced') cls += ' synced';
    else if (st.status === 'syncing') cls += ' syncing';
    else if (st.status === 'offline' || st.status === 'error') cls += ' offline';
    chip.className = cls;
    chip.textContent = text + (st.pending ? ' (' + st.pending + ')' : '');
    chip.title = st.message || '';
  }

  function mountSyncChip() {
    var right = document.querySelector('.topbar-right');
    if (!right || document.getElementById('sync-chip')) return;
    var chip = document.createElement('span');
    chip.id = 'sync-chip';
    chip.className = 'sync-chip';
    chip.textContent = '初始化';
    chip.addEventListener('click', function () {
      if (Cloud.getState().mode === 'cloud') {
        Cloud.fullSync();
        if (App.Toast) App.Toast.show('已手动触发同步', 'info');
      } else if (Router) {
        Router.navigate('settings');
      }
    });
    right.insertBefore(chip, right.firstChild);
  }

  /* ---------------- 设置页：云同步面板 ---------------- */

  function cloudPanelHtml() {
    var st = Cloud.getState();
    var html = '';
    html += '<div class="card cloud-panel" id="cloud-panel">';
    html += '<div class="section-title">云同步 · Supabase</div>';

    html += '<div class="cloud-status ' + st.status + '">';
    html += '<span class="cloud-dot"></span>';
    html += '<span id="cloud-status-text">' + esc(Cloud.statusText()) + '</span>';
    html += '</div>';
    if (st.message) {
      html += '<div class="cloud-hint" id="cloud-message">' + esc(st.message) + '</div>';
    }

    if (st.mode !== 'cloud') {
      html += '<div class="cloud-hint">当前为<b>纯本地模式</b>。在 <code>js/config.js</code> 填入 supabaseUrl 与 supabaseAnonKey 后刷新即可启用。</div>';
    } else if (!st.user) {
      html += '<div class="form-group mt-12"><label class="form-label">邮箱</label>';
      html += '<input type="email" id="cloud-email" placeholder="you@example.com" autocomplete="email"></div>';
      html += '<div class="form-group"><label class="form-label">密码</label>';
      html += '<input type="password" id="cloud-password" placeholder="至少 6 位" autocomplete="current-password"></div>';
      html += '<div class="cloud-row">';
      html += '<button class="btn btn-primary" id="cloud-signin">登录</button>';
      html += '<button class="btn btn-secondary" id="cloud-signup">注册</button>';
      html += '</div>';
      html += '<div class="cloud-hint">首次使用先「注册」，之后自动登录。数据按用户隔离，别人看不到。</div>';
    } else {
      html += '<div class="cloud-account">已登录：<b>' + esc(st.user.email || st.user.id) + '</b></div>';
      html += '<div class="cloud-row">';
      html += '<button class="btn btn-secondary" id="cloud-pull">从云端拉取</button>';
      html += '<button class="btn btn-secondary" id="cloud-push">立即上传</button>';
      html += '<button class="btn btn-danger" id="cloud-signout">退出登录</button>';
      html += '</div>';
      html += '<div class="cloud-hint">改动会在 1.2 秒后自动上传；每 60 秒自动拉取一次；切换页面可见时也会同步。</div>';
    }

    html += '</div>';
    return html;
  }

  function bindCloudPanel() {
    var signin = document.getElementById('cloud-signin');
    var signup = document.getElementById('cloud-signup');
    var signout = document.getElementById('cloud-signout');
    var pullBtn = document.getElementById('cloud-pull');
    var pushBtn = document.getElementById('cloud-push');

    function auth(mode) {
      var email = (document.getElementById('cloud-email') || {}).value || '';
      var pwd = (document.getElementById('cloud-password') || {}).value || '';
      if (!email || !pwd) return toast('请填写邮箱和密码', 'error');
      var p = mode === 'up' ? Cloud.signUp(email, pwd) : Cloud.signIn(email, pwd);
      return p.then(function (res) {
        if (res && res.error) throw res.error;
        toast(mode === 'up' ? '注册成功，正在同步…' : '登录成功，正在同步…', 'success');
        return Cloud.fullSync();
      }).catch(function (err) {
        toast(err.message || '认证失败', 'error');
      });
    }

    if (signin) signin.addEventListener('click', function () { auth('in'); });
    if (signup) signup.addEventListener('click', function () { auth('up'); });
    if (signout) signout.addEventListener('click', function () {
      Cloud.signOut();
      toast('已退出登录', 'info');
    });
    if (pullBtn) pullBtn.addEventListener('click', function () {
      Cloud.pull().then(function () { toast('已拉取云端数据', 'success'); refreshView(); });
    });
    if (pushBtn) pushBtn.addEventListener('click', function () {
      Cloud.SYNC_KEYS.forEach(function (k) { Cloud.markDirtyForPush(k); });
      Cloud.push().then(function () { toast('已上传到云端', 'success'); });
    });
  }

  function injectCloudPanel() {
    var main = document.getElementById('main');
    if (!main || document.getElementById('cloud-panel')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = cloudPanelHtml();
    var panel = wrap.firstChild;
    // 插到最前面，但排在主题设置之后更顺手
    var firstCard = main.querySelector('.card');
    if (firstCard && firstCard.nextSibling) main.insertBefore(panel, firstCard.nextSibling);
    else main.appendChild(panel);
    bindCloudPanel();
  }

  function refreshCloudPanel() {
    var panel = document.getElementById('cloud-panel');
    if (!panel) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = cloudPanelHtml();
    panel.parentNode.replaceChild(wrap.firstChild, panel);
    bindCloudPanel();
  }

  function toast(msg, type) {
    if (App.Toast) App.Toast.show(msg, type);
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 模块视图刷新 ---------------- */

  function refreshView() {
    if (!Router || !Router.current) return;
    var mod = Router.modules[Router.current];
    var main = document.getElementById('main');
    if (mod && main && typeof mod.render === 'function') {
      main.innerHTML = mod.render();
      if (typeof mod.afterRender === 'function') mod.afterRender();
      if (Router.current === 'settings') injectCloudPanel();
    }
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    // 入口按钮
    var entry = document.getElementById('desk-entry');
    if (entry) entry.addEventListener('click', showDesk);
    var back = document.getElementById('to-blog-btn');
    if (back) back.addEventListener('click', showBlog);

    // 移动端侧栏
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function (e) {
        if (window.innerWidth <= 860) sidebar.classList.remove('open');
      });
    }

    // 顶栏同步指示
    mountSyncChip();

    // 设置页注入云同步面板
    if (Router && Router.navigate) {
      var origNavigate = Router.navigate;
      Router.navigate = function (name) {
        origNavigate.call(Router, name);
        if (name === 'settings') injectCloudPanel();
      };
      if (Router.current === 'settings') injectCloudPanel();
    }

    // 云端状态订阅
    if (Cloud) {
      Cloud.onStatus(function (st) {
        renderSyncChip(st);
        if (document.getElementById('cloud-panel')) refreshCloudPanel();
      });

      document.addEventListener('cloud:pulled', function () {
        refreshView();
      });

      Cloud.init().then(function () {
        renderSyncChip(Cloud.getState());
      });
    } else {
      var chip = document.getElementById('sync-chip');
      if (chip) chip.textContent = '本地模式';
    }

    // 顶部保存按钮：顺带触发一次上传
    document.addEventListener('app:save-all', function () {
      if (Cloud && Cloud.getState().mode === 'cloud') Cloud.push();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
