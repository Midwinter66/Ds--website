// ===== App: 启动入口 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Router = root.App.Router;

  var MODULES = [
    { id: 'home',      name: '首页',     icon: '\u{1F3E0}', category: 'daily' },
    { id: 'plan',      name: '今日计划',  icon: '\u{1F4CB}', category: 'daily' },
    { id: 'research',  name: '科研进展',  icon: '\u{1F52C}', category: 'research' },
    { id: 'psychology',name: '心理学',   icon: '\u{1F9E0}', category: 'life' },
    { id: 'fitness',   name: '健身计划',  icon: '\u{1F4AA}', category: 'life' },
    { id: 'cooking',   name: '烹饪美食',  icon: '\u{1F373}', category: 'life' },
    { id: 'games',     name: '游戏娱乐',  icon: '\u{1F3AE}', category: 'life' },
    { id: 'settings',  name: '数据和设置', icon: '\u2699\uFE0F', category: 'system' }
  ];

  var CATEGORIES = [
    { id: 'daily',    name: '日常' },
    { id: 'research', name: '科研' },
    { id: 'life',     name: '生活' },
    { id: 'system',   name: '数据和设置' }
  ];

  function renderSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var html = '<div class="sidebar-logo">我的生活</div>';
    CATEGORIES.forEach(function(cat) {
      html += '<div class="nav-category">' + cat.name + '</div>';
      MODULES.filter(function(m) { return m.category === cat.id; }).forEach(function(m) {
        html += '<div class="desk-nav-item" data-module="' + m.id + '">' +
                '<span class="nav-icon">' + m.icon + '</span>' +
                '<span>' + m.name + '</span>' +
                '</div>';
      });
    });
    sidebar.innerHTML = html;

    // 绑定导航点击
    var navItems = sidebar.querySelectorAll('.desk-nav-item');
    navItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var moduleId = this.getAttribute('data-module');
        Router.navigate(moduleId);
      });
    });
  }

  function renderTopbar() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;

    var today = Storage.getTodayDate();
    var dateObj = Storage.parseDate(today);
    var weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
    var dateStr = today + ' ' + weekdays[dateObj.getDay()];

    var settings = Storage.get('app_settings', { theme: 'light', defaultPage: 'home' });
    var themeIcon = settings.theme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}';

    topbar.innerHTML =
      '<span class="topbar-title">首页</span>' +
      '<div class="topbar-right">' +
        '<span class="topbar-date">' + dateStr + '</span>' +
        '<button class="btn btn-sm btn-primary" id="app-save-btn" title="保存所有数据">保存</button>' +
        '<button class="theme-toggle" id="theme-toggle-btn">' + themeIcon + '</button>' +
      '</div>';

    // 绑定保存按钮
    var saveBtn = document.getElementById('app-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        // 触发保存事件，让各模块保存数据
        if (typeof document !== 'undefined') {
          var event;
          if (typeof CustomEvent === 'function') {
            event = new CustomEvent('app:save-all');
          } else {
            event = document.createEvent('Event');
            event.initEvent('app:save-all', true, true);
          }
          document.dispatchEvent(event);
        }
        if (root.App.Toast) root.App.Toast.success('数据已保存');
      });
    }

    // 绑定主题切换
    var themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function() {
        var currentSettings = Storage.get('app_settings', { theme: 'light', defaultPage: 'home' });
        var newTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
        currentSettings.theme = newTheme;
        Storage.set('app_settings', currentSettings);
        applyTheme(newTheme);
        this.textContent = newTheme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}';
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function init() {
    // 1. 读取设置，应用主题
    var settings = Storage.get('app_settings', { theme: 'light', defaultPage: 'home' });
    applyTheme(settings.theme);

    // 2. 渲染侧边栏和顶栏
    renderSidebar();
    renderTopbar();

    // 3. 注册所有模块
    if (root.App.Home) Router.register('home', root.App.Home);
    if (root.App.Plan) Router.register('plan', root.App.Plan);
    if (root.App.Research) Router.register('research', root.App.Research);
    if (root.App.Psychology) Router.register('psychology', root.App.Psychology);
    if (root.App.Fitness) Router.register('fitness', root.App.Fitness);
    if (root.App.Cooking) Router.register('cooking', root.App.Cooking);
    if (root.App.Games) Router.register('games', root.App.Games);
    if (root.App.Settings) Router.register('settings', root.App.Settings);

    // 4. 导航到默认页
    var defaultPage = settings.defaultPage || 'home';
    if (!Router.modules[defaultPage]) defaultPage = 'home';
    Router.navigate(defaultPage);
  }

  root.App.init = init;

  // DOM ready 后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
