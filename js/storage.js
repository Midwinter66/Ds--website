// ===== Storage: localStorage 封装 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};

  var STORAGE_PREFIX = 'app_';

  root.App.Storage = {
    // 读取数据，key 不存在时返回 defaultValue
    get: function(key, defaultValue) {
      var raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return defaultValue;
      }
    },

    // 写入数据，自动 JSON 序列化
    set: function(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },

    // 删除单个 key
    remove: function(key) {
      localStorage.removeItem(key);
    },

    // 生成唯一 ID
    generateId: function() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    // 获取今天的日期字符串 YYYY-MM-DD
    getTodayDate: function() {
      var d = new Date();
      var month = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return d.getFullYear() + '-' + month + '-' + day;
    },

    // 格式化日期为 YYYY-MM-DD
    formatDate: function(date) {
      var d = new Date(date);
      var month = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return d.getFullYear() + '-' + month + '-' + day;
    },

    // 解析日期字符串为 Date 对象
    parseDate: function(dateStr) {
      return new Date(dateStr + 'T00:00:00');
    },

    // 日期加减天数，返回 YYYY-MM-DD
    addDays: function(dateStr, days) {
      var d = this.parseDate(dateStr);
      d.setDate(d.getDate() + days);
      return this.formatDate(d);
    },

    // 导出所有 app_ 前缀的数据
    exportAll: function() {
      var result = {};
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(STORAGE_PREFIX) === 0) {
          result[key] = localStorage.getItem(key);
        }
      }
      return result;
    },

    // 从对象导入数据（覆盖现有）
    importAll: function(data) {
      this.clearAll();
      for (var key in data) {
        if (data.hasOwnProperty(key) && key.indexOf(STORAGE_PREFIX) === 0) {
          localStorage.setItem(key, data[key]);
        }
      }
    },

    // 清除所有 app_ 前缀的数据
    clearAll: function() {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(STORAGE_PREFIX) === 0) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function(key) {
        localStorage.removeItem(key);
      });
    },

    // 统计各模块数据量
    getStats: function() {
      var stats = {};
      var tasks = this.get('app_tasks', {});
      stats.tasks = 0;
      for (var date in tasks) {
        if (tasks.hasOwnProperty(date) && Array.isArray(tasks[date])) {
          stats.tasks += tasks[date].length;
        }
      }

      var research = this.get('app_research', []);
      stats.research = Array.isArray(research) ? research.length : 0;

      var psychology = this.get('app_psychology', { notes: [], reading: [] });
      stats.psychologyNotes = (psychology.notes && Array.isArray(psychology.notes)) ? psychology.notes.length : 0;
      stats.psychologyReading = (psychology.reading && Array.isArray(psychology.reading)) ? psychology.reading.length : 0;

      var fitness = this.get('app_fitness', { plans: [], history: [] });
      stats.fitnessPlans = (fitness.plans && Array.isArray(fitness.plans)) ? fitness.plans.length : 0;
      stats.fitnessHistory = (fitness.history && Array.isArray(fitness.history)) ? fitness.history.length : 0;

      var games = this.get('app_games', {});
      stats.games = games ? Object.keys(games).length : 0;

      var cooking = this.get('app_cooking', []);
      stats.cooking = Array.isArray(cooking) ? cooking.length : 0;

      var memos = this.get('app_memos', []);
      stats.memos = Array.isArray(memos) ? memos.length : 0;

      return stats;
    }
  };
})();
