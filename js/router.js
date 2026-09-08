// ===== Router: 模块切换 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};

  root.App.Router = {
    current: null,
    modules: {},

    register: function(name, module) {
      this.modules[name] = module;
    },

    navigate: function(name) {
      if (!this.modules[name]) return;
      this.current = name;

      // 更新侧边栏高亮
      var navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(function(item) {
        if (item.getAttribute('data-module') === name) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // 渲染模块内容
      var module = this.modules[name];
      var main = document.getElementById('main');
      if (main && module && typeof module.render === 'function') {
        main.innerHTML = module.render();
        if (typeof module.afterRender === 'function') {
          module.afterRender();
        }
      }

      // 更新顶栏标题
      var titleEl = document.querySelector('.topbar-title');
      if (titleEl) {
        titleEl.textContent = this.getModuleTitle(name);
      }
    },

    getModuleTitle: function(name) {
      var titles = {
        home: '首页',
        plan: '今日计划',
        research: '科研进展',
        psychology: '心理学知识',
        fitness: '健身计划',
        games: '游戏娱乐',
        settings: '数据和设置'
      };
      return titles[name] || '';
    },

    getCurrent: function() {
      return this.current;
    }
  };
})();
