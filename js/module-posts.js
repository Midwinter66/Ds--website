// ===== 写作模块（博客文章，Markdown，存 Supabase）=====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;
  var Cloud = root.App.CloudStore;

  var CATEGORIES = [
    { id: 'snow',  name: '思雪', desc: '想法笔记' },
    { id: 'ice',   name: '冰研', desc: '技术研究' },
    { id: 'frost', name: '积素', desc: '知识积累' },
    { id: 'soil',  name: '冻土', desc: '进行项目' },
    { id: 'night', name: '夜翻', desc: '读书笔记' }
  ];

  var view = 'list';        // list | editor
  var editingId = null;     // 当前编辑的文章 id
  var posts = [];           // 我的所有文章
  var draft = { title: '', content_md: '', tags: '', category: 'snow', published: true };

  /* ---------------- Markdown 渲染 ---------------- */
  function renderMd(md) {
    if (!md) return '<p class="text-muted">（无内容）</p>';
    try {
      if (root.marked) {
        var raw = root.marked.parse(md, { breaks: true, gfm: true });
        if (root.DOMPurify) raw = root.DOMPurify.sanitize(raw);
        return raw;
      }
    } catch (e) { /* fallthrough */ }
    return '<p>' + escapeHtml(md).replace(/\n/g, '<br>') + '</p>';
  }

  /* ---------------- 数据层 ---------------- */
  function api() { return Cloud.isReady() ? Cloud.getClient() : null; }

  function fetchMine() {
    var c = api();
    if (!c) { posts = []; return Promise.resolve(posts); }
    return c.from('posts').select('*').order('created_at', { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        posts = r.data || [];
        return posts;
      });
  }

  function savePost(p) {
    var c = api();
    if (!c) return Promise.reject(new Error('未登录'));
    var uid = Cloud.getState().user.id;
    var payload = {
      title: p.title,
      content_md: p.content_md,
      tags: parseTags(p.tags),
      category: p.category,
      published: p.published
    };
    if (editingId) {
      return c.from('posts').update(payload).eq('id', editingId).eq('user_id', uid)
        .select().single().then(function (r) {
          if (r.error) throw r.error;
          return r.data;
        });
    }
    payload.user_id = uid;
    return c.from('posts').insert(payload).select().single().then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  function deletePost(id) {
    var c = api();
    if (!c) return Promise.reject(new Error('未登录'));
    var uid = Cloud.getState().user.id;
    return c.from('posts').delete().eq('id', id).eq('user_id', uid)
      .then(function (r) { if (r.error) throw r.error; return true; });
  }

  function togglePublish(post) {
    var c = api();
    if (!c) return Promise.reject(new Error('未登录'));
    var uid = Cloud.getState().user.id;
    return c.from('posts').update({ published: !post.published })
      .eq('id', post.id).eq('user_id', uid)
      .then(function (r) { if (r.error) throw r.error; return true; });
  }

  function parseTags(s) {
    if (!s) return [];
    return s.split(/[,，\s]+/).map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; });
  }

  /* ---------------- UI ---------------- */
  var ui = {
    render: function () { return view === 'editor' ? this.renderEditor() : this.renderList(); },

    renderList: function () {
      if (!Cloud.isReady()) {
        return needLoginHtml('写作需要先登录。打开「数据和设置」注册/登录后即可开始写文章。');
      }
      var html = '';
      html += '<div class="flex items-center justify-between mb-20">';
      html += '<div class="section-title" style="margin:0;">我的文章 (' + posts.length + ')</div>';
      html += '<button class="btn btn-primary" id="posts-new">+ 新建文章</button>';
      html += '</div>';

      if (posts.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">\u{1F4DD}</div>';
        html += '<div class="empty-state-text">还没有文章，点「新建文章」开始写第一篇</div></div>';
        return html;
      }

      html += '<div class="card">';
      posts.forEach(function (p) {
        var cat = CATEGORIES.filter(function (c) { return c.id === p.category; })[0] || CATEGORIES[0];
        var tagsHtml = (p.tags || []).map(function (t) {
          return '<span class="card-tag">#' + escapeHtml(t) + '</span>';
        }).join('');
        html += '<div class="post-row" data-id="' + p.id + '">';
        html += '<div class="post-row-main">';
        html += '<div class="post-row-title">' + escapeHtml(p.title || '(无标题)') + ' ';
        if (!p.published) html += '<span class="badge-draft">草稿</span>';
        html += '</div>';
        html += '<div class="post-row-meta">' + formatDate(p.created_at) + ' · ' + cat.name + ' · ' + (p.tags || []).length + ' 标签</div>';
        html += '<div class="post-row-tags">' + tagsHtml + '</div>';
        html += '</div>';
        html += '<div class="post-row-actions">';
        html += '<button class="btn btn-sm btn-secondary post-toggle" data-id="' + p.id + '">' + (p.published ? '撤下' : '发布') + '</button>';
        html += '<button class="btn btn-sm btn-secondary post-edit" data-id="' + p.id + '">编辑</button>';
        html += '<button class="btn btn-sm btn-danger post-del" data-id="' + p.id + '">删</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
      return html;
    },

    renderEditor: function () {
      var html = '';
      html += '<div class="flex items-center justify-between mb-20">';
      html += '<button class="btn btn-sm btn-secondary" id="posts-back">← 返回列表</button>';
      html += '<div class="flex gap-8">';
      html += '<label class="form-checkbox"><input type="checkbox" id="post-published" ' + (draft.published ? 'checked' : '') + '> 已发布</label>';
      html += '<button class="btn btn-primary" id="post-save">保存</button>';
      html += '</div>';
      html += '</div>';

      html += '<div class="card mb-20">';
      html += '<input type="text" id="post-title" class="form-input" placeholder="文章标题" value="' + escapeAttr(draft.title) + '" style="font-size:18px;font-weight:600;">';

      html += '<div class="form-row mt-12">';
      html += '<select id="post-category" class="form-input" style="width:160px;">';
      CATEGORIES.forEach(function (c) {
        html += '<option value="' + c.id + '"' + (draft.category === c.id ? ' selected' : '') + '>' + c.name + ' · ' + c.desc + '</option>';
      });
      html += '</select>';
      html += '<input type="text" id="post-tags" class="form-input" placeholder="标签，逗号分隔" value="' + escapeAttr(draft.tags) + '" style="flex:1;">';
      html += '</div>';
      html += '</div>';

      html += '<div class="editor-split">';
      html += '<div class="editor-pane"><textarea id="post-content" class="editor-textarea" placeholder="# 在这里写 Markdown&#10;&#10;支持 **加粗**、- 列表、> 引用、```代码```、[链接](url)">' + escapeHtml(draft.content_md) + '</textarea></div>';
      html += '<div class="editor-pane editor-preview" id="post-preview"></div>';
      html += '</div>';
      return html;
    },

    afterRender: function () { this.bindEvents(); },

    bindEvents: function () {
      var self = this;
      var main = document.getElementById('main');
      if (view === 'editor') { this.bindEditor(); return; }

      var newBtn = document.getElementById('posts-new');
      if (newBtn) newBtn.addEventListener('click', function () {
        editingId = null;
        draft = { title: '', content_md: '', tags: '', category: 'snow', published: true };
        view = 'editor';
        self.refresh();
      });

      var editBtns = document.querySelectorAll('.post-edit');
      editBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-id');
          var p = posts.filter(function (x) { return x.id === id; })[0];
          if (!p) return;
          editingId = p.id;
          draft = {
            title: p.title || '',
            content_md: p.content_md || '',
            tags: (p.tags || []).join(', '),
            category: p.category || 'snow',
            published: p.published !== false
          };
          view = 'editor';
          self.refresh();
        });
      });

      var delBtns = document.querySelectorAll('.post-del');
      delBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-id');
          if (!confirm('确定删除这篇文章？不可恢复。')) return;
          deletePost(id).then(function () {
            Toast.success('已删除');
            return fetchMine();
          }).then(function () { self.refresh(); })
            .catch(function (e) { Toast.error(e.message || '删除失败'); });
        });
      });

      var toggleBtns = document.querySelectorAll('.post-toggle');
      toggleBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-id');
          var p = posts.filter(function (x) { return x.id === id; })[0];
          if (!p) return;
          togglePublish(p).then(function () { return fetchMine(); })
            .then(function () { self.refresh(); Toast.success(p.published ? '已撤下' : '已发布'); })
            .catch(function (e) { Toast.error(e.message || '操作失败'); });
        });
      });
    },

    bindEditor: function () {
      var self = this;
      var titleI = document.getElementById('post-title');
      var contentT = document.getElementById('post-content');
      var tagsI = document.getElementById('post-tags');
      var catS = document.getElementById('post-category');
      var pubChk = document.getElementById('post-published');
      var preview = document.getElementById('post-preview');
      var backBtn = document.getElementById('posts-back');
      var saveBtn = document.getElementById('post-save');

      function updatePreview() {
        if (preview) preview.innerHTML = renderMd(contentT.value);
      }
      function syncDraft() {
        draft.title = titleI.value;
        draft.content_md = contentT.value;
        draft.tags = tagsI.value;
        draft.category = catS.value;
        draft.published = pubChk.checked;
      }

      updatePreview();
      if (contentT) contentT.addEventListener('input', function () { syncDraft(); updatePreview(); });
      [titleI, tagsI].forEach(function (el) {
        if (el) el.addEventListener('input', syncDraft);
      });
      if (catS) catS.addEventListener('change', syncDraft);
      if (pubChk) pubChk.addEventListener('change', syncDraft);

      if (backBtn) backBtn.addEventListener('click', function () {
        if (!confirm('放弃当前编辑返回？未保存内容会丢失。')) return;
        view = 'list';
        self.refresh();
      });

      if (saveBtn) saveBtn.addEventListener('click', function () {
        syncDraft();
        if (!draft.title.trim()) { Toast.error('请填标题'); return; }
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中…';
        savePost(draft).then(function () {
          Toast.success(editingId ? '已更新' : '已发布');
          editingId = null;
          view = 'list';
          return fetchMine();
        }).then(function () { self.refresh(); })
          .catch(function (e) {
            Toast.error(e.message || '保存失败');
            saveBtn.disabled = false;
            saveBtn.textContent = '保存';
          });
      });
    },

    refresh: function () {
      var main = document.getElementById('main');
      if (main) { main.innerHTML = this.render(); this.bindEvents(); }
    }
  };

  function needLoginHtml(msg) {
    return '<div class="empty-state"><div class="empty-state-icon">\u{1F511}</div>' +
      '<div class="empty-state-text">' + escapeHtml(msg) + '</div></div>';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  root.App.Posts = {
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    refresh: function () { return fetchMine().then(function () { ui.refresh(); }); },
    fetchMine: fetchMine,
    _getView: function () { return view; },
    _setView: function (v) { view = v; }
  };
})();
