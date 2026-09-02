/* ============================================================
   冬 · 个人网站主逻辑
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  // 示例数据（后续可接入 Supabase）
  // ============================================================
  const ENTRIES = [
    {
      id: 1,
      title: '关于注意力经济的一些思考',
      date: '2026-08-28',
      category: 'thought',
      categoryName: '思雪',
      excerpt: '我们每天被多少信息推着走？刷手机的时候，到底是我们在看内容，还是内容在"吃"我们的时间...',
      tags: ['认知', '注意力', '产品']
    },
    {
      id: 2,
      title: 'Astro 群岛架构学习笔记',
      date: '2026-08-25',
      category: 'tech',
      categoryName: '冰研',
      excerpt: 'Astro 的群岛架构（Islands Architecture）到底是什么？为什么说它是静态站点的未来...',
      tags: ['前端', 'Astro', '性能优化']
    },
    {
      id: 3,
      title: '费曼学习法的四个步骤',
      date: '2026-08-20',
      category: 'knowledge',
      categoryName: '积素',
      excerpt: '选择一个概念 → 用最简单的话讲给别人听 → 卡住了就回去查 → 再简化再讲。核心就是"用自己的话"...',
      tags: ['学习方法', '费曼技巧', '方法论']
    },
    {
      id: 4,
      title: '个人网站项目启动',
      date: '2026-08-15',
      category: 'project',
      categoryName: '冻土',
      excerpt: '从"暖冬"这个概念出发，设计一个属于自己的个人网站。参考了 soulyea.com 的入口仪式感设计，但做 2D 简化...',
      tags: ['项目', '个人网站', '设计']
    },
    {
      id: 5,
      title: '《深度工作》读书笔记',
      date: '2026-08-10',
      category: 'book',
      categoryName: '夜翻',
      excerpt: '深度工作是在无干扰状态下进行的专业活动，将认知能力推向极限。浅层工作则是不需要太多认知投入...',
      tags: ['读书', '效率', '深度工作']
    },
    {
      id: 6,
      title: '为什么冬天适合思考',
      date: '2026-08-05',
      category: 'thought',
      categoryName: '思雪',
      excerpt: '冬天万物沉寂，人也变得安静。寒冷让人清醒，也让人向内看。也许这就是为什么最好的想法总...',
      tags: ['随想', '冬天', '生活']
    },
    {
      id: 7,
      title: 'CSS 变量与设计系统',
      date: '2026-07-28',
      category: 'tech',
      categoryName: '冰研',
      excerpt: '用 CSS 自定义属性构建设计系统，是我最近觉得最值得的一件事。颜色、间距、圆角、动效曲线...',
      tags: ['CSS', '设计系统', '前端']
    },
    {
      id: 8,
      title: '第一性原理',
      date: '2026-07-20',
      category: 'knowledge',
      categoryName: '积素',
      excerpt: '第一性原理的核心是：一层层剥开表象，找到最根本的事实，然后从那里重新推导。而不是类比思维...',
      tags: ['思维模型', '第一性原理', '认知']
    },
    {
      id: 9,
      title: '2026 年的上半年',
      date: '2026-06-30',
      category: 'thought',
      categoryName: '思雪',
      excerpt: '半年过去了。做了几个项目，读了几本书，去了几个地方。最大的感受是：慢一点也没关系...',
      tags: ['复盘', '成长', '生活']
    },
    {
      id: 10,
      title: '《被讨厌的勇气》',
      date: '2026-06-15',
      category: 'book',
      categoryName: '夜翻',
      excerpt: '阿德勒心理学说，一切烦恼都来自人际关系。而课题分离是解决的关键 —— 分清什么是自己的事...',
      tags: ['读书', '心理学', '阿德勒']
    },
    {
      id: 11,
      title: 'Supabase 入门指南',
      date: '2026-06-08',
      category: 'tech',
      categoryName: '冰研',
      excerpt: 'Supabase 是 Firebase 的开源替代品。数据库、认证、存储、实时订阅，一个平台全搞定...',
      tags: ['数据库', 'BaaS', '后端']
    },
    {
      id: 12,
      title: '公园散步时想到的',
      date: '2026-05-22',
      category: 'thought',
      categoryName: '思雪',
      excerpt: '今天在公园走了很久。树还是那些树，但每次看感觉都不一样。也许变化的不是树，是看树的心情...',
      tags: ['随想', '生活', '散步']
    }
  ];

  // ============================================================
  // 状态
  // ============================================================
  const state = {
    currentCategory: 'all',
    activeTags: [],
    searchQuery: ''
  };

  // ============================================================
  // 初始化
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    initSnowflakes();
    initWelcomePage();
    initNavigation();
    initSearch();
    renderTagCloud();
    renderTimeline();
    initScrollHeader();
  });

  // ============================================================
  // 雪花效果
  // ============================================================
  function initSnowflakes() {
    const container = document.getElementById('snowflakes');
    if (!container) return;

    const snowChars = ['❄', '❅', '❆', '·'];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const flake = document.createElement('span');
      flake.className = 'snowflake';
      flake.textContent = snowChars[Math.floor(Math.random() * snowChars.length)];
      flake.style.left = Math.random() * 100 + '%';
      flake.style.fontSize = (0.5 + Math.random() * 0.8) + 'rem';
      flake.style.animationDuration = (8 + Math.random() * 12) + 's';
      flake.style.animationDelay = (Math.random() * 10) + 's';
      flake.style.opacity = 0.2 + Math.random() * 0.4;
      container.appendChild(flake);
    }
  }

  // ============================================================
  // 入口页交互
  // ============================================================
  function initWelcomePage() {
    const welcome = document.getElementById('welcomePage');
    const winterChar = document.getElementById('winterChar');
    const mainApp = document.getElementById('mainApp');

    if (!welcome || !mainApp) return;

    function enterSite() {
      welcome.classList.add('fade-out');
      setTimeout(() => {
        mainApp.classList.add('visible');
        welcome.style.display = 'none';
        document.title = '冬 · 时间轴';
      }, 800);
    }

    // 点击冬字进入
    winterChar.addEventListener('click', enterSite);

    // 按 Enter 进入
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !welcome.classList.contains('fade-out')) {
        enterSite();
      }
    });

    // 检查是否已经进入过（sessionStorage），如果是直接显示主页
    if (sessionStorage.getItem('winter-entered')) {
      welcome.style.display = 'none';
      mainApp.classList.add('visible');
      document.title = '冬 · 时间轴';
    } else {
      sessionStorage.setItem('winter-entered', '1');
    }
  }

  // ============================================================
  // 导航
  // ============================================================
  function initNavigation() {
    const navItems = document.querySelectorAll('.category-nav a');
    const logo = document.getElementById('siteLogo');

    navItems.forEach(item => {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        const cat = this.getAttribute('data-cat');

        // 更新激活状态
        navItems.forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        // 切换分类
        if (cat === 'about') {
          showAboutPage();
        } else {
          state.currentCategory = cat;
          renderTimeline();
          // 滚动到内容区
          document.querySelector('.content-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Logo 点击回到顶部/全部
    if (logo) {
      logo.addEventListener('click', function () {
        state.currentCategory = 'all';
        state.activeTags = [];
        state.searchQuery = '';
        document.getElementById('searchInput').value = '';
        navItems.forEach(n => n.classList.remove('active'));
        navItems[0].classList.add('active');
        renderTagCloud();
        renderTimeline();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // ============================================================
  // 搜索
  // ============================================================
  function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = this.value.trim().toLowerCase();
        renderTimeline();
      }, 200);
    });
  }

  // ============================================================
  // 标签云
  // ============================================================
  function renderTagCloud() {
    const cloud = document.getElementById('tagCloud');
    if (!cloud) return;

    // 收集所有标签
    const tagCount = {};
    ENTRIES.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // 按数量排序
    const tags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]);

    // 标签颜色轮换
    const tagColors = ['', 'secondary', 'pine'];

    cloud.innerHTML = tags.map((tag, i) => {
      const colorClass = tagColors[i % tagColors.length];
      const isActive = state.activeTags.includes(tag);
      return `<span class="tag ${colorClass} ${isActive ? 'active' : ''}" data-tag="${tag}">${tag}</span>`;
    }).join('');

    // 绑定点击事件
    cloud.querySelectorAll('.tag').forEach(tagEl => {
      tagEl.addEventListener('click', function () {
        const tag = this.getAttribute('data-tag');
        if (state.activeTags.includes(tag)) {
          state.activeTags = state.activeTags.filter(t => t !== tag);
        } else {
          state.activeTags.push(tag);
        }
        renderTagCloud();
        renderTimeline();
      });
    });
  }

  // ============================================================
  // 时间轴渲染
  // ============================================================
  function renderTimeline() {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;

    // 筛选
    let filtered = ENTRIES.filter(entry => {
      // 分类筛选
      if (state.currentCategory !== 'all' && entry.category !== state.currentCategory) {
        return false;
      }
      // 标签筛选（AND 逻辑：必须包含所有选中标签）
      if (state.activeTags.length > 0) {
        const hasAllTags = state.activeTags.every(tag => entry.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      // 搜索筛选
      if (state.searchQuery) {
        const q = state.searchQuery;
        const inTitle = entry.title.toLowerCase().includes(q);
        const inExcerpt = entry.excerpt.toLowerCase().includes(q);
        const inTags = entry.tags.some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inExcerpt && !inTags) return false;
      }
      return true;
    });

    // 按日期倒序
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
      timeline.innerHTML = `
        <div style="text-align:center; padding: 3rem 0; color: var(--ink-muted);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">一片空白</p>
          <p style="font-size: 0.85rem;">雪落无声，静待新的印记</p>
        </div>
      `;
      return;
    }

    // 按年份分组
    const groups = {};
    filtered.forEach(entry => {
      const year = entry.date.substring(0, 4);
      if (!groups[year]) groups[year] = [];
      groups[year].push(entry);
    });

    // 渲染
    let html = '';
    Object.keys(groups).sort((a, b) => b - a).forEach(year => {
      html += `
        <div class="year-group">
          <div class="year-header">
            <h2>${year}</h2>
          </div>
          <div class="year-entries">
            ${groups[year].map(entry => renderEntryCard(entry)).join('')}
          </div>
        </div>
      `;
    });

    timeline.innerHTML = html;

    // 添加入场动画
    setTimeout(() => {
      timeline.querySelectorAll('.entry-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        card.style.transition = `all 0.5s var(--ease-soft) ${i * 0.05}s`;
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    }, 10);
  }

  // ============================================================
  // 渲染单条卡片
  // ============================================================
  function renderEntryCard(entry) {
    const tagColors = {
      thought: '',
      tech: 'secondary',
      knowledge: 'pine',
      project: '',
      book: 'secondary'
    };
    const colorClass = tagColors[entry.category] || '';

    const tagsHtml = entry.tags.slice(0, 3).map(tag =>
      `<span class="tag ${colorClass}" data-tag="${tag}">${tag}</span>`
    ).join('');

    return `
      <article class="entry-card" data-id="${entry.id}">
        <span class="entry-category">${entry.categoryName}</span>
        <div class="entry-date">${formatDate(entry.date)}</div>
        <h3 class="entry-title">${entry.title}</h3>
        <p class="entry-excerpt">${entry.excerpt}</p>
        <div class="entry-tags">${tagsHtml}</div>
      </article>
    `;
  }

  // ============================================================
  // 关于页
  // ============================================================
  function showAboutPage() {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;

    timeline.innerHTML = `
      <div class="page-view">
        <div class="about-section">
          <div class="about-avatar">冬</div>
          <h2 class="about-name">冬</h2>
          <p class="about-bio">
            一个安静的数字角落。<br/>
            记录想法、知识与成长的痕迹。<br/>
            如冬日的雪，悄然落下，静静积累。
          </p>
          <div class="about-links">
            <a href="javascript:void(0)" onclick="alert('联系方式待添加')">联系</a>
            <a href="javascript:void(0)" onclick="alert('RSS 待添加')">RSS</a>
            <a href="https://github.com/Midwinter66" target="_blank" rel="noopener">GitHub</a>
          </div>
        </div>

        <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--rule-soft);">
          <h3 style="text-align:center; font-weight: 400; color: var(--ink-light); margin-bottom: 2rem;">分类</h3>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align:center;">
            <div style="padding: 1.5rem 1rem;">
              <div style="font-family:'Ma Shan Zheng',serif; font-size:1.4rem; color:var(--accent); margin-bottom:0.3rem;">思雪</div>
              <div style="font-size:0.8rem; color:var(--ink-muted);">想法笔记</div>
            </div>
            <div style="padding: 1.5rem 1rem;">
              <div style="font-family:'Ma Shan Zheng',serif; font-size:1.4rem; color:var(--secondary); margin-bottom:0.3rem;">冰研</div>
              <div style="font-size:0.8rem; color:var(--ink-muted);">技术内容</div>
            </div>
            <div style="padding: 1.5rem 1rem;">
              <div style="font-family:'Ma Shan Zheng',serif; font-size:1.4rem; color:var(--pine); margin-bottom:0.3rem;">积素</div>
              <div style="font-size:0.8rem; color:var(--ink-muted);">知识点</div>
            </div>
            <div style="padding: 1.5rem 1rem;">
              <div style="font-family:'Ma Shan Zheng',serif; font-size:1.4rem; color:var(--accent); margin-bottom:0.3rem;">冻土</div>
              <div style="font-size:0.8rem; color:var(--ink-muted);">在做项目</div>
            </div>
            <div style="padding: 1.5rem 1rem;">
              <div style="font-family:'Ma Shan Zheng',serif; font-size:1.4rem; color:var(--secondary); margin-bottom:0.3rem;">夜翻</div>
              <div style="font-size:0.8rem; color:var(--ink-muted);">读书笔记</div>
            </div>
            <div style="padding: 1.5rem 1rem;">
              <div style="font-family:'Ma Shan Zheng',serif; font-size:1.4rem; color:var(--pine); margin-bottom:0.3rem;">归处</div>
              <div style="font-size:0.8rem; color:var(--ink-muted);">关于</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // 滚动时头部效果
  // ============================================================
  function initScrollHeader() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // ============================================================
  // 工具函数：格式化日期
  // ============================================================
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${m}.${day}`;
  }

})();
