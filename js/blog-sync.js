// ===== 博客侧：拉取已发布文章注入首页时间线 + 详情模态 =====
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};

  var MONTH_CN = ['', '01月', '02月', '03月', '04月', '05月', '06月', '07月', '08月', '09月', '10月', '11月', '12月'];

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

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  // 取匿名只读 client；未配置/SDK 没加载则静默退出
  function client() {
    var Cloud = root.App.CloudStore;
    if (!Cloud) return null;
    return Cloud.getAnonClient ? Cloud.getAnonClient() : null;
  }

  // 拉取已发布文章
  function fetchPublished() {
    var c = client();
    if (!c) return Promise.resolve([]);
    return c.from('posts').select('id,title,content_md,tags,category,created_at')
      .eq('published', true).order('created_at', { ascending: false })
      .then(function (r) { return (r && r.data) || []; })
      .catch(function () { return []; });
  }

  // 把单篇文章注入时间线，返回创建的卡片节点
  function injectPost(post) {
    var timeline = document.getElementById('timeline');
    if (!timeline) return null;

    var d = new Date(post.created_at);
    if (isNaN(d)) return null;
    var year = String(d.getFullYear());
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var monthKey = year + '-' + mm;
    var day = String(d.getDate());

    var yearGroup = ensureYearGroup(timeline, year);
    var monthGroup = ensureMonthGroup(yearGroup, monthKey, MONTH_CN[d.getMonth() + 1]);
    var monthPosts = monthGroup.querySelector('.month-posts') || createMonthPosts(monthGroup);

    var card = document.createElement('a');
    card.className = 'post-card';
    card.setAttribute('href', '#post-' + post.id);
    card.setAttribute('data-dynamic', '1');
    card.setAttribute('data-post-id', post.id);
    card.setAttribute('data-category', post.category || 'snow');
    card.setAttribute('data-tags', (post.tags || []).join(','));
    card.setAttribute('data-title', post.title || '');
    card.setAttribute('data-summary', summaryFromMd(post.content_md));
    card.innerHTML =
      '<div class="card-date"><span class="card-day">' + day + '</span><span class="card-month">' + MONTH_CN[d.getMonth() + 1] + '</span></div>' +
      '<div class="card-content">' +
        '<div class="card-header"><span class="card-category">' + catName(post.category) + '</span></div>' +
        '<h3 class="card-title">' + escapeHtml(post.title || '(无标题)') + '</h3>' +
        '<p class="card-summary">' + escapeHtml(summaryFromMd(post.content_md)) + '</p>' +
        '<div class="card-tags">' + (post.tags || []).map(function (t) {
          return '<span class="card-tag">#' + escapeHtml(t) + '</span>';
        }).join('') + '</div>' +
      '</div>';
    monthPosts.appendChild(card);
    return card;
  }

  function summaryFromMd(md) {
    if (!md) return '';
    var txt = String(md).replace(/[#>*`_~\-!\[\]()]/g, '').replace(/\s+/g, ' ').trim();
    return txt.length > 80 ? txt.slice(0, 80) + '…' : txt;
  }

  function catName(c) {
    var map = { snow: '思雪', ice: '冰研', frost: '积素', soil: '冻土', night: '夜翻' };
    return map[c] || '思雪';
  }

  function ensureYearGroup(timeline, year) {
    var groups = timeline.querySelectorAll('.year-group');
    var existing = null;
    groups.forEach(function (g) {
      if (g.getAttribute('data-year') === year) existing = g;
    });
    if (existing) return existing;
    var g = document.createElement('div');
    g.className = 'year-group';
    g.setAttribute('data-year', year);
    g.innerHTML =
      '<div class="year-header" data-year="' + year + '">' +
        '<div class="year-dot"></div><h2 class="year-title">' + year + '年</h2>' +
        '<span class="year-count">0 篇</span>' +
        '<button class="year-toggle" data-year="' + year + '">−</button>' +
      '</div>' +
      '<div class="year-content" data-year="' + year + '"></div>';
    // 按年降序插入（新年在前）
    var inserted = false;
    groups.forEach(function (ex) {
      if (!inserted && Number(ex.getAttribute('data-year')) < Number(year)) {
        timeline.insertBefore(g, ex);
        inserted = true;
      }
    });
    if (!inserted) timeline.appendChild(g);
    bindYearToggle(g.querySelector('.year-toggle'));
    return g;
  }

  function ensureMonthGroup(yearGroup, monthKey, label) {
    var existing = null;
    yearGroup.querySelectorAll('.month-group').forEach(function (m) {
      if (m.getAttribute('data-month') === monthKey) existing = m;
    });
    if (existing) return existing;
    var m = document.createElement('div');
    m.className = 'month-group';
    m.setAttribute('data-month', monthKey);
    m.innerHTML = '<div class="month-label">' + label + '</div><div class="month-posts"></div>';
    // 月降序
    var inserted = false;
    yearGroup.querySelectorAll('.month-group').forEach(function (ex) {
      if (!inserted && ex.getAttribute('data-month') < monthKey) {
        yearGroup.querySelector('.year-content').insertBefore(m, ex);
        inserted = true;
      }
    });
    if (!inserted) yearGroup.querySelector('.year-content').appendChild(m);
    return m;
  }

  function createMonthPosts(monthGroup) {
    var d = document.createElement('div');
    d.className = 'month-posts';
    monthGroup.appendChild(d);
    return d;
  }

  function bindYearToggle(btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var y = btn.getAttribute('data-year');
      var content = document.querySelector('.year-content[data-year="' + y + '"]');
      if (!content) return;
      var collapsed = content.style.display === 'none';
      content.style.display = collapsed ? '' : 'none';
      btn.textContent = collapsed ? '−' : '+';
    });
  }

  function recountYear(year) {
    var g = document.querySelector('.year-group[data-year="' + year + '"]');
    if (!g) return;
    var n = g.querySelectorAll('.post-card').length;
    var cnt = g.querySelector('.year-count');
    if (cnt) cnt.textContent = n + ' 篇';
  }

  // 详情模态
  function openPostModal(post) {
    var existing = document.getElementById('post-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'post-modal';
    modal.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-head"><span class="modal-title">' + escapeHtml(post.title || '(无标题)') + '</span><button class="modal-x">×</button></div>' +
        '<div class="modal-body post-article">' + renderMd(post.content_md) + '</div>' +
      '</div>';
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('visible'); });
    modal.querySelector('.modal-x').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    function close() {
      modal.classList.remove('visible');
      setTimeout(function () { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 200);
    }
  }

  // 缓存已拉取的文章，供点击时查正文
  var cache = {};

  function start() {
    // 等 CloudStore 初始化好（拿到 anon client）
    var Cloud = root.App.CloudStore;
    if (!Cloud || !Cloud.getAnonClient) { setTimeout(start, 300); return; }
    fetchPublished().then(function (posts) {
      if (!posts.length) return;
      posts.forEach(function (p) {
        cache[p.id] = p;
        injectPost(p);
      });
      // 重算每个出现过的年份的计数
      var years = {};
      posts.forEach(function (p) {
        var y = String(new Date(p.created_at).getFullYear());
        years[y] = 1;
      });
      Object.keys(years).forEach(recountYear);
      // 点击动态卡 → 模态
      document.querySelectorAll('.post-card[data-dynamic="1"]').forEach(function (card) {
        card.addEventListener('click', function (e) {
          e.preventDefault();
          var id = card.getAttribute('data-post-id');
          if (cache[id]) openPostModal(cache[id]);
        });
      });
      // 通知 winter-app 重新捕获卡片
      document.dispatchEvent(new CustomEvent('blog:cards-injected'));
    });
  }

  root.App.BlogSync = { start: start, fetchPublished: fetchPublished, openPostModal: openPostModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 500); });
  } else {
    setTimeout(start, 500);
  }
})();
