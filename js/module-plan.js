// ===== 今日计划模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var STORAGE_KEY = 'app_tasks';
  var currentDate = null; // 当前查看的日期 YYYY-MM-DD

  // 优先级排序权重
  var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  // ===== 数据操作 =====
  var data = {
    // 获取某天的所有任务
    getTasks: function(date) {
      var all = Storage.get(STORAGE_KEY, {});
      return all[date] || [];
    },

    // 获取所有任务（跨日期）
    getAllTasks: function() {
      return Storage.get(STORAGE_KEY, {});
    },

    // 添加任务
    addTask: function(date, text, priority) {
      if (!text || !text.trim()) return null;
      var all = Storage.get(STORAGE_KEY, {});
      if (!all[date]) all[date] = [];

      var task = {
        id: Storage.generateId(),
        text: text.trim(),
        priority: priority || 'medium',
        completed: false,
        createdAt: Date.now()
      };
      all[date].push(task);
      Storage.set(STORAGE_KEY, all);
      return task;
    },

    // 切换任务完成状态
    toggleTask: function(date, taskId) {
      var all = Storage.get(STORAGE_KEY, {});
      if (!all[date]) return false;
      for (var i = 0; i < all[date].length; i++) {
        if (all[date][i].id === taskId) {
          all[date][i].completed = !all[date][i].completed;
          Storage.set(STORAGE_KEY, all);
          return all[date][i].completed;
        }
      }
      return false;
    },

    // 删除任务
    deleteTask: function(date, taskId) {
      var all = Storage.get(STORAGE_KEY, {});
      if (!all[date]) return false;
      var originalLength = all[date].length;
      all[date] = all[date].filter(function(t) { return t.id !== taskId; });
      if (all[date].length < originalLength) {
        Storage.set(STORAGE_KEY, all);
        return true;
      }
      return false;
    },

    // 获取进度
    getProgress: function(date) {
      var tasks = this.getTasks(date);
      if (tasks.length === 0) return { total: 0, completed: 0, percent: 0 };
      var completed = tasks.filter(function(t) { return t.completed; }).length;
      return {
        total: tasks.length,
        completed: completed,
        percent: Math.round(completed / tasks.length * 100)
      };
    },

    // 按优先级排序
    sortTasks: function(tasks) {
      return tasks.slice().sort(function(a, b) {
        // 未完成在前
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        // 按优先级
        var pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 1;
        var pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 1;
        if (pa !== pb) return pa - pb;
        // 按创建时间
        return a.createdAt - b.createdAt;
      });
    }
  };

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      if (!currentDate) currentDate = Storage.getTodayDate();
      return this.renderPage();
    },

    renderPage: function() {
      var tasks = data.getTasks(currentDate);
      var sorted = data.sortTasks(tasks);
      var progress = data.getProgress(currentDate);

      var pending = sorted.filter(function(t) { return !t.completed; });
      var completed = sorted.filter(function(t) { return t.completed; });

      var html = '';

      // 日期切换栏
      html += '<div class="flex items-center justify-between mb-20">';
      html += '<div class="flex items-center gap-12">';
      html += '<button class="btn btn-icon btn-secondary" id="plan-prev-day">&lt;</button>';
      html += '<span style="font-size:18px;font-weight:600;">' + currentDate + '</span>';
      html += '<button class="btn btn-icon btn-secondary" id="plan-next-day">&gt;</button>';
      html += '<button class="btn btn-sm btn-secondary" id="plan-today">今天</button>';
      html += '</div>';
      html += '</div>';

      // 任务输入区
      html += '<div class="card mb-20">';
      html += '<div class="form-row">';
      html += '<input type="text" id="plan-input" placeholder="输入新任务..." style="flex:1;" />';
      html += '<select id="plan-priority" style="width:100px;">';
      html += '<option value="high">高</option>';
      html += '<option value="medium" selected>中</option>';
      html += '<option value="low">低</option>';
      html += '</select>';
      html += '<button class="btn btn-primary" id="plan-add-btn">添加</button>';
      html += '</div>';
      html += '</div>';

      // 进行中任务
      html += '<div class="section-title">进行中 (' + pending.length + ')</div>';
      if (pending.length === 0 && completed.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">\u{1F4CB}</div><div class="empty-state-text">今天还没有计划，添加一个吧</div></div>';
      } else {
        html += '<div class="card mb-20">';
        pending.forEach(function(task) {
          html += renderTaskItem(task);
        });
        if (pending.length === 0) {
          html += '<div class="text-muted" style="text-align:center;padding:12px;">全部完成了！</div>';
        }
        html += '</div>';
      }

      // 已完成任务
      if (completed.length > 0) {
        html += '<div class="section-title">已完成 (' + completed.length + ')</div>';
        html += '<div class="card mb-20">';
        completed.forEach(function(task) {
          html += renderTaskItem(task);
        });
        html += '</div>';
      }

      // 进度条
      if (progress.total > 0) {
        html += '<div class="card">';
        html += '<div class="flex justify-between items-center mb-12">';
        html += '<span class="text-secondary">完成进度</span>';
        html += '<span class="text-secondary">' + progress.completed + '/' + progress.total + ' (' + progress.percent + '%)</span>';
        html += '</div>';
        html += '<div class="progress-bar"><div class="progress-fill' + (progress.percent === 100 ? ' complete' : '') + '" style="width:' + progress.percent + '%;"></div></div>';
        html += '</div>';
      }

      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // 添加任务
      var addBtn = document.getElementById('plan-add-btn');
      var input = document.getElementById('plan-input');
      var prioritySelect = document.getElementById('plan-priority');

      function doAdd() {
        var text = input.value;
        var priority = prioritySelect.value;
        if (text.trim()) {
          data.addTask(currentDate, text, priority);
          Toast.success('已添加');
          self.refresh();
        }
      }

      if (addBtn) addBtn.addEventListener('click', doAdd);
      if (input) input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doAdd();
      });

      // 日期切换
      var prevBtn = document.getElementById('plan-prev-day');
      var nextBtn = document.getElementById('plan-next-day');
      var todayBtn = document.getElementById('plan-today');

      if (prevBtn) prevBtn.addEventListener('click', function() {
        currentDate = Storage.addDays(currentDate, -1);
        self.refresh();
      });
      if (nextBtn) nextBtn.addEventListener('click', function() {
        currentDate = Storage.addDays(currentDate, 1);
        self.refresh();
      });
      if (todayBtn) todayBtn.addEventListener('click', function() {
        currentDate = Storage.getTodayDate();
        self.refresh();
      });

      // 任务勾选和删除
      var taskItems = document.querySelectorAll('.task-item');
      taskItems.forEach(function(item) {
        var taskId = item.getAttribute('data-task-id');
        var checkbox = item.querySelector('.task-checkbox');
        var delBtn = item.querySelector('.task-delete');

        if (checkbox) checkbox.addEventListener('click', function() {
          data.toggleTask(currentDate, taskId);
          self.refresh();
        });

        if (delBtn) delBtn.addEventListener('click', function() {
          if (confirm('确定删除这个任务吗？')) {
            data.deleteTask(currentDate, taskId);
            Toast.info('已删除');
            self.refresh();
          }
        });
      });
    },

    refresh: function() {
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = this.renderPage();
        this.bindEvents();
      }
    }
  };

  function renderTaskItem(task) {
    var html = '<div class="task-item flex items-center gap-12" data-task-id="' + task.id + '" style="padding:8px 0;border-bottom:1px solid var(--border);">';
    html += '<div class="task-checkbox' + (task.completed ? ' checked' : '') + '"></div>';
    html += '<span class="priority-badge priority-' + task.priority + '"></span>';
    html += '<span style="flex:1;' + (task.completed ? 'text-decoration:line-through;color:var(--text-muted);' : '') + '">' + escapeHtml(task.text) + '</span>';
    html += '<button class="btn btn-icon btn-secondary task-delete" title="删除">\u00d7</button>';
    html += '</div>';
    return html;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  root.App.Plan = {
    // 数据接口（供测试和首页调用）
    getTasks: data.getTasks,
    getAllTasks: data.getAllTasks,
    addTask: data.addTask,
    toggleTask: data.toggleTask,
    deleteTask: data.deleteTask,
    getProgress: data.getProgress,
    sortTasks: data.sortTasks,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui)
  };
})();
