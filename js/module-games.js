// ===== 游戏娱乐模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;
  var Game2048 = root.App.Game2048;
  var Snake = root.App.Snake;

  var STORAGE_KEY = 'app_games';

  // 当前视图状态
  var currentView = 'list'; // 'list' | '2048' | 'snake'

  // ===== 辅助函数 =====
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  // ===== 数据操作 =====
  var data = {
    getScores: function() {
      var games = Storage.get(STORAGE_KEY, {});
      return {
        '2048': {
          bestScore: (games['2048'] && games['2048'].bestScore) || 0,
          lastScore: (games['2048'] && games['2048'].lastScore) || 0
        },
        'snake': {
          bestScore: (games['snake'] && games['snake'].bestScore) || 0,
          lastScore: (games['snake'] && games['snake'].lastScore) || 0
        }
      };
    },

    getBestScore: function(gameName) {
      var scores = data.getScores();
      return scores[gameName] ? scores[gameName].bestScore : 0;
    },

    getLastScore: function(gameName) {
      var scores = data.getScores();
      return scores[gameName] ? scores[gameName].lastScore : 0;
    },

    saveScore: function(gameName, bestScore, lastScore) {
      var games = Storage.get(STORAGE_KEY, {});
      if (!games[gameName]) games[gameName] = { bestScore: 0, lastScore: 0 };
      games[gameName].bestScore = bestScore;
      games[gameName].lastScore = lastScore;
      Storage.set(STORAGE_KEY, games);
    },

    getAllScores: function() {
      return data.getScores();
    }
  };

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      if (currentView === '2048') {
        return this.render2048Game();
      }
      if (currentView === 'snake') {
        return this.renderSnakeGame();
      }
      return this.renderList();
    },

    renderList: function() {
      var scores = data.getScores();
      var html = '';

      html += '<div class="section-title">选择游戏</div>';
      html += '<div class="game-list">';

      // 2048 卡片
      html += '<div class="card game-card" id="game-card-2048">';
      html += '<div class="game-card-title">2048</div>';
      html += '<div class="game-card-desc">合并数字方块，挑战 2048</div>';
      html += '<div class="game-card-score">';
      html += '<span class="text-secondary">最高分</span>';
      html += '<span style="font-size:24px;font-weight:700;color:var(--accent);">' + scores['2048'].bestScore + '</span>';
      html += '</div>';
      html += '</div>';

      // 贪吃蛇卡片
      html += '<div class="card game-card" id="game-card-snake">';
      html += '<div class="game-card-title">贪吃蛇</div>';
      html += '<div class="game-card-desc">经典贪吃蛇，吃食物变长</div>';
      html += '<div class="game-card-score">';
      html += '<span class="text-secondary">最高分</span>';
      html += '<span style="font-size:24px;font-weight:700;color:var(--accent);">' + scores['snake'].bestScore + '</span>';
      html += '</div>';
      html += '</div>';

      html += '</div>';

      // 操作说明
      html += '<div class="card mt-16">';
      html += '<div class="section-title">操作说明</div>';
      html += '<div class="text-secondary" style="line-height:1.8;">';
      html += '<div>2048：使用方向键或鼠标滑动移动方块，相同数字合并</div>';
      html += '<div>贪吃蛇：使用方向键控制蛇的移动方向，吃红色食物变长得分</div>';
      html += '</div>';
      html += '</div>';

      return html;
    },

    render2048Game: function() {
      var scores = data.getScores();
      var html = '';

      html += '<div class="flex items-center justify-between mb-16">';
      html += '<button class="btn btn-sm btn-secondary" id="game-back-btn">&larr; 返回列表</button>';
      html += '<button class="btn btn-sm btn-primary" id="game-2048-new">新游戏</button>';
      html += '</div>';

      html += '<div class="card">';
      html += '<div class="flex justify-between items-center mb-16">';
      html += '<div>';
      html += '<span class="text-secondary" style="font-size:13px;">当前分</span>';
      html += '<span id="game-2048-score" style="font-size:24px;font-weight:700;margin-left:8px;">0</span>';
      html += '</div>';
      html += '<div>';
      html += '<span class="text-secondary" style="font-size:13px;">最高分</span>';
      html += '<span id="game-2048-best" style="font-size:24px;font-weight:700;color:var(--accent);margin-left:8px;">' + scores['2048'].bestScore + '</span>';
      html += '</div>';
      html += '</div>';
      html += '<div id="game-2048-area"></div>';
      html += '</div>';

      return html;
    },

    renderSnakeGame: function() {
      var scores = data.getScores();
      var html = '';

      html += '<div class="flex items-center justify-between mb-16">';
      html += '<button class="btn btn-sm btn-secondary" id="game-back-btn">&larr; 返回列表</button>';
      html += '<button class="btn btn-sm btn-primary" id="game-snake-new">新游戏</button>';
      html += '</div>';

      html += '<div class="card">';
      html += '<div class="flex justify-between items-center mb-16">';
      html += '<div>';
      html += '<span class="text-secondary" style="font-size:13px;">当前分</span>';
      html += '<span id="game-snake-score" style="font-size:24px;font-weight:700;margin-left:8px;">0</span>';
      html += '</div>';
      html += '<div>';
      html += '<span class="text-secondary" style="font-size:13px;">蛇长度</span>';
      html += '<span id="game-snake-length" style="font-size:24px;font-weight:700;margin-left:8px;color:var(--success);">3</span>';
      html += '</div>';
      html += '<div>';
      html += '<span class="text-secondary" style="font-size:13px;">最高分</span>';
      html += '<span id="game-snake-best" style="font-size:24px;font-weight:700;color:var(--accent);margin-left:8px;">' + scores['snake'].bestScore + '</span>';
      html += '</div>';
      html += '</div>';
      html += '<div style="text-align:center;">';
      html += '<canvas id="game-snake-canvas" width="400" height="400" style="border:1px solid var(--border);background:var(--bg-input);"></canvas>';
      html += '</div>';
      html += '</div>';

      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      if (currentView === 'list') {
        // 游戏卡片点击
        var card2048 = document.getElementById('game-card-2048');
        if (card2048) {
          card2048.addEventListener('click', function() {
            currentView = '2048';
            self.refresh();
          });
        }

        var cardSnake = document.getElementById('game-card-snake');
        if (cardSnake) {
          cardSnake.addEventListener('click', function() {
            currentView = 'snake';
            self.refresh();
          });
        }
      }

      if (currentView === '2048') {
        // 返回按钮
        var backBtn = document.getElementById('game-back-btn');
        if (backBtn) {
          backBtn.addEventListener('click', function() {
            Game2048.stop();
            currentView = 'list';
            self.refresh();
          });
        }

        // 新游戏按钮
        var newBtn = document.getElementById('game-2048-new');
        if (newBtn) {
          newBtn.addEventListener('click', function() {
            Game2048.newGame();
          });
        }

        // 启动 2048 游戏
        var main = document.getElementById('main');
        var gameArea = document.getElementById('game-2048-area');
        if (gameArea && main) {
          Game2048.start(main, {
            onGameOver: function(score, bestScore) {
              data.saveScore('2048', bestScore, score);
              if (Toast) Toast.info('游戏结束！得分：' + score);
            }
          });
        }
      }

      if (currentView === 'snake') {
        // 返回按钮
        var backBtn2 = document.getElementById('game-back-btn');
        if (backBtn2) {
          backBtn2.addEventListener('click', function() {
            Snake.stop();
            currentView = 'list';
            self.refresh();
          });
        }

        // 新游戏按钮
        var newBtn2 = document.getElementById('game-snake-new');
        if (newBtn2) {
          newBtn2.addEventListener('click', function() {
            Snake.newGame();
          });
        }

        // 启动贪吃蛇游戏
        var canvas = document.getElementById('game-snake-canvas');
        if (canvas) {
          Snake.start(canvas, {
            onGameOver: function(score, bestScore) {
              data.saveScore('snake', bestScore, score);
              if (Toast) Toast.info('游戏结束！得分：' + score);
            }
          });
        }
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

  root.App.Games = {
    // 数据接口
    getScores: data.getScores,
    getBestScore: data.getBestScore,
    getLastScore: data.getLastScore,
    saveScore: data.saveScore,
    getAllScores: data.getAllScores,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    // 离开模块时由 Router 调用：停掉定时器与键盘监听，避免后台空跑
    destroy: function() { this._resetState(); },
    // 仅供测试用
    _setView: function(v) { currentView = v; },
    _getView: function() { return currentView; },
    _resetState: function() {
      currentView = 'list';
      try { Game2048.stop(); } catch(e) {}
      try { Snake.stop(); } catch(e) {}
    }
  };
})();
