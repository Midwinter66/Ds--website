// ===== 贪吃蛇游戏逻辑 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;

  var STORAGE_KEY = 'app_games';
  var GRID_SIZE = 20;

  // 游戏状态
  var snake = [];
  var food = null;
  var direction = 'right';
  var score = 0;
  var bestScore = 0;
  var isRunning = false;
  var gameCallback = null;
  var keyListener = null;
  var timerId = null;
  var canvasEl = null;
  var ctx = null;
  var cellSize = 20;
  var speed = 150; // ms per step

  // ===== 核心逻辑 =====

  function getGridSize() {
    return GRID_SIZE;
  }

  function getSnake() {
    return snake.map(function(s) { return { x: s.x, y: s.y }; });
  }

  function getFood() {
    return food ? { x: food.x, y: food.y } : null;
  }

  function getDirection() {
    return direction;
  }

  function getScore() {
    return score;
  }

  function getBestScore() {
    return bestScore;
  }

  function getSnakeLength() {
    return snake.length;
  }

  // 从 storage 读取最高分
  function loadBestScore() {
    var games = Storage.get(STORAGE_KEY, {});
    bestScore = (games['snake'] && games['snake'].bestScore) || 0;
    return bestScore;
  }

  // 保存最高分到 storage
  function saveBestScore() {
    var games = Storage.get(STORAGE_KEY, {});
    if (!games['snake']) games['snake'] = { bestScore: 0, lastScore: 0 };
    games['snake'].bestScore = bestScore;
    games['snake'].lastScore = score;
    Storage.set(STORAGE_KEY, games);
  }

  // 生成食物（不在蛇身上）
  function generateFood() {
    var occupied = {};
    for (var i = 0; i < snake.length; i++) {
      occupied[snake[i].x + ',' + snake[i].y] = true;
    }

    var available = [];
    for (var x = 0; x < GRID_SIZE; x++) {
      for (var y = 0; y < GRID_SIZE; y++) {
        if (!occupied[x + ',' + y]) {
          available.push({ x: x, y: y });
        }
      }
    }

    if (available.length === 0) return null;
    var pos = available[Math.floor(Math.random() * available.length)];
    food = { x: pos.x, y: pos.y };
    return food;
  }

  // 初始化新游戏
  function init() {
    // 蛇从中间开始，长度 3，向右移动
    var mid = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid }
    ];
    direction = 'right';
    score = 0;
    generateFood();
  }

  // 改变方向（不能 180 度反向）
  function changeDirection(dir) {
    var opposites = {
      'left': 'right',
      'right': 'left',
      'up': 'down',
      'down': 'up'
    };
    if (dir === opposites[direction]) {
      return false;
    }
    if (dir !== 'left' && dir !== 'right' && dir !== 'up' && dir !== 'down') {
      return false;
    }
    direction = dir;
    return true;
  }

  // 检查碰撞
  function checkCollision(x, y, body) {
    // 碰墙
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      return 'wall';
    }
    // 碰自身
    for (var i = 0; i < body.length; i++) {
      if (body[i].x === x && body[i].y === y) {
        return 'self';
      }
    }
    return null;
  }

  // 移动一帧，返回 { alive: bool, ateFood: bool }
  function step() {
    if (snake.length === 0) return { alive: false, ateFood: false };

    var head = snake[0];
    var newHead;

    if (direction === 'right') {
      newHead = { x: head.x + 1, y: head.y };
    } else if (direction === 'left') {
      newHead = { x: head.x - 1, y: head.y };
    } else if (direction === 'up') {
      newHead = { x: head.x, y: head.y - 1 };
    } else if (direction === 'down') {
      newHead = { x: head.x, y: head.y + 1 };
    } else {
      return { alive: false, ateFood: false };
    }

    // 检查碰撞（不包括尾巴，因为尾巴会移动）
    var bodyToCheck = snake.slice(0, snake.length - 1);
    var collision = checkCollision(newHead.x, newHead.y, bodyToCheck);
    if (collision) {
      return { alive: false, ateFood: false, cause: collision };
    }

    // 检查是否吃到食物
    var ateFood = food && newHead.x === food.x && newHead.y === food.y;

    // 添加新头
    snake.unshift(newHead);

    if (ateFood) {
      score += 10;
      if (score > bestScore) {
        bestScore = score;
      }
      generateFood();
    } else {
      // 没吃到食物则移除尾巴
      snake.pop();
    }

    return { alive: true, ateFood: ateFood };
  }

  // ===== UI =====

  function draw() {
    if (!ctx || !canvasEl) return;
    var w = canvasEl.width;
    var h = canvasEl.height;
    cellSize = w / GRID_SIZE;

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 绘制网格背景
    ctx.fillStyle = 'var(--bg-input)';
    ctx.fillRect(0, 0, w, h);

    // 绘制食物
    if (food) {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(
        food.x * cellSize + cellSize / 2,
        food.y * cellSize + cellSize / 2,
        cellSize / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // 绘制蛇
    for (var i = 0; i < snake.length; i++) {
      var seg = snake[i];
      if (i === 0) {
        // 蛇头
        ctx.fillStyle = '#27ae60';
      } else {
        // 蛇身
        ctx.fillStyle = '#2ecc71';
      }
      ctx.fillRect(
        seg.x * cellSize + 1,
        seg.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    }
  }

  function updateScoreDisplay() {
    if (!canvasEl) return;
    var container = canvasEl.parentElement;
    if (!container) return;
    var scoreEl = container.querySelector('#game-snake-score');
    if (scoreEl) scoreEl.textContent = score;
    var bestEl = container.querySelector('#game-snake-best');
    if (bestEl) bestEl.textContent = bestScore;
    var lenEl = container.querySelector('#game-snake-length');
    if (lenEl) lenEl.textContent = snake.length;
  }

  function gameLoop() {
    var result = step();
    if (!result.alive) {
      // 游戏结束
      stop();
      saveBestScore();
      draw();
      updateScoreDisplay();
      if (gameCallback && gameCallback.onGameOver) {
        gameCallback.onGameOver(score, bestScore);
      }
      return;
    }
    draw();
    updateScoreDisplay();
  }

  function handleKey(e) {
    var keyMap = {
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'ArrowUp': 'up',
      'ArrowDown': 'down'
    };
    var dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      changeDirection(dir);
    }
  }

  function start(canvas, callbacks) {
    canvasEl = canvas;
    gameCallback = callbacks || {};
    loadBestScore();
    init();

    // 获取 2D 上下文（jsdom 不支持，需要容错）
    if (canvas && canvas.getContext) {
      try {
        ctx = canvas.getContext('2d');
      } catch(e) {
        ctx = null;
      }
    }

    draw();
    updateScoreDisplay();

    // 启动键盘监听
    keyListener = function(e) { handleKey(e); };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', keyListener);
    }

    // 启动游戏循环
    isRunning = true;
    if (typeof setInterval === 'function') {
      timerId = setInterval(gameLoop, speed);
    }
  }

  function stop() {
    isRunning = false;
    if (timerId) {
      if (typeof clearInterval === 'function') {
        clearInterval(timerId);
      }
      timerId = null;
    }
    if (keyListener && typeof document !== 'undefined') {
      document.removeEventListener('keydown', keyListener);
    }
    keyListener = null;
  }

  function newGame() {
    stop();
    init();
    draw();
    updateScoreDisplay();
    isRunning = true;
    if (typeof setInterval === 'function') {
      timerId = setInterval(gameLoop, speed);
    }
    keyListener = function(e) { handleKey(e); };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', keyListener);
    }
  }

  root.App.Snake = {
    // 核心逻辑（供测试）
    init: init,
    getSnake: getSnake,
    getFood: getFood,
    getDirection: getDirection,
    getScore: getScore,
    getBestScore: getBestScore,
    getSnakeLength: getSnakeLength,
    getGridSize: getGridSize,
    loadBestScore: loadBestScore,
    saveBestScore: saveBestScore,
    generateFood: generateFood,
    changeDirection: changeDirection,
    checkCollision: checkCollision,
    step: step,
    // 内部辅助（供测试）
    _setSnake: function(s) { snake = s.map(function(p) { return { x: p.x, y: p.y }; }); },
    _setFood: function(f) { food = f ? { x: f.x, y: f.y } : null; },
    _setDirection: function(d) { direction = d; },
    _setScore: function(s) { score = s; },
    _setBestScore: function(s) { bestScore = s; },
    _isRunning: function() { return isRunning; },
    // UI 接口
    start: start,
    stop: stop,
    newGame: newGame,
    draw: draw
  };
})();
