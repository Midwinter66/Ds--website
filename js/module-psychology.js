// ===== 心理学知识模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var STORAGE_KEY = 'app_psychology';
  var TAB_KEY = 'app_psychology_tab';

  // UI 状态（模块级）
  var currentTab = 'notes';       // 'notes' | 'reading'
  var currentNoteId = null;       // 当前选中的笔记 ID
  var selectedCategory = '';      // 当前筛选的分类（'' 表示全部）
  var searchKeyword = '';         // 当前搜索关键词

  // ===== 内部辅助 =====

  // 读取整体数据，保证结构合法
  function getData() {
    var d = Storage.get(STORAGE_KEY, { notes: [], reading: [] });
    if (!d || typeof d !== 'object') d = { notes: [], reading: [] };
    if (!Array.isArray(d.notes)) d.notes = [];
    if (!Array.isArray(d.reading)) d.reading = [];
    // 兼容旧数据：确保每个阅读项有 quotes 数组
    for (var i = 0; i < d.reading.length; i++) {
      if (!Array.isArray(d.reading[i].quotes)) d.reading[i].quotes = [];
    }
    return d;
  }

  function saveData(d) {
    Storage.set(STORAGE_KEY, d);
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

  function formatTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
  }

  // 标签统一处理：接受数组或逗号分隔字符串
  function parseTags(value) {
    if (Array.isArray(value)) return value.slice();
    if (typeof value !== 'string') return [];
    return value.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; });
  }

  // 按 updatedAt 倒序比较
  function byUpdatedAtDesc(a, b) {
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }

  // ===== 数据操作 =====
  var data = {
    // ---------- 知识笔记 ----------
    // 获取所有笔记，按 updatedAt 倒序
    getNotes: function() {
      var d = getData();
      return d.notes.slice().sort(byUpdatedAtDesc);
    },

    // 获取指定笔记
    getNote: function(id) {
      if (!id) return null;
      var d = getData();
      for (var i = 0; i < d.notes.length; i++) {
        if (d.notes[i].id === id) return d.notes[i];
      }
      return null;
    },

    // 创建新笔记
    addNote: function(title, category, content, tags) {
      var d = getData();
      var now = Date.now();
      var note = {
        id: Storage.generateId(),
        title: title || '',
        category: category || '',
        content: content || '',
        tags: parseTags(tags),
        createdAt: now,
        updatedAt: now
      };
      d.notes.push(note);
      saveData(d);
      return note;
    },

    // 更新笔记字段，并更新 updatedAt
    updateNote: function(id, fields) {
      if (!id || !fields) return null;
      var d = getData();
      for (var i = 0; i < d.notes.length; i++) {
        if (d.notes[i].id === id) {
          if (fields.title !== undefined) d.notes[i].title = fields.title;
          if (fields.category !== undefined) d.notes[i].category = fields.category;
          if (fields.content !== undefined) d.notes[i].content = fields.content;
          if (fields.tags !== undefined) d.notes[i].tags = parseTags(fields.tags);
          d.notes[i].updatedAt = Date.now();
          saveData(d);
          return d.notes[i];
        }
      }
      return null;
    },

    // 删除笔记
    deleteNote: function(id) {
      if (!id) return false;
      var d = getData();
      var originalLength = d.notes.length;
      d.notes = d.notes.filter(function(n) { return n.id !== id; });
      if (d.notes.length < originalLength) {
        saveData(d);
        return true;
      }
      return false;
    },

    // 获取所有分类（去重，不含空值）
    getCategories: function() {
      var d = getData();
      var cats = [];
      var seen = {};
      for (var i = 0; i < d.notes.length; i++) {
        var c = d.notes[i].category;
        if (c && !seen[c]) {
          seen[c] = true;
          cats.push(c);
        }
      }
      return cats;
    },

    // 按分类筛选笔记
    filterByCategory: function(category) {
      var d = getData();
      return d.notes.filter(function(n) {
        return n.category === category;
      }).slice().sort(byUpdatedAtDesc);
    },

    // 按关键词搜索标题和内容
    searchNotes: function(keyword) {
      if (!keyword || !String(keyword).trim()) return [];
      var kw = String(keyword).toLowerCase().trim();
      var d = getData();
      var results = [];
      for (var i = 0; i < d.notes.length; i++) {
        var n = d.notes[i];
        var title = (n.title || '').toLowerCase();
        var content = (n.content || '').toLowerCase();
        if (title.indexOf(kw) !== -1 || content.indexOf(kw) !== -1) {
          results.push(n);
        }
      }
      return results.sort(byUpdatedAtDesc);
    },

    // 返回笔记总数
    getNotesCount: function() {
      var d = getData();
      return d.notes.length;
    },

    // ---------- 阅读追踪 ----------
    // 获取所有阅读项
    getReadingList: function() {
      var d = getData();
      return d.reading.slice();
    },

    // 添加阅读项（默认进度 0，状态 unread）
    addReading: function(title, author) {
      if (!title || !String(title).trim()) return null;
      var d = getData();
      var item = {
        id: Storage.generateId(),
        title: String(title).trim(),
        author: author ? String(author).trim() : '',
        progress: 0,
        status: 'unread',
        review: '',
        quotes: [],
        createdAt: Date.now()
      };
      d.reading.push(item);
      saveData(d);
      return item;
    },

    // 更新进度，进度 100 时自动设为 finished
    updateProgress: function(id, progress) {
      if (!id) return null;
      var d = getData();
      var p = Number(progress);
      if (isNaN(p)) p = 0;
      if (p < 0) p = 0;
      if (p > 100) p = 100;
      p = Math.round(p);
      for (var i = 0; i < d.reading.length; i++) {
        if (d.reading[i].id === id) {
          d.reading[i].progress = p;
          if (p >= 100) {
            d.reading[i].progress = 100;
            d.reading[i].status = 'finished';
          } else if (p > 0) {
            d.reading[i].status = 'reading';
          } else {
            d.reading[i].status = 'unread';
          }
          saveData(d);
          return d.reading[i];
        }
      }
      return null;
    },

    // 更新读后感
    updateReview: function(id, review) {
      if (!id) return null;
      var d = getData();
      for (var i = 0; i < d.reading.length; i++) {
        if (d.reading[i].id === id) {
          d.reading[i].review = review != null ? String(review) : '';
          saveData(d);
          return d.reading[i];
        }
      }
      return null;
    },

    // 删除阅读项
    deleteReading: function(id) {
      if (!id) return false;
      var d = getData();
      var originalLength = d.reading.length;
      d.reading = d.reading.filter(function(r) { return r.id !== id; });
      if (d.reading.length < originalLength) {
        saveData(d);
        return true;
      }
      return false;
    },

    // ---------- 灵感摘抄 ----------
    // 添加灵感摘抄
    addQuote: function(readingId, text, page) {
      if (!readingId || !text || !String(text).trim()) return null;
      var d = getData();
      for (var i = 0; i < d.reading.length; i++) {
        if (d.reading[i].id === readingId) {
          var quote = {
            id: Storage.generateId(),
            text: String(text).trim(),
            page: page ? String(page).trim() : '',
            createdAt: Date.now()
          };
          d.reading[i].quotes.push(quote);
          saveData(d);
          return quote;
        }
      }
      return null;
    },

    // 删除灵感摘抄
    deleteQuote: function(readingId, quoteId) {
      if (!readingId || !quoteId) return false;
      var d = getData();
      for (var i = 0; i < d.reading.length; i++) {
        if (d.reading[i].id === readingId) {
          var originalLength = d.reading[i].quotes.length;
          d.reading[i].quotes = d.reading[i].quotes.filter(function(q) { return q.id !== quoteId; });
          if (d.reading[i].quotes.length < originalLength) {
            saveData(d);
            return true;
          }
          return false;
        }
      }
      return false;
    },

    // 获取指定书目的灵感摘抄
    getQuotes: function(readingId) {
      if (!readingId) return [];
      var d = getData();
      for (var i = 0; i < d.reading.length; i++) {
        if (d.reading[i].id === readingId) {
          return d.reading[i].quotes.slice();
        }
      }
      return [];
    },

    // 返回阅读统计 {total, reading, finished, avgProgress}
    getReadingStats: function() {
      var d = getData();
      var list = d.reading;
      var total = list.length;
      var reading = 0;
      var finished = 0;
      var progressSum = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i].status === 'reading') reading++;
        if (list[i].status === 'finished') finished++;
        progressSum += Number(list[i].progress) || 0;
      }
      var avgProgress = total > 0 ? Math.round(progressSum / total) : 0;
      return {
        total: total,
        reading: reading,
        finished: finished,
        avgProgress: avgProgress
      };
    }
  };

  // ===== UI 渲染 =====

  function renderTabs() {
    var html = '<div class="tabs">';
    html += '<div class="tab' + (currentTab === 'notes' ? ' active' : '') + '" data-tab="notes">知识笔记</div>';
    html += '<div class="tab' + (currentTab === 'reading' ? ' active' : '') + '" data-tab="reading">阅读追踪</div>';
    html += '</div>';
    return html;
  }

  function renderChip(label, cat) {
    var active = selectedCategory === cat;
    var bg = active ? 'var(--accent)' : 'var(--bg-hover)';
    var color = active ? '#fff' : 'var(--text-secondary)';
    return '<span class="cat-chip' + (active ? ' active' : '') + '" data-cat="' + escapeAttr(cat) + '" ' +
      'style="padding:4px 10px;border-radius:12px;font-size:12px;cursor:pointer;background:' + bg + ';color:' + color + ';">' +
      escapeHtml(label) + '</span>';
  }

  function renderCategories() {
    var cats = data.getCategories();
    var html = '<div class="flex" style="flex-wrap:wrap;gap:6px;">';
    html += renderChip('全部', '');
    cats.forEach(function(c) {
      html += renderChip(c, c);
    });
    html += '</div>';
    return html;
  }

  function renderReadingItem(r) {
    var statusMap = { unread: '未开始', reading: '阅读中', finished: '已读完' };
    var statusText = statusMap[r.status] || r.status;
    var statusClass = r.status === 'finished' ? 'text-success' : (r.status === 'reading' ? 'text-secondary' : 'text-muted');

    var html = '<div class="card mb-12" data-reading-id="' + escapeAttr(r.id) + '">';
    html += '<div class="flex items-center justify-between mb-12">';
    html += '<div>';
    html += '<div style="font-size:16px;font-weight:600;">' + escapeHtml(r.title) + '</div>';
    if (r.author) {
      html += '<div class="text-muted" style="font-size:13px;">' + escapeHtml(r.author) + '</div>';
    }
    html += '</div>';
    html += '<select class="psy-status-select" data-reading-id="' + escapeAttr(r.id) + '" style="font-size:13px;padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-input);">';
    html += '<option value="unread"' + (r.status === 'unread' ? ' selected' : '') + '>未开始</option>';
    html += '<option value="reading"' + (r.status === 'reading' ? ' selected' : '') + '>阅读中</option>';
    html += '<option value="finished"' + (r.status === 'finished' ? ' selected' : '') + '>已读完</option>';
    html += '</select>';
    html += '</div>';

    // 灵感摘抄区域
    html += '<div class="mb-12">';
    html += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">灵感摘抄</div>';

    // 添加摘抄表单
    html += '<div class="form-group">';
    html += '<textarea class="psy-quote-input" data-reading-id="' + escapeAttr(r.id) + '" placeholder="抄下书中启发你的话语..." style="width:100%;min-height:60px;"></textarea>';
    html += '<div class="flex items-center gap-12" style="margin-top:8px;">';
    html += '<input type="text" class="psy-quote-page" data-reading-id="' + escapeAttr(r.id) + '" placeholder="页码（选填）" style="width:120px;" />';
    html += '<button class="btn btn-primary btn-sm psy-add-quote" data-reading-id="' + escapeAttr(r.id) + '">添加摘抄</button>';
    html += '</div>';
    html += '</div>';

    // 摘抄列表
    var quotes = r.quotes || [];
    if (quotes.length > 0) {
      html += '<div class="psy-quote-list" data-reading-id="' + escapeAttr(r.id) + '">';
      quotes.forEach(function(q) {
        html += '<div class="mb-8" style="background:var(--bg-hover);padding:12px;border-radius:var(--radius-sm);border-left:3px solid var(--accent);" data-quote-id="' + escapeAttr(q.id) + '">';
        html += '<div style="font-size:14px;line-height:1.6;">' + escapeHtml(q.text) + '</div>';
        if (q.page) {
          html += '<div class="text-muted" style="font-size:12px;margin-top:4px;">第 ' + escapeHtml(q.page) + ' 页</div>';
        }
        html += '<div class="flex justify-end" style="margin-top:4px;">';
        html += '<button class="btn btn-danger btn-sm psy-delete-quote" data-reading-id="' + escapeAttr(r.id) + '" data-quote-id="' + escapeAttr(q.id) + '">删除</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="text-muted" style="font-size:13px;padding:8px 0;">还没有摘抄，记录下书中启发你的话语吧</div>';
    }
    html += '</div>';

    // 读后感
    html += '<div class="form-group">';
    html += '<label class="form-label">读后感</label>';
    html += '<textarea class="psy-review-input" data-reading-id="' + escapeAttr(r.id) + '" placeholder="记录读后感..." style="width:100%;min-height:80px;">' + escapeHtml(r.review || '') + '</textarea>';
    html += '<div class="flex justify-end" style="margin-top:6px;">';
    html += '<button class="btn btn-sm btn-primary psy-save-review" data-reading-id="' + escapeAttr(r.id) + '">保存读后感</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="flex justify-end">';
    html += '<button class="btn btn-danger btn-sm psy-delete-reading" data-reading-id="' + escapeAttr(r.id) + '">删除</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  var ui = {
    render: function() {
      // 每次渲染从 storage 读取 Tab 状态（实现刷新后保持，同时保证测试隔离）
      currentTab = Storage.get(TAB_KEY, 'notes') || 'notes';
      if (currentTab !== 'notes' && currentTab !== 'reading') currentTab = 'notes';
      if (currentTab === 'reading') {
        return this.renderReadingPage();
      }
      return this.renderNotesPage();
    },

    renderNotesPage: function() {
      var notes = data.getNotes();

      // 校验当前选中的笔记是否仍存在
      if (currentNoteId) {
        var exists = false;
        for (var i = 0; i < notes.length; i++) {
          if (notes[i].id === currentNoteId) { exists = true; break; }
        }
        if (!exists) currentNoteId = notes.length > 0 ? notes[0].id : null;
      } else if (notes.length > 0) {
        currentNoteId = notes[0].id;
      }

      var html = '';
      html += renderTabs();
      html += '<div class="split-layout">';
      html += '<div class="split-left">';

      // 搜索框
      html += '<div class="mb-12"><input type="text" id="psy-search" placeholder="搜索笔记..." style="width:100%;" value="' + escapeAttr(searchKeyword) + '" /></div>';
      // 新建按钮
      html += '<button class="btn btn-primary btn-sm mb-12" id="psy-new-note" style="width:100%;">+ 新建笔记</button>';
      // 分类筛选
      html += '<div class="mb-12" id="psy-categories">';
      html += renderCategories();
      html += '</div>';
      // 笔记列表（可独立刷新）
      html += '<div id="psy-note-list">';
      html += this.renderNoteList();
      html += '</div>';

      html += '</div>'; // split-left

      // 右侧编辑区
      html += '<div class="split-right">';
      html += this.renderNoteEditor();
      html += '</div>'; // split-right

      html += '</div>'; // split-layout
      return html;
    },

    // 渲染笔记列表（可单独刷新，保持搜索框焦点）
    renderNoteList: function() {
      var notes;
      if (searchKeyword && String(searchKeyword).trim()) {
        notes = data.searchNotes(searchKeyword);
      } else if (selectedCategory) {
        notes = data.filterByCategory(selectedCategory);
      } else {
        notes = data.getNotes();
      }

      var html = '';
      if (notes.length === 0) {
        html += '<div class="empty-state" style="padding:24px 8px;"><div class="empty-state-text">';
        html += (searchKeyword && String(searchKeyword).trim()) ? '没有匹配的笔记' : '还没有笔记，点击上方按钮新建';
        html += '</div></div>';
      } else {
        notes.forEach(function(n) {
          var active = n.id === currentNoteId ? ' active' : '';
          var title = n.title && String(n.title).trim() ? n.title : '无标题';
          html += '<div class="date-list-item note-list-item' + active + '" data-note-id="' + escapeAttr(n.id) + '">';
          html += '<span class="date-dot"></span>';
          html += '<div style="flex:1;min-width:0;">';
          html += '<div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(title) + '</div>';
          html += '<div class="text-muted" style="font-size:12px;">' + escapeHtml(formatTimestamp(n.updatedAt)) + '</div>';
          html += '</div>';
          html += '</div>';
        });
      }
      return html;
    },

    // 渲染右侧编辑区
    renderNoteEditor: function() {
      var note = currentNoteId ? data.getNote(currentNoteId) : null;

      if (!note) {
        var empty = '';
        empty += '<div class="empty-state">';
        empty += '<div class="empty-state-icon">\u{1F4DD}</div>';
        empty += '<div class="empty-state-text">选择左侧笔记查看，或点击"新建笔记"开始记录</div>';
        empty += '</div>';
        return empty;
      }

      var html = '';
      html += '<div class="card">';
      // 标题
      html += '<div class="form-group">';
      html += '<input type="text" id="psy-note-title" data-field="title" data-note-id="' + escapeAttr(note.id) + '" placeholder="标题" value="' + escapeAttr(note.title) + '" style="width:100%;font-size:16px;font-weight:600;" />';
      html += '</div>';
      // 分类
      html += '<div class="form-group">';
      html += '<label class="form-label">分类</label>';
      html += '<input type="text" id="psy-note-category" data-field="category" data-note-id="' + escapeAttr(note.id) + '" value="' + escapeAttr(note.category) + '" placeholder="如：认知、情绪、行为、发展" style="width:100%;" />';
      html += '</div>';
      // 标签
      html += '<div class="form-group">';
      html += '<label class="form-label">标签（逗号分隔）</label>';
      html += '<input type="text" id="psy-note-tags" data-field="tags" data-note-id="' + escapeAttr(note.id) + '" value="' + escapeAttr((note.tags || []).join(', ')) + '" style="width:100%;" />';
      html += '</div>';
      // 内容
      html += '<div class="form-group">';
      html += '<label class="form-label">内容</label>';
      html += '<textarea id="psy-note-content" data-field="content" data-note-id="' + escapeAttr(note.id) + '" style="width:100%;min-height:200px;">' + escapeHtml(note.content) + '</textarea>';
      html += '</div>';
      // 操作
      html += '<div class="flex justify-between items-center mt-12">';
      html += '<button class="btn btn-sm btn-primary" id="psy-save-note" data-note-id="' + escapeAttr(note.id) + '">保存笔记</button>';
      html += '<button class="btn btn-danger btn-sm" id="psy-delete-note" data-note-id="' + escapeAttr(note.id) + '">删除笔记</button>';
      html += '</div>';
      html += '</div>';
      return html;
    },

    renderReadingPage: function() {
      var list = data.getReadingList();
      var html = '';
      html += renderTabs();

      // 添加按钮
      html += '<div class="mb-20">';
      html += '<button class="btn btn-primary btn-sm" id="psy-add-reading">+ 添加书目</button>';
      html += '</div>';

      // 添加表单（默认隐藏）
      html += '<div class="card mb-20 hidden" id="psy-reading-form">';
      html += '<div class="form-row">';
      html += '<input type="text" id="psy-reading-title" placeholder="书名（必填）" style="flex:1;" />';
      html += '<input type="text" id="psy-reading-author" placeholder="作者（选填）" style="flex:1;" />';
      html += '<button class="btn btn-primary" id="psy-reading-save">添加</button>';
      html += '<button class="btn btn-secondary" id="psy-reading-cancel">取消</button>';
      html += '</div>';
      html += '</div>';

      // 书目列表
      if (list.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">\u{1F4DA}</div><div class="empty-state-text">还没有书目，点击"添加书目"开始追踪阅读进度</div></div>';
      } else {
        list.forEach(function(r) {
          html += renderReadingItem(r);
        });
      }
      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // Tab 切换
      var tabs = document.querySelectorAll('.tab[data-tab]');
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          currentTab = this.getAttribute('data-tab');
          Storage.set(TAB_KEY, currentTab);
          // 切换 Tab 时重置笔记侧状态
          currentNoteId = null;
          selectedCategory = '';
          searchKeyword = '';
          self.refresh();
        });
      });

      if (currentTab === 'reading') {
        this.bindReadingEvents();
      } else {
        this.bindNotesEvents();
      }
    },

    bindNotesEvents: function() {
      var self = this;

      // 新建笔记
      var newBtn = document.getElementById('psy-new-note');
      if (newBtn) {
        newBtn.addEventListener('click', function() {
          var note = data.addNote('', '', '', []);
          currentNoteId = note.id;
          searchKeyword = '';
          selectedCategory = '';
          self.refresh();
          if (Toast) Toast.success('已创建');
        });
      }

      // 搜索框输入
      var searchInput = document.getElementById('psy-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          searchKeyword = this.value;
          self.refreshNoteList();
        });
      }

      // 分类筛选
      self.bindCategoryEvents();

      // 笔记列表点击
      self.bindNoteListEvents();

      // 编辑字段失焦自动保存
      var fields = document.querySelectorAll('[data-field][data-note-id]');
      fields.forEach(function(fieldEl) {
        fieldEl.addEventListener('blur', function() {
          var noteId = this.getAttribute('data-note-id');
          var fieldName = this.getAttribute('data-field');
          var updateFields = {};
          if (fieldName === 'tags') {
            updateFields.tags = parseTags(this.value);
          } else {
            updateFields[fieldName] = this.value;
          }
          data.updateNote(noteId, updateFields);
        });
      });

      // 手动保存笔记按钮
      var saveNoteBtn = document.getElementById('psy-save-note');
      if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', function() {
          var noteId = this.getAttribute('data-note-id');
          var titleEl = document.querySelector('[data-field="title"][data-note-id="' + noteId + '"]');
          var categoryEl = document.querySelector('[data-field="category"][data-note-id="' + noteId + '"]');
          var tagsEl = document.querySelector('[data-field="tags"][data-note-id="' + noteId + '"]');
          var contentEl = document.querySelector('[data-field="content"][data-note-id="' + noteId + '"]');
          var updateFields = {};
          if (titleEl) updateFields.title = titleEl.value;
          if (categoryEl) updateFields.category = categoryEl.value;
          if (tagsEl) updateFields.tags = parseTags(tagsEl.value);
          if (contentEl) updateFields.content = contentEl.value;
          data.updateNote(noteId, updateFields);
          if (Toast) Toast.success('笔记已保存');
        });
      }

      // 删除笔记
      var delBtn = document.getElementById('psy-delete-note');
      if (delBtn) {
        delBtn.addEventListener('click', function() {
          var noteId = this.getAttribute('data-note-id');
          if (confirm('确定删除这篇笔记吗？')) {
            data.deleteNote(noteId);
            currentNoteId = null;
            if (Toast) Toast.info('已删除');
            self.refresh();
          }
        });
      }
    },

    bindCategoryEvents: function() {
      var self = this;
      var chips = document.querySelectorAll('.cat-chip');
      chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
          selectedCategory = this.getAttribute('data-cat');
          searchKeyword = '';
          self.refresh();
        });
      });
    },

    bindNoteListEvents: function() {
      var self = this;
      var items = document.querySelectorAll('.note-list-item');
      items.forEach(function(item) {
        item.addEventListener('click', function() {
          currentNoteId = this.getAttribute('data-note-id');
          self.refresh();
        });
      });
    },

    bindReadingEvents: function() {
      var self = this;

      // 显示添加表单
      var addBtn = document.getElementById('psy-add-reading');
      if (addBtn) {
        addBtn.addEventListener('click', function() {
          var form = document.getElementById('psy-reading-form');
          if (form) form.classList.remove('hidden');
          var titleInput = document.getElementById('psy-reading-title');
          if (titleInput) titleInput.focus();
        });
      }

      // 取消添加
      var cancelBtn = document.getElementById('psy-reading-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          var form = document.getElementById('psy-reading-form');
          if (form) form.classList.add('hidden');
          var titleInput = document.getElementById('psy-reading-title');
          if (titleInput) titleInput.value = '';
          var authorInput = document.getElementById('psy-reading-author');
          if (authorInput) authorInput.value = '';
        });
      }

      // 保存添加
      var saveBtn = document.getElementById('psy-reading-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          var titleInput = document.getElementById('psy-reading-title');
          var authorInput = document.getElementById('psy-reading-author');
          var title = titleInput ? titleInput.value : '';
          var author = authorInput ? authorInput.value : '';
          if (title && title.trim()) {
            data.addReading(title, author);
            if (Toast) Toast.success('已添加');
            self.refresh();
          } else {
            if (Toast) Toast.error('请填写书名');
          }
        });
      }

      // 状态选择
      var statusSelects = document.querySelectorAll('.psy-status-select');
      statusSelects.forEach(function(sel) {
        sel.addEventListener('change', function() {
          var id = this.getAttribute('data-reading-id');
          var status = this.value;
          var progress = status === 'finished' ? 100 : (status === 'reading' ? 50 : 0);
          data.updateProgress(id, progress);
          if (Toast) Toast.success('状态已更新');
          self.refresh();
        });
      });

      // 添加摘抄
      var addQuoteBtns = document.querySelectorAll('.psy-add-quote');
      addQuoteBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var readingId = this.getAttribute('data-reading-id');
          var quoteInput = document.querySelector('.psy-quote-input[data-reading-id="' + readingId + '"]');
          var pageInput = document.querySelector('.psy-quote-page[data-reading-id="' + readingId + '"]');
          var text = quoteInput ? quoteInput.value : '';
          var page = pageInput ? pageInput.value : '';
          if (text && text.trim()) {
            data.addQuote(readingId, text, page);
            if (Toast) Toast.success('已添加摘抄');
            self.refresh();
          } else {
            if (Toast) Toast.error('请输入摘抄内容');
          }
        });
      });

      // 删除摘抄
      var delQuoteBtns = document.querySelectorAll('.psy-delete-quote');
      delQuoteBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var readingId = this.getAttribute('data-reading-id');
          var quoteId = this.getAttribute('data-quote-id');
          if (confirm('确定删除这条摘抄吗？')) {
            data.deleteQuote(readingId, quoteId);
            if (Toast) Toast.info('已删除');
            self.refresh();
          }
        });
      });

      // 读后感失焦保存
      var reviews = document.querySelectorAll('.psy-review-input');
      reviews.forEach(function(review) {
        review.addEventListener('blur', function() {
          var id = this.getAttribute('data-reading-id');
          data.updateReview(id, this.value);
        });
      });

      // 读后感手动保存按钮
      var saveReviewBtns = document.querySelectorAll('.psy-save-review');
      saveReviewBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = this.getAttribute('data-reading-id');
          var reviewEl = document.querySelector('.psy-review-input[data-reading-id="' + id + '"]');
          var reviewText = reviewEl ? reviewEl.value : '';
          data.updateReview(id, reviewText);
          if (Toast) Toast.success('读后感已保存');
        });
      });

      // 删除书目
      var delBtns = document.querySelectorAll('.psy-delete-reading');
      delBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = this.getAttribute('data-reading-id');
          if (confirm('确定删除这本书吗？')) {
            data.deleteReading(id);
            if (Toast) Toast.info('已删除');
            self.refresh();
          }
        });
      });
    },

    // 刷新整个页面
    refresh: function() {
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = this.render();
        this.bindEvents();
      }
    },

    // 仅刷新笔记列表（保持搜索框焦点）
    refreshNoteList: function() {
      var container = document.getElementById('psy-note-list');
      if (container) {
        container.innerHTML = this.renderNoteList();
        this.bindNoteListEvents();
      }
    }
  };

  root.App.Psychology = {
    // 数据接口
    getNotes: data.getNotes,
    getNote: data.getNote,
    addNote: data.addNote,
    updateNote: data.updateNote,
    deleteNote: data.deleteNote,
    getCategories: data.getCategories,
    filterByCategory: data.filterByCategory,
    searchNotes: data.searchNotes,
    getNotesCount: data.getNotesCount,
    getReadingList: data.getReadingList,
    addReading: data.addReading,
    updateProgress: data.updateProgress,
    updateReview: data.updateReview,
    deleteReading: data.deleteReading,
    addQuote: data.addQuote,
    deleteQuote: data.deleteQuote,
    getQuotes: data.getQuotes,
    getReadingStats: data.getReadingStats,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui)
  };
})();
