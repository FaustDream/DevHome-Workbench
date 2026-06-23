/**
 * DevHome Workbench v2 - 工作台核心控制器
 *
 * 职责：
 *   1. Tab 导航路由（仪表盘/笔记/日历/番茄钟/我）
 *   2. 四象限任务管理（保留并增强）
 *   3. 番茄钟控制
 *   4. 日历渲染
 *   5. 行为仪表盘
 *   6. AI 总结入口
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
    var EMPTY_STATE_MESSAGES = ns.EMPTY_STATE_MESSAGES;
    var DEFAULT_V2_CONFIG = ns.DEFAULT_V2_CONFIG;

    var QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

    /* ===== Tab 切换 ===== */
    ns.switchWbTab = function (tabName) {
        if (state.activeWbTab === tabName) return;
        state.activeWbTab = tabName;

        // 更新导航 active
        if (dom.wbNav) {
            dom.wbNav.querySelectorAll('.wb-nav-tab').forEach(function (tab) {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
        }

        // 切换面板
        if (dom.wbContent) {
            dom.wbContent.querySelectorAll('.wb-panel').forEach(function (panel) {
                panel.classList.toggle('active', panel.dataset.panel === tabName);
            });
        }

        // 切换到特定 Tab 时的初始化
        if (tabName === 'notes') {
            ns.renderNotesList(state._notesFilter || 'all', state._notesSearch || '');
            if (typeof ns.renderCustomFilters === 'function') ns.renderCustomFilters();
        } else if (tabName === 'calendar') {
            ns.renderCalendar(state.currentCalendarDate || new Date());
        }
    };

    /* ===== 专注模式切换 ===== */

    /** 一键切换专注模式/日常模式 */
    ns.toggleFocusMode = function () {
        if (state.currentDevhomeMode === 'workbench') {
            ns.exitFocusMode();
        } else {
            ns.enterFocusMode();
        }
    };

    /** 进入专注模式 */
    ns.enterFocusMode = function () {
        // 幂等性保护：已在专注模式中则忽略重复调用
        if (state.currentDevhomeMode === 'workbench') return;

        // 保存当前分类页索引和加载快捷键配置，退出时恢复
        state._savedPageIndex = state.currentPage;

        // 加载快捷键（如果还没加载过）
        if (!state._focusShortcut) {
            storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG).then(function (config) {
                state._focusShortcut = config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
                ns.updateContextMenuLabel();
            });
        }

        // 切换主题：禁用像素主题（通过 setAttribute 确保可靠性），启用暖纸主题
        var pixelLink = document.getElementById('theme-pixel');
        var warmPaperLink = document.getElementById('theme-warm-paper');
        if (pixelLink) pixelLink.setAttribute('media', 'not all');
        if (warmPaperLink) warmPaperLink.media = 'all';

        // 隐藏日常模式专属元素（Matrix 数字雨 canvas 由 JS 内联样式控制，需 JS 显式隐藏）
        var matrixCanvas = document.getElementById('matrixCanvas');
        if (matrixCanvas) matrixCanvas.style.display = 'none';
        var bgContainer = document.getElementById('bgContainer');
        if (bgContainer) bgContainer.style.display = 'none';

        // 立即切换状态和 UI — 不等异步数据，否则用户看到白屏
        state.workbenchVisible = true;
        state.currentDevhomeMode = 'workbench';
        state._quadrantFilter = 'active';
        state.workbench = ns.getWorkbenchState();  // 先用 localStorage 兜底数据
        if (dom.devhomeStage) dom.devhomeStage.classList.add('visible');
        if (dom.container) dom.container.classList.add('devhome-dimmed');
        ns.renderQuadrantBoard();
        ns.renderCaptures();
        ns.switchWbTab('dashboard');
        ns.updateContextMenuLabel();

        // 异步加载 v2 格式的任务数据，覆盖兜底数据（如果有更新的话）
        storageV2.get(storageV2.KEYS.TASKS, null).then(function (v2Tasks) {
            if (v2Tasks && v2Tasks.length > 0) {
                var quadrants = { q1: { tasks: [] }, q2: { tasks: [] }, q3: { tasks: [] }, q4: { tasks: [] } };
                v2Tasks.forEach(function (t) {
                    if (quadrants[t.quadrant]) quadrants[t.quadrant].tasks.push(t);
                });
                state.workbench = { quadrants: quadrants };
                ns.renderQuadrantBoard();
            }
        }).catch(function () {
            // v2 数据加载失败不影响使用，localStorage 兜底已在上面加载
        });
    };

    /** 退出专注模式，恢复日常模式 */
    ns.exitFocusMode = function () {
        // 幂等性保护：已退出则忽略
        if (state.currentDevhomeMode === 'daily') return;

        // 切换主题：恢复像素主题（移除 media 属性 = 默认 all），禁用暖纸主题
        var pixelLink = document.getElementById('theme-pixel');
        var warmPaperLink = document.getElementById('theme-warm-paper');
        if (pixelLink) pixelLink.removeAttribute('media');
        if (warmPaperLink) warmPaperLink.media = 'not all';

        // 恢复日常模式专属元素
        var matrixCanvas = document.getElementById('matrixCanvas');
        if (matrixCanvas) matrixCanvas.style.display = 'block';
        // bgContainer 由 pixel-theme.css 控制显隐，移除内联样式让 CSS 接管
        var bgContainer = document.getElementById('bgContainer');
        if (bgContainer) bgContainer.style.display = '';

        state.currentDevhomeMode = 'daily';
        state.workbenchVisible = false;
        if (dom.devhomeStage) dom.devhomeStage.classList.remove('visible');
        if (dom.container) dom.container.classList.remove('devhome-dimmed');

        // 恢复之前保存的分类页
        if (typeof state._savedPageIndex === 'number' && state._savedPageIndex !== state.currentPage) {
            state.currentPage = state._savedPageIndex;
            if (typeof ns.tileManager !== 'undefined' && ns.tileManager.updateCurrentTiles) {
                ns.tileManager.updateCurrentTiles();
                ns.renderTiles();
                ns.updatePageIndicator();
            }
        }
        // 清理临时状态，防止下次进入专注模式恢复错误页面
        delete state._savedPageIndex;
        ns.updateContextMenuLabel();
    };

    /* 兼容旧入口（保留原 openWorkbenchPanel / showDailyMode / closeWorkbenchPanel） */
    ns.openWorkbenchPanel = ns.enterFocusMode;
    ns.showDailyMode = ns.exitFocusMode;
    ns.closeWorkbenchPanel = ns.exitFocusMode;

    /** 更新右键菜单中的专注模式标签和快捷键显示 */
    ns.updateContextMenuLabel = function () {
        if (!dom.ctxFocusModeLabel) return;
        var isFocus = state.currentDevhomeMode === 'workbench';
        dom.ctxFocusModeLabel.textContent = isFocus ? '退出专注模式' : '进入专注模式';

        if (dom.ctxFocusModeKey) {
            var sc = state._focusShortcut || { ctrl: true, key: 'k' };
            var parts = [];
            if (sc.ctrl) parts.push('Ctrl');
            if (sc.shift) parts.push('Shift');
            if (sc.alt) parts.push('Alt');
            parts.push(sc.key.toUpperCase());
            dom.ctxFocusModeKey.textContent = parts.join('+');
        }
    };

    /** 检测按键是否匹配专注模式快捷键 */
    ns.isFocusModeShortcut = function (e) {
        var sc = state._focusShortcut || { ctrl: true, key: 'k' };
        if (!sc.key) return false;
        var ctrlOk = sc.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        var shiftOk = sc.shift ? e.shiftKey : !e.shiftKey;
        var altOk = sc.alt ? e.altKey : !e.altKey;
        var keyOk = e.key && e.key.toLowerCase() === sc.key.toLowerCase();
        return ctrlOk && shiftOk && altOk && keyOk;
    };

    /* ===== 四象限任务（保留原逻辑，增强存储） ===== */
    ns.getWorkbenchState = function () {
        var saved = devhomeStorage.get('workbench', null);
        var base = JSON.parse(JSON.stringify(defaultWorkbenchState));
        if (saved && saved.quadrants) {
            QUADRANTS.forEach(function (q) {
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
        delete task.completed;
        return task;
    }

    ns.saveWorkbenchState = function (nextState) {
        state.workbench = Object.assign({}, ns.getWorkbenchState(), nextState);
        devhomeStorage.set('workbench', state.workbench);
        // 同步到 v2 格式
        var v2Tasks = [];
        QUADRANTS.forEach(function (q) {
            var tasks = state.workbench.quadrants[q] && state.workbench.quadrants[q].tasks;
            if (!tasks) return;
            tasks.forEach(function (t) {
                v2Tasks.push(Object.assign({}, t, { quadrant: q }));
            });
        });
        storageV2.set(storageV2.KEYS.TASKS, v2Tasks).catch(function () {});
    };

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

    ns.renderQuadrantBoard = function () {
        var config = state.workbench || ns.getWorkbenchState();
        var filter = state._quadrantFilter || 'active';

        if (dom.quadrantFilterBtn) {
            dom.quadrantFilterBtn.textContent = filter === 'active' ? '活跃' : '全部';
            dom.quadrantFilterBtn.classList.toggle('filter-all', filter === 'all');
        }

        QUADRANTS.forEach(function (q) {
            var listEl = document.getElementById(q + 'TaskList');
            var countEl = document.getElementById(q + 'Count');
            var allTasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            var visibleTasks = getVisibleTasks(allTasks);

            if (countEl) {
                var activeCount = allTasks.filter(function (t) { return t.status === 'active' || !t.status; }).length;
                countEl.textContent = activeCount !== allTasks.length
                    ? activeCount + '/' + allTasks.length
                    : String(allTasks.length);
            }

            if (!listEl) return;
            if (visibleTasks.length === 0) {
                listEl.innerHTML = '';
                return;
            }

            listEl.innerHTML = visibleTasks.map(function (task) {
                var isActive = task.status === 'active' || !task.status || task.status === undefined;
                var isCompleted = task.status === 'completed' || (!task.status && task.completed);
                var isCancelled = task.status === 'cancelled';
                var rowClass = '';
                var checkClass = '';
                if (isCompleted) { rowClass = ' is-completed'; checkClass = ' checked'; }
                if (isCancelled) { rowClass = ' is-cancelled'; }
                var timeStr = formatTaskTime(task.createdAt);
                return '<div class="quadrant-task' + rowClass + '" ' +
                    'data-task-id="' + escapeHtml(task.id) + '" ' +
                    'data-quadrant="' + q + '" ' +
                    (isActive ? 'draggable="true"' : '') + '>' +
                    (isActive
                        ? '<button class="quadrant-task-check' + checkClass + '" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + q + '" title="标记完成"></button>'
                        : '<span class="quadrant-task-status-dot" title="' + (isCompleted ? '已完成' : '已取消') + '"></span>') +
                    '<span class="quadrant-task-title">' + escapeHtml(task.title) + '</span>' +
                    '<span class="quadrant-task-time">' + escapeHtml(timeStr) + '</span>' +
                    '<button class="quadrant-task-del" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + q + '" title="取消任务">' +
                    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
                    '</button></div>';
            }).join('');
        });
    };

    ns.toggleQuadrantFilter = function () {
        state._quadrantFilter = state._quadrantFilter === 'active' ? 'all' : 'active';
        ns.renderQuadrantBoard();
    };

    function taskId() { return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

    ns.addQuadrantTask = function (quadrant, title) {
        if (!title || !title.trim()) return;
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) config.quadrants[quadrant] = { tasks: [] };
        config.quadrants[quadrant].tasks.push({
            id: taskId(), title: title.trim(), status: 'active', createdAt: Date.now()
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

    ns.showQuadrantInput = function (cardEl, quadrant) {
        var existing = cardEl.querySelector('.quadrant-input-row');
        if (existing) { existing.remove(); return; }
        var row = document.createElement('div');
        row.className = 'quadrant-input-row';
        row.innerHTML = '<input type="text" placeholder="输入任务名称，回车确认..." autofocus>' +
            '<button class="quadrant-input-confirm" title="确认添加">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '<button class="quadrant-input-cancel" title="取消">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            '</button>';
        var addBtn = cardEl.querySelector('.quadrant-add-btn');
        if (addBtn) addBtn.insertAdjacentElement('beforebegin', row);
        var input = row.querySelector('input');
        var confirmBtn = row.querySelector('.quadrant-input-confirm');
        var cancelBtn = row.querySelector('.quadrant-input-cancel');
        var submitFn = function () { var val = input.value; row.remove(); if (val.trim()) ns.addQuadrantTask(quadrant, val); };
        var cancelFn = function () { row.remove(); };
        confirmBtn.addEventListener('click', submitFn);
        cancelBtn.addEventListener('click', cancelFn);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); submitFn(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelFn(); }
        });
        setTimeout(function () { input.focus(); }, 50);
    };

    ns.clearCompletedTasks = function () {
        var config = ns.getWorkbenchState();
        var count = 0;
        QUADRANTS.forEach(function (q) {
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

    /* ===== 番茄钟 ===== */
    ns.setPomodoroDuration = function (duration) {
        state.pomodoroDuration = duration;
        // 更新预设按钮 active
        document.querySelectorAll('.wb-pomodoro-preset').forEach(function (btn) {
            btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
        });
        ns.updatePomodoroDisplay();
    };

    ns.setPomodoroMode = function (mode) {
        state.pomodoroMode = mode;
        var modeDefault = document.getElementById('wbPomodoroModeDefault');
        var modeFocus = document.getElementById('wbPomodoroModeFocus');
        if (modeDefault) modeDefault.classList.toggle('active', mode === 'default');
        if (modeFocus) modeFocus.classList.toggle('active', mode === 'focus');
    };

    ns.updatePomodoroDisplay = function () {
        if (!dom.wbPomodoroTime) return;
        var duration = state.pomodoroMode === 'focus' ? '∞' : state.pomodoroDuration;
        dom.wbPomodoroTime.textContent = typeof duration === 'number'
            ? String(duration).padStart(2, '0') + ':00'
            : '∞:∞';
        if (dom.wbPomodoroLabel) dom.wbPomodoroLabel.textContent = '准备开始';
        if (dom.wbPomodoroProgress) dom.wbPomodoroProgress.setAttribute('stroke-dashoffset', '0');
    };

    ns.startPomodoro = function () {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'POMODORO_START',
                data: {
                    duration: state.pomodoroMode === 'focus' ? 999 : state.pomodoroDuration,
                    restDuration: state.pomodoroRestDuration,
                    type: state.pomodoroMode
                }
            });
        }
        var startBtn = document.getElementById('wbPomodoroStart');
        var pauseBtn = document.getElementById('wbPomodoroPause');
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        if (dom.wbPomodoroLabel) dom.wbPomodoroLabel.textContent = '专注中...';
    };

    ns.pausePomodoro = function () {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_PAUSE' });
        }
        var startBtn = document.getElementById('wbPomodoroStart');
        var pauseBtn = document.getElementById('wbPomodoroPause');
        if (startBtn) startBtn.style.display = '';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (startBtn) startBtn.textContent = '继续';
        if (dom.wbPomodoroLabel) dom.wbPomodoroLabel.textContent = '已暂停';
    };

    ns.resetPomodoro = function () {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_STOP' });
        }
        var startBtn = document.getElementById('wbPomodoroStart');
        var pauseBtn = document.getElementById('wbPomodoroPause');
        if (startBtn) { startBtn.style.display = ''; startBtn.textContent = '开始'; }
        if (pauseBtn) pauseBtn.style.display = 'none';
        ns.updatePomodoroDisplay();
    };

    /* ===== 日历 ===== */
    var _calendarDate = new Date();

    ns.navigateCalendar = function (delta) {
        _calendarDate.setMonth(_calendarDate.getMonth() + delta);
        ns.renderCalendar(new Date(_calendarDate));
    };

    ns.renderCalendar = function (date) {
        _calendarDate = new Date(date);
        state.currentCalendarDate = _calendarDate;

        if (dom.wbCalendarTitle) {
            dom.wbCalendarTitle.textContent = _calendarDate.getFullYear() + '年' + (_calendarDate.getMonth() + 1) + '月';
        }
        if (!dom.wbCalendarDays) return;

        var year = _calendarDate.getFullYear();
        var month = _calendarDate.getMonth();
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        // 收集该月有内容的日期
        var contentDates = {};
        (state.notes || []).forEach(function (n) {
            var d = new Date(n.createdAt);
            if (d.getFullYear() === year && d.getMonth() === month) {
                var key = d.getDate();
                contentDates[key] = (contentDates[key] || 0) + 1;
            }
        });

        var html = '';
        // 填充上月空白
        for (var i = 0; i < firstDay; i++) {
            html += '<div class="wb-calendar-day other-month"></div>';
        }
        // 当月日期
        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var classes = 'wb-calendar-day';
            if (dateStr === todayStr) classes += ' today';
            if (contentDates[day]) classes += ' has-content';
            html += '<div class="' + classes + '" data-date="' + dateStr + '">' + day + '</div>';
        }
        dom.wbCalendarDays.innerHTML = html;

        // 点击日期显示详情
        dom.wbCalendarDays.querySelectorAll('.wb-calendar-day').forEach(function (dayEl) {
            dayEl.addEventListener('click', function () {
                var clickedDate = dayEl.dataset.date;
                ns.showCalendarDetail(clickedDate);
            });
        });
    };

    ns.showCalendarDetail = function (dateStr) {
        if (!dom.wbCalendarDetail) return;
        var notes = (state.notes || []).filter(function (n) {
            var d = new Date(n.createdAt);
            var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return ds === dateStr;
        });
        var captures = (state.captures || []).filter(function (c) {
            var d = new Date(c.createdAt);
            var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return ds === dateStr;
        });

        if (notes.length === 0 && captures.length === 0) {
            dom.wbCalendarDetail.innerHTML = '<p class="wb-calendar-detail-empty">' + dateStr + ' 暂无记录</p>';
            return;
        }

        var html = '<h3>' + dateStr + '</h3>';
        if (notes.length > 0) {
            html += '<div style="margin-top:8px;"><strong>笔记 (' + notes.length + ')</strong></div>';
            notes.forEach(function (n) {
                html += '<div style="padding:4px 0;font-size:13px;">📝 ' + escapeHtml(n.title) + '</div>';
            });
        }
        if (captures.length > 0) {
            html += '<div style="margin-top:8px;"><strong>捕获 (' + captures.length + ')</strong></div>';
            captures.forEach(function (c) {
                html += '<div style="padding:4px 0;font-size:13px;">⚡ ' + escapeHtml(c.content.slice(0, 80)) + '</div>';
            });
        }
        dom.wbCalendarDetail.innerHTML = html;
    };

    /* ===== 行为仪表盘 ===== */
    ns.renderBehaviorDashboard = async function () {
        var behavior = await storageV2.get(storageV2.KEYS.BEHAVIOR, ns.DEFAULT_BEHAVIOR_STATE);
        var sessions = await storageV2.get(storageV2.KEYS.POMODORO_SESSIONS, []);

        // 计算统计
        var todayStr = new Date().toISOString().slice(0, 10);
        var todaySessions = sessions.filter(function (s) {
            return s.startedAt && new Date(s.startedAt).toISOString().slice(0, 10) === todayStr && s.completed;
        });
        var totalFocusMin = todaySessions.reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);

        // 连续打卡
        var streak = behavior.streakDays || 0;
        if (dom.wbMeStreakNum) dom.wbMeStreakNum.textContent = streak;
        if (dom.wbMeStatTasks) dom.wbMeStatTasks.textContent = behavior.totalCompleted || 0;
        if (dom.wbMeStatPomodoros) dom.wbMeStatPomodoros.textContent = todaySessions.length;
        if (dom.wbMeStatFocus) dom.wbMeStatFocus.textContent = totalFocusMin;
        if (dom.wbMeStatNotes) dom.wbMeStatNotes.textContent = (state.notes || []).length;

        // 更新今日打卡
        var todayBehavior = behavior.dailyStats && behavior.dailyStats[todayStr];
        if (!todayBehavior || !todayBehavior.streakDay) {
            behavior.lastActiveDate = todayStr;
            behavior.streakDays = (behavior.streakDays || 0) + 1;
            if (!behavior.dailyStats) behavior.dailyStats = {};
            behavior.dailyStats[todayStr] = Object.assign({}, behavior.dailyStats[todayStr] || {}, { streakDay: true });
            await storageV2.set(storageV2.KEYS.BEHAVIOR, behavior);
            if (dom.wbMeStreakNum) dom.wbMeStreakNum.textContent = behavior.streakDays;
        }
    };

    /* ===== AI 总结 ===== */
    ns.generateAISummary = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var apiKey = config.aiApi.apiKey;
        var endpoint = config.aiApi.endpoint;
        var model = config.aiApi.model;

        if (!apiKey) {
            ns.showToast('请先在下方填入 API Key', 'error');
            return;
        }

        // 收集今日内容
        var todayStr = new Date().toISOString().slice(0, 10);
        var todayNotes = (state.notes || []).filter(function (n) {
            return new Date(n.createdAt).toISOString().slice(0, 10) === todayStr;
        });
        var todayCaptures = (state.captures || []).filter(function (c) {
            return new Date(c.createdAt).toISOString().slice(0, 10) === todayStr;
        });

        var contentText = '';
        todayNotes.forEach(function (n) {
            contentText += '## ' + n.title + '\n' + n.content + '\n\n';
        });
        todayCaptures.forEach(function (c) {
            contentText += '- ' + c.content + '\n';
        });

        if (!contentText.trim()) {
            ns.showToast('今天还没有任何记录', 'info');
            return;
        }

        if (dom.wbMeAiResult) dom.wbMeAiResult.style.display = 'block';
        if (dom.wbMeAiContent) dom.wbMeAiContent.innerHTML = '<p style="color:var(--wb-text-secondary);">正在生成总结...</p>';

        // 调用腾讯混元 API（Bearer Token 方式）
        try {
            var response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    Model: model,
                    Messages: [
                        {
                            Role: 'system',
                            Content: '你是一个专业的工作总结助手。请将以下工作记录整理为结构化的每日总结，包括：1) 今日完成的任务 2) 遇到的问题 3) 关键收获 4) 明日计划。用 Markdown 格式输出。'
                        },
                        {
                            Role: 'user',
                            Content: contentText.slice(0, 6000)
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error('API 请求失败: ' + response.status + ' ' + response.statusText);
            }

            var data = await response.json();
            var summary = data.Response && data.Response.Choices && data.Response.Choices[0]
                ? data.Response.Choices[0].Message.Content
                : (data.choices && data.choices[0] ? data.choices[0].message.content : JSON.stringify(data));

            if (dom.wbMeAiContent) {
                dom.wbMeAiContent.innerHTML = typeof marked !== 'undefined' && marked.parse
                    ? marked.parse(summary)
                    : '<pre>' + escapeHtml(summary) + '</pre>';
            }
        } catch (e) {
            if (dom.wbMeAiContent) {
                dom.wbMeAiContent.innerHTML = '<p style="color:#ff6b6b;">生成失败：' + escapeHtml(e.message) + '</p>' +
                    '<p style="color:var(--wb-text-tertiary);font-size:11px;">请检查 API Key 和网络连接</p>';
            }
            console.error('[AI Summary] 错误:', e);
        }
    };

    /* ===== 加载设置面板配置 ===== */
    ns.loadMeConfig = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = config.aiApi.apiKey || '';
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = config.aiApi.endpoint || DEFAULT_V2_CONFIG.aiApi.endpoint;
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = config.aiApi.model || DEFAULT_V2_CONFIG.aiApi.model;
        if (dom.wbMeToggleStrict) dom.wbMeToggleStrict.checked = config.behavior.strictMode || false;
        if (dom.wbMeToggleFileSync) dom.wbMeToggleFileSync.checked = config.fileSync.enabled || false;

        // 加载快捷键配置
        var sc = config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
        state._focusShortcut = sc;
        if (dom.wbMeShortcutCtrl) dom.wbMeShortcutCtrl.checked = sc.ctrl;
        if (dom.wbMeShortcutShift) dom.wbMeShortcutShift.checked = sc.shift;
        if (dom.wbMeShortcutAlt) dom.wbMeShortcutAlt.checked = sc.alt;
        if (dom.wbMeShortcutKey) dom.wbMeShortcutKey.value = sc.key;
        ns.updateContextMenuLabel();
    };

})(window.DevHome);
