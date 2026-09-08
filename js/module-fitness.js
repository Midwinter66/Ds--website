// ===== 健身计划模块 =====
(function() {
  'use strict';
  var root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.App = root.App || {};
  var Storage = root.App.Storage;
  var Toast = root.App.Toast;

  var STORAGE_KEY = 'app_fitness';

  // 模块内状态
  var selectedPlanId = null;    // 当前选中查看的计划 ID
  var editPlanId = null;        // 编辑模式时保存实际的 plan ID
  var isTraining = false;       // 是否在训练模式中
  var trainingPlanId = null;    // 正在训练的计划 ID
  var completedExercises = {};  // 训练中已完成的动作 { exerciseId: true }

  // ===== 数据操作 =====
  var data = {
    getAll: function() {
      var raw = Storage.get(STORAGE_KEY, null);
      if (!raw || typeof raw !== 'object') {
        return { plans: [], history: [], todayPlan: null, bodyStats: [] };
      }
      if (!Array.isArray(raw.plans)) raw.plans = [];
      if (!Array.isArray(raw.history)) raw.history = [];
      if (!Array.isArray(raw.bodyStats)) raw.bodyStats = [];
      if (raw.todayPlan === undefined) raw.todayPlan = null;
      return raw;
    },

    saveAll: function(fitnessData) {
      Storage.set(STORAGE_KEY, fitnessData);
    },

    getPlans: function() {
      return data.getAll().plans;
    },

    getPlan: function(id) {
      if (!id) return null;
      var plans = data.getAll().plans;
      for (var i = 0; i < plans.length; i++) {
        if (plans[i].id === id) return plans[i];
      }
      return null;
    },

    createPlan: function(name, description, exercises) {
      if (!name || !name.trim()) return null;
      var fitnessData = data.getAll();
      var plan = {
        id: Storage.generateId(),
        name: name.trim(),
        description: (description || '').trim(),
        exercises: []
      };
      if (Array.isArray(exercises)) {
        for (var i = 0; i < exercises.length; i++) {
          var ex = exercises[i];
          if (ex && ex.name && ex.name.trim()) {
            plan.exercises.push({
              id: Storage.generateId(),
              name: ex.name.trim(),
              sets: parseInt(ex.sets) || 0,
              reps: parseInt(ex.reps) || 0,
              weight: (ex.weight || '').toString().trim()
            });
          }
        }
      }
      fitnessData.plans.push(plan);
      data.saveAll(fitnessData);
      return plan;
    },

    updatePlan: function(id, fields) {
      if (!id || !fields) return null;
      var fitnessData = data.getAll();
      for (var i = 0; i < fitnessData.plans.length; i++) {
        if (fitnessData.plans[i].id === id) {
          if (fields.name !== undefined) fitnessData.plans[i].name = fields.name.trim();
          if (fields.description !== undefined) fitnessData.plans[i].description = fields.description.trim();
          if (fields.exercises !== undefined && Array.isArray(fields.exercises)) {
            fitnessData.plans[i].exercises = [];
            for (var j = 0; j < fields.exercises.length; j++) {
              var ex = fields.exercises[j];
              if (ex && ex.name && ex.name.trim()) {
                fitnessData.plans[i].exercises.push({
                  id: ex.id || Storage.generateId(),
                  name: ex.name.trim(),
                  sets: parseInt(ex.sets) || 0,
                  reps: parseInt(ex.reps) || 0,
                  weight: (ex.weight || '').toString().trim()
                });
              }
            }
          }
          data.saveAll(fitnessData);
          return fitnessData.plans[i];
        }
      }
      return null;
    },

    deletePlan: function(id) {
      if (!id) return false;
      var fitnessData = data.getAll();
      var originalLength = fitnessData.plans.length;
      fitnessData.plans = fitnessData.plans.filter(function(p) { return p.id !== id; });
      if (fitnessData.plans.length < originalLength) {
        if (fitnessData.todayPlan === id) {
          fitnessData.todayPlan = null;
        }
        data.saveAll(fitnessData);
        return true;
      }
      return false;
    },

    addExercise: function(planId, exercise) {
      if (!planId || !exercise || !exercise.name || !exercise.name.trim()) return null;
      var fitnessData = data.getAll();
      for (var i = 0; i < fitnessData.plans.length; i++) {
        if (fitnessData.plans[i].id === planId) {
          var ex = {
            id: Storage.generateId(),
            name: exercise.name.trim(),
            sets: parseInt(exercise.sets) || 0,
            reps: parseInt(exercise.reps) || 0,
            weight: (exercise.weight || '').toString().trim()
          };
          fitnessData.plans[i].exercises.push(ex);
          data.saveAll(fitnessData);
          return ex;
        }
      }
      return null;
    },

    deleteExercise: function(planId, exerciseId) {
      if (!planId || !exerciseId) return false;
      var fitnessData = data.getAll();
      for (var i = 0; i < fitnessData.plans.length; i++) {
        if (fitnessData.plans[i].id === planId) {
          var originalLength = fitnessData.plans[i].exercises.length;
          fitnessData.plans[i].exercises = fitnessData.plans[i].exercises.filter(function(e) {
            return e.id !== exerciseId;
          });
          if (fitnessData.plans[i].exercises.length < originalLength) {
            data.saveAll(fitnessData);
            return true;
          }
          return false;
        }
      }
      return false;
    },

    setTodayPlan: function(planId) {
      var fitnessData = data.getAll();
      fitnessData.todayPlan = planId || null;
      data.saveAll(fitnessData);
      return fitnessData.todayPlan;
    },

    getTodayPlan: function() {
      var fitnessData = data.getAll();
      if (!fitnessData.todayPlan) return null;
      return data.getPlan(fitnessData.todayPlan);
    },

    addHistory: function(planId, planName, completedExerciseIds) {
      var fitnessData = data.getAll();
      var record = {
        id: Storage.generateId(),
        date: Storage.getTodayDate(),
        planId: planId,
        planName: planName,
        completedExercises: completedExerciseIds.slice()
      };
      fitnessData.history.push(record);
      data.saveAll(fitnessData);
      return record;
    },

    getHistory: function() {
      var fitnessData = data.getAll();
      return fitnessData.history.slice().sort(function(a, b) {
        if (a.date < b.date) return 1;
        if (a.date > b.date) return -1;
        return 0;
      });
    },

    getTodayHistory: function() {
      var today = Storage.getTodayDate();
      var history = data.getHistory();
      return history.filter(function(h) { return h.date === today; });
    },

    getTodaySummary: function() {
      var todayPlan = data.getTodayPlan();
      var todayHistory = data.getTodayHistory();

      if (!todayPlan) {
        return { hasPlan: false, planName: '', total: 0, completed: 0, historyCount: todayHistory.length };
      }

      var total = todayPlan.exercises.length;
      var completed = 0;

      if (todayHistory.length > 0) {
        var latest = todayHistory[0];
        completed = latest.completedExercises.length;
      }

      return {
        hasPlan: true,
        planName: todayPlan.name,
        total: total,
        completed: completed,
        historyCount: todayHistory.length
      };
    },

    // ---------- 个人身体数据 ----------
    // 添加身体数据记录
    addBodyStat: function(date, weight, height) {
      if (!date || weight === undefined || weight === null || isNaN(parseFloat(weight))) return null;
      var fitnessData = data.getAll();
      var stat = {
        id: Storage.generateId(),
        date: date,
        weight: parseFloat(weight),
        height: height ? parseFloat(height) : 0,
        createdAt: Date.now()
      };
      fitnessData.bodyStats.push(stat);
      data.saveAll(fitnessData);
      return stat;
    },

    // 获取所有身体数据（按日期升序）
    getBodyStats: function() {
      var fitnessData = data.getAll();
      return fitnessData.bodyStats.slice().sort(function(a, b) {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
      });
    },

    // 获取最新一条身体数据
    getLatestBodyStat: function() {
      var stats = data.getBodyStats();
      if (stats.length === 0) return null;
      return stats[stats.length - 1];
    },

    // 删除身体数据记录
    deleteBodyStat: function(id) {
      if (!id) return false;
      var fitnessData = data.getAll();
      var originalLength = fitnessData.bodyStats.length;
      fitnessData.bodyStats = fitnessData.bodyStats.filter(function(s) { return s.id !== id; });
      if (fitnessData.bodyStats.length < originalLength) {
        data.saveAll(fitnessData);
        return true;
      }
      return false;
    },

    // 获取体重变化历史（日期 + 体重）
    getWeightHistory: function() {
      var stats = data.getBodyStats();
      return stats.map(function(s) {
        return { id: s.id, date: s.date, weight: s.weight };
      });
    },

    // 计算 BMI
    calculateBMI: function(weight, height) {
      if (!weight || !height || height <= 0) return 0;
      var h = height / 100; // 转为米
      return Math.round(weight / (h * h) * 10) / 10; // 保留一位小数
    },

    // 计算每日营养摄入建议（基于体重）
    calculateNutrition: function(weight) {
      if (!weight || weight <= 0) return null;
      return {
        protein: Math.round(weight * 1.6 * 10) / 10,   // 1.6g/kg
        carbs: Math.round(weight * 5 * 10) / 10,         // 5g/kg
        fat: Math.round(weight * 1 * 10) / 10,            // 1g/kg
        calories: Math.round((weight * 1.6 * 4 + weight * 5 * 4 + weight * 1 * 9) * 10) / 10
      };
    }
  };

  // ===== 辅助函数 =====
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

  function renderExerciseRow(ex) {
    var html = '';
    html += '<div class="exercise-row flex items-center gap-8" style="padding:6px 0;">';
    html += '<input type="text" data-field="name" data-ex-id="' + (ex ? escapeAttr(ex.id) : '') + '" placeholder="动作名称" style="flex:1;" value="' + escapeAttr(ex ? ex.name : '') + '" />';
    html += '<input type="number" data-field="sets" placeholder="组" style="width:60px;" value="' + (ex ? ex.sets : '') + '" />';
    html += '<input type="number" data-field="reps" placeholder="次" style="width:60px;" value="' + (ex ? ex.reps : '') + '" />';
    html += '<input type="text" data-field="weight" placeholder="重量" style="width:80px;" value="' + escapeAttr(ex ? ex.weight : '') + '" />';
    html += '<button class="btn btn-icon btn-secondary exercise-del-row" title="删除">&times;</button>';
    html += '</div>';
    return html;
  }

  // ===== UI 渲染 =====
  var ui = {
    render: function() {
      return this.renderPage();
    },

    renderPage: function() {
      var plans = data.getPlans();

      // 如果选中的计划不存在，重置
      if (selectedPlanId && selectedPlanId !== '__new__' && selectedPlanId !== '__edit__') {
        var found = false;
        for (var i = 0; i < plans.length; i++) {
          if (plans[i].id === selectedPlanId) { found = true; break; }
        }
        if (!found) selectedPlanId = plans.length > 0 ? plans[0].id : null;
      } else if (!selectedPlanId && plans.length > 0) {
        selectedPlanId = plans[0].id;
      }

      var html = '';
      html += '<div class="split-layout">';

      // 左侧：计划列表
      html += '<div class="split-left">';
      html += '<button class="btn btn-primary btn-sm mb-12" id="fitness-new-plan" style="width:100%;">+ 新建训练计划</button>';
      html += '<div id="fitness-plan-list">';
      html += this.renderPlanList();
      html += '</div>';
      html += '</div>';

      // 右侧：计划详情或编辑表单
      html += '<div class="split-right">';
      html += this.renderDetail();
      html += '</div>';

      html += '</div>'; // end split-layout

      // 个人数据统计区域
      html += this.renderBodyStatsSection();

      return html;
    },

    renderPlanList: function() {
      var plans = data.getPlans();
      var todayPlanId = data.getAll().todayPlan;
      var html = '';

      if (plans.length === 0) {
        html += '<div class="empty-state" style="padding:24px 8px;">';
        html += '<div class="empty-state-text">还没有训练计划，点击上方按钮创建</div>';
        html += '</div>';
        return html;
      }

      plans.forEach(function(plan) {
        var active = plan.id === selectedPlanId ? ' active' : '';
        var todayMark = plan.id === todayPlanId ? ' <span style="color:var(--accent);font-size:12px;">[今日]</span>' : '';
        var exCount = plan.exercises.length;
        html += '<div class="date-list-item' + active + '" data-plan-id="' + escapeAttr(plan.id) + '">';
        html += '<span class="date-dot"></span>';
        html += '<span>' + escapeHtml(plan.name) + todayMark + '</span>';
        html += '<span class="text-muted" style="font-size:12px;margin-left:auto;">' + exCount + '个动作</span>';
        html += '</div>';
      });
      return html;
    },

    renderDetail: function() {
      // 新建模式
      if (selectedPlanId === '__new__') {
        return this.renderEditForm(null);
      }

      // 编辑模式
      if (selectedPlanId === '__edit__') {
        var editPlan = editPlanId ? data.getPlan(editPlanId) : null;
        return this.renderEditForm(editPlan);
      }

      // 训练模式
      if (isTraining && trainingPlanId) {
        return this.renderTrainingMode();
      }

      var plan = selectedPlanId ? data.getPlan(selectedPlanId) : null;

      if (!plan) {
        var html = '';
        html += '<div class="empty-state">';
        html += '<div class="empty-state-icon">\u{1F4AA}</div>';
        html += '<div class="empty-state-text">创建你的第一个训练计划</div>';
        html += '</div>';
        return html;
      }

      return this.renderPlanDetail(plan);
    },

    renderPlanDetail: function(plan) {
      var fitnessData = data.getAll();
      var isToday = fitnessData.todayPlan === plan.id;
      var html = '';

      html += '<div class="card">';
      html += '<div class="flex items-center justify-between mb-16">';
      html += '<span style="font-size:18px;font-weight:600;">' + escapeHtml(plan.name) + '</span>';
      html += '<div class="flex gap-8">';
      html += '<button class="btn btn-sm btn-secondary" id="fitness-edit-btn">编辑</button>';
      html += '<button class="btn btn-sm btn-danger" id="fitness-delete-btn">删除</button>';
      html += '</div>';
      html += '</div>';

      if (plan.description) {
        html += '<div class="text-secondary mb-12">' + escapeHtml(plan.description) + '</div>';
      }

      // 今日标记
      if (isToday) {
        html += '<div class="mb-12"><span style="color:var(--accent);font-size:13px;">\u2713 今日训练计划</span></div>';
      } else {
        html += '<button class="btn btn-sm btn-secondary mb-12" id="fitness-set-today">设为今日训练</button>';
      }

      // 动作列表
      html += '<div class="section-title">动作列表 (' + plan.exercises.length + ')</div>';
      if (plan.exercises.length === 0) {
        html += '<div class="text-muted" style="text-align:center;padding:16px;">还没有动作，点击编辑添加</div>';
      } else {
        html += '<div class="card" style="background:var(--bg-input);">';
        plan.exercises.forEach(function(ex, idx) {
          html += '<div class="flex items-center gap-12" style="padding:8px 0;' + (idx > 0 ? 'border-top:1px solid var(--border);' : '') + '">';
          html += '<span style="font-weight:600;min-width:24px;">' + (idx + 1) + '</span>';
          html += '<span style="flex:1;font-weight:500;">' + escapeHtml(ex.name) + '</span>';
          html += '<span class="text-secondary" style="font-size:13px;">' + ex.sets + '组 x ' + ex.reps + '次</span>';
          if (ex.weight) {
            html += '<span class="text-secondary" style="font-size:13px;">' + escapeHtml(ex.weight) + '</span>';
          }
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';

      // 开始训练按钮
      if (plan.exercises.length > 0) {
        html += '<button class="btn btn-primary mt-16" id="fitness-start-training" style="width:100%;">开始训练</button>';
      }

      // 训练历史
      html += '<div class="section-title mt-20">训练历史</div>';
      var history = data.getHistory();
      var planHistory = history.filter(function(h) { return h.planId === plan.id; });
      if (planHistory.length === 0) {
        html += '<div class="text-muted" style="text-align:center;padding:12px;">暂无训练记录</div>';
      } else {
        html += '<div class="card">';
        planHistory.forEach(function(h) {
          html += '<div class="flex items-center justify-between" style="padding:6px 0;border-bottom:1px solid var(--border);">';
          html += '<span>' + escapeHtml(h.date) + '</span>';
          html += '<span class="text-secondary" style="font-size:13px;">完成 ' + h.completedExercises.length + ' 个动作</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      return html;
    },

    renderEditForm: function(existingPlan) {
      var html = '';
      html += '<div class="card">';
      html += '<div class="section-title">' + (existingPlan ? '编辑计划' : '新建计划') + '</div>';

      html += '<div class="form-group mb-12">';
      html += '<label class="form-label">计划名称</label>';
      html += '<input type="text" id="fitness-plan-name" style="width:100%;" value="' + escapeAttr(existingPlan ? existingPlan.name : '') + '" placeholder="如：推日训练" />';
      html += '</div>';

      html += '<div class="form-group mb-12">';
      html += '<label class="form-label">描述（选填）</label>';
      html += '<input type="text" id="fitness-plan-desc" style="width:100%;" value="' + escapeAttr(existingPlan ? existingPlan.description : '') + '" placeholder="如：胸/肩/三头" />';
      html += '</div>';

      html += '<div class="section-title">动作列表</div>';
      html += '<div id="fitness-exercise-list">';
      var exercises = existingPlan ? existingPlan.exercises : [];
      if (exercises.length === 0) {
        html += '<div class="text-muted" style="text-align:center;padding:8px;">点击下方添加动作</div>';
      } else {
        exercises.forEach(function(ex) {
          html += renderExerciseRow(ex);
        });
      }
      html += '</div>';

      html += '<button class="btn btn-sm btn-secondary mt-8" id="fitness-add-exercise" style="width:100%;">+ 添加动作</button>';

      html += '<div class="flex gap-8 mt-16">';
      var editIdAttr = existingPlan ? ' data-edit-id="' + escapeAttr(existingPlan.id) + '"' : '';
      html += '<button class="btn btn-primary" id="fitness-save-plan" style="flex:1;"' + editIdAttr + '>保存</button>';
      html += '<button class="btn btn-secondary" id="fitness-cancel-edit">取消</button>';
      html += '</div>';

      html += '</div>';

      return html;
    },

    renderTrainingMode: function() {
      var plan = data.getPlan(trainingPlanId);
      if (!plan) {
        isTraining = false;
        trainingPlanId = null;
        return this.renderDetail();
      }

      var total = plan.exercises.length;
      var completedCount = Object.keys(completedExercises).length;
      var percent = total > 0 ? Math.round(completedCount / total * 100) : 0;

      var html = '';
      html += '<div class="card">';
      html += '<div class="flex items-center justify-between mb-16">';
      html += '<span style="font-size:18px;font-weight:600;">训练中：' + escapeHtml(plan.name) + '</span>';
      html += '<button class="btn btn-sm btn-secondary" id="fitness-exit-training">退出</button>';
      html += '</div>';

      // 进度
      html += '<div class="flex justify-between items-center mb-12">';
      html += '<span class="text-secondary">训练进度</span>';
      html += '<span class="text-secondary">' + completedCount + '/' + total + ' (' + percent + '%)</span>';
      html += '</div>';
      html += '<div class="progress-bar mb-16"><div class="progress-fill' + (percent === 100 ? ' complete' : '') + '" style="width:' + percent + '%;"></div></div>';

      // 动作勾选列表
      html += '<div class="card" style="background:var(--bg-input);">';
      plan.exercises.forEach(function(ex, idx) {
        var isChecked = completedExercises[ex.id];
        html += '<div class="task-item flex items-center gap-12" data-exercise-id="' + escapeAttr(ex.id) + '" style="padding:10px 0;' + (idx > 0 ? 'border-top:1px solid var(--border);' : '') + '">';
        html += '<div class="task-checkbox' + (isChecked ? ' checked' : '') + '"></div>';
        html += '<span style="flex:1;font-weight:500;' + (isChecked ? 'text-decoration:line-through;color:var(--text-muted);' : '') + '">' + escapeHtml(ex.name) + '</span>';
        html += '<span class="text-secondary" style="font-size:13px;">' + ex.sets + 'x' + ex.reps + '</span>';
        if (ex.weight) {
          html += '<span class="text-secondary" style="font-size:13px;">' + escapeHtml(ex.weight) + '</span>';
        }
        html += '</div>';
      });
      html += '</div>';

      // 完成按钮
      if (completedCount === total && total > 0) {
        html += '<button class="btn btn-primary mt-16" id="fitness-complete-training" style="width:100%;">完成训练</button>';
      }

      html += '</div>';
      return html;
    },

    // ===== 个人数据统计 =====
    renderBodyStatsSection: function() {
      var stats = data.getBodyStats();
      var latest = stats.length > 0 ? stats[stats.length - 1] : null;
      var today = Storage.getTodayDate();
      var html = '';

      html += '<div class="card mt-20">';
      html += '<div class="section-title">个人数据</div>';

      // 添加体重身高表单
      html += '<div class="grid-3 mb-16" style="grid-template-columns:1fr 1fr auto;align-items:end;">';
      html += '<div class="form-group" style="margin:0;">';
      html += '<label class="form-label">日期</label>';
      html += '<input type="date" id="fitness-stat-date" value="' + today + '" style="width:100%;" />';
      html += '</div>';
      html += '<div class="form-group" style="margin:0;">';
      html += '<label class="form-label">体重 (kg)</label>';
      html += '<input type="number" id="fitness-stat-weight" placeholder="如 70.5" step="0.1" style="width:100%;" />';
      html += '</div>';
      html += '<div class="form-group" style="margin:0;">';
      html += '<label class="form-label">身高 (cm)</label>';
      html += '<input type="number" id="fitness-stat-height" placeholder="如 175" step="0.1" style="width:100%;" value="' + (latest ? latest.height : '') + '" />';
      html += '</div>';
      html += '</div>';
      html += '<button class="btn btn-primary btn-sm" id="fitness-add-stat" style="width:100%;margin-bottom:16px;">记录数据</button>';

      // 统计信息
      if (latest) {
        var bmi = data.calculateBMI(latest.weight, latest.height);

        html += '<div class="grid-3 mb-16">';
        // BMI 卡片
        var bmiStatus = bmi < 18.5 ? '偏瘦' : (bmi < 24 ? '正常' : (bmi < 28 ? '偏胖' : '肥胖'));
        var bmiColor = bmi < 18.5 ? '#3498db' : (bmi < 24 ? '#2ecc71' : (bmi < 28 ? '#f39c12' : '#e74c3c'));
        html += '<div class="card" style="text-align:center;background:var(--bg-input);">';
        html += '<div class="text-muted" style="font-size:12px;">BMI</div>';
        html += '<div style="font-size:28px;font-weight:700;color:' + bmiColor + ';">' + bmi + '</div>';
        html += '<div style="font-size:12px;color:' + bmiColor + ';">' + bmiStatus + '</div>';
        html += '</div>';

        // 体重卡片
        var prevWeight = stats.length > 1 ? stats[stats.length - 2].weight : latest.weight;
        var weightDiff = Math.round((latest.weight - prevWeight) * 10) / 10;
        var diffText = weightDiff > 0 ? '+' + weightDiff + ' kg' : (weightDiff < 0 ? weightDiff + ' kg' : '持平');
        var diffColor = weightDiff > 0 ? '#e74c3c' : (weightDiff < 0 ? '#2ecc71' : 'var(--text-muted)');
        html += '<div class="card" style="text-align:center;background:var(--bg-input);">';
        html += '<div class="text-muted" style="font-size:12px;">当前体重</div>';
        html += '<div style="font-size:28px;font-weight:700;color:var(--accent);">' + latest.weight + ' kg</div>';
        html += '<div style="font-size:12px;color:' + diffColor + ';">' + diffText + '</div>';
        html += '</div>';

        // 身高卡片
        html += '<div class="card" style="text-align:center;background:var(--bg-input);">';
        html += '<div class="text-muted" style="font-size:12px;">身高</div>';
        html += '<div style="font-size:28px;font-weight:700;color:#9b59b6;">' + (latest.height || '-') + '</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">cm</div>';
        html += '</div>';
        html += '</div>';

        // 营养建议
        var nutrition = data.calculateNutrition(latest.weight);
        if (nutrition) {
          html += '<div class="card" style="background:var(--bg-input);">';
          html += '<div style="font-size:14px;font-weight:600;margin-bottom:10px;">每日营养摄入建议 <span class="text-muted" style="font-size:12px;font-weight:400;">（基于体重 ' + latest.weight + ' kg）</span></div>';
          html += '<div class="grid-3">';
          // 蛋白质
          html += '<div style="text-align:center;padding:10px;border-radius:var(--radius-sm);background:rgba(231,76,60,0.1);">';
          html += '<div style="font-size:12px;color:var(--text-muted);">蛋白质</div>';
          html += '<div style="font-size:20px;font-weight:700;color:#e74c3c;">' + nutrition.protein + 'g</div>';
          html += '<div style="font-size:11px;color:var(--text-muted);">1.6g/kg</div>';
          html += '</div>';
          // 碳水
          html += '<div style="text-align:center;padding:10px;border-radius:var(--radius-sm);background:rgba(241,196,15,0.1);">';
          html += '<div style="font-size:12px;color:var(--text-muted);">碳水化合物</div>';
          html += '<div style="font-size:20px;font-weight:700;color:#f1c40f;">' + nutrition.carbs + 'g</div>';
          html += '<div style="font-size:11px;color:var(--text-muted);">5g/kg</div>';
          html += '</div>';
          // 脂肪
          html += '<div style="text-align:center;padding:10px;border-radius:var(--radius-sm);background:rgba(230,126,34,0.1);">';
          html += '<div style="font-size:12px;color:var(--text-muted);">脂肪</div>';
          html += '<div style="font-size:20px;font-weight:700;color:#e67e22;">' + nutrition.fat + 'g</div>';
          html += '<div style="font-size:11px;color:var(--text-muted);">1g/kg</div>';
          html += '</div>';
          html += '</div>';
          html += '<div style="text-align:center;margin-top:8px;font-size:13px;color:var(--text-secondary);">预计每日热量摄入：约 <strong style="color:var(--accent);">' + nutrition.calories + '</strong> 千卡</div>';
          html += '</div>';
        }

        // 体重变化历史
        html += '<div class="section-title mt-16">体重变化记录</div>';
        if (stats.length > 0) {
          html += '<div class="card" style="background:var(--bg-input);">';
          stats.slice().reverse().forEach(function(s, idx) {
            var prev = idx < stats.length - 1 ? stats[stats.length - 2 - idx].weight : s.weight;
            var diff = Math.round((s.weight - prev) * 10) / 10;
            var dColor = diff > 0 ? '#e74c3c' : (diff < 0 ? '#2ecc71' : 'var(--text-muted)');
            var dText = diff > 0 ? '+' + diff : (diff < 0 ? '' + diff : '持平');
            html += '<div class="flex items-center justify-between" style="padding:6px 0;' + (idx > 0 ? 'border-top:1px solid var(--border);' : '') + '">';
            html += '<span style="font-size:13px;">' + escapeHtml(s.date) + '</span>';
            html += '<div class="flex items-center gap-12">';
            html += '<span style="font-weight:600;">' + s.weight + ' kg</span>';
            if (idx < stats.length - 1) {
              html += '<span style="font-size:12px;color:' + dColor + ';min-width:50px;text-align:right;">' + dText + '</span>';
            } else {
              html += '<span style="font-size:12px;color:var(--text-muted);min-width:50px;text-align:right;">初始</span>';
            }
            html += '<button class="btn btn-danger btn-sm fitness-del-stat" data-stat-id="' + escapeAttr(s.id) + '" style="padding:2px 6px;font-size:11px;">删除</button>';
            html += '</div>';
            html += '</div>';
          });
          html += '</div>';
        }
      } else {
        html += '<div class="text-muted" style="text-align:center;padding:16px;">还没有记录身体数据，记录今天的体重和身高开始追踪</div>';
      }

      html += '</div>';
      return html;
    },

    afterRender: function() {
      this.bindEvents();
    },

    bindEvents: function() {
      var self = this;

      // 新建计划
      var newBtn = document.getElementById('fitness-new-plan');
      if (newBtn) {
        newBtn.addEventListener('click', function() {
          selectedPlanId = '__new__';
          editPlanId = null;
          self.refresh();
        });
      }

      // 计划列表点击
      var listItems = document.querySelectorAll('.date-list-item[data-plan-id]');
      listItems.forEach(function(item) {
        item.addEventListener('click', function() {
          selectedPlanId = this.getAttribute('data-plan-id');
          editPlanId = null;
          isTraining = false;
          self.refresh();
        });
      });

      // 编辑按钮
      var editBtn = document.getElementById('fitness-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function() {
          editPlanId = selectedPlanId;
          selectedPlanId = '__edit__';
          self.refresh();
        });
      }

      // 删除按钮
      var delBtn = document.getElementById('fitness-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function() {
          if (confirm('确定删除这个训练计划吗？')) {
            data.deletePlan(selectedPlanId);
            selectedPlanId = null;
            if (Toast) Toast.info('已删除');
            self.refresh();
          }
        });
      }

      // 设为今日训练
      var setTodayBtn = document.getElementById('fitness-set-today');
      if (setTodayBtn) {
        setTodayBtn.addEventListener('click', function() {
          data.setTodayPlan(selectedPlanId);
          if (Toast) Toast.success('已设为今日训练');
          self.refresh();
        });
      }

      // 开始训练
      var startBtn = document.getElementById('fitness-start-training');
      if (startBtn) {
        startBtn.addEventListener('click', function() {
          isTraining = true;
          trainingPlanId = selectedPlanId;
          completedExercises = {};
          self.refresh();
        });
      }

      // 训练模式中的事件
      if (isTraining) {
        // 勾选动作
        var exerciseItems = document.querySelectorAll('.task-item[data-exercise-id]');
        exerciseItems.forEach(function(item) {
          item.addEventListener('click', function() {
            var exId = this.getAttribute('data-exercise-id');
            if (completedExercises[exId]) {
              delete completedExercises[exId];
            } else {
              completedExercises[exId] = true;
            }
            self.refresh();
          });
        });

        // 退出训练
        var exitBtn = document.getElementById('fitness-exit-training');
        if (exitBtn) {
          exitBtn.addEventListener('click', function() {
            isTraining = false;
            trainingPlanId = null;
            completedExercises = {};
            self.refresh();
          });
        }

        // 完成训练
        var completeBtn = document.getElementById('fitness-complete-training');
        if (completeBtn) {
          completeBtn.addEventListener('click', function() {
            var plan = data.getPlan(trainingPlanId);
            if (plan) {
              var completedIds = Object.keys(completedExercises);
              data.addHistory(plan.id, plan.name, completedIds);
              if (Toast) Toast.success('训练完成！');
            }
            isTraining = false;
            trainingPlanId = null;
            completedExercises = {};
            self.refresh();
          });
        }
      }

      // 编辑表单事件
      this.bindEditFormEvents();

      // 个人数据统计事件
      this.bindBodyStatEvents();
    },

    bindEditFormEvents: function() {
      var self = this;

      // 添加动作行
      var addExBtn = document.getElementById('fitness-add-exercise');
      if (addExBtn) {
        addExBtn.addEventListener('click', function() {
          var container = document.getElementById('fitness-exercise-list');
          if (container) {
            var div = document.createElement('div');
            div.innerHTML = renderExerciseRow(null);
            var newRow = div.firstChild;
            container.appendChild(newRow);

            // 删除默认提示
            var placeholder = container.querySelector('.text-muted');
            if (placeholder) placeholder.remove();

            // 绑定删除行
            var delBtn = newRow.querySelector('.exercise-del-row');
            if (delBtn) {
              delBtn.addEventListener('click', function() {
                newRow.remove();
              });
            }
          }
        });
      }

      // 删除已有动作行
      var delRowBtns = document.querySelectorAll('.exercise-del-row');
      delRowBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var row = this.closest('.exercise-row');
          if (row) row.remove();
        });
      });

      // 保存计划
      var saveBtn = document.getElementById('fitness-save-plan');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          var nameInput = document.getElementById('fitness-plan-name');
          var descInput = document.getElementById('fitness-plan-desc');
          var name = nameInput ? nameInput.value : '';
          var description = descInput ? descInput.value : '';

          if (!name.trim()) {
            if (Toast) Toast.error('请输入计划名称');
            return;
          }

          // 收集动作
          var rows = document.querySelectorAll('.exercise-row');
          var exercises = [];
          rows.forEach(function(row) {
            var nameEl = row.querySelector('[data-field="name"]');
            var setsEl = row.querySelector('[data-field="sets"]');
            var repsEl = row.querySelector('[data-field="reps"]');
            var weightEl = row.querySelector('[data-field="weight"]');
            if (nameEl && nameEl.value.trim()) {
              exercises.push({
                id: nameEl.getAttribute('data-ex-id') || '',
                name: nameEl.value,
                sets: setsEl ? setsEl.value : 0,
                reps: repsEl ? repsEl.value : 0,
                weight: weightEl ? weightEl.value : ''
              });
            }
          });

          // 判断是新建还是编辑
          var editId = saveBtn.getAttribute('data-edit-id');
          if (editId) {
            data.updatePlan(editId, { name: name, description: description, exercises: exercises });
            selectedPlanId = editId;
            editPlanId = null;
            if (Toast) Toast.success('计划已更新');
          } else {
            var plan = data.createPlan(name, description, exercises);
            selectedPlanId = plan ? plan.id : null;
            if (Toast) Toast.success('计划已创建');
          }
          self.refresh();
        });
      }

      // 取消
      var cancelBtn = document.getElementById('fitness-cancel-edit');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          var plans = data.getPlans();
          selectedPlanId = plans.length > 0 ? plans[0].id : null;
          editPlanId = null;
          self.refresh();
        });
      }
    },

    bindBodyStatEvents: function() {
      var self = this;

      // 记录数据按钮
      var addStatBtn = document.getElementById('fitness-add-stat');
      if (addStatBtn) {
        addStatBtn.addEventListener('click', function() {
          var dateInput = document.getElementById('fitness-stat-date');
          var weightInput = document.getElementById('fitness-stat-weight');
          var heightInput = document.getElementById('fitness-stat-height');
          var date = dateInput ? dateInput.value : '';
          var weight = weightInput ? weightInput.value : '';
          var height = heightInput ? heightInput.value : '';

          if (!date) {
            if (Toast) Toast.error('请选择日期');
            return;
          }
          if (!weight || isNaN(parseFloat(weight))) {
            if (Toast) Toast.error('请输入体重');
            return;
          }

          var stat = data.addBodyStat(date, weight, height);
          if (stat) {
            if (Toast) Toast.success('数据已记录');
            self.refresh();
          } else {
            if (Toast) Toast.error('记录失败');
          }
        });
      }

      // 删除身体数据
      var delStatBtns = document.querySelectorAll('.fitness-del-stat');
      delStatBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var statId = this.getAttribute('data-stat-id');
          if (confirm('确定删除这条记录吗？')) {
            data.deleteBodyStat(statId);
            if (Toast) Toast.info('已删除');
            self.refresh();
          }
        });
      });
    },

    refresh: function() {
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = this.renderPage();
        this.bindEvents();
      }
    }
  };

  root.App.Fitness = {
    // 数据接口
    getPlans: data.getPlans,
    getPlan: data.getPlan,
    createPlan: data.createPlan,
    updatePlan: data.updatePlan,
    deletePlan: data.deletePlan,
    addExercise: data.addExercise,
    deleteExercise: data.deleteExercise,
    setTodayPlan: data.setTodayPlan,
    getTodayPlan: data.getTodayPlan,
    getHistory: data.getHistory,
    getTodayHistory: data.getTodayHistory,
    getTodaySummary: data.getTodaySummary,
    addHistory: data.addHistory,
    // 个人数据接口
    addBodyStat: data.addBodyStat,
    getBodyStats: data.getBodyStats,
    getLatestBodyStat: data.getLatestBodyStat,
    deleteBodyStat: data.deleteBodyStat,
    getWeightHistory: data.getWeightHistory,
    calculateBMI: data.calculateBMI,
    calculateNutrition: data.calculateNutrition,
    // UI 接口
    render: ui.render.bind(ui),
    afterRender: ui.afterRender.bind(ui),
    // 仅供测试用：重置内部状态
    _resetState: function() {
      selectedPlanId = null;
      editPlanId = null;
      isTraining = false;
      trainingPlanId = null;
      completedExercises = {};
    }
  };
})();
