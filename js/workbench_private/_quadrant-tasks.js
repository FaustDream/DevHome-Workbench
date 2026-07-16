/**
 * DevHome Workbench - 四象限任务 CRUD + 过滤 + 渲染
 * 从 workbench.js 拆分，职责：任务状态管理、渲染、输入、编辑、时间设置、截止提醒
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var devhomeStorage = ns.devhomeStorage;
    var defaultWorkbenchState = ns.defaultWorkbenchState;
    var storageV2 = ns.storageV2;
    var escapeHtml = ns.escapeHtml;

    var QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

    /* ===== 公共象限遍历方法（消除 8+ 处 QUADRANTS.forEach 重复） ===== */

    /** 遍历四个象限，对每个象限执行回调 */
    ns.forEachQuadrant = function (fn) {
        QUADRANTS.forEach(function (q) { fn(q); });
    };

    /** 获取指定象限的任务列表 */
    ns.getQuadrantTasks = function (quadrant) {
        var config = ns.getWorkbenchState();
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
        var saved = devhomeStorage.get('workbench', null);
        var base = JSON.parse(JSON.stringify(defaultWorkbenchState));
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
            var seen = {};
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
        var v2Tasks = [];
        ns.forEachQuadrant(function (q) {
            var tasks = state.workbench.quadrants[q] && state.workbench.quadrants[q].tasks;
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
        var now = new Date();
        var d = new Date(ts);
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var diffDays = Math.floor((today - taskDay) / 86400000);
        var timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        if (diffDays === 0) return timeStr;
        if (diffDays === 1) return '昨天 ' + timeStr;
        if (diffDays < 7) {
            var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return weekdays[d.getDay()] + ' ' + timeStr;
        }
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + timeStr;
    }

    function getVisibleTasks(tasks) {
        var filter = state._quadrantFilter || 'active';
        if (filter === 'all') return tasks;
        return tasks.filter(function (t) {
            return t.status === filter || (filter === 'active' && !t.status) || (filter === 'active' && t.status === undefined);
        });
    }

    /* ===== 四象限渲染 ===== */
    ns.renderQuadrantBoard = function () {
        var config = ns.getWorkbenchState();
        state.workbench = config; // 同步清理后的数据回 state
        var filter = state._quadrantFilter || 'active';
        var totalCount = 0;
        ns.forEachQuadrant(function (q) {
            totalCount += (config.quadrants[q] && config.quadrants[q].tasks || []).length;
        });

        // 更新过滤按钮
        var filterBtn = document.getElementById('wbTaskFilterBtn');
        if (filterBtn) {
            filterBtn.textContent = filter === 'active' ? '活跃' : '全部';
        }

        // 维度标签映射
        var qLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };

        ns.forEachQuadrant(function (activeQ) {
            var listEl = document.getElementById('wbQgList' + activeQ.toUpperCase());
            var allTasks = (config.quadrants[activeQ] && config.quadrants[activeQ].tasks) || [];
            var visibleTasks = getVisibleTasks(allTasks);

            // 隐藏任务计数徽章（只显示任务列表）
            var countEl = document.getElementById('wbQgCount' + activeQ.toUpperCase());
            if (countEl) countEl.textContent = '';

            if (!listEl) return;

            if (visibleTasks.length === 0) {
                listEl.innerHTML = '';
                return;
            }

            // 渲染任务列表
            listEl.innerHTML = visibleTasks.map(function (task) {
                var isActive = task.status === 'active' || !task.status || task.status === undefined;
                var isCompleted = task.status === 'completed' || (!task.status && task.completed);
                var isCancelled = task.status === 'cancelled';
                var rowClass = isCompleted ? ' is-completed' : (isCancelled ? ' is-cancelled' : '');
                var checkClass = isCompleted ? ' checked' : '';

                // 关联笔记指示器（清理已删除笔记的引用）
                var rawNoteIds = task.noteIds || [];
                var existingNoteIds = {};
                (state.notes || []).forEach(function (n) { existingNoteIds[n.id] = true; });
                var validNoteIds = rawNoteIds.filter(function (nid) { return existingNoteIds[nid]; });
                if (validNoteIds.length !== rawNoteIds.length) {
                    task.noteIds = validNoteIds; // 清理孤立引用
                }
                var noteBadge = '';
                if (validNoteIds.length > 0) {
                    noteBadge = '<span class="wb-task-note-badge" title="已关联 ' + validNoteIds.length + ' 篇笔记">📎' + validNoteIds.length + '</span>';
                }

                // 计划时间 / 超期标记
                var timeBadge = '';
                if (task.plannedAt && isActive) {
                    var plannedDate = new Date(task.plannedAt);
                    var now = Date.now();
                    var overdue = plannedDate.getTime() < now;
                    var timeLabel = formatTaskTime(task.plannedAt);
                    var timeTitle = overdue ? '已超期: ' + timeLabel : '计划: ' + timeLabel;
                    timeBadge = '<span class="wb-task-item-time' + (overdue ? ' overdue' : '') + '" title="' + timeTitle + '">' +
                        (overdue ? '⚠ ' : '⏰ ') + timeLabel + '</span>';
                }

                // 任务描述指示器
                var contentBadge = '';
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
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) config.quadrants[quadrant] = { tasks: [] };
        opts = opts || {};
        var plannedAt = opts.plannedAt || null;
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
        var config = ns.getWorkbenchState();
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
        var config = ns.getWorkbenchState();
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
        var config = ns.getWorkbenchState();
        if (!config.quadrants[fromQuadrant] || !config.quadrants[toQuadrant]) return;
        var task = null;
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
        var config = ns.getWorkbenchState();
        if (!config.quadrants[fromQuadrant] || !config.quadrants[toQuadrant]) return;

        var task = null;
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
        var config = ns.getWorkbenchState();
        var count = 0;
        ns.forEachQuadrant(function (q) {
            if (!config.quadrants[q]) return;
            var before = config.quadrants[q].tasks.length;
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
        var existing = document.querySelector('.wb-task-input-row');
        if (existing) { existing.remove(); return; }

        var row = document.createElement('div');
        row.className = 'wb-task-input-row';
        row.innerHTML = '<input type="text" placeholder="输入任务，回车确认..." autofocus>' +
            '<button class="wb-task-input-expand" title="展开详细设置（描述、计划时间）">📝</button>' +
            '<button class="wb-task-input-confirm" title="确认">✓</button>' +
            '<button class="wb-task-input-cancel" title="取消">✕</button>';
        addBtn.insertAdjacentElement('beforebegin', row);
        var input = row.querySelector('input');
        var expandBtn = row.querySelector('.wb-task-input-expand');
        var confirmBtn = row.querySelector('.wb-task-input-confirm');
        var cancelBtn = row.querySelector('.wb-task-input-cancel');

        // 详细面板（默认隐藏）
        var detailPanel = null;
        var descInput = null;
        var dateInput = null;

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

        var submitFn = function () {
            var title = input.value.trim();
            if (!title) return;
            var desc = descInput ? descInput.value.trim() : '';
            var plannedAt = dateInput && dateInput.value ? new Date(dateInput.value + 'T00:00:00').getTime() : null;
            if (detailPanel && detailPanel.isConnected) detailPanel.remove();
            if (row.isConnected) row.remove();
            ns.addQuadrantTask(quadrant, title, { content: desc, plannedAt: plannedAt });
        };
        var cancelFn = function () {
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
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) return;
        var task = (config.quadrants[quadrant].tasks || []).find(function (t) { return t.id === taskId; });
        if (!task) return;

        // 查找对应 DOM 中的任务标题元素
        var listEl = document.getElementById('wbQgList' + quadrant.toUpperCase());
        if (!listEl) return;
        var taskItem = listEl.querySelector('[data-task-id="' + taskId + '"]');
        if (!taskItem) return;
        var titleEl = taskItem.querySelector('.wb-task-item-title');
        if (!titleEl) return;

        // 如果已有内联编辑框，先清除
        var existing = listEl.querySelector('.wb-task-inline-edit');
        if (existing) existing.remove();

        // 创建内联编辑组件
        var editRow = document.createElement('div');
        editRow.className = 'wb-task-inline-edit';
        editRow.innerHTML = '<input type="text" value="' + escapeHtml(task.title) + '" placeholder="编辑任务标题...">' +
            '<div class="wb-task-inline-edit-btns">' +
                '<button class="wb-task-inline-save" title="保存">✓</button>' +
                '<button class="wb-task-inline-cancel" title="取消">✕</button>' +
            '</div>';

        // 替换标题为编辑框
        titleEl.style.display = 'none';
        titleEl.parentNode.insertBefore(editRow, titleEl.nextSibling);

        var input = editRow.querySelector('input');
        var saveBtn = editRow.querySelector('.wb-task-inline-save');
        var cancelBtn = editRow.querySelector('.wb-task-inline-cancel');

        var cleanup = function () {
            if (editRow.isConnected) editRow.remove();
            titleEl.style.display = '';
        };

        var doSave = function () {
            var newTitle = input.value.trim();
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

    /** 弹出时间选择器修改已有任务的截止时间 */
    ns.setTaskTime = function (taskId, quadrant) {
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) return;
        var task = (config.quadrants[quadrant].tasks || []).find(function (t) { return t.id === taskId; });
        if (!task) return;

        // 构建一个行内时间编辑面板
        var listEl = document.getElementById('wbQgList' + quadrant.toUpperCase());
        if (!listEl) return;
        var existing = listEl.querySelector('.wb-task-inline-time-edit');
        if (existing) existing.remove();

        var row = document.createElement('div');
        row.className = 'wb-task-inline-time-edit';
        // 从 plannedAt 还原日期和时间
        var curDate = task.plannedAt ? new Date(task.plannedAt) : null;
        var dateVal = curDate ? curDate.getFullYear() + '-' + String(curDate.getMonth() + 1).padStart(2, '0') + '-' + String(curDate.getDate()).padStart(2, '0') : '';
        var timeVal = curDate ? String(curDate.getHours()).padStart(2, '0') + ':' + String(curDate.getMinutes()).padStart(2, '0') : '';
        row.innerHTML = '<span style="font-size:10px;color:var(--color-text-secondary);margin-right:4px;">截止:</span>' +
            '<input type="date" class="wb-time-picker-date" value="' + dateVal + '" style="flex:1;">' +
            '<input type="time" class="wb-time-picker-time" value="' + timeVal + '" style="flex:1;">' +
            '<button class="wb-task-input-confirm" title="保存">✓</button>' +
            '<button class="wb-task-input-cancel" title="清除">✕</button>' +
            '<button class="wb-task-input-expand" title="移除时间" style="font-size:11px;">🗑</button>';

        var taskItem = listEl.querySelector('[data-task-id="' + taskId + '"]');
        if (taskItem) {
            taskItem.insertAdjacentElement('afterend', row);
        } else {
            listEl.insertBefore(row, listEl.firstChild);
        }

        var dateInput = row.querySelector('input[type="date"]');
        var timeInput = row.querySelector('input[type="time"]');
        var confirmBtn = row.querySelector('.wb-task-input-confirm');
        var cancelBtn = row.querySelector('.wb-task-input-cancel');
        var removeBtn = row.querySelector('.wb-task-input-expand');

        var cleanup = function () { if (row.isConnected) row.remove(); };

        var saveTime = function (plannedAt) {
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

        confirmBtn.addEventListener('click', function () {
            var plannedAt = ns._readTimePickerValueEl(dateInput, timeInput);
            cleanup();
            saveTime(plannedAt);
        });
        cancelBtn.addEventListener('click', cleanup);
        removeBtn.addEventListener('click', function () {
            cleanup();
            saveTime(null);
        });

        // 自动聚焦日期输入
        if (dateInput) setTimeout(function () { dateInput.focus(); }, 50);
        console.log('[编辑] 设置任务时间 id=' + taskId);
    };

    /** 从已有的 date/time DOM 元素读取时间戳（供 setTaskTime 内联使用） */
    ns._readTimePickerValueEl = function (dateEl, timeEl) {
        if (!dateEl || !dateEl.value) return null;
        var dateStr = dateEl.value;
        var timeStr = timeEl && timeEl.value ? timeEl.value : '23:59';
        var dt = new Date(dateStr + 'T' + timeStr + ':00');
        if (isNaN(dt.getTime())) return null;
        return dt.getTime();
    };

    /* ===== 任务浮动菜单 ===== */
    var _taskMenuEl = null;

    ns.showTaskContextMenu = function (taskId, quadrant, evt) {
        ns.hideTaskContextMenu();
        var qLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };
        var otherQs = ns.getOtherQuadrants(quadrant);

        // 检查是否有已关联笔记
        var linkedNotes = ns.getTaskLinkedNotes(taskId);
        var hasLinkedNotes = linkedNotes && linkedNotes.length > 0;
        var linkedBadge = hasLinkedNotes ? ' (' + linkedNotes.length + '篇)' : '';

        var menu = document.createElement('div');
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
        var rect = evt.target.getBoundingClientRect();
        var top = rect.bottom + 4;
        var left = Math.min(rect.left, window.innerWidth - 180);
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';

        // 点击外部关闭
        var closeHandler = function (e) {
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
        var _deadlineNotified = {}; // 已提醒的 taskId 集合，避免重复弹窗
        var _deadlineTimer = null;

        ns.startDeadlineChecker = function () {
            if (_deadlineTimer) return;
            _deadlineTimer = setInterval(function () {
                if (state.currentDevhomeMode !== 'workbench') return;
                var config = state.workbench || ns.getWorkbenchState();
                if (!config || !config.quadrants) return;
                ns.forEachQuadrant(function (q) {
                    var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
                    tasks.forEach(function (task) {
                        if (task.status !== 'active' || !task.plannedAt) return;
                        var remaining = task.plannedAt - Date.now();
                        // 超期 或 剩余不足 2 分钟且未提醒
                        if (remaining <= 0 || (remaining < 120000 && remaining > 0)) {
                            if (_deadlineNotified[task.id]) return;
                            _deadlineNotified[task.id] = true;
                            var label = remaining <= 0 ? '已超期' : '即将到期';
                            var title = (task.title || '').slice(0, 30);
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
