// ===== 首页模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var MEMO_KEY = 'app_memos';

  // ===== 备忘录数据操作 =====
  var memo = {
    getAll: function() {
      var memos = Storage.get(MEMO_KEY, []);
      if (!Array.isArray(memos)) return [];
      return memos;
    },

    add: function(text) {
      if (!text || !text.trim()) return null;
      var memos = memo.getAll();
      var item = {
        id: Storage.generateId(),
        text: text.trim(),
        createdAt: new Date().toISOString()
      };
      memos.unshift(item);
      // 只保留最近 50 条
      if (memos.length > 50) memos = memos.slice(0, 50);
      Storage.set(MEMO_KEY, memos);
      return item;
    },

    delete: function(id) {
      if (!id) return false;
      var memos = memo.getAll();
      var originalLength = memos.length;
      memos = memos.filter(function(m) { return m.id !== id; });
      if (memos.length < originalLength) {
        Storage.set(MEMO_KEY, memos);
        return true;
      }
      return false;
    },

    getRecent: function(count) {
      count = count || 5;
      var memos = memo.getAll();
      return memos.slice(0, count);
    },

    getCount: function() {
      return memo.getAll().length;
    }
  };

  // ===== 辅助函数 =====
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function getGreeting() {
    var hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
  }

  function formatDateChinese(dateStr) {
    var d = Storage.parseDate(dateStr);
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + weekdays[d.getDay()];
  }

  // ===== 摘要数据读取 =====
  var summaries = {
    // 今日计划摘要
    getPlanSummary: function() {
      var today = Storage.getTodayDate();
      var tasks = Storage.get('app_tasks', {});
      var todayTasks = tasks[today] || [];
      var pending = todayTasks.filter(function(t) { return !t.completed; });
      var completed = todayTasks.filter(function(t) { return t.completed; });
      var progress = todayTasks.length > 0 ? Math.round(completed.length / todayTasks.length * 100) : 0;

      return {
        total: todayTasks.length,
        pending: pending.length,
        completed: completed.length,
        progress: progress,
        topTasks: pending.slice(0, 5).map(function(t) {
          return { text: t.text, priority: t.priority, completed: t.completed };
        })
      };
    },

    // 科研进展摘要
    getResearchSummary: function() {
      var logs = Storage.get('app_research', []);
      if (!Array.isArray(logs) || logs.length === 0) {
        return { count: 0, latestDate: null, preview: null };
      }
      // 按日期倒序找最近一条
      var sorted = logs.slice().sort(function(a, b) {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      });
      var latest = sorted[0];
      return {
        count: logs.length,
        latestDate: latest.date,
        preview: latest.whatDid ? latest.whatDid.substring(0, 100) : ''
      };
    },

    // 心理学摘要
    getPsychologySummary: function() {
      var data = Storage.get('app_psychology', { notes: [], reading: [] });
      var notes = (data.notes && Array.isArray(data.notes)) ? data.notes : [];
      var reading = (data.reading && Array.isArray(data.reading)) ? data.reading : [];
      var inProgress = reading.filter(function(r) { return r.status === 'reading' || (r.progress > 0 && r.progress < 100); });
      var avgProgress = 0;
      if (reading.length > 0) {
        var totalProgress = reading.reduce(function(sum, r) { return sum + (r.progress || 0); }, 0);
        avgProgress = Math.round(totalProgress / reading.length);
      }
      return {
        notesCount: notes.length,
        readingCount: reading.length,
        inProgressCount: inProgress.length,
        avgProgress: avgProgress
      };
    },

    // 健身摘要
    getFitnessSummary: function() {
      var data = Storage.get('app_fitness', { plans: [], history: [], todayPlan: null });
      if (!data.todayPlan) {
        return { hasPlan: false, planName: '', total: 0, completed: 0, historyCount: 0 };
      }
      var plans = data.plans || [];
      var todayPlan = null;
      for (var i = 0; i < plans.length; i++) {
        if (plans[i].id === data.todayPlan) {
          todayPlan = plans[i];
          break;
        }
      }
      if (!todayPlan) {
        return { hasPlan: false, planName: '', total: 0, completed: 0, historyCount: 0 };
      }

      var today = Storage.getTodayDate();
      var history = data.history || [];
      var todayHistory = history.filter(function(h) { return h.date === today; });
      var completed = todayHistory.length > 0 ? todayHistory[0].completedExercises.length : 0;

      return {
        hasPlan: true,
        planName: todayPlan.name,
        total: todayPlan.exercises.length,
        completed: completed,
        historyCount: todayHistory.length
      };
    },

    // 游戏摘要
    getGamesSummary: function() {
      var games = Storage.get('app_games', {});
      return {
        '2048': (games['2048'] && games['2048'].bestScore) || 0,
        'snake': (games['snake'] && games['snake'].bestScore) || 0
      };
    }
  };

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      var today = Storage.getTodayDate();
      var html = '';

      // 顶部问候
      html += '<div class="card mb-16" style="text-align:center;padding:20px;">';
      html += '<div style="font-size:24px;font-weight:700;margin-bottom:4px;">' + escapeHtml(getGreeting()) + '！</div>';
      html += '<div class="text-secondary">' + escapeHtml(formatDateChinese(today)) + '</div>';
      html += '</div>';

      // 快速备忘录
      html += '<div class="card mb-16">';
      html += '<div class="section-title">快速备忘录</div>';
      html += '<div class="flex gap-8 mb-12">';
      html += '<input type="text" id="home-memo-input" placeholder="随手记点什么..." style="flex:1;" />';
      html += '<button class="btn btn-primary" id="home-memo-save">保存</button>';
      html += '</div>';
      html += '<div id="home-memo-list">';
      html += this.renderMemoList();
      html += '</div>';
      html += '</div>';

      // 摘要卡片网格
      html += '<div class="home-summary-grid">';

      // 今日计划摘要 - 圆环进度风格
      var planSummary = summaries.getPlanSummary();
      html += '<div class="card home-summary-card home-card-plan" data-navigate="plan">';
      html += '<div class="home-summary-title">今日计划</div>';
      if (planSummary.total === 0) {
        html += '<div class="home-summary-content text-muted">今天还没有任务</div>';
      } else {
        // 圆环进度
        html += '<div class="home-plan-ring">';
        html += '<div class="home-plan-ring-bg" style="background:conic-gradient(var(--accent) ' + planSummary.progress + '%, var(--bg-hover) ' + planSummary.progress + '%);">';
        html += '<div class="home-plan-ring-inner">';
        html += '<span style="font-size:20px;font-weight:700;color:var(--accent);">' + planSummary.progress + '%</span>';
        html += '</div></div>';
        html += '<div class="home-plan-ring-info">';
        html += '<span style="font-size:13px;color:var(--text-secondary);">' + planSummary.completed + '已完成 / ' + planSummary.pending + '待办</span>';
        html += '</div></div>';
        // 任务列表
        if (planSummary.topTasks.length > 0) {
          html += '<div class="home-summary-content" style="margin-top:8px;">';
          planSummary.topTasks.slice(0, 3).forEach(function(t) {
            var badge = t.priority === 'high' ? '<span class="priority-badge priority-high"></span>' :
                        t.priority === 'low' ? '<span class="priority-badge priority-low"></span>' :
                        '<span class="priority-badge priority-medium"></span>';
            html += '<div class="home-task-item">' + badge + escapeHtml(t.text) + '</div>';
          });
          html += '</div>';
        }
      }
      html += '</div>';

      // 科研进展摘要 - 时间线日志风格
      var researchSummary = summaries.getResearchSummary();
      html += '<div class="card home-summary-card home-card-research" data-navigate="research">';
      html += '<div class="home-summary-title">科研进展</div>';
      if (researchSummary.count === 0) {
        html += '<div class="home-summary-content text-muted">还没有记录日志</div>';
      } else {
        html += '<div class="home-research-badge">' + researchSummary.count + ' 条日志</div>';
        html += '<div class="home-summary-content" style="margin-top:8px;">';
        html += '<div class="home-research-date">' + escapeHtml(researchSummary.latestDate) + '</div>';
        html += '<div class="home-research-preview">' + escapeHtml(researchSummary.preview) + '</div>';
        html += '</div>';
      }
      html += '</div>';

      // 心理学摘要 - 双栏统计风格
      var psychSummary = summaries.getPsychologySummary();
      html += '<div class="card home-summary-card home-card-psychology" data-navigate="psychology">';
      html += '<div class="home-summary-title">心理学知识</div>';
      html += '<div class="home-psych-stats">';
      html += '<div class="home-psych-stat-box" style="background:rgba(52,152,219,0.1);">';
      html += '<div class="home-psych-stat-num" style="color:#3498db;">' + psychSummary.notesCount + '</div>';
      html += '<div class="home-psych-stat-label">笔记</div>';
      html += '</div>';
      html += '<div class="home-psych-stat-box" style="background:rgba(155,89,182,0.1);">';
      html += '<div class="home-psych-stat-num" style="color:#9b59b6;">' + psychSummary.readingCount + '</div>';
      html += '<div class="home-psych-stat-label">书目</div>';
      html += '</div>';
      html += '</div>';
      if (psychSummary.readingCount > 0) {
        html += '<div class="text-muted" style="font-size:12px;margin-top:6px;">平均进度 ' + psychSummary.avgProgress + '%</div>';
      }
      html += '</div>';

      // 健身摘要 - 分段进度风格
      var fitnessSummary = summaries.getFitnessSummary();
      html += '<div class="card home-summary-card home-card-fitness" data-navigate="fitness">';
      html += '<div class="home-summary-title">健身计划</div>';
      if (!fitnessSummary.hasPlan) {
        html += '<div class="home-summary-content text-muted">今日无训练计划</div>';
      } else {
        html += '<div class="home-fitness-badge">' + escapeHtml(fitnessSummary.planName) + '</div>';
        var fitProgress = fitnessSummary.total > 0 ? Math.round(fitnessSummary.completed / fitnessSummary.total * 100) : 0;
        // 分段进度条
        html += '<div class="home-fitness-segments">';
        for (var si = 0; si < fitnessSummary.total; si++) {
          var done = si < fitnessSummary.completed;
          html += '<div class="home-fitness-seg' + (done ? ' done' : '') + '"></div>';
        }
        html += '</div>';
        html += '<div class="text-secondary" style="font-size:12px;margin-top:6px;">' + fitnessSummary.completed + '/' + fitnessSummary.total + ' 完成 (' + fitProgress + '%)</div>';
      }
      html += '</div>';

      // 游戏摘要 - 奖牌风格
      var gamesSummary = summaries.getGamesSummary();
      html += '<div class="card home-summary-card home-card-games" data-navigate="games">';
      html += '<div class="home-summary-title">游戏娱乐</div>';
      html += '<div class="home-games-row">';
      html += '<div class="home-game-medal" style="border-color:#f39c12;">';
      html += '<div class="home-game-medal-name">2048</div>';
      html += '<div class="home-game-medal-score" style="color:#f39c12;">' + gamesSummary['2048'] + '</div>';
      html += '<div class="home-game-medal-label">最高分</div>';
      html += '</div>';
      html += '<div class="home-game-medal" style="border-color:#2ecc71;">';
      html += '<div class="home-game-medal-name">贪吃蛇</div>';
      html += '<div class="home-game-medal-score" style="color:#2ecc71;">' + gamesSummary['snake'] + '</div>';
      html += '<div class="home-game-medal-label">最高分</div>';
      html += '</div>';
      html += '</div>';
      html += '</div>';

      html += '</div>'; // end summary grid

      // 空状态引导
      var planEmpty = planSummary.total === 0;
      var researchEmpty = researchSummary.count === 0;
      var psychEmpty = psychSummary.notesCount === 0;
      var memoEmpty = memo.getCount() === 0;

      if (planEmpty && researchEmpty && psychEmpty && memoEmpty) {
        html += '<div class="card mt-16" style="text-align:center;padding:24px;">';
        html += '<div class="text-secondary">欢迎使用！各模块暂无数据，点击上方摘要卡片或侧边栏开始使用。</div>';
        html += '</div>';
      }

      return html;
    },

    renderMemoList: function() {
      var memos = memo.getRecent(5);
      if (memos.length === 0) {
        return '<div class="text-muted" style="text-align:center;padding:8px;font-size:13px;">还没有备忘</div>';
      }
      var html = '';
      memos.forEach(function(m) {
        html += '<div class="memo-item flex items-center gap-8" style="padding:6px 0;border-bottom:1px solid var(--border);">';
        html += '<span style="flex:1;font-size:13px;">' + escapeHtml(m.text) + '</span>';
        html += '<button class="btn btn-icon btn-secondary memo-del-btn" data-memo-id="' + m.id + '" title="删除">&times;</button>';
        html += '</div>';
      });
      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // 保存备忘
      var saveBtn = document.getElementById('home-memo-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          self.saveMemo();
        });
      }

      // 回车保存
      var memoInput = document.getElementById('home-memo-input');
      if (memoInput) {
        memoInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            self.saveMemo();
          }
        });
      }

      // 删除备忘
      var delBtns = document.querySelectorAll('.memo-del-btn');
      delBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = this.getAttribute('data-memo-id');
          memo.delete(id);
          self.refreshMemoList();
          if (Toast) Toast.info('已删除');
        });
      });

      // 摘要卡片点击跳转
      var cards = document.querySelectorAll('.home-summary-card[data-navigate]');
      cards.forEach(function(card) {
        card.addEventListener('click', function() {
          var target = this.getAttribute('data-navigate');
          var Router = root.App.Router;
          if (Router && Router.navigate) {
            Router.navigate(target);
          }
        });
      });
    },

    saveMemo: function() {
      var input = document.getElementById('home-memo-input');
      if (!input) return;
      var text = input.value;
      if (!text.trim()) {
        if (Toast) Toast.error('请输入内容');
        return;
      }
      memo.add(text);
      input.value = '';
      this.refreshMemoList();
      if (Toast) Toast.success('已保存');
    },

    refreshMemoList: function() {
      var listEl = document.getElementById('home-memo-list');
      if (listEl) {
        listEl.innerHTML = this.renderMemoList();
        // 重新绑定删除按钮事件
        var self = this;
        var delBtns = listEl.querySelectorAll('.memo-del-btn');
        delBtns.forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = this.getAttribute('data-memo-id');
            memo.delete(id);
            self.refreshMemoList();
            if (Toast) Toast.info('已删除');
          });
        });
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

  root.App.Home = {
    // 备忘录接口
    getMemos: memo.getAll,
    addMemo: memo.add,
    deleteMemo: memo.delete,
    getRecentMemos: memo.getRecent,
    getMemoCount: memo.getCount,
    // 摘要接口
    getPlanSummary: summaries.getPlanSummary,
    getResearchSummary: summaries.getResearchSummary,
    getPsychologySummary: summaries.getPsychologySummary,
    getFitnessSummary: summaries.getFitnessSummary,
    getGamesSummary: summaries.getGamesSummary,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    refresh: ui.refresh.bind(ui)
  };
})();
