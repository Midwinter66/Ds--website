// ===== 冬主题个人网站 - 主逻辑 =====
(function () {
  'use strict';

  // ========== 雪花效果（增强版） ==========
  function initSnow() {
    const canvas = document.getElementById('snow-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let snowflakes = [];
    let animationId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function createSnowflakes() {
      const count = Math.floor((canvas.width * canvas.height) / 12000);
      snowflakes = [];
      for (let i = 0; i < count; i++) {
        snowflakes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 3 + 1,
          speed: Math.random() * 0.8 + 0.3,
          sway: Math.random() * 0.6 + 0.2,
          swayOffset: Math.random() * Math.PI * 2,
          opacity: Math.random() * 0.5 + 0.3,
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      snowflakes.forEach(sf => {
        sf.y += sf.speed;
        sf.x += Math.sin(sf.y * 0.01 + sf.swayOffset) * sf.sway;
        if (sf.y > canvas.height + 10) { sf.y = -10; sf.x = Math.random() * canvas.width; }
        if (sf.x < -10) sf.x = canvas.width + 10;
        if (sf.x > canvas.width + 10) sf.x = -10;
        ctx.beginPath();
        ctx.arc(sf.x, sf.y, sf.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 160, 140, ${sf.opacity})`;
        ctx.fill();
      });
      animationId = requestAnimationFrame(animate);
    }

    resize();
    createSnowflakes();
    animate();
    window.addEventListener('resize', () => { resize(); createSnowflakes(); });
    return () => cancelAnimationFrame(animationId);
  }

  // ========== 入口页逻辑 ==========
  function initWelcome() {
    const welcome = document.getElementById('welcome-screen');
    const mainApp = document.getElementById('main-app');
    const winterChar = document.getElementById('winter-char');
    if (!welcome || !mainApp) return;

    const hasEntered = sessionStorage.getItem('winter_entered');
    if (hasEntered) {
      welcome.classList.add('hidden');
      mainApp.classList.remove('hidden');
      requestAnimationFrame(() => { mainApp.classList.add('visible'); });
      return;
    }

    function enterSite() {
      var desk = document.getElementById('desk-app');
      if (desk && desk.classList.contains('active')) return;
      if (welcome.classList.contains('fade-out')) return;
      welcome.classList.add('fade-out');
      mainApp.classList.remove('hidden');
      setTimeout(() => {
        welcome.classList.add('hidden');
        mainApp.classList.add('visible');
      }, 600);
      sessionStorage.setItem('winter_entered', 'true');
    }

    winterChar.addEventListener('click', enterSite);
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter') enterSite(); });
  }

  // ========== 滚动头部效果 ==========
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    function onScroll() {
      if (window.scrollY > 10) { header.classList.add('scrolled'); }
      else { header.classList.remove('scrolled'); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ========== 分类筛选 ==========
  function initCategoryFilter() {
    const navItems = document.querySelectorAll('.nav-item');
    const noResults = document.getElementById('no-results');
    if (navItems.length === 0) return;

    function filterByCategory(category) {
      let visibleCount = 0;
      document.querySelectorAll('.post-card').forEach(card => {
        const cardCategory = card.dataset.category;
        if (category === 'all' || cardCategory === category) {
          card.classList.remove('hidden'); visibleCount++;
        } else { card.classList.add('hidden'); }
      });
      document.querySelectorAll('.month-group').forEach(group => {
        const visiblePosts = group.querySelectorAll('.post-card:not(.hidden)');
        if (visiblePosts.length > 0) group.classList.remove('hidden');
        else group.classList.add('hidden');
      });
      document.querySelectorAll('.year-group').forEach(group => {
        const visibleMonths = group.querySelectorAll('.month-group:not(.hidden)');
        if (visibleMonths.length > 0) group.classList.remove('hidden');
        else group.classList.add('hidden');
      });
      if (noResults) {
        if (visibleCount === 0) noResults.classList.remove('hidden');
        else noResults.classList.add('hidden');
      }
    }

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const category = item.dataset.category;
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        filterByCategory(category);
      });
    });

    // 动态文章注入后重新应用当前筛选
    document.addEventListener('blog:cards-injected', () => {
      const active = document.querySelector('.nav-item.active');
      filterByCategory(active ? active.dataset.category : 'all');
    });
  }

  // ========== 搜索功能 ==========
  function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchHistory = document.getElementById('search-history');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');
    const noResults = document.getElementById('no-results');
    if (!searchInput) return;

    const HISTORY_KEY = 'winter_search_history';
    const MAX_HISTORY = 8;

    function getHistory() {
      try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
    }
    function saveHistory(history) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    }
    function addToHistory(keyword) {
      if (!keyword.trim()) return;
      let history = getHistory();
      history = history.filter(h => h !== keyword);
      history.unshift(keyword);
      saveHistory(history);
      renderHistory();
    }
    function renderHistory() {
      const history = getHistory();
      if (!searchHistory || !historyList) return;
      if (history.length === 0) { searchHistory.classList.add('hidden'); return; }
      historyList.innerHTML = '';
      history.forEach(item => {
        const el = document.createElement('span');
        el.className = 'history-item';
        el.textContent = item;
        el.addEventListener('click', () => { searchInput.value = item; performSearch(item); });
        historyList.appendChild(el);
      });
    }
    function performSearch(keyword) {
      keyword = keyword.trim().toLowerCase();
      let visibleCount = 0;
      document.querySelectorAll('.post-card').forEach(card => {
        const title = card.dataset.title?.toLowerCase() || '';
        const summary = card.dataset.summary?.toLowerCase() || '';
        const tags = card.dataset.tags?.toLowerCase() || '';
        const category = card.dataset.category?.toLowerCase() || '';
        if (!keyword) { card.classList.remove('hidden'); visibleCount++; return; }
        if (title.includes(keyword) || summary.includes(keyword) || tags.includes(keyword) || category.includes(keyword)) {
          card.classList.remove('hidden'); visibleCount++;
        } else { card.classList.add('hidden'); }
      });
      document.querySelectorAll('.month-group').forEach(group => {
        const visiblePosts = group.querySelectorAll('.post-card:not(.hidden)');
        if (visiblePosts.length > 0) group.classList.remove('hidden');
        else group.classList.add('hidden');
      });
      document.querySelectorAll('.year-group').forEach(group => {
        const visibleMonths = group.querySelectorAll('.month-group:not(.hidden)');
        if (visibleMonths.length > 0) group.classList.remove('hidden');
        else group.classList.add('hidden');
      });
      if (noResults) {
        if (keyword && visibleCount === 0) noResults.classList.remove('hidden');
        else noResults.classList.add('hidden');
      }
    }

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { performSearch(value); }, 200);
      if (searchHistory && value === '') { renderHistory(); }
      else if (searchHistory) { searchHistory.classList.add('hidden'); }
    });
    searchInput.addEventListener('focus', () => {
      if (searchInput.value === '' && getHistory().length > 0) {
        renderHistory();
        searchHistory?.classList.remove('hidden');
      }
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        addToHistory(searchInput.value.trim());
        searchHistory?.classList.add('hidden');
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-section') && searchHistory) {
        searchHistory.classList.add('hidden');
      }
    });
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
      });
    }
    renderHistory();

    // 动态文章注入后重新应用当前搜索
    document.addEventListener('blog:cards-injected', () => {
      performSearch(searchInput.value);
    });
  }

  // ========== 年份折叠 ==========
  function initYearToggle() {
    const yearHeaders = document.querySelectorAll('.year-header');
    const yearContents = document.querySelectorAll('.year-content');
    if (yearHeaders.length === 0) return;
    yearContents.forEach(content => { content.style.maxHeight = content.scrollHeight + 'px'; });
    yearHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        const year = header.dataset.year;
        const content = document.querySelector(`.year-content[data-year="${year}"]`);
        const toggleBtn = header.querySelector('.year-toggle');
        if (!content) return;
        if (content.classList.contains('collapsed')) {
          content.classList.remove('collapsed');
          content.style.maxHeight = content.scrollHeight + 'px';
          if (toggleBtn) toggleBtn.textContent = '−';
        } else {
          content.style.maxHeight = content.scrollHeight + 'px';
          content.offsetHeight;
          content.classList.add('collapsed');
          content.style.maxHeight = '0px';
          if (toggleBtn) toggleBtn.textContent = '+';
        }
      });
    });
    window.addEventListener('resize', () => {
      yearContents.forEach(content => {
        if (!content.classList.contains('collapsed')) {
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    });
  }

  // ========== 页面平滑切换 ==========
  function initPageTransition() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
      if (href.startsWith('/Ds--website/')) {
        e.preventDefault();
        const mainApp = document.getElementById('main-app');
        if (mainApp) { mainApp.style.transition = 'opacity 0.3s ease'; mainApp.style.opacity = '0'; }
        setTimeout(() => { window.location.href = href; }, 300);
      }
    });
  }

  // ========== 初始化 ==========
  document.addEventListener('DOMContentLoaded', () => {
    initSnow();
    initWelcome();
    initHeaderScroll();
    initCategoryFilter();
    initSearch();
    initYearToggle();
    initPageTransition();
  });
})();
