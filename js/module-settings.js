// ===== 数据和设置模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var STORAGE_KEY = 'app_settings';

  var MODULE_NAMES = {
    home: '首页',
    plan: '今日计划',
    research: '科研进展',
    psychology: '心理学知识',
    fitness: '健身计划',
    cooking: '烹饪美食',
    games: '游戏娱乐',
    settings: '数据和设置'
  };

  // ===== 数据操作 =====
  var data = {
    getSettings: function() {
      return Storage.get(STORAGE_KEY, {
        theme: 'light',
        defaultPage: 'home'
      });
    },

    saveSettings: function(settings) {
      Storage.set(STORAGE_KEY, settings);
    },

    getTheme: function() {
      var settings = data.getSettings();
      return settings.theme || 'light';
    },

    setTheme: function(theme) {
      var settings = data.getSettings();
      settings.theme = theme;
      data.saveSettings(settings);
      data.applyTheme(theme);
      return theme;
    },

    applyTheme: function(theme) {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme || 'light');
      }
    },

    getDefaultPage: function() {
      var settings = data.getSettings();
      return settings.defaultPage || 'home';
    },

    setDefaultPage: function(pageId) {
      var settings = data.getSettings();
      settings.defaultPage = pageId;
      data.saveSettings(settings);
      return pageId;
    },

    getStats: function() {
      return Storage.getStats();
    },

    exportData: function() {
      return Storage.exportAll();
    },

    importData: function(jsonData) {
      try {
        var parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        Storage.importAll(parsed);
        return true;
      } catch(e) {
        return false;
      }
    },

    clearAll: function() {
      Storage.clearAll();
    }
  };

  // ===== 辅助函数 =====
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      var settings = data.getSettings();
      var stats = data.getStats();
      var html = '';

      // 主题设置
      html += '<div class="card mb-16">';
      html += '<div class="section-title">主题设置</div>';
      html += '<div class="flex items-center justify-between" style="padding:8px 0;">';
      html += '<span>外观主题</span>';
      html += '<div class="flex gap-8">';
      html += '<button class="btn btn-sm ' + (settings.theme === 'light' ? 'btn-primary' : 'btn-secondary') + '" id="settings-theme-light">浅色</button>';
      html += '<button class="btn btn-sm ' + (settings.theme === 'dark' ? 'btn-primary' : 'btn-secondary') + '" id="settings-theme-dark">深色</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';

      // 默认页设置
      html += '<div class="card mb-16">';
      html += '<div class="section-title">启动默认页</div>';
      html += '<div style="padding:8px 0;">';
      html += '<select id="settings-default-page" style="width:100%;padding:8px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;">';
      for (var key in MODULE_NAMES) {
        if (MODULE_NAMES.hasOwnProperty(key)) {
          var selected = settings.defaultPage === key ? ' selected' : '';
          html += '<option value="' + key + '"' + selected + '>' + escapeHtml(MODULE_NAMES[key]) + '</option>';
        }
      }
      html += '</select>';
      html += '<div class="text-muted" style="font-size:12px;margin-top:4px;">打开 app 时默认显示的页面</div>';
      html += '</div>';
      html += '</div>';

      // 数据统计
      html += '<div class="card mb-16">';
      html += '<div class="section-title">数据统计</div>';
      html += '<div class="stat-list">';
      html += '<div class="stat-row"><span>今日计划</span><span>' + (stats.tasks || 0) + ' 条任务</span></div>';
      html += '<div class="stat-row"><span>科研进展</span><span>' + (stats.research || 0) + ' 条日志</span></div>';
      html += '<div class="stat-row"><span>心理学笔记</span><span>' + (stats.psychologyNotes || 0) + ' 条笔记</span></div>';
      html += '<div class="stat-row"><span>阅读追踪</span><span>' + (stats.psychologyReading || 0) + ' 本书目</span></div>';
      html += '<div class="stat-row"><span>训练计划</span><span>' + (stats.fitnessPlans || 0) + ' 个计划</span></div>';
      html += '<div class="stat-row"><span>训练记录</span><span>' + (stats.fitnessHistory || 0) + ' 条记录</span></div>';
      html += '<div class="stat-row"><span>烹饪菜谱</span><span>' + (stats.cooking || 0) + ' 个菜谱</span></div>';
      html += '<div class="stat-row"><span>游戏数据</span><span>' + (stats.games || 0) + ' 个游戏</span></div>';
      html += '<div class="stat-row"><span>备忘录</span><span>' + (stats.memos || 0) + ' 条备忘</span></div>';
      html += '</div>';
      html += '</div>';

      // 数据管理
      html += '<div class="card mb-16">';
      html += '<div class="section-title">数据管理</div>';
      html += '<div style="padding:8px 0;">';
      html += '<button class="btn btn-primary" id="settings-export" style="width:100%;margin-bottom:8px;">导出数据为 JSON</button>';
      html += '<button class="btn btn-secondary" id="settings-import-btn" style="width:100%;margin-bottom:8px;">导入数据（覆盖现有）</button>';
      html += '<input type="file" id="settings-import-file" accept=".json" style="display:none;" />';
      html += '<button class="btn btn-danger" id="settings-clear" style="width:100%;">清除全部数据</button>';
      html += '</div>';
      html += '</div>';

      // 危险操作确认区
      html += '<div id="settings-confirm-area"></div>';

      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // 主题切换 - 浅色
      var lightBtn = document.getElementById('settings-theme-light');
      if (lightBtn) {
        lightBtn.addEventListener('click', function() {
          data.setTheme('light');
          if (Toast) Toast.success('已切换为浅色主题');
          self.refresh();
        });
      }

      // 主题切换 - 深色
      var darkBtn = document.getElementById('settings-theme-dark');
      if (darkBtn) {
        darkBtn.addEventListener('click', function() {
          data.setTheme('dark');
          if (Toast) Toast.success('已切换为深色主题');
          self.refresh();
        });
      }

      // 默认页设置
      var pageSelect = document.getElementById('settings-default-page');
      if (pageSelect) {
        pageSelect.addEventListener('change', function() {
          var pageId = this.value;
          data.setDefaultPage(pageId);
          if (Toast) Toast.success('默认页已设置为：' + (MODULE_NAMES[pageId] || pageId));
        });
      }

      // 导出数据
      var exportBtn = document.getElementById('settings-export');
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          self.handleExport();
        });
      }

      // 导入数据
      var importBtn = document.getElementById('settings-import-btn');
      if (importBtn) {
        importBtn.addEventListener('click', function() {
          var fileInput = document.getElementById('settings-import-file');
          if (fileInput) fileInput.click();
        });
      }

      // 文件选择
      var fileInput = document.getElementById('settings-import-file');
      if (fileInput) {
        fileInput.addEventListener('change', function(e) {
          self.handleImport(e);
        });
      }

      // 清除数据
      var clearBtn = document.getElementById('settings-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          self.handleClear();
        });
      }

      // 确认区事件
      var confirmBtn = document.getElementById('settings-confirm-yes');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
          var action = this.getAttribute('data-action');
          self.executeConfirmed(action);
        });
      }

      var cancelBtn = document.getElementById('settings-confirm-no');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          self.hideConfirm();
        });
      }
    },

    handleExport: function() {
      var exportData = data.exportData();
      var jsonStr = JSON.stringify(exportData, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'life-app-backup-' + Storage.getTodayDate() + '.json';
      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
      if (Toast) Toast.success('数据已导出');
    },

    handleImport: function(e) {
      var self = this;
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function(event) {
        var jsonData = event.target.result;
        var result = data.importData(jsonData);
        if (result) {
          if (Toast) Toast.success('数据导入成功');
          self.refresh();
        } else {
          if (Toast) Toast.error('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);

      // 重置 input 以便可以再次选择同一个文件
      e.target.value = '';
    },

    handleClear: function() {
      this.showConfirm('确定要清除全部数据吗？此操作不可撤销！', 'clear');
    },

    showConfirm: function(message, action) {
      var area = document.getElementById('settings-confirm-area');
      if (!area) return;

      var html = '';
      html += '<div class="card" style="border:2px solid var(--danger);">';
      html += '<div style="color:var(--danger);font-weight:600;margin-bottom:12px;">' + escapeHtml(message) + '</div>';
      html += '<div class="flex gap-8">';
      html += '<button class="btn btn-danger" id="settings-confirm-yes" data-action="' + escapeHtml(action) + '" style="flex:1;">确认</button>';
      html += '<button class="btn btn-secondary" id="settings-confirm-no" style="flex:1;">取消</button>';
      html += '</div>';
      html += '</div>';
      area.innerHTML = html;

      // 绑定事件
      var self = this;
      var yesBtn = document.getElementById('settings-confirm-yes');
      if (yesBtn) {
        yesBtn.addEventListener('click', function() {
          self.executeConfirmed(this.getAttribute('data-action'));
        });
      }
      var noBtn = document.getElementById('settings-confirm-no');
      if (noBtn) {
        noBtn.addEventListener('click', function() {
          self.hideConfirm();
        });
      }
    },

    executeConfirmed: function(action) {
      if (action === 'clear') {
        // 二次确认
        var area = document.getElementById('settings-confirm-area');
        if (area && area.getAttribute('data-double-confirm') !== 'true') {
          area.setAttribute('data-double-confirm', 'true');
          this.showConfirm('再次确认：所有数据将被永久删除，确定吗？', 'clear-confirmed');
          return;
        }
        data.clearAll();
        this.hideConfirm();
        if (Toast) Toast.info('所有数据已清除');
        this.refresh();
      } else if (action === 'clear-confirmed') {
        data.clearAll();
        this.hideConfirm();
        if (Toast) Toast.info('所有数据已清除');
        this.refresh();
      }
    },

    hideConfirm: function() {
      var area = document.getElementById('settings-confirm-area');
      if (area) {
        area.innerHTML = '';
        area.removeAttribute('data-double-confirm');
      }
    },

    refresh: function() {
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = this.render();
        this.bindEvents();
      }
    }
  };

  root.App.Settings = {
    // 数据接口
    getSettings: data.getSettings,
    saveSettings: data.saveSettings,
    getTheme: data.getTheme,
    setTheme: data.setTheme,
    applyTheme: data.applyTheme,
    getDefaultPage: data.getDefaultPage,
    setDefaultPage: data.setDefaultPage,
    getStats: data.getStats,
    exportData: data.exportData,
    importData: data.importData,
    clearAll: data.clearAll,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    // 仅供测试用
    _resetState: function() {}
  };
})();
