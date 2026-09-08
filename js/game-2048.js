// ===== 2048 游戏逻辑 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;

  var STORAGE_KEY = 'app_games';
  var SIZE = 4;

  // 游戏状态
  var grid = [];
  var score = 0;
  var bestScore = 0;
  var gameCallback = null;
  var keyListener = null;
  var mouseStartX = 0;
  var mouseStartY = 0;
  var mouseListenerStart = null;
  var mouseListenerEnd = null;
  var containerEl = null;

  // ===== 核心逻辑 =====

  function createEmptyGrid() {
    var g = [];
    for (var i = 0; i < SIZE; i++) {
      g.push([0, 0, 0, 0]);
    }
    return g;
  }

  function getGrid() {
    return grid.map(function(row) { return row.slice(); });
  }

  function getScore() {
    return score;
  }

  function getBestScore() {
    return bestScore;
  }

  function loadBestScore() {
    var games = Storage.get(STORAGE_KEY, {});
    bestScore = (games['2048'] && games['2048'].bestScore) || 0;
    return bestScore;
  }

  function saveBestScore() {
    var games = Storage.get(STORAGE_KEY, {});
    if (!games['2048']) games['2048'] = { bestScore: 0, lastScore: 0 };
    games['2048'].bestScore = bestScore;
    games['2048'].lastScore = score;
    Storage.set(STORAGE_KEY, games);
  }

  function addRandomTile() {
    var empty = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) {
          empty.push({ r: r, c: c });
        }
      }
    }
    if (empty.length === 0) return null;
    var pos = empty[Math.floor(Math.random() * empty.length)];
    grid[pos.r][pos.c] = Math.random() < 0.9 ? 2 : 4;
    return { r: pos.r, c: pos.c, value: grid[pos.r][pos.c] };
  }

  function init() {
    grid = createEmptyGrid();
    score = 0;
    addRandomTile();
    addRandomTile();
  }

  function moveLeftRow(row) {
    var filtered = row.filter(function(v) { return v !== 0; });
    var gained = 0;
    var merged = [];
    var i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        var newVal = filtered[i] * 2;
        merged.push(newVal);
        gained += newVal;
        i += 2;
      } else {
        merged.push(filtered[i]);
        i += 1;
      }
    }
    while (merged.length < SIZE) {
      merged.push(0);
    }
    var moved = false;
    for (var j = 0; j < SIZE; j++) {
      if (row[j] !== merged[j]) {
        moved = true;
        break;
      }
    }
    return { row: merged, moved: moved, gained: gained };
  }

  function rotateClockwise(g) {
    var newGrid = createEmptyGrid();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        newGrid[c][SIZE - 1 - r] = g[r][c];
      }
    }
    return newGrid;
  }

  function rotateCounterClockwise(g) {
    var newGrid = createEmptyGrid();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        newGrid[SIZE - 1 - c][r] = g[r][c];
      }
    }
    return newGrid;
  }

  function rotate180(g) {
    var newGrid = createEmptyGrid();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        newGrid[SIZE - 1 - r][SIZE - 1 - c] = g[r][c];
      }
    }
    return newGrid;
  }

  function move(direction) {
    var rotatedGrid;
    var rotateBack;

    if (direction === 'left') {
      rotatedGrid = getGrid();
      rotateBack = function(g) { return g; };
    } else if (direction === 'right') {
      rotatedGrid = rotate180(getGrid());
      rotateBack = rotate180;
    } else if (direction === 'up') {
      rotatedGrid = rotateCounterClockwise(getGrid());
      rotateBack = rotateClockwise;
    } else if (direction === 'down') {
      rotatedGrid = rotateClockwise(getGrid());
      rotateBack = rotateCounterClockwise;
    } else {
      return false;
    }

    var moved = false;
    var totalGained = 0;
    var newGrid = [];

    for (var r = 0; r < SIZE; r++) {
      var result = moveLeftRow(rotatedGrid[r]);
      newGrid.push(result.row);
      if (result.moved) moved = true;
      totalGained += result.gained;
    }

    if (moved) {
      grid = rotateBack(newGrid);
      score += totalGained;
      if (score > bestScore) {
        bestScore = score;
      }
      addRandomTile();
      saveBestScore();
    }

    return moved;
  }

  function isGameOver() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
      }
    }
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var val = grid[r][c];
        if (c + 1 < SIZE && grid[r][c + 1] === val) return false;
        if (r + 1 < SIZE && grid[r + 1][c] === val) return false;
      }
    }
    return true;
  }

  // ===== UI =====

  var TILE_COLORS = {
    0: '', 2: 'tile-2', 4: 'tile-4', 8: 'tile-8', 16: 'tile-16',
    32: 'tile-32', 64: 'tile-64', 128: 'tile-128', 256: 'tile-256',
    512: 'tile-512', 1024: 'tile-1024', 2048: 'tile-2048'
  };

  function getTileClass(value) {
    if (value === 0) return '';
    return TILE_COLORS[value] || 'tile-super';
  }

  function renderGrid() {
    if (!containerEl) return;
    var gameArea = containerEl.querySelector('#game-2048-area');
    if (!gameArea) return;

    var html = '';
    html += '<div class="game-grid-2048">';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var val = grid[r][c];
        html += '<div class="grid-cell ' + getTileClass(val) + '">';
        if (val > 0) html += val;
        html += '</div>';
      }
    }
    html += '</div>';
    gameArea.innerHTML = html;

    var scoreEl = containerEl.querySelector('#game-2048-score');
    if (scoreEl) scoreEl.textContent = score;
    var bestEl = containerEl.querySelector('#game-2048-best');
    if (bestEl) bestEl.textContent = bestScore;
  }

  function doMove(dir) {
    var moved = move(dir);
    if (moved) {
      renderGrid();
      if (isGameOver()) {
        if (gameCallback) gameCallback.onGameOver && gameCallback.onGameOver(score, bestScore);
      }
    }
    return moved;
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
      doMove(dir);
    }
  }

  // 鼠标滑动检测
  function handleMouseDown(e) {
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
  }

  function handleMouseUp(e) {
    var dx = e.clientX - mouseStartX;
    var dy = e.clientY - mouseStartY;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);
    var threshold = 30; // 最小滑动距离

    if (absDx < threshold && absDy < threshold) return;

    if (absDx > absDy) {
      // 水平滑动
      doMove(dx > 0 ? 'right' : 'left');
    } else {
      // 垂直滑动
      doMove(dy > 0 ? 'down' : 'up');
    }
  }

  function start(container, callbacks) {
    containerEl = container;
    gameCallback = callbacks || {};
    loadBestScore();
    init();
    renderGrid();

    // 键盘监听
    keyListener = function(e) { handleKey(e); };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', keyListener);
    }

    // 鼠标滑动监听
    var gameArea = container.querySelector('#game-2048-area');
    if (gameArea) {
      mouseListenerStart = function(e) { handleMouseDown(e); };
      mouseListenerEnd = function(e) { handleMouseUp(e); };
      gameArea.addEventListener('mousedown', mouseListenerStart);
      gameArea.addEventListener('mouseup', mouseListenerEnd);
    }
  }

  function stop() {
    if (keyListener && typeof document !== 'undefined') {
      document.removeEventListener('keydown', keyListener);
    }
    keyListener = null;

    // 移除鼠标监听
    if (containerEl) {
      var gameArea = containerEl.querySelector('#game-2048-area');
      if (gameArea) {
        if (mouseListenerStart) gameArea.removeEventListener('mousedown', mouseListenerStart);
        if (mouseListenerEnd) gameArea.removeEventListener('mouseup', mouseListenerEnd);
      }
    }
    mouseListenerStart = null;
    mouseListenerEnd = null;

    containerEl = null;
    gameCallback = null;
  }

  function newGame() {
    init();
    renderGrid();
  }

  root.App.Game2048 = {
    init: init,
    getGrid: getGrid,
    getScore: getScore,
    getBestScore: getBestScore,
    loadBestScore: loadBestScore,
    saveBestScore: saveBestScore,
    addRandomTile: addRandomTile,
    move: move,
    isGameOver: isGameOver,
    _moveLeftRow: moveLeftRow,
    _rotateClockwise: rotateClockwise,
    _rotateCounterClockwise: rotateCounterClockwise,
    _rotate180: rotate180,
    _createEmptyGrid: createEmptyGrid,
    _setGrid: function(g) { grid = g; },
    _setScore: function(s) { score = s; },
    _setBestScore: function(s) { bestScore = s; },
    _getTileClass: getTileClass,
    start: start,
    stop: stop,
    newGame: newGame,
    renderGrid: renderGrid,
    doMove: doMove
  };
})();
