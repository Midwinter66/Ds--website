// ===== 科研进展模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var STORAGE_KEY = 'app_research';
  var currentLogId = null; // 当前查看的日志 ID
  var searchKeyword = '';  // 当前搜索关键词

  // ===== 数据操作 =====
  var data = {
    // 获取所有日志，按日期倒序排列
    getLogs: function() {
      var logs = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(logs)) return [];
      return logs.slice().sort(function(a, b) {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      });
    },

    // 获取指定日期的日志
    getLogByDate: function(date) {
      if (!date) return null;
      var logs = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(logs)) return null;
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].date === date) return logs[i];
      }
      return null;
    },

    // 创建新日志（如果当天已有日志则返回已有的）
    createLog: function(date) {
      if (!date) date = Storage.getTodayDate();
      var logs = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(logs)) logs = [];
      // 检查当天是否已有日志
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].date === date) return logs[i];
      }
      var log = {
        id: Storage.generateId(),
        date: date,
        whatDid: '',
        problems: '',
        nextPlan: ''
      };
      logs.push(log);
      Storage.set(STORAGE_KEY, logs);
      return log;
    },

    // 更新日志字段（whatDid/problems/nextPlan）
    updateLog: function(id, fields) {
      if (!id || !fields) return null;
      var logs = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(logs)) return null;
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].id === id) {
          if (fields.whatDid !== undefined) logs[i].whatDid = fields.whatDid;
          if (fields.problems !== undefined) logs[i].problems = fields.problems;
          if (fields.nextPlan !== undefined) logs[i].nextPlan = fields.nextPlan;
          Storage.set(STORAGE_KEY, logs);
          return logs[i];
        }
      }
      return null;
    },

    // 按关键词搜索所有日志的三个字段
    searchLogs: function(keyword) {
      if (!keyword || !keyword.trim()) return [];
      var kw = keyword.toLowerCase().trim();
      var logs = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(logs)) return [];
      var results = [];
      for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        var whatDid = (log.whatDid || '').toLowerCase();
        var problems = (log.problems || '').toLowerCase();
        var nextPlan = (log.nextPlan || '').toLowerCase();
        if (whatDid.indexOf(kw) !== -1 ||
            problems.indexOf(kw) !== -1 ||
            nextPlan.indexOf(kw) !== -1) {
          results.push(log);
        }
      }
      // 按日期倒序排列
      return results.sort(function(a, b) {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      });
    },

    // 获取最近一条日志（供首页摘要用）
    getLatestLog: function() {
      var logs = data.getLogs();
      if (logs.length === 0) return null;
      return logs[0];
    }
  };

  // ===== 内部辅助函数 =====

  // 根据 ID 获取日志（内部使用，不对外暴露）
  function getLogById(id) {
    if (!id) return null;
    var logs = Storage.get(STORAGE_KEY, []);
    if (!Array.isArray(logs)) return null;
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].id === id) return logs[i];
    }
    return null;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 渲染单个 textarea
  function renderTextarea(label, field, value, logId) {
    var html = '';
    html += '<div class="form-group">';
    html += '<label class="form-label">' + label + '</label>';
    html += '<textarea id="research-' + field + '" data-field="' + field + '" data-log-id="' + escapeAttr(logId) + '" style="width:100%;min-height:120px;">' + escapeHtml(value) + '</textarea>';
    html += '</div>';
    return html;
  }

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      return this.renderPage();
    },

    renderPage: function() {
      var logs = data.getLogs();

      // 如果当前没有选中的日志，且有日志，选中第一条（最新的）
      if (!currentLogId && logs.length > 0) {
        currentLogId = logs[0].id;
      }

      // 如果当前选中的日志已不存在（数据被清空等），重置
      if (currentLogId && logs.length > 0) {
        var exists = false;
        for (var i = 0; i < logs.length; i++) {
          if (logs[i].id === currentLogId) { exists = true; break; }
        }
        if (!exists) currentLogId = logs[0].id;
      } else if (logs.length === 0) {
        currentLogId = null;
      }

      var html = '';
      html += '<div class="split-layout">';

      // 左侧：搜索框 + 日期列表 + 新建按钮
      html += '<div class="split-left">';

      // 搜索框
      html += '<div class="mb-12">';
      html += '<input type="text" id="research-search" placeholder="搜索日志..." style="width:100%;" value="' + escapeAttr(searchKeyword) + '" />';
      html += '</div>';

      // 新建按钮
      html += '<button class="btn btn-primary btn-sm mb-12" id="research-new-btn" style="width:100%;">+ 新建今日日志</button>';

      // 日期列表容器（可独立刷新，不影响搜索框焦点）
      html += '<div id="research-list">';
      html += this.renderList();
      html += '</div>';

      html += '</div>'; // split-left

      // 右侧：编辑区
      html += '<div class="split-right">';
      html += this.renderEditor();
      html += '</div>'; // split-right

      html += '</div>'; // split-layout

      return html;
    },

    // 渲染日期列表（可单独刷新）
    renderList: function() {
      var logs = data.getLogs();
      var displayLogs = logs;

      // 有搜索关键词时过滤
      if (searchKeyword && searchKeyword.trim()) {
        displayLogs = data.searchLogs(searchKeyword);
      }

      var html = '';
      if (displayLogs.length === 0) {
        html += '<div class="empty-state" style="padding:24px 8px;">';
        html += '<div class="empty-state-text">';
        html += (searchKeyword && searchKeyword.trim()) ? '没有匹配的日志' : '还没有日志，点击上方按钮新建';
        html += '</div>';
        html += '</div>';
      } else {
        displayLogs.forEach(function(log) {
          var active = log.id === currentLogId ? ' active' : '';
          html += '<div class="date-list-item' + active + '" data-log-id="' + escapeAttr(log.id) + '">';
          html += '<span class="date-dot"></span>';
          html += '<span>' + escapeHtml(log.date) + '</span>';
          html += '</div>';
        });
      }
      return html;
    },

    // 渲染右侧编辑区
    renderEditor: function() {
      var currentLog = currentLogId ? getLogById(currentLogId) : null;

      if (!currentLog) {
        var html = '';
        html += '<div class="empty-state">';
        html += '<div class="empty-state-icon">\u{1F52C}</div>';
        html += '<div class="empty-state-text">选择左侧日期查看日志，或点击"新建今日日志"开始记录</div>';
        html += '</div>';
        return html;
      }

      var html = '';
      html += '<div class="card">';

      // 日期标题
      html += '<div class="flex items-center justify-between mb-16">';
      html += '<span style="font-size:18px;font-weight:600;">' + escapeHtml(currentLog.date) + '</span>';
      html += '</div>';

      // 三个文本区域
      html += renderTextarea('今天做了什么', 'whatDid', currentLog.whatDid, currentLog.id);
      html += renderTextarea('遇到的问题', 'problems', currentLog.problems, currentLog.id);
      html += renderTextarea('明日计划', 'nextPlan', currentLog.nextPlan, currentLog.id);

      // 保存按钮
      html += '<div class="flex justify-end" style="margin-top:8px;">';
      html += '<button class="btn btn-sm btn-primary" id="research-save-btn">保存日志</button>';
      html += '</div>';

      html += '</div>'; // card
      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // 新建日志按钮
      var newBtn = document.getElementById('research-new-btn');
      if (newBtn) {
        newBtn.addEventListener('click', function() {
          var today = Storage.getTodayDate();
          var log = data.createLog(today);
          currentLogId = log.id;
          searchKeyword = '';
          self.refresh();
          if (Toast) Toast.success('日志已创建');
        });
      }

      // 搜索框输入
      var searchInput = document.getElementById('research-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          searchKeyword = this.value;
          self.refreshList();
        });
      }

      // 日期列表点击
      self.bindListEvents();

      // textarea 失焦自动保存
      var textareas = document.querySelectorAll('textarea[data-field]');
      textareas.forEach(function(ta) {
        ta.addEventListener('blur', function() {
          var field = this.getAttribute('data-field');
          var logId = this.getAttribute('data-log-id');
          if (logId) {
            var fields = {};
            fields[field] = this.value;
            data.updateLog(logId, fields);
          }
        });
      });

      // 手动保存按钮
      var saveBtn = document.getElementById('research-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          var tas = document.querySelectorAll('textarea[data-field]');
          var logId = null;
          var fields = {};
          tas.forEach(function(ta) {
            var field = ta.getAttribute('data-field');
            logId = ta.getAttribute('data-log-id');
            fields[field] = ta.value;
          });
          if (logId) {
            data.updateLog(logId, fields);
            if (Toast) Toast.success('日志已保存');
          }
        });
      }
    },

    // 绑定日期列表项点击事件（可单独重绑）
    bindListEvents: function() {
      var self = this;
      var items = document.querySelectorAll('.date-list-item');
      items.forEach(function(item) {
        item.addEventListener('click', function() {
          currentLogId = this.getAttribute('data-log-id');
          self.refresh();
        });
      });
    },

    // 刷新整个页面
    refresh: function() {
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = this.renderPage();
        this.bindEvents();
      }
    },

    // 仅刷新日期列表（保持搜索框焦点）
    refreshList: function() {
      var container = document.getElementById('research-list');
      if (container) {
        container.innerHTML = this.renderList();
        this.bindListEvents();
      }
    }
  };

  root.App.Research = {
    // 数据接口
    getLogs: data.getLogs,
    getLogByDate: data.getLogByDate,
    createLog: data.createLog,
    updateLog: data.updateLog,
    searchLogs: data.searchLogs,
    getLatestLog: data.getLatestLog,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui)
  };
})();
