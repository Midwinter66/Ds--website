// ===== 烹饪模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var STORAGE_KEY = 'app_cooking';

  // 菜谱分类
  var CATEGORIES = ['中餐', '西餐', '日料', '烘焙', '汤粥', '凉菜', '甜品', '其他'];
  var DIFFICULTIES = ['简单', '中等', '困难'];

  // 当前视图状态
  var currentView = 'list'; // 'list' | 'detail' | 'edit'
  var currentRecipeId = null;
  var filterCategory = 'all';
  var searchKeyword = '';

  // ===== 辅助函数 =====
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return String(text == null ? '' : text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== 数据操作 =====
  var data = {
    // 获取所有菜谱
    getRecipes: function() {
      var d = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(d)) return [];
      return d.slice().sort(function(a, b) {
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
    },

    // 获取单个菜谱
    getRecipe: function(id) {
      if (!id) return null;
      var recipes = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(recipes)) return null;
      for (var i = 0; i < recipes.length; i++) {
        if (recipes[i].id === id) return recipes[i];
      }
      return null;
    },

    // 添加菜谱
    addRecipe: function(recipeData) {
      if (!recipeData || !recipeData.name || !String(recipeData.name).trim()) return null;
      var recipes = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(recipes)) recipes = [];

      var now = Date.now();
      var recipe = {
        id: Storage.generateId(),
        name: String(recipeData.name).trim(),
        category: recipeData.category || '其他',
        difficulty: recipeData.difficulty || '简单',
        cookTime: parseInt(recipeData.cookTime, 10) || 0,
        servings: parseInt(recipeData.servings, 10) || 1,
        ingredients: Array.isArray(recipeData.ingredients) ? recipeData.ingredients.map(function(ing) {
          return { name: String(ing.name || '').trim(), amount: String(ing.amount || '').trim() };
        }).filter(function(ing) { return ing.name; }) : [],
        seasonings: Array.isArray(recipeData.seasonings) ? recipeData.seasonings.map(function(sea) {
          return { name: String(sea.name || '').trim(), amount: String(sea.amount || '').trim() };
        }).filter(function(sea) { return sea.name; }) : [],
        steps: Array.isArray(recipeData.steps) ? recipeData.steps.map(function(s) {
          return String(s || '').trim();
        }).filter(function(s) { return s; }) : [],
        notes: recipeData.notes ? String(recipeData.notes).trim() : '',
        createdAt: now,
        updatedAt: now
      };

      recipes.push(recipe);
      Storage.set(STORAGE_KEY, recipes);
      return recipe;
    },

    // 更新菜谱
    updateRecipe: function(id, fields) {
      if (!id || !fields) return null;
      var recipes = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(recipes)) return null;

      for (var i = 0; i < recipes.length; i++) {
        if (recipes[i].id === id) {
          if (fields.name !== undefined) recipes[i].name = String(fields.name).trim();
          if (fields.category !== undefined) recipes[i].category = fields.category;
          if (fields.difficulty !== undefined) recipes[i].difficulty = fields.difficulty;
          if (fields.cookTime !== undefined) recipes[i].cookTime = parseInt(fields.cookTime, 10) || 0;
          if (fields.servings !== undefined) recipes[i].servings = parseInt(fields.servings, 10) || 1;
          if (Array.isArray(fields.ingredients)) {
            recipes[i].ingredients = fields.ingredients.map(function(ing) {
              return { name: String(ing.name || '').trim(), amount: String(ing.amount || '').trim() };
            }).filter(function(ing) { return ing.name; });
          }
          if (Array.isArray(fields.seasonings)) {
            recipes[i].seasonings = fields.seasonings.map(function(sea) {
              return { name: String(sea.name || '').trim(), amount: String(sea.amount || '').trim() };
            }).filter(function(sea) { return sea.name; });
          }
          if (Array.isArray(fields.steps)) {
            recipes[i].steps = fields.steps.map(function(s) {
              return String(s || '').trim();
            }).filter(function(s) { return s; });
          }
          if (fields.notes !== undefined) recipes[i].notes = String(fields.notes).trim();
          recipes[i].updatedAt = Date.now();

          Storage.set(STORAGE_KEY, recipes);
          return recipes[i];
        }
      }
      return null;
    },

    // 删除菜谱
    deleteRecipe: function(id) {
      if (!id) return false;
      var recipes = Storage.get(STORAGE_KEY, []);
      if (!Array.isArray(recipes)) return false;
      var originalLength = recipes.length;
      recipes = recipes.filter(function(r) { return r.id !== id; });
      if (recipes.length < originalLength) {
        Storage.set(STORAGE_KEY, recipes);
        return true;
      }
      return false;
    },

    // 获取分类列表及数量
    getCategories: function() {
      var recipes = data.getRecipes();
      var cats = {};
      CATEGORIES.forEach(function(c) { cats[c] = 0; });
      recipes.forEach(function(r) {
        var cat = r.category || '其他';
        if (cats[cat] === undefined) cats[cat] = 0;
        cats[cat]++;
      });
      return CATEGORIES.map(function(c) {
        return { name: c, count: cats[c] || 0 };
      });
    },

    // 按分类筛选
    getByCategory: function(category) {
      var recipes = data.getRecipes();
      if (!category || category === 'all') return recipes;
      return recipes.filter(function(r) { return (r.category || '其他') === category; });
    },

    // 搜索菜谱
    searchRecipes: function(keyword) {
      if (!keyword || !String(keyword).trim()) return data.getRecipes();
      var kw = String(keyword).trim().toLowerCase();
      var recipes = data.getRecipes();
      return recipes.filter(function(r) {
        if (r.name.toLowerCase().indexOf(kw) >= 0) return true;
        if (r.notes && r.notes.toLowerCase().indexOf(kw) >= 0) return true;
        if (r.ingredients) {
          for (var i = 0; i < r.ingredients.length; i++) {
            if (r.ingredients[i].name.toLowerCase().indexOf(kw) >= 0) return true;
          }
        }
        if (r.seasonings) {
          for (var j = 0; j < r.seasonings.length; j++) {
            if (r.seasonings[j].name.toLowerCase().indexOf(kw) >= 0) return true;
          }
        }
        return false;
      });
    },

    // 获取统计数据（供首页摘要用）
    getStats: function() {
      var recipes = data.getRecipes();
      var cats = {};
      recipes.forEach(function(r) {
        var cat = r.category || '其他';
        if (cats[cat] === undefined) cats[cat] = 0;
        cats[cat]++;
      });
      var topCategory = null;
      var maxCount = 0;
      Object.keys(cats).forEach(function(c) {
        if (cats[c] > maxCount) {
          maxCount = cats[c];
          topCategory = c;
        }
      });
      return {
        total: recipes.length,
        topCategory: topCategory,
        categories: Object.keys(cats).length
      };
    },

    // 获取所有分类名称
    getAllCategories: function() {
      return CATEGORIES.slice();
    },

    // 获取所有难度级别
    getAllDifficulties: function() {
      return DIFFICULTIES.slice();
    }
  };

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      if (currentView === 'detail' && currentRecipeId) {
        return this.renderDetail();
      }
      if (currentView === 'edit') {
        return this.renderEdit();
      }
      return this.renderList();
    },

    // 列表页
    renderList: function() {
      var html = '';
      var recipes;

      // 搜索 + 添加
      html += '<div class="flex items-center justify-between mb-16">';
      html += '<input type="text" id="cooking-search" placeholder="搜索菜谱..." value="' + escapeAttr(searchKeyword) + '" style="flex:1;margin-right:12px;padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-input);" />';
      html += '<button class="btn btn-primary btn-sm" id="cooking-add-btn">添加菜谱</button>';
      html += '</div>';

      // 分类筛选
      html += '<div class="tabs mb-16" id="cooking-categories">';
      html += '<div class="tab' + (filterCategory === 'all' ? ' active' : '') + '" data-category="all">全部</div>';
      CATEGORIES.forEach(function(cat) {
        html += '<div class="tab' + (filterCategory === cat ? ' active' : '') + '" data-category="' + escapeAttr(cat) + '">' + escapeHtml(cat) + '</div>';
      });
      html += '</div>';

      // 菜谱列表
      if (searchKeyword) {
        recipes = data.searchRecipes(searchKeyword);
      } else {
        recipes = data.getByCategory(filterCategory);
      }

      if (recipes.length === 0) {
        html += '<div class="empty-state">';
        html += '<div class="empty-state-icon">🍳</div>';
        html += '<div class="empty-state-text">' + (searchKeyword ? '没有找到匹配的菜谱' : '还没有菜谱，点击"添加菜谱"开始记录') + '</div>';
        html += '</div>';
      } else {
        html += '<div class="grid-cards">';
        recipes.forEach(function(r) {
          var diffColor = r.difficulty === '简单' ? '#2ecc71' : (r.difficulty === '困难' ? '#e74c3c' : '#f39c12');
          html += '<div class="card card-clickable cooking-recipe-card" data-recipe-id="' + escapeAttr(r.id) + '">';
          html += '<div style="font-size:16px;font-weight:600;margin-bottom:6px;">' + escapeHtml(r.name) + '</div>';
          html += '<div class="flex items-center gap-12" style="margin-bottom:8px;">';
          html += '<span class="cooking-cat-badge" data-cat="' + escapeAttr(r.category) + '">' + escapeHtml(r.category) + '</span>';
          html += '<span style="font-size:12px;color:' + diffColor + ';font-weight:600;">' + escapeHtml(r.difficulty) + '</span>';
          html += '</div>';
          html += '<div class="text-muted" style="font-size:12px;">';
          if (r.cookTime > 0) html += '⏱ ' + r.cookTime + '分钟　';
          html += '👥 ' + r.servings + '人份';
          html += '</div>';
          if (r.ingredients.length > 0) {
            html += '<div class="text-muted" style="font-size:12px;margin-top:4px;">食材：' + r.ingredients.length + ' 种</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }

      return html;
    },

    // 详情页
    renderDetail: function() {
      var r = data.getRecipe(currentRecipeId);
      if (!r) {
        currentView = 'list';
        return this.renderList();
      }

      var html = '';
      html += '<div class="flex items-center justify-between mb-16">';
      html += '<button class="btn btn-sm btn-secondary" id="cooking-back-btn">&larr; 返回列表</button>';
      html += '<div class="flex gap-8">';
      html += '<button class="btn btn-sm btn-secondary" id="cooking-edit-btn" data-recipe-id="' + escapeAttr(r.id) + '">编辑</button>';
      html += '<button class="btn btn-sm btn-danger" id="cooking-delete-btn" data-recipe-id="' + escapeAttr(r.id) + '">删除</button>';
      html += '</div>';
      html += '</div>';

      html += '<div class="card">';
      html += '<div style="font-size:22px;font-weight:700;margin-bottom:8px;">' + escapeHtml(r.name) + '</div>';

      // 标签信息
      html += '<div class="flex items-center gap-12" style="margin-bottom:16px;">';
      html += '<span class="cooking-cat-badge" data-cat="' + escapeAttr(r.category) + '">' + escapeHtml(r.category) + '</span>';
      var diffColor = r.difficulty === '简单' ? '#2ecc71' : (r.difficulty === '困难' ? '#e74c3c' : '#f39c12');
      html += '<span style="padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;background:' + diffColor + '20;color:' + diffColor + ';">' + escapeHtml(r.difficulty) + '</span>';
      html += '<span class="text-muted" style="font-size:13px;">⏱ ' + r.cookTime + '分钟</span>';
      html += '<span class="text-muted" style="font-size:13px;">👥 ' + r.servings + '人份</span>';
      html += '</div>';

      // 食材
      if (r.ingredients.length > 0) {
        html += '<div class="section-title">食材</div>';
        html += '<div class="cooking-item-list">';
        r.ingredients.forEach(function(ing) {
          html += '<div class="cooking-item-row">';
          html += '<span style="font-weight:500;">' + escapeHtml(ing.name) + '</span>';
          html += '<span class="text-muted">' + escapeHtml(ing.amount) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      // 调料
      if (r.seasonings.length > 0) {
        html += '<div class="section-title mt-16">调料</div>';
        html += '<div class="cooking-item-list">';
        r.seasonings.forEach(function(sea) {
          html += '<div class="cooking-item-row">';
          html += '<span style="font-weight:500;">' + escapeHtml(sea.name) + '</span>';
          html += '<span class="text-muted">' + escapeHtml(sea.amount) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      // 步骤
      if (r.steps.length > 0) {
        html += '<div class="section-title mt-16">制作步骤</div>';
        html += '<div class="cooking-steps-list">';
        r.steps.forEach(function(step, idx) {
          html += '<div class="cooking-step-row">';
          html += '<div class="cooking-step-num">' + (idx + 1) + '</div>';
          html += '<div class="cooking-step-text">' + escapeHtml(step) + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      // 备注
      if (r.notes) {
        html += '<div class="section-title mt-16">备注</div>';
        html += '<div class="card" style="background:var(--bg-input);font-size:14px;line-height:1.6;">' + escapeHtml(r.notes) + '</div>';
      }

      html += '</div>';
      return html;
    },

    // 编辑/添加页
    renderEdit: function() {
      var r = currentRecipeId ? data.getRecipe(currentRecipeId) : null;
      var isEdit = !!r;

      var html = '';
      html += '<div class="flex items-center justify-between mb-16">';
      html += '<button class="btn btn-sm btn-secondary" id="cooking-back-btn">&larr; 返回</button>';
      html += '<button class="btn btn-sm btn-primary" id="cooking-save-btn">' + (isEdit ? '保存修改' : '创建菜谱') + '</button>';
      html += '</div>';

      html += '<div class="card">';
      html += '<div class="section-title">' + (isEdit ? '编辑菜谱' : '新建菜谱') + '</div>';

      // 基本信息
      html += '<div class="grid-2 mb-16">';
      html += '<div class="form-group">';
      html += '<label class="form-label">菜名 *</label>';
      html += '<input type="text" id="recipe-name" value="' + (r ? escapeAttr(r.name) : '') + '" placeholder="如：番茄炒蛋" style="width:100%;" />';
      html += '</div>';
      html += '<div class="form-group">';
      html += '<label class="form-label">分类</label>';
      html += '<select id="recipe-category" style="width:100%;">';
      CATEGORIES.forEach(function(cat) {
        html += '<option value="' + escapeAttr(cat) + '"' + (r && r.category === cat ? ' selected' : '') + '>' + escapeHtml(cat) + '</option>';
      });
      html += '</select>';
      html += '</div>';
      html += '</div>';

      html += '<div class="grid-3 mb-16">';
      html += '<div class="form-group">';
      html += '<label class="form-label">难度</label>';
      html += '<select id="recipe-difficulty" style="width:100%;">';
      DIFFICULTIES.forEach(function(diff) {
        html += '<option value="' + escapeAttr(diff) + '"' + (r && r.difficulty === diff ? ' selected' : '') + '>' + escapeHtml(diff) + '</option>';
      });
      html += '</select>';
      html += '</div>';
      html += '<div class="form-group">';
      html += '<label class="form-label">烹饪时间(分钟)</label>';
      html += '<input type="number" id="recipe-cooktime" value="' + (r ? r.cookTime : '') + '" placeholder="如：30" style="width:100%;" />';
      html += '</div>';
      html += '<div class="form-group">';
      html += '<label class="form-label">几人份</label>';
      html += '<input type="number" id="recipe-servings" value="' + (r ? r.servings : '1') + '" style="width:100%;" />';
      html += '</div>';
      html += '</div>';

      // 食材
      html += '<div class="section-title">食材</div>';
      html += '<div id="recipe-ingredients-list">';
      if (r && r.ingredients.length > 0) {
        r.ingredients.forEach(function(ing, idx) {
          html += '<div class="cooking-edit-row" data-type="ingredient" data-index="' + idx + '">';
          html += '<input type="text" class="cooking-ing-name" value="' + escapeAttr(ing.name) + '" placeholder="食材名" style="flex:1;" />';
          html += '<input type="text" class="cooking-ing-amount" value="' + escapeAttr(ing.amount) + '" placeholder="用量" style="width:100px;" />';
          html += '<button class="btn btn-danger btn-sm cooking-del-row" data-type="ingredient" data-index="' + idx + '">删</button>';
          html += '</div>';
        });
      }
      html += '</div>';
      html += '<button class="btn btn-sm btn-secondary cooking-add-row" data-type="ingredient" style="margin-top:8px;">+ 添加食材</button>';

      // 调料
      html += '<div class="section-title mt-16">调料</div>';
      html += '<div id="recipe-seasonings-list">';
      if (r && r.seasonings.length > 0) {
        r.seasonings.forEach(function(sea, idx) {
          html += '<div class="cooking-edit-row" data-type="seasoning" data-index="' + idx + '">';
          html += '<input type="text" class="cooking-sea-name" value="' + escapeAttr(sea.name) + '" placeholder="调料名" style="flex:1;" />';
          html += '<input type="text" class="cooking-sea-amount" value="' + escapeAttr(sea.amount) + '" placeholder="用量" style="width:100px;" />';
          html += '<button class="btn btn-danger btn-sm cooking-del-row" data-type="seasoning" data-index="' + idx + '">删</button>';
          html += '</div>';
        });
      }
      html += '</div>';
      html += '<button class="btn btn-sm btn-secondary cooking-add-row" data-type="seasoning" style="margin-top:8px;">+ 添加调料</button>';

      // 步骤
      html += '<div class="section-title mt-16">制作步骤</div>';
      html += '<div id="recipe-steps-list">';
      if (r && r.steps.length > 0) {
        r.steps.forEach(function(step, idx) {
          html += '<div class="cooking-edit-row cooking-step-edit" data-type="step" data-index="' + idx + '">';
          html += '<span class="cooking-step-edit-num">' + (idx + 1) + '</span>';
          html += '<textarea class="cooking-step-input" placeholder="详细描述这一步..." style="flex:1;min-height:40px;">' + escapeHtml(step) + '</textarea>';
          html += '<button class="btn btn-danger btn-sm cooking-del-row" data-type="step" data-index="' + idx + '">删</button>';
          html += '</div>';
        });
      }
      html += '</div>';
      html += '<button class="btn btn-sm btn-secondary cooking-add-row" data-type="step" style="margin-top:8px;">+ 添加步骤</button>';

      // 备注
      html += '<div class="section-title mt-16">备注</div>';
      html += '<textarea id="recipe-notes" placeholder="烹饪小贴士、注意事项..." style="width:100%;min-height:60px;">' + (r ? escapeHtml(r.notes) : '') + '</textarea>';

      html += '</div>';
      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // 搜索
      var searchInput = document.getElementById('cooking-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          searchKeyword = this.value;
          self.refresh();
          // 重新聚焦
          var newSearch = document.getElementById('cooking-search');
          if (newSearch) {
            newSearch.focus();
            newSearch.setSelectionRange(searchKeyword.length, searchKeyword.length);
          }
        });
      }

      // 添加按钮
      var addBtn = document.getElementById('cooking-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', function() {
          currentView = 'edit';
          currentRecipeId = null;
          self.refresh();
        });
      }

      // 分类筛选
      var catTabs = document.querySelectorAll('#cooking-categories .tab');
      catTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          filterCategory = this.getAttribute('data-category');
          self.refresh();
        });
      });

      // 菜谱卡片点击
      var cards = document.querySelectorAll('.cooking-recipe-card');
      cards.forEach(function(card) {
        card.addEventListener('click', function() {
          currentRecipeId = this.getAttribute('data-recipe-id');
          currentView = 'detail';
          self.refresh();
        });
      });

      // 返回按钮
      var backBtn = document.getElementById('cooking-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', function() {
          currentView = 'list';
          currentRecipeId = null;
          self.refresh();
        });
      }

      // 编辑按钮
      var editBtn = document.getElementById('cooking-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function() {
          currentView = 'edit';
          self.refresh();
        });
      }

      // 删除按钮
      var delBtn = document.getElementById('cooking-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function() {
          var id = this.getAttribute('data-recipe-id');
          if (confirm('确定删除这个菜谱吗？')) {
            data.deleteRecipe(id);
            if (Toast) Toast.info('已删除');
            currentView = 'list';
            currentRecipeId = null;
            self.refresh();
          }
        });
      }

      // 保存按钮
      var saveBtn = document.getElementById('cooking-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          self.saveRecipe();
        });
      }

      // 添加行（食材/调料/步骤）
      var addRowBtns = document.querySelectorAll('.cooking-add-row');
      addRowBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          self.addEditRow(this.getAttribute('data-type'));
        });
      });

      // 删除行
      var delRowBtns = document.querySelectorAll('.cooking-del-row');
      delRowBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          self.removeEditRow(this.getAttribute('data-type'), parseInt(this.getAttribute('data-index'), 10));
        });
      });
    },

    // 收集表单数据并保存
    saveRecipe: function() {
      var nameInput = document.getElementById('recipe-name');
      var name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        if (Toast) Toast.error('请输入菜名');
        return;
      }

      var recipeData = {
        name: name,
        category: document.getElementById('recipe-category') ? document.getElementById('recipe-category').value : '其他',
        difficulty: document.getElementById('recipe-difficulty') ? document.getElementById('recipe-difficulty').value : '简单',
        cookTime: document.getElementById('recipe-cooktime') ? document.getElementById('recipe-cooktime').value : 0,
        servings: document.getElementById('recipe-servings') ? document.getElementById('recipe-servings').value : 1,
        ingredients: [],
        seasonings: [],
        steps: [],
        notes: document.getElementById('recipe-notes') ? document.getElementById('recipe-notes').value : ''
      };

      // 收集食材
      var ingRows = document.querySelectorAll('#recipe-ingredients-list .cooking-edit-row');
      ingRows.forEach(function(row) {
        var nameEl = row.querySelector('.cooking-ing-name');
        var amountEl = row.querySelector('.cooking-ing-amount');
        if (nameEl && nameEl.value.trim()) {
          recipeData.ingredients.push({
            name: nameEl.value.trim(),
            amount: amountEl ? amountEl.value.trim() : ''
          });
        }
      });

      // 收集调料
      var seaRows = document.querySelectorAll('#recipe-seasonings-list .cooking-edit-row');
      seaRows.forEach(function(row) {
        var nameEl = row.querySelector('.cooking-sea-name');
        var amountEl = row.querySelector('.cooking-sea-amount');
        if (nameEl && nameEl.value.trim()) {
          recipeData.seasonings.push({
            name: nameEl.value.trim(),
            amount: amountEl ? amountEl.value.trim() : ''
          });
        }
      });

      // 收集步骤
      var stepRows = document.querySelectorAll('#recipe-steps-list .cooking-edit-row');
      stepRows.forEach(function(row) {
        var stepEl = row.querySelector('.cooking-step-input');
        if (stepEl && stepEl.value.trim()) {
          recipeData.steps.push(stepEl.value.trim());
        }
      });

      // 保存
      if (currentRecipeId) {
        var updated = data.updateRecipe(currentRecipeId, recipeData);
        if (updated) {
          if (Toast) Toast.success('菜谱已更新');
          currentView = 'detail';
          this.refresh();
        } else {
          if (Toast) Toast.error('保存失败');
        }
      } else {
        var created = data.addRecipe(recipeData);
        if (created) {
          if (Toast) Toast.success('菜谱已创建');
          currentRecipeId = created.id;
          currentView = 'detail';
          this.refresh();
        } else {
          if (Toast) Toast.error('创建失败');
        }
      }
    },

    // 添加编辑行
    addEditRow: function(type) {
      var container;
      var html = '';

      if (type === 'ingredient') {
        container = document.getElementById('recipe-ingredients-list');
        html += '<div class="cooking-edit-row" data-type="ingredient">';
        html += '<input type="text" class="cooking-ing-name" placeholder="食材名" style="flex:1;" />';
        html += '<input type="text" class="cooking-ing-amount" placeholder="用量" style="width:100px;" />';
        html += '<button class="btn btn-danger btn-sm cooking-del-row" data-type="ingredient">删</button>';
        html += '</div>';
      } else if (type === 'seasoning') {
        container = document.getElementById('recipe-seasonings-list');
        html += '<div class="cooking-edit-row" data-type="seasoning">';
        html += '<input type="text" class="cooking-sea-name" placeholder="调料名" style="flex:1;" />';
        html += '<input type="text" class="cooking-sea-amount" placeholder="用量" style="width:100px;" />';
        html += '<button class="btn btn-danger btn-sm cooking-del-row" data-type="seasoning">删</button>';
        html += '</div>';
      } else if (type === 'step') {
        container = document.getElementById('recipe-steps-list');
        var stepCount = container.querySelectorAll('.cooking-edit-row').length;
        html += '<div class="cooking-edit-row cooking-step-edit" data-type="step">';
        html += '<span class="cooking-step-edit-num">' + (stepCount + 1) + '</span>';
        html += '<textarea class="cooking-step-input" placeholder="详细描述这一步..." style="flex:1;min-height:40px;"></textarea>';
        html += '<button class="btn btn-danger btn-sm cooking-del-row" data-type="step">删</button>';
        html += '</div>';
      }

      if (container) {
        container.insertAdjacentHTML('beforeend', html);
        // 重新绑定删除事件
        var newDelBtn = container.lastElementChild.querySelector('.cooking-del-row');
        if (newDelBtn) {
          var self = this;
          newDelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var row = this.parentElement;
            row.remove();
          });
        }
        // 聚焦新行
        var firstInput = container.lastElementChild.querySelector('input, textarea');
        if (firstInput) firstInput.focus();
      }
    },

    // 删除编辑行
    removeEditRow: function(type, index) {
      var container;
      if (type === 'ingredient') {
        container = document.getElementById('recipe-ingredients-list');
      } else if (type === 'seasoning') {
        container = document.getElementById('recipe-seasonings-list');
      } else if (type === 'step') {
        container = document.getElementById('recipe-steps-list');
      }
      if (container) {
        var rows = container.querySelectorAll('.cooking-edit-row');
        if (rows[index]) {
          rows[index].remove();
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

  // 辅助：self.refresh() 的替代（避免 this 上下文丢失）
  function self_refresh(self) {
    self.refresh();
  }

  root.App.Cooking = {
    // 数据接口
    getRecipes: data.getRecipes,
    getRecipe: data.getRecipe,
    addRecipe: data.addRecipe,
    updateRecipe: data.updateRecipe,
    deleteRecipe: data.deleteRecipe,
    getCategories: data.getCategories,
    getByCategory: data.getByCategory,
    searchRecipes: data.searchRecipes,
    getStats: data.getStats,
    getAllCategories: data.getAllCategories,
    getAllDifficulties: data.getAllDifficulties,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    // 仅供测试用
    _setView: function(v) { currentView = v; },
    _getView: function() { return currentView; },
    _setRecipeId: function(id) { currentRecipeId = id; },
    _getRecipeId: function() { return currentRecipeId; },
    _setFilter: function(cat) { filterCategory = cat; },
    _setSearch: function(kw) { searchKeyword = kw; },
    _resetState: function() {
      currentView = 'list';
      currentRecipeId = null;
      filterCategory = 'all';
      searchKeyword = '';
    }
  };
})();
