// ===== 便签模块（Markdown 速记，存 Supabase，本人私有）=====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;
  var Cloud = root.App.CloudStore;

  var notes = [];
  var filterTag = null;
  var searchKw = '';

  var COLORS = ['default', 'yellow', 'green', 'blue', 'pink'];
  var COLOR_LABEL = { default: '白', yellow: '黄', green: '绿', blue: '蓝', pink: '粉' };

  /* ---------------- Markdown ---------------- */
  function renderMd(md) {
    if (!md) return '';
    try {
      if (root.marked) {
        var raw = root.marked.parse(md, { breaks: true, gfm: true });
        if (root.DOMPurify) raw = root.DOMPurify.sanitize(raw);
        return raw;
      }
    } catch (e) {}
    return '<p>' + escapeHtml(md).replace(/\n/g, '<br>') + '</p>';
  }

  /* ---------------- 数据 ---------------- */
  function api() { return Cloud.isReady() ? Cloud.getClient() : null; }

  function fetchAll() {
    var c = api();
    if (!c) { notes = []; return Promise.resolve(notes); }
    return c.from('notes').select('*').order('created_at', { ascending: false })
      .then(function (r) { if (r.error) throw r.error; notes = r.data || []; return notes; });
  }

  function createNote(text, tags, color) {
    var c = api();
    if (!c) return Promise.reject(new Error('未登录'));
    var uid = Cloud.getState().user.id;
    return c.from('notes').insert({
      user_id: uid, content_md: text,
      tags: parseTags(tags), color: color || 'default'
    }).select().single().then(function (r) {
      if (r.error) throw r.error; return r.data;
    });
  }

  function updateNote(id, patch) {
    var c = api();
    if (!c) return Promise.reject(new Error('未登录'));
    var uid = Cloud.getState().user.id;
    return c.from('notes').update(patch).eq('id', id).eq('user_id', uid)
      .then(function (r) { if (r.error) throw r.error; return true; });
  }

  function deleteNote(id) {
    var c = api();
    if (!c) return Promise.reject(new Error('未登录'));
    var uid = Cloud.getState().user.id;
    return c.from('notes').delete().eq('id', id).eq('user_id', uid)
      .then(function (r) { if (r.error) throw r.error; return true; });
  }

  function parseTags(s) {
    if (!s) return [];
    return s.split(/[,，\s]+/).map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; });
  }

  function allTags() {
    var set = {};
    notes.forEach(function (n) { (n.tags || []).forEach(function (t) { set[t] = (set[t] || 0) + 1; }); });
    return Object.keys(set).map(function (t) { return { tag: t, count: set[t] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function filtered() {
    return notes.filter(function (n) {
      if (filterTag && (n.tags || []).indexOf(filterTag) < 0) return false;
      if (searchKw) {
        var hay = (n.content_md || '').toLowerCase() + ' ' + (n.tags || []).join(' ').toLowerCase();
        if (hay.indexOf(searchKw) < 0) return false;
      }
      return true;
    });
  }

  /* ---------------- UI ---------------- */
  var ui = {
    render: function () { return this.renderPage(); },

    renderPage: function () {
      if (!Cloud.isReady()) {
        return '<div class="empty-state"><div class="empty-state-icon">\u{1F511}</div>' +
          '<div class="empty-state-text">便签私有存储，需要先登录。打开「数据和设置」注册/登录后即可使用。</div></div>';
      }
      var html = '';
      // 新建条
      html += '<div class="card mb-20 note-composer">';
      html += '<textarea id="note-input" class="editor-textarea note-input" rows="3" placeholder="记一笔…  支持 Markdown"></textarea>';
      html += '<div class="note-composer-row">';
      html += '<input type="text" id="note-tags" class="form-input" placeholder="标签，逗号分隔" style="flex:1;">';
      html += '<select id="note-color" class="form-input" style="width:90px;">';
      COLORS.forEach(function (c) {
        html += '<option value="' + c + '">' + COLOR_LABEL[c] + '</option>';
      });
      html += '</select>';
      html += '<button class="btn btn-primary" id="note-add">记下</button>';
      html += '</div>';
      html += '</div>';

      // 标签 + 搜索
      var tags = allTags();
      if (tags.length || filterTag || searchKw) {
        html += '<div class="note-toolbar mb-20">';
        html += '<div class="note-tags">';
        if (filterTag) {
          html += '<span class="note-tag-chip active" data-tag="">全部 ×</span>';
        }
        tags.forEach(function (t) {
          var active = t.tag === filterTag ? ' active' : '';
          html += '<span class="note-tag-chip' + active + '" data-tag="' + escapeAttr(t.tag) + '">#' + escapeHtml(t.tag) + ' <em>' + t.count + '</em></span>';
        });
        html += '</div>';
        html += '<input type="text" id="note-search" class="form-input note-search" placeholder="搜便签…" value="' + escapeAttr(searchKw) + '">';
        html += '</div>';
      }

      var list = filtered();
      html += '<div class="section-title">便签 (' + list.length + ')</div>';
      if (list.length === 0) {
        html += '<div class="empty-state"><div class="empty-state-icon">\u{1F4DD}</div>';
        html += '<div class="empty-state-text">' + (notes.length ? '当前筛选下没有便签' : '还没有便签，记下第一条吧') + '</div></div>';
      } else {
        html += '<div class="notes-grid">';
        list.forEach(function (n) { html += renderNoteCard(n); });
        html += '</div>';
      }
      return html;
    },

    afterRender: function () { this.bindEvents(); },

    bindEvents: function () {
      var self = this;
      var input = document.getElementById('note-input');
      var tagsI = document.getElementById('note-tags');
      var colorS = document.getElementById('note-color');
      var addBtn = document.getElementById('note-add');

      function doAdd() {
        var text = input.value.trim();
        if (!text) { Toast.error('写点什么再记'); return; }
        addBtn.disabled = true;
        createNote(text, tagsI.value, colorS.value).then(function () {
          Toast.success('已记下');
          input.value = ''; tagsI.value = '';
          return fetchAll();
        }).then(function () { self.refresh(); })
          .catch(function (e) {
            Toast.error(e.message || '保存失败');
            addBtn.disabled = false;
          });
      }
      if (addBtn) addBtn.addEventListener('click', doAdd);
      if (input) input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doAdd();
      });

      var searchI = document.getElementById('note-search');
      if (searchI) searchI.addEventListener('input', function () {
        searchKw = searchI.value.trim().toLowerCase();
        self.refresh();
        var ns = document.getElementById('note-search');
        if (ns) { ns.focus(); ns.value = searchKw; }
      });

      var chips = document.querySelectorAll('.note-tag-chip');
      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          filterTag = c.getAttribute('data-tag') || null;
          self.refresh();
        });
      });

      var delBtns = document.querySelectorAll('.note-del');
      delBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-id');
          if (!confirm('删除这条便签？')) return;
          deleteNote(id).then(function () { return fetchAll(); })
            .then(function () { self.refresh(); Toast.info('已删'); })
            .catch(function (e) { Toast.error(e.message || '删除失败'); });
        });
      });

      var editBtns = document.querySelectorAll('.note-edit');
      editBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-id');
          openEditor(id, self);
        });
      });
    },

    refresh: function () {
      var main = document.getElementById('main');
      if (main) { main.innerHTML = this.renderPage(); this.bindEvents(); }
    }
  };

  function renderNoteCard(n) {
    var body = renderMd(n.content_md);
    var tagsHtml = (n.tags || []).map(function (t) {
      return '<span class="note-card-tag">#' + escapeHtml(t) + '</span>';
    }).join('');
    return '<div class="note-card color-' + (n.color || 'default') + '" data-id="' + n.id + '">' +
      '<div class="note-card-body">' + body + '</div>' +
      (tagsHtml ? '<div class="note-card-tags">' + tagsHtml + '</div>' : '') +
      '<div class="note-card-foot">' +
        '<span class="note-card-date">' + formatDate(n.created_at) + '</span>' +
        '<span>' +
          '<button class="btn btn-sm btn-secondary note-edit" data-id="' + n.id + '">改</button> ' +
          '<button class="btn btn-sm btn-danger note-del" data-id="' + n.id + '">删</button>' +
        '</span>' +
      '</div>' +
    '</div>';
  }

  function openEditor(id, ctx) {
    var n = notes.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-head"><span>编辑便签</span><button class="modal-x">×</button></div>' +
        '<div class="modal-body">' +
          '<textarea id="note-edit-content" class="editor-textarea" rows="8">' + escapeHtml(n.content_md) + '</textarea>' +
          '<div class="form-row mt-12">' +
            '<input type="text" id="note-edit-tags" class="form-input" placeholder="标签" value="' + escapeAttr((n.tags || []).join(', ')) + '" style="flex:1;">' +
            '<select id="note-edit-color" class="form-input" style="width:90px;">' +
              COLORS.map(function (c) {
                return '<option value="' + c + '"' + (n.color === c ? ' selected' : '') + '>' + COLOR_LABEL[c] + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-secondary" id="note-edit-cancel">取消</button>' +
          '<button class="btn btn-primary" id="note-edit-save">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.classList.add('visible');
    function close() { modal.classList.remove('visible'); setTimeout(function () { document.body.removeChild(modal); }, 200); }
    modal.querySelector('.modal-x').addEventListener('click', close);
    modal.querySelector('#note-edit-cancel').addEventListener('click', close);
    modal.querySelector('#note-edit-save').addEventListener('click', function () {
      var content = modal.querySelector('#note-edit-content').value;
      var tags = modal.querySelector('#note-edit-tags').value;
      var color = modal.querySelector('#note-edit-color').value;
      updateNote(id, { content_md: content, tags: parseTags(tags), color: color })
        .then(function () { close(); return fetchAll(); })
        .then(function () { ctx.refresh(); Toast.success('已更新'); })
        .catch(function (e) { Toast.error(e.message || '保存失败'); });
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  root.App.Notes = {
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    refresh: function () { return fetchAll().then(function () { ui.refresh(); }); },
    fetchAll: fetchAll,
    _getView: function () { return 'list'; }
  };
})();
