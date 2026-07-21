/**
 * DevHome Workbench - 四象限任务 CRUD + 过滤 + 渲染
 * 从 workbench.js 拆分，职责：任务状态管理、渲染、输入、编辑、时间设置、截止提醒
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const devhomeStorage = ns.devhomeStorage;
    const defaultWorkbenchState = ns.defaultWorkbenchState;
    const storageV2 = ns.storageV2;
    const escapeHtml = ns.escapeHtml;

    const QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

    /* ===== 公共象限遍历方法（消除 8+ 处 QUADRANTS.forEach 重复） ===== */

    /** 遍历四个象限，对每个象限执行回调 */
    ns.forEachQuadrant = function (fn) {
        QUADRANTS.forEach(function (q) { fn(q); });
    };

    /** 获取指定象限的任务列表 */
    ns.getQuadrantTasks = function (quadrant) {
        const config = ns.getWorkbenchState();
        return (config.quadrants[quadrant] && config.quadrants[quadrant].tasks) || [];
    };

    /** 获取除指定象限外的其他三个象限数组 */
    ns.getOtherQuadrants = function (exclude) {
        return QUADRANTS.filter(function (q) { return q !== exclude; });
    };

    /* ===== 任务 ID 生成 ===== */
    function taskId() { return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

    /* ===== 状态获取与保存 ===== */
    ns.getWorkbenchState = function () {
        const saved = devhomeStorage.get('workbench', null);
        const base = JSON.parse(JSON.stringify(defaultWorkbenchState));
        if (saved && saved.quadrants) {
            ns.forEachQuadrant(function (q) {
                if (saved.quadrants[q] && Array.isArray(saved.quadrants[q].tasks)) {
                    base.quadrants[q].tasks = saved.quadrants[q].tasks.map(normalizeTask);
                }
            });
        }
        return base;
    };

    function normalizeTask(task) {
        if (!task.status) { task.status = task.completed ? 'completed' : 'active'; }
        if (!task.createdAt) task.createdAt = Date.now();
        // 补齐时效性字段
        if (!task.plannedAt && task.deadline) task.plannedAt = task.deadline;
        // 迁移 dueDate 字段（ISO 日期字符串，用于任务到期通知）
        if (!task.dueDate && task.plannedAt) {
            task.dueDate = new Date(task.plannedAt).toISOString();
        }
        delete task.completed;
        delete task.deadline;
        // 去重 noteIds
        if (Array.isArray(task.noteIds) && task.noteIds.length > 1) {
            const seen = {};
            task.noteIds = task.noteIds.filter(function (id) {
                if (seen[id]) return false;
                seen[id] = true;
                return true;
            });
        }
        return task;
    }

    ns.saveWorkbenchState = function (nextState) {
        state.workbench = Object.assign({}, ns.getWorkbenchState(), nextState);
        devhomeStorage.set('workbench', state.workbench);
        // 同步到 v2 格式
        const v2Tasks = [];
        ns.forEachQuadrant(function (q) {
            let tasks = state.workbench.quadrants[q] && state.workbench.quadrants[q].tasks;
            if (!tasks) return;
            tasks.forEach(function (t) {
                v2Tasks.push(Object.assign({}, t, { quadrant: q }));
            });
        });
        storageV2.set(storageV2.KEYS.TASKS, v2Tasks).catch(function (err) {
            console.error('[错误] 保存工作台状态到 storageV2 失败', err);
        });
    };

    /* ===== 过滤与渲染辅助 ===== */
    function formatTaskTime(ts) {
        if (!ts) return '';
        const now = new Date();
        const d = new Date(ts);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.floor((today - taskDay) / 86400000);
        const timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        if (diffDays === 0) return timeStr;
        if (diffDays === 1) return '昨天 ' + timeStr;
        if (diffDays < 7) {
            const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return weekdays[d.getDay()] + ' ' + timeStr;
        }
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + timeStr;
    }

    function getVisibleTasks(tasks) {
        const filter = state._quadrantFilter || 'active';
        if (filter === 'all') return tasks;
        return tasks.filter(function (t) {
            return t.status === filter || (filter === 'active' && !t.status) || (filter === 'active' && t.status === undefined);
        });
    }

    /* ===== 四象限渲染 ===== */
    ns.renderQuadrantBoard = function () {
        const config = ns.getWorkbenchState();
        state.workbench = config; // 同步清理后的数据回 state
        const filter = state._quadrantFilter || 'active';
        let totalCount = 0;
        ns.forEachQuadrant(function (q) {
            totalCount += (config.quadrants[q] && config.quadrants[q].tasks || []).length;
        });

        // 更新过滤按钮
        const filterBtn = document.getElementById('wbTaskFilterBtn');
        if (filterBtn) {
            filterBtn.textContent = filter === 'active' ? '活跃' : '全部';
        }

        // 维度标签映射
        const qLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };

        ns.forEachQuadrant(function (activeQ) {
            const listEl = document.getElementById('wbQgList' + activeQ.toUpperCase());
            const allTasks = (config.quadrants[activeQ] && config.quadrants[activeQ].tasks) || [];
            const visibleTasks = getVisibleTasks(allTasks);

            // 隐藏任务计数徽章（只显示任务列表）
            const countEl = document.getElementById('wbQgCount' + activeQ.toUpperCase());
            if (countEl) countEl.textContent = '';

            if (!listEl) return;

            if (visibleTasks.length === 0) {
                listEl.innerHTML = '';
                return;
            }

            // 渲染任务列表
            listEl.innerHTML = visibleTasks.map(function (task) {
                const isActive = task.status === 'active' || !task.status || task.status === undefined;
                const isCompleted = task.status === 'completed' || (!task.status && task.completed);
                const isCancelled = task.status === 'cancelled';
                const rowClass = isCompleted ? ' is-completed' : (isCancelled ? ' is-cancelled' : '');
                const checkClass = isCompleted ? ' checked' : '';

                // 关联笔记指示器（清理已删除笔记的引用）
                const rawNoteIds = task.noteIds || [];
                const existingNoteIds = {};
                (state.notes || []).forEach(function (n) { existingNoteIds[n.id] = true; });
                const validNoteIds = rawNoteIds.filter(function (nid) { return existingNoteIds[nid]; });
                if (validNoteIds.length !== rawNoteIds.length) {
                    task.noteIds = validNoteIds; // 清理孤立引用
                }
                let noteBadge = '';
                if (validNoteIds.length > 0) {
                    noteBadge = '<span class="wb-task-note-badge" title="已关联 ' + validNoteIds.length + ' 篇笔记">📎' + validNoteIds.length + '</span>';
                }

                // 计划时间 / 超期标记
                let timeBadge = '';
                if (task.plannedAt && isActive) {
                    const plannedDate = new Date(task.plannedAt);
                    const now = Date.now();
                    const overdue = plannedDate.getTime() < now;
                    const timeLabel = formatTaskTime(task.plannedAt);
                    const timeTitle = overdue ? '已超期: ' + timeLabel : '计划: ' + timeLabel;
                    timeBadge = '<span class="wb-task-item-time' + (overdue ? ' overdue' : '') + '" title="' + timeTitle + '">' +
                        (overdue ? '⚠ ' : '⏰ ') + timeLabel + '</span>';
                }

                // 任务描述指示器
                let contentBadge = '';
                if (task.content && task.content.trim()) {
                    contentBadge = '<span class="wb-task-note-badge" title="' + escapeHtml(task.content.trim().slice(0, 80)) + '" style="opacity:0.4;">📝</span>';
                }

                return '<div class="wb-task-item' + rowClass + '" ' +
                    'data-task-id="' + escapeHtml(task.id) + '" ' +
                    'data-quadrant="' + activeQ + '">' +
                    (isActive
                        ? '<button class="wb-task-check' + checkClass + '" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + activeQ + '" title="标记完成"></button>'
                        : '<span class="wb-task-check checked" style="pointer-events:none;"></span>') +
                    '<span class="wb-task-item-title" title="' + escapeHtml(task.title) + '">' + escapeHtml(task.title) + '</span>' +
                    timeBadge +
                    contentBadge +
                    noteBadge +
                    (isActive
                        ? '<button class="wb-task-more-btn" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + activeQ + '" title="更多操作">⋮</button>'
                        : '') +
                    '</div>';
            }).join('');
        });
        console.log('[面板] 四象限渲染完成 总任务=' + totalCount + ' 过滤=' + filter);
    };

    /* ===== 任务 CRUD ===== */
    ns.toggleQuadrantFilter = function () {
        state._quadrantFilter = state._quadrantFilter === 'active' ? 'all' : 'active';
        ns.renderQuadrantBoard();
    };

    ns.addQuadrantTask = function (quadrant, title, opts) {
        if (!title || !title.trim()) return;
        const config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) config.quadrants[quadrant] = { tasks: [] };
        opts = opts || {};
        const plannedAt = opts.plannedAt || null;
        config.quadrants[quadrant].tasks.push({
            id: taskId(),
            title: title.trim(),
            status: 'active',
            noteIds: opts.noteIds || [],
            content: opts.content || '',
            plannedAt: plannedAt,
            dueDate: plannedAt ? new Date(plannedAt).toISOString() : null,  // ISO 字符串供通知检查
            createdAt: Date.now()
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
    };

    ns.completeQuadrantTask = function (quadrant, taskIdToComplete) {
        const config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) return;
        config.quadrants[quadrant].tasks = config.quadrants[quadrant].tasks.map(function (t) {
            if (t.id === taskIdToComplete) { t.status = 'completed'; t.completedAt = Date.now(); delete t.completed; }
            return t;
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
    };

    ns.cancelQuadrantTask = function (quadrant, taskIdToCancel) {
        const config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) return;
        config.quadrants[quadrant].tasks = config.quadrants[quadrant].tasks.map(function (t) {
            if (t.id === taskIdToCancel) { t.status = 'cancelled'; t.cancelledAt = Date.now(); delete t.completed; }
            return t;
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
    };

    ns.moveQuadrantTask = function (taskIdToMove, fromQuadrant, toQuadrant) {
        if (fromQuadrant === toQuadrant) return;
        const config = ns.getWorkbenchState();
        if (!config.quadrants[fromQuadrant] || !config.quadrants[toQuadrant]) return;
        let task = null;
        config.quadrants[fromQuadrant].tasks = config.quadrants[fromQuadrant].tasks.filter(function (t) {
            if (t.id === taskIdToMove) { task = t; return false; } return true;
        });
        if (task) config.quadrants[toQuadrant].tasks.push(task);
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
    };

    /** 通过下拉菜单切换任务维度 */
    ns.changeTaskQuadrant = function (taskId, fromQuadrant, toQuadrant) {
        if (!toQuadrant || fromQuadrant === toQuadrant) return;
        const config = ns.getWorkbenchState();
        if (!config.quadrants[fromQuadrant] || !config.quadrants[toQuadrant]) return;

        let task = null;
        config.quadrants[fromQuadrant].tasks = config.quadrants[fromQuadrant].tasks.filter(function (t) {
            if (t.id === taskId) { task = t; return false; }
            return true;
        });

        if (task) {
            task.quadrant = toQuadrant;
            if (!config.quadrants[toQuadrant].tasks) config.quadrants[toQuadrant].tasks = [];
            config.quadrants[toQuadrant].tasks.push(task);
            ns.saveWorkbenchState({ quadrants: config.quadrants });
            state.workbench = ns.getWorkbenchState();
            ns.renderQuadrantBoard();
            console.log('[编辑] 任务 ' + taskId + ' 维度变更: ' + fromQuadrant + ' -> ' + toQuadrant);
        }
    };

    ns.clearCompletedTasks = function () {
        const config = ns.getWorkbenchState();
        let count = 0;
        ns.forEachQuadrant(function (q) {
            if (!config.quadrants[q]) return;
            const before = config.quadrants[q].tasks.length;
            config.quadrants[q].tasks = config.quadrants[q].tasks.filter(function (t) {
                return t.status === 'active' || (!t.status && !t.completed);
            });
            count += before - config.quadrants[q].tasks.length;
        });
        if (count === 0) return;
        ns.showConfirm('将永久删除 ' + count + ' 条已完成/已取消的任务，不可恢复。确定继续？', { title: '清除已完成任务' }).then(function (ok) {
            if (!ok) return;
            ns.saveWorkbenchState({ quadrants: config.quadrants });
            state.workbench = ns.getWorkbenchState();
            ns.renderQuadrantBoard();
        });
    };

    /* ===== 任务内联编辑 ===== */
    /** 显示任务添加内联输入框 */
    ns.showQuadrantInput = function (quadrant, addBtn) {
        if (!addBtn) return;

        // 移除已有输入框
        const existing = document.querySelector('.wb-task-input-row');
        if (existing) { existing.remove(); return; }

        const row = document.createElement('div');
        row.className = 'wb-task-input-row';
        row.innerHTML = '<input type="text" placeholder="输入任务，回车确认..." autofocus>' +
            '<button class="wb-task-input-expand" title="展开详细设置（描述、计划时间）">📝</button>' +
            '<button class="wb-task-input-confirm" title="确认">✓</button>' +
            '<button class="wb-task-input-cancel" title="取消">✕</button>';
        addBtn.insertAdjacentElement('beforebegin', row);
        const input = row.querySelector('input');
        const expandBtn = row.querySelector('.wb-task-input-expand');
        const confirmBtn = row.querySelector('.wb-task-input-confirm');
        const cancelBtn = row.querySelector('.wb-task-input-cancel');

        // 详细面板（默认隐藏）
        let detailPanel = null;
        let descInput = null;
        let dateInput = null;

        function showDetail() {
            if (detailPanel) { if (detailPanel.isConnected) detailPanel.remove(); detailPanel = null; return; }
            detailPanel = document.createElement('div');
            detailPanel.className = 'wb-task-input-detail';
            detailPanel.innerHTML = '<textarea placeholder="任务描述（可选）" rows="3"></textarea>' +
                '<input type="date" class="wb-task-input-date" placeholder="计划执行日期">';
            row.after(detailPanel);
            descInput = detailPanel.querySelector('textarea');
            dateInput = detailPanel.querySelector('.wb-task-input-date');
            // 恢复焦点到标题输入
            input.focus();
        }

        const submitFn = function () {
            let title = input.value.trim();
            if (!title) return;
            const desc = descInput ? descInput.value.trim() : '';
            const plannedAt = dateInput && dateInput.value ? new Date(dateInput.value + 'T00:00:00').getTime() : null;
            if (detailPanel && detailPanel.isConnected) detailPanel.remove();
            if (row.isConnected) row.remove();
            ns.addQuadrantTask(quadrant, title, { content: desc, plannedAt: plannedAt });
        };
        const cancelFn = function () {
            if (detailPanel && detailPanel.isConnected) detailPanel.remove();
            if (row.isConnected) row.remove();
        };

        expandBtn.addEventListener('click', function (e) { e.stopPropagation(); showDetail(); });
        confirmBtn.addEventListener('click', submitFn);
        cancelBtn.addEventListener('click', cancelFn);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFn(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelFn(); }
        });
        setTimeout(function () { input.focus(); }, 50);
    };

    /** 内联编辑任务标题 */
    ns.editQuadrantTask = function (taskId, quadrant) {
        const config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) return;
        let task = (config.quadrants[quadrant].tasks || []).find(function (t) { return t.id === taskId; });
        if (!task) return;

        // 查找对应 DOM 中的任务标题元素
        const listEl = document.getElementById('wbQgList' + quadrant.toUpperCase());
        if (!listEl) return;
        const taskItem = listEl.querySelector('[data-task-id="' + taskId + '"]');
        if (!taskItem) return;
        const titleEl = taskItem.querySelector('.wb-task-item-title');
        if (!titleEl) return;

        // 如果已有内联编辑框，先清除
        const existing = listEl.querySelector('.wb-task-inline-edit');
        if (existing) existing.remove();

        // 创建内联编辑组件
        const editRow = document.createElement('div');
        editRow.className = 'wb-task-inline-edit';
        editRow.innerHTML = '<input type="text" value="' + escapeHtml(task.title) + '" placeholder="编辑任务标题...">' +
            '<div class="wb-task-inline-edit-btns">' +
                '<button class="wb-task-inline-save" title="保存">✓</button>' +
                '<button class="wb-task-inline-cancel" title="取消">✕</button>' +
            '</div>';

        // 替换标题为编辑框
        titleEl.style.display = 'none';
        titleEl.parentNode.insertBefore(editRow, titleEl.nextSibling);

        const input = editRow.querySelector('input');
        const saveBtn = editRow.querySelector('.wb-task-inline-save');
        const cancelBtn = editRow.querySelector('.wb-task-inline-cancel');

        const cleanup = function () {
            if (editRow.isConnected) editRow.remove();
            titleEl.style.display = '';
        };

        const doSave = function () {
            const newTitle = input.value.trim();
            cleanup();
            if (!newTitle || newTitle === task.title) return;
            // 更新任务标题
            config.quadrants[quadrant].tasks = config.quadrants[quadrant].tasks.map(function (t) {
                if (t.id === taskId) t.title = newTitle;
                return t;
            });
            ns.saveWorkbenchState({ quadrants: config.quadrants });
            state.workbench = ns.getWorkbenchState();
            ns.renderQuadrantBoard();
            console.log('[编辑] 任务标题更新: ' + taskId + ' → ' + newTitle.slice(0, 30));
        };

        saveBtn.addEventListener('click', doSave);
        cancelBtn.addEventListener('click', cleanup);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); doSave(); }
            if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
        });
        setTimeout(function () { input.focus(); input.select(); }, 50);
        console.log('[编辑] 开始编辑任务标题 id=' + taskId);
    };

    /** 将 Date 格式化为 input[type=date] 所需的 yyyy-mm-dd */
    function toDateInputValue(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /**
     * 弹出行内时间编辑面板，修改/清除已有任务的截止时间。
     * 交互重构（需求3+4）：
     *   - 「取消」仅关闭面板、不改动数据（不再伪装成清除）；
     *   - 「移除时间」为独立的危险操作按钮，仅在任务已设时间时出现，点击后清空 plannedAt/dueDate；
     *   - 新增快捷预设（今天/明天/本周末/下周），提升设置效率与视觉层次。
     */
    ns.setTaskTime = function (taskId, quadrant) {
        const config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) return;
        let task = (config.quadrants[quadrant].tasks || []).find(function (t) { return t.id === taskId; });
        if (!task) return;

        // 构建一个行内时间编辑面板
        const listEl = document.getElementById('wbQgList' + quadrant.toUpperCase());
        if (!listEl) return;
        const existing = listEl.querySelector('.wb-task-inline-time-edit');
        if (existing) existing.remove();

        // 从 plannedAt 还原日期和时间
        const hasTime = !!task.plannedAt;
        const curDate = hasTime ? new Date(task.plannedAt) : null;
        const dateVal = curDate ? toDateInputValue(curDate) : '';
        const timeVal = curDate ? String(curDate.getHours()).padStart(2, '0') + ':' + String(curDate.getMinutes()).padStart(2, '0') : '';

        const panel = document.createElement('div');
        panel.className = 'wb-task-inline-time-edit';
        panel.innerHTML =
            '<div class="wb-time-panel-head">' +
                '<span class="wb-time-panel-title">⏰ 设置截止时间</span>' +
                '<button class="wb-time-panel-close" type="button" title="关闭">✕</button>' +
            '</div>' +
            '<div class="wb-time-quick">' +
                '<button class="wb-time-chip" type="button" data-preset="today">今天</button>' +
                '<button class="wb-time-chip" type="button" data-preset="tomorrow">明天</button>' +
                '<button class="wb-time-chip" type="button" data-preset="weekend">本周末</button>' +
                '<button class="wb-time-chip" type="button" data-preset="nextweek">下周</button>' +
            '</div>' +
            '<div class="wb-time-fields">' +
                '<label class="wb-time-field"><span class="wb-time-field-label">日期</span>' +
                    '<input type="date" class="wb-time-picker-date" value="' + dateVal + '"></label>' +
                '<label class="wb-time-field"><span class="wb-time-field-label">时间</span>' +
                    '<input type="time" class="wb-time-picker-time" value="' + timeVal + '"></label>' +
            '</div>' +
            '<div class="wb-time-panel-foot">' +
                (hasTime ? '<button class="wb-time-remove" type="button" title="清除该任务的截止时间">移除时间</button>' : '<span></span>') +
                '<div class="wb-time-panel-actions">' +
                    '<button class="wb-time-cancel" type="button">取消</button>' +
                    '<button class="wb-time-save" type="button">保存</button>' +
                '</div>' +
            '</div>';

        const taskItem = listEl.querySelector('[data-task-id="' + taskId + '"]');
        if (taskItem) {
            taskItem.insertAdjacentElement('afterend', panel);
        } else {
            listEl.insertBefore(panel, listEl.firstChild);
        }

        const dateInput = panel.querySelector('.wb-time-picker-date');
        const timeInput = panel.querySelector('.wb-time-picker-time');
        const saveBtn = panel.querySelector('.wb-time-save');
        const cancelBtn = panel.querySelector('.wb-time-cancel');
        const closeBtn = panel.querySelector('.wb-time-panel-close');
        const removeBtn = panel.querySelector('.wb-time-remove');

        const cleanup = function () {
            document.removeEventListener('keydown', onKeydown);
            if (panel.isConnected) panel.remove();
        };

        const saveTime = function (plannedAt) {
            config.quadrants[quadrant].tasks = config.quadrants[quadrant].tasks.map(function (t) {
                if (t.id === taskId) {
                    t.plannedAt = plannedAt;
                    t.dueDate = plannedAt ? new Date(plannedAt).toISOString() : null;
                }
                return t;
            });
            ns.saveWorkbenchState({ quadrants: config.quadrants });
            state.workbench = ns.getWorkbenchState();
            ns.renderQuadrantBoard();
            console.log('[编辑] 任务 ' + taskId + ' 截止时间 ' + (plannedAt ? '更新' : '已移除'));
        };

        // 快捷预设：填充日期输入（时间保留已填值，否则给默认时间）
        const applyPreset = function (preset) {
            const now = new Date();
            let target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            let defaultTime = '18:00';
            if (preset === 'today') {
                defaultTime = '18:00';
            } else if (preset === 'tomorrow') {
                target.setDate(target.getDate() + 1);
                defaultTime = '09:00';
            } else if (preset === 'weekend') {
                // 本周六（getDay: 0=周日..6=周六）
                const offset = (6 - target.getDay() + 7) % 7;
                target.setDate(target.getDate() + offset);
                defaultTime = '10:00';
            } else if (preset === 'nextweek') {
                // 下周一
                const offset = (8 - target.getDay()) % 7 || 7;
                target.setDate(target.getDate() + offset);
                defaultTime = '09:00';
            }
            dateInput.value = toDateInputValue(target);
            if (!timeInput.value) timeInput.value = defaultTime;
            console.log('[交互] 时间面板快捷预设 ' + preset + ' → ' + dateInput.value + ' ' + timeInput.value);
        };

        const onKeydown = function (e) {
            if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                const plannedAt = ns._readTimePickerValueEl(dateInput, timeInput);
                cleanup();
                saveTime(plannedAt);
            }
        };

        panel.querySelectorAll('.wb-time-chip').forEach(function (chip) {
            chip.addEventListener('click', function () { applyPreset(chip.dataset.preset); });
        });
        saveBtn.addEventListener('click', function () {
            const plannedAt = ns._readTimePickerValueEl(dateInput, timeInput);
            cleanup();
            saveTime(plannedAt);
        });
        // 「取消」「关闭」仅关闭面板，不改动已保存的时间
        cancelBtn.addEventListener('click', cleanup);
        closeBtn.addEventListener('click', cleanup);
        // 「移除时间」独立危险操作，明确清空已设置的时间
        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                cleanup();
                saveTime(null);
                ns.showToast('已移除任务截止时间', 'info');
            });
        }
        document.addEventListener('keydown', onKeydown);

        // 自动聚焦日期输入
        if (dateInput) setTimeout(function () { dateInput.focus(); }, 50);
        console.log('[编辑] 设置任务时间 id=' + taskId + ' 已有时间=' + hasTime);
    };

    /** 从已有的 date/time DOM 元素读取时间戳（供 setTaskTime 内联使用） */
    ns._readTimePickerValueEl = function (dateEl, timeEl) {
        if (!dateEl || !dateEl.value) return null;
        const dateStr = dateEl.value;
        const timeStr = timeEl && timeEl.value ? timeEl.value : '23:59';
        const dt = new Date(dateStr + 'T' + timeStr + ':00');
        if (isNaN(dt.getTime())) return null;
        return dt.getTime();
    };

    /* ===== 任务浮动菜单 ===== */
    let _taskMenuEl = null;

    ns.showTaskContextMenu = function (taskId, quadrant, evt) {
        ns.hideTaskContextMenu();
        const qLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };
        const otherQs = ns.getOtherQuadrants(quadrant);

        // 检查是否有已关联笔记
        const linkedNotes = ns.getTaskLinkedNotes(taskId);
        const hasLinkedNotes = linkedNotes && linkedNotes.length > 0;
        const linkedBadge = hasLinkedNotes ? ' (' + linkedNotes.length + '篇)' : '';

        const menu = document.createElement('div');
        menu.className = 'wb-task-context-menu';
        menu.innerHTML = otherQs.map(function (q) {
            return '<button data-action="move" data-to="' + q + '" data-task-id="' + escapeHtml(taskId) + '" data-from="' + quadrant + '">移至' + qLabels[q] + '</button>';
        }).join('') +
            '<div class="wb-task-menu-sep"></div>' +
            '<button data-action="edit" data-task-id="' + escapeHtml(taskId) + '" data-quadrant="' + quadrant + '">编辑任务</button>' +
            '<button data-action="set-time" data-task-id="' + escapeHtml(taskId) + '" data-quadrant="' + quadrant + '">设置时间</button>' +
            (hasLinkedNotes ? '<button data-action="view-linked-notes" data-task-id="' + escapeHtml(taskId) + '" data-quadrant="' + quadrant + '">查看关联笔记' + linkedBadge + '</button>' : '') +
            '<button data-action="link-notes" data-task-id="' + escapeHtml(taskId) + '" data-quadrant="' + quadrant + '">关联笔记</button>' +
            '<button data-action="delete" data-task-id="' + escapeHtml(taskId) + '" data-quadrant="' + quadrant + '">删除任务</button>';

        document.body.appendChild(menu);
        _taskMenuEl = menu;

        // 定位菜单
        const rect = evt.target.getBoundingClientRect();
        const top = rect.bottom + 4;
        const left = Math.min(rect.left, window.innerWidth - 180);
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';

        // 点击外部关闭
        const closeHandler = function (e) {
            if (!menu.contains(e.target)) {
                ns.hideTaskContextMenu();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(function () { document.addEventListener('click', closeHandler); }, 0);
        console.log('[面板] 打开任务操作菜单 task=' + taskId);
    };

    ns.hideTaskContextMenu = function () {
        if (_taskMenuEl) {
            if (_taskMenuEl.isConnected) _taskMenuEl.remove();
            _taskMenuEl = null;
        }
    };

    /* ===== 截止时间轮询提醒 ===== */
    (function () {
        let _deadlineNotified = {}; // 已提醒的 taskId 集合，避免重复弹窗
        let _deadlineTimer = null;

        ns.startDeadlineChecker = function () {
            if (_deadlineTimer) return;
            _deadlineTimer = setInterval(function () {
                if (state.currentDevhomeMode !== 'workbench') return;
                const config = state.workbench || ns.getWorkbenchState();
                if (!config || !config.quadrants) return;
                ns.forEachQuadrant(function (q) {
                    let tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
                    tasks.forEach(function (task) {
                        if (task.status !== 'active' || !task.plannedAt) return;
                        let remaining = task.plannedAt - Date.now();
                        // 超期 或 剩余不足 2 分钟且未提醒
                        if (remaining <= 0 || (remaining < 120000 && remaining > 0)) {
                            if (_deadlineNotified[task.id]) return;
                            _deadlineNotified[task.id] = true;
                            let label = remaining <= 0 ? '已超期' : '即将到期';
                            let title = (task.title || '').slice(0, 30);
                            ns.showToast('⏰ ' + label + ': ' + title, remaining <= 0 ? 'warning' : 'info');
                            console.log('[提醒] 截止时间 ' + label + ' task=' + task.id + ' title=' + title);
                        }
                    });
                });
            }, 60000); // 每分钟检查一次
        };

        ns.stopDeadlineChecker = function () {
            if (_deadlineTimer) { clearInterval(_deadlineTimer); _deadlineTimer = null; }
            _deadlineNotified = {};
        };
    })();

})(window.DevHome);
