/* 冒烟测试：jsdom 加载首页，遍历所有模块与两个小游戏，捕获运行时错误
 *
 * 注意：JSDOM.fromURL + resources:'usable' 会并行拉取脚本且不保证按文档顺序执行，
 * 与本页面的依赖关系（storage → router → modules → app → desk）冲突。
 * 所以这里先把 script 标签摘出来，再按文档顺序串行注入。
 *
 * 用法：先起 http://127.0.0.1:8765，再 node tools/smoke-test.js
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = 'http://127.0.0.1:8765/Ds--website/';
const PAGE = BASE + 'index.html';

const errors = [];
const logs = [];

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  if (/Not implemented: HTMLCanvasElement/.test(e.message)) return;
  errors.push('[jsdomError] ' + e.message + (e.detail ? '\n   ' + e.detail : '') + '\n   STACK: ' + String(e.stack || '').split('\n').slice(0,6).join('\n   '));
});
vc.on('error', (...a) => errors.push('[console.error] ' + a.join(' ')));
vc.on('warn', (...a) => logs.push('[warn] ' + a.join(' ')));
vc.on('info', (...a) => logs.push('[info] ' + a.join(' ')));
vc.on('log', (...a) => logs.push('[log] ' + a.join(' ')));

function fakeCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get: (t, k) => {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'canvas') return { width: 400, height: 400 };
      if (k === 'measureText') return () => ({ width: 10 });
      return typeof k === 'string' ? noop : undefined;
    },
    set: () => true
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const html = await fetch(PAGE).then((r) => r.text());
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const stripped = html.replace(/<script src="[^"]+"><\/script>/g, '');

  const dom = new JSDOM(stripped, {
    url: PAGE,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = function () { return fakeCtx(); };
      // 模拟 Supabase SDK 已加载，避免 jsdom 拉不动 CDN 导致 CloudStore 进 error 状态
      window.supabase = {
        createClient: function () {
          return {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              getSession: async () => ({ data: { session: null }, error: null }),
              onAuthStateChange: function () { return { data: { subscription: { unsubscribe() {} } } }; },
              signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'stub' } }),
              signUp: async () => ({ data: { user: null, session: null }, error: { message: 'stub' } }),
              signOut: async () => ({ error: null })
            },
            from: function () {
              return {
                select: function () { return { eq: function () { return { data: [], error: null }; } }; },
                upsert: async () => ({ data: null, error: null }),
                delete: function () { return { eq: function () { return Promise.resolve({ error: null }); } }; }
              };
            },
            rpc: async () => ({ data: null, error: null })
          };
        }
      };
    }
  });
  const { window } = dom;
  const doc = window.document;
  await wait(50);

  for (const src of srcs) {
    await new Promise((resolve) => {
      const s = doc.createElement('script');
      s.src = src.startsWith('http') ? src : new URL(src, BASE).href;
      s.onload = () => resolve();
      s.onerror = () => { errors.push('[load] 脚本加载失败 ' + src); resolve(); };
      doc.head.appendChild(s);
    });
  }
  await wait(300);

  const results = [];
  const check = (name, cond, extra) => {
    const ok = !!cond;
    results.push({ name, pass: ok, extra: extra || '' });
    console.log((ok ? '  PASS  ' : '> FAIL  ') + name + (extra ? '  -- ' + extra : ''));
  };

  const App = window.App || {};

  check('App.Storage', !!App.Storage);
  check('App.Router', !!App.Router);
  check('App.CloudStore', !!App.CloudStore);
  check('App.Toast', !!App.Toast);
  check('App.Game2048', !!App.Game2048);
  check('App.Snake', !!App.Snake);

  ['sidebar', 'topbar', 'main', 'desk-app', 'desk-entry', 'to-blog-btn'].forEach((id) =>
    check('容器 #' + id, !!doc.getElementById(id))
  );

  check('侧栏导航项 = 8', doc.querySelectorAll('#sidebar .desk-nav-item').length === 8,
    '实际 ' + doc.querySelectorAll('#sidebar .desk-nav-item').length);
  check('顶栏已渲染', !!doc.querySelector('.topbar-title'));
  check('同步状态 chip', !!doc.getElementById('sync-chip'));
  check('云同步进入云端模式（已配置 config）',
    App.CloudStore && App.CloudStore.getState().mode === 'cloud',
    App.CloudStore ? App.CloudStore.getState().mode + '/' + App.CloudStore.getState().status : 'CloudStore 未定义');
  check('顶栏 chip 文案为「未登录」',
    (doc.getElementById('sync-chip') || {}).textContent === '未登录',
    (doc.getElementById('sync-chip') || {}).textContent);

  const modules = Object.keys((App.Router && App.Router.modules) || {});
  check('已注册模块数 = 8', modules.length === 8, modules.join(','));
  for (const m of modules) {
    try {
      App.Router.navigate(m);
      await wait(60);
      const main = doc.getElementById('main');
      check('模块 ' + m + ' 渲染', main && main.innerHTML.trim().length > 20,
        main ? main.innerHTML.trim().length + ' 字符' : '无 #main');
    } catch (e) {
      check('模块 ' + m + ' 渲染', false, e.message);
    }
  }

  try {
    App.Router.navigate('games');
    await wait(80);
    const card2048 = doc.getElementById('game-card-2048');
    check('游戏列表：2048 卡片', !!card2048);
    if (card2048) {
      card2048.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await wait(200);
      const cells = doc.querySelectorAll('#game-2048-area .grid-cell');
      const filled = Array.from(cells).filter((c) => c.textContent.trim()).length;
      check('2048 棋盘渲染', !!doc.querySelector('#game-2048-area .game-grid-2048'));
      check('2048 格子 = 16', cells.length === 16, '实际 ' + cells.length);
      check('2048 初始有数字块', filled >= 2, filled + ' 个');
    }
    // destroy 后 currentView 应回到 list，所以这里能重新拿到卡片
    App.Router.navigate('home');
    await wait(60);
    check('离开游戏模块后状态重置', App.Games._getView() === 'list', App.Games._getView());
    App.Router.navigate('games');
    await wait(80);
    const cardSnake = doc.getElementById('game-card-snake');
    check('游戏列表：贪吃蛇卡片', !!cardSnake);
    if (cardSnake) {
      cardSnake.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await wait(200);
      check('贪吃蛇画布存在', !!doc.getElementById('game-snake-canvas'));
    }
  } catch (e) {
    check('游戏模块', false, e.message);
  }

  App.Router.navigate('settings');
  await wait(80);
  check('设置页云同步面板', !!doc.getElementById('cloud-panel'));
  check('面板进入云端登录态（含邮箱输入框）',
    !!doc.getElementById('cloud-email'),
    (doc.getElementById('cloud-status-text') || {}).textContent || '无状态文案');

  doc.getElementById('desk-entry').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(80);
  const desk = doc.getElementById('desk-app');
  check('切换到工作台', desk.classList.contains('active'));
  check('切换后博客隐藏', doc.getElementById('main-app').classList.contains('hidden'));
  doc.getElementById('to-blog-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(80);
  check('切回博客', !desk.classList.contains('active'));

  App.Storage.set('app_memos', [{ id: 'test1', text: '冒烟测试' }]);
  const memo = App.Storage.get('app_memos', []);
  check('存储读写', memo.length === 1 && memo[0].text === '冒烟测试');

  check('博客文章卡 = 5（模板已移除）',
    doc.querySelectorAll('.post-card').length === 5,
    '实际 ' + doc.querySelectorAll('.post-card').length);
  check('无 _template 死链', !/posts\/_template/.test(doc.body.innerHTML));

  console.log('\n================ 汇总 ================');
  const fail = results.filter((r) => !r.pass).length;
  console.log('通过 ' + (results.length - fail) + ' / ' + results.length);
  if (errors.length) {
    console.log('\n运行时错误 ' + errors.length + ' 条：');
    errors.slice(0, 15).forEach((e) => console.log('  ' + e));
  } else {
    console.log('无运行时错误');
  }
  if (process.env.SHOW_LOGS) logs.slice(0, 25).forEach((l) => console.log(l));
  console.log('======================================\n');

  try { App.Snake && App.Snake.stop(); } catch (e) {}
  try { App.Game2048 && App.Game2048.stop(); } catch (e) {}
  try { window.close(); } catch (e) {}
  setTimeout(() => process.exit(fail || errors.length ? 1 : 0), 100);
})().catch((e) => {
  console.error('测试崩溃：', e.message);
  console.error(e.stack);
  process.exitCode = 1;
});
