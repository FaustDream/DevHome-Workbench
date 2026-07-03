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
        // 已废弃：三栏布局中不再需要 Tab 切换
        // 保留函数签名以防旧代码调用
        console.log('[模式] switchWbTab 已废弃，使用 switchSidebar 代替');
    };

    /* ===== 侧边栏面板切换 ===== */
    ns.switchSidebar = function (panelName) {
        if (!panelName) return;
        state._activeSidebarPanel = panelName;

        // 更新导航 active
        document.querySelectorAll('.wb-sidenav-item').forEach(function (item) {
            item.classList.toggle('active', item.dataset.sidebar === panelName);
        });

        // 切换左栏面板
        document.querySelectorAll('.wb-side-panel').forEach(function (panel) {
            panel.classList.toggle('active', panel.dataset.panel === panelName);
        });

        // 面板初始化
        if (panelName === 'tasks') {
            ns.renderQuadrantBoard();
        } else if (panelName === 'calendar') {
            ns.renderSideCalendar(state.currentCalendarDate || new Date());
        }
        console.log('[面板] 左侧栏切换到 ' + panelName);
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

        // 切换主题已由 ThemeManager 集中管理，模式切换不再操作 link media
        // 专注模式与非专注模式共享同一套主题

        // 隐藏日常模式专属元素（Matrix 数字雨 canvas 由背景管理器控制）
        var matrixCanvas = document.getElementById('matrixCanvas');
        if (matrixCanvas) matrixCanvas.style.display = 'none';
        var bgContainer = document.getElementById('bgContainer');
        if (bgContainer) bgContainer.style.display = 'none';

        // 立即切换状态和 UI — 不等异步数据，否则用户看到白屏
        console.log('[模式] 进入专注模式');
        state.workbenchVisible = true;
        state.currentDevhomeMode = 'workbench';
        state._quadrantFilter = 'active';
        state.workbench = ns.getWorkbenchState();  // 先用 localStorage 兜底数据
        if (dom.devhomeStage) dom.devhomeStage.classList.add('visible');
        if (dom.container) dom.container.classList.add('devhome-dimmed');

        // 三栏初始化
        ns.renderQuadrantBoard();
        ns.renderMiniCalendar(new Date());
        ns.renderCalendar(new Date());
        ns.renderNotesList('all', '');
        if (typeof ns.renderCustomFilters === 'function') ns.renderCustomFilters();
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

        // 主题已由 ThemeManager 集中管理，模式切换不再操作 link media

        // 恢复日常模式专属元素（仅在数字雨已开启时才显示 canvas）
        var matrixCanvas = document.getElementById('matrixCanvas');
        if (matrixCanvas && ns.matrixRain && ns.matrixRain.isRunning()) {
            matrixCanvas.style.display = 'block';
        }
        var bgContainer = document.getElementById('bgContainer');
        if (bgContainer) bgContainer.style.display = '';

        state.currentDevhomeMode = 'daily';
        console.log('[模式] 退出专注模式');
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
        var totalCount = 0;
        QUADRANTS.forEach(function (q) {
            totalCount += (config.quadrants[q] && config.quadrants[q].tasks || []).length;
        });

        // 更新过滤按钮
        var filterBtn = document.getElementById('wbTaskFilterBtn');
        if (filterBtn) {
            filterBtn.textContent = filter === 'active' ? '活跃' : '全部';
        }

        // 维度标签映射
        var qLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };

        QUADRANTS.forEach(function (activeQ) {
            var listEl = document.getElementById('wbQgList' + activeQ.toUpperCase());
            var countEl = document.getElementById('wbQgCount' + activeQ.toUpperCase());
            var allTasks = (config.quadrants[activeQ] && config.quadrants[activeQ].tasks) || [];
            var visibleTasks = getVisibleTasks(allTasks);

            // 更新计数
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

            // 维度下拉选项（排除当前维度）
            var qOptions = QUADRANTS.filter(function (q) { return q !== activeQ; });

            // 维度下拉选项 HTML
            var selectOpts = '<option value="">移至...</option>' +
                qOptions.map(function (q) {
                    return '<option value="' + q + '">' + qLabels[q] + '</option>';
                }).join('');

            listEl.innerHTML = visibleTasks.map(function (task) {
                var isActive = task.status === 'active' || !task.status || task.status === undefined;
                var isCompleted = task.status === 'completed' || (!task.status && task.completed);
                var isCancelled = task.status === 'cancelled';
                var rowClass = isCompleted ? ' is-completed' : (isCancelled ? ' is-cancelled' : '');
                var checkClass = isCompleted ? ' checked' : '';

                return '<div class="wb-task-item' + rowClass + '" ' +
                    'data-task-id="' + escapeHtml(task.id) + '" ' +
                    'data-quadrant="' + activeQ + '">' +
                    (isActive
                        ? '<button class="wb-task-check' + checkClass + '" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + activeQ + '" title="标记完成"></button>'
                        : '<span class="wb-task-check checked" style="pointer-events:none;"></span>') +
                    '<span class="wb-task-item-title">' + escapeHtml(task.title) + '</span>' +
                    (isActive
                        ? '<select class="wb-task-selector" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + activeQ + '" title="切换维度">' + selectOpts + '</select>'
                        : '') +
                    '<button class="wb-task-del" data-task-id="' + escapeHtml(task.id) + '" data-quadrant="' + activeQ + '" title="取消任务">&times;</button></div>';
            }).join('');
        });
        console.log('[面板] 四象限渲染完成 总任务=' + totalCount + ' 过滤=' + filter);
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

    /** 显示任务添加内联输入框（在指定象限分组内） */
    ns.showQuadrantInput = function (quadrant, addBtn) {
        if (!addBtn) return;

        // 移除已有输入框
        var existing = document.querySelector('.wb-task-input-row');
        if (existing) { existing.remove(); return; }

        var row = document.createElement('div');
        row.className = 'wb-task-input-row';
        row.innerHTML = '<input type="text" placeholder="输入任务，回车确认..." autofocus>' +
            '<button class="wb-task-input-confirm" title="确认">✓</button>' +
            '<button class="wb-task-input-cancel" title="取消">✕</button>';
        addBtn.insertAdjacentElement('beforebegin', row);
        var input = row.querySelector('input');
        var confirmBtn = row.querySelector('.wb-task-input-confirm');
        var cancelBtn = row.querySelector('.wb-task-input-cancel');
        var submitFn = function () {
            var val = input.value; row.remove();
            if (val.trim()) ns.addQuadrantTask(quadrant, val);
        };
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
    /** 辅助：同时更新左右栏番茄钟的时间显示 */
    function _pomoUpdateTimeEls(textFn) {
        var leftEl = document.getElementById('wbPomodoroTime');
        var rightEl = document.getElementById('wbPomodoroSideTime');
        var text = textFn();
        if (leftEl) leftEl.textContent = text;
        if (rightEl) rightEl.textContent = text;
    }

    /** 辅助：设置左右栏进度环偏移 */
    function _pomoUpdateProgress(offset, total) {
        var leftEl = document.getElementById('wbPomodoroProgress');
        var rightEl = document.getElementById('wbPomodoroSideProgress');
        var leftTotal = 502.65; // r=80 → 2*PI*80
        var rightTotal = 402.12; // r=64 → 2*PI*64
        if (leftEl) leftEl.setAttribute('stroke-dashoffset', String(offset * leftTotal / total));
        if (rightEl) rightEl.setAttribute('stroke-dashoffset', String(offset * rightTotal / total));
    }

    ns.setPomodoroDuration = function (duration) {
        state.pomodoroDuration = duration;
        // 更新左右栏预设按钮 active
        document.querySelectorAll('.wb-pomodoro-preset, .wb-pomodoro-side-preset').forEach(function (btn) {
            btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
        });
        ns.updatePomodoroDisplay();
    };

    ns.updatePomodoroDisplay = function () {
        var duration = state.pomodoroMode === 'focus' ? '∞' : state.pomodoroDuration;
        var text = typeof duration === 'number'
            ? String(duration).padStart(2, '0') + ':00'
            : '∞:∞';
        _pomoUpdateTimeEls(function () { return text; });

        var labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '准备开始';
        _pomoUpdateProgress(0, 100);
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
        console.log('[交互] 番茄钟 开始 时长=' + (state.pomodoroMode === 'focus' ? '无限' : state.pomodoroDuration + '分'));
        var startBtn = document.getElementById('wbPomodoroStart');
        var pauseBtn = document.getElementById('wbPomodoroPause');
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = '';
        var sideStart = document.getElementById('wbPomodoroSideStart');
        var sideReset = document.getElementById('wbPomodoroSideReset');
        if (sideStart) { sideStart.textContent = '暂停'; sideStart.classList.add('is-running'); }
        if (sideReset) sideReset.style.display = '';
        var labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '专注中...';
    };

    ns.pausePomodoro = function () {
        console.log('[交互] 番茄钟 暂停');
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_PAUSE' });
        }
        var startBtn = document.getElementById('wbPomodoroStart');
        var pauseBtn = document.getElementById('wbPomodoroPause');
        if (startBtn) startBtn.style.display = '';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (startBtn) startBtn.textContent = '继续';
        // 右栏
        var sideStart = document.getElementById('wbPomodoroSideStart');
        if (sideStart) { sideStart.textContent = '继续'; sideStart.classList.remove('is-running'); }
        var labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '已暂停';
    };

    ns.resetPomodoro = function () {
        console.log('[交互] 番茄钟 重置');
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_STOP' });
        }
        var startBtn = document.getElementById('wbPomodoroStart');
        var pauseBtn = document.getElementById('wbPomodoroPause');
        if (startBtn) { startBtn.style.display = ''; startBtn.textContent = '开始'; }
        if (pauseBtn) pauseBtn.style.display = 'none';
        // 右栏
        var sideStart = document.getElementById('wbPomodoroSideStart');
        var sideReset = document.getElementById('wbPomodoroSideReset');
        if (sideStart) { sideStart.textContent = '开始'; sideStart.classList.remove('is-running'); }
        ns.updatePomodoroDisplay();
    };

    /* ===== 日历（右栏迷你日历 + 侧栏日历） ===== */
    var _calendarDate = new Date();

    ns.navigateCalendar = function (delta) {
        _calendarDate.setMonth(_calendarDate.getMonth() + delta);
        ns.renderCalendar(new Date(_calendarDate));
        ns.renderMiniCalendar(new Date(_calendarDate));
        ns.renderSideCalendar(new Date(_calendarDate));
    };

    ns.renderCalendar = function (date) {
        _calendarDate = new Date(date);
        state.currentCalendarDate = _calendarDate;

        // 右栏迷你日历标题
        var titleEl = document.getElementById('wbCalendarTitle');
        if (titleEl) {
            titleEl.textContent = _calendarDate.getFullYear() + '年' + (_calendarDate.getMonth() + 1) + '月';
        }

        // 右栏迷你日历日期格（使用 .wb-cal-day 类名）
        var daysEl = document.getElementById('wbCalendarDays');
        if (!daysEl) return;
        daysEl.innerHTML = ns._buildCalendarDaysHTML(_calendarDate, 'wb-cal-day');
        ns._bindCalendarDayClicks(daysEl);
    };

    /** 右栏迷你日历渲染 */
    ns.renderMiniCalendar = function (date) {
        if (!date) date = _calendarDate;
        var titleEl = document.getElementById('wbCalendarTitle');
        var daysEl = document.getElementById('wbCalendarDays');
        if (titleEl) {
            titleEl.textContent = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
        }
        if (daysEl) {
            daysEl.innerHTML = ns._buildCalendarDaysHTML(date, 'wb-cal-day');
            ns._bindCalendarDayClicks(daysEl);
        }
    };

    /** 侧栏迷你日历渲染 */
    ns.renderSideCalendar = function (date) {
        if (!date) date = _calendarDate;
        var titleEl = document.getElementById('wbSideCalTitle');
        var daysEl = document.getElementById('wbSideCalDays');
        if (titleEl) {
            titleEl.textContent = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
        }
        if (daysEl) {
            daysEl.innerHTML = ns._buildCalendarDaysHTML(date, 'wb-side-cal-day');
            daysEl.querySelectorAll('.wb-side-cal-day').forEach(function (el) {
                el.addEventListener('click', function () {
                    ns.showCalendarDetail(el.dataset.date);
                });
            });
        }
    };

    /** 构建日历日期网格 HTML */
    ns._buildCalendarDaysHTML = function (date, cellClass) {
        var year = date.getFullYear();
        var month = date.getMonth();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDay = new Date(year, month, 1).getDay();
        var prevMonthDays = new Date(year, month, 0).getDate();
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        // 有内容的日期
        var contentDates = {};
        (state.notes || []).forEach(function (n) {
            var d = new Date(n.createdAt);
            if (d.getFullYear() === year && d.getMonth() === month) {
                contentDates[d.getDate()] = true;
            }
        });

        var html = '';
        // 上月填充
        for (var i = firstDay - 1; i >= 0; i--) {
            html += '<span class="' + cellClass + ' other-month">' + (prevMonthDays - i) + '</span>';
        }
        // 当月
        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var classes = [cellClass];
            if (dateStr === todayStr) classes.push('today');
            if (contentDates[day]) classes.push('has-content');
            html += '<span class="' + classes.join(' ') + '" data-date="' + dateStr + '">' + day + '</span>';
        }
        // 下月填充
        var totalCells = firstDay + daysInMonth;
        var remaining = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
        for (var j = 1; j <= remaining; j++) {
            html += '<span class="' + cellClass + ' other-month">' + j + '</span>';
        }
        return html;
    };

    /** 绑定日期点击事件 */
    ns._bindCalendarDayClicks = function (container) {
        container.querySelectorAll('[data-date]').forEach(function (el) {
            el.addEventListener('click', function () {
                ns.showCalendarDetail(el.dataset.date);
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
        if (dom.wbMeAiContent) dom.wbMeAiContent.innerHTML = '<p style="color:var(--color-text-secondary);">正在生成总结...</p>';

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
                    '<p style="color:var(--color-text-tertiary);font-size:11px;">请检查 API Key 和网络连接</p>';
            }
            console.error('[AI Summary] 错误:', e);
        }
    };

    /* ===== 加载 AI + 快捷键配置到设置面板 UI ===== */
    ns.loadMeConfig = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        // AI 配置
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = config.aiApi.apiKey || '';
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = config.aiApi.endpoint || DEFAULT_V2_CONFIG.aiApi.endpoint;
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = config.aiApi.model || DEFAULT_V2_CONFIG.aiApi.model;

        // 加载快捷键到 hidden input（新 DOM 用 value '1'/'0'）
        var sc = config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
        state._focusShortcut = sc;
        var ctrlEl = document.getElementById('wbMeShortcutCtrl');
        var shiftEl = document.getElementById('wbMeShortcutShift');
        var altEl = document.getElementById('wbMeShortcutAlt');
        var keyEl = document.getElementById('wbMeShortcutKey');
        if (ctrlEl) ctrlEl.value = sc.ctrl ? '1' : '0';
        if (shiftEl) shiftEl.value = sc.shift ? '1' : '0';
        if (altEl) altEl.value = sc.alt ? '1' : '0';
        if (keyEl) keyEl.value = sc.key || 'k';
        // 更新显示
        var display = document.getElementById('sShortcutKeys');
        if (display) {
            var parts = [];
            if (sc.ctrl) parts.push('Ctrl');
            if (sc.shift) parts.push('Shift');
            if (sc.alt) parts.push('Alt');
            parts.push((sc.key || 'K').toUpperCase());
            display.textContent = parts.join(' + ');
        }
        ns.updateContextMenuLabel();
    };

})(window.DevHome);
