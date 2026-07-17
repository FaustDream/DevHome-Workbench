/**
 * DevHome Workbench v2 - 工作台核心控制器（协调入口）
 *
 * 职责：
 *   1. Tab 导航路由 / 侧边栏面板切换
 *   2. 专注模式切换（enterFocusMode / exitFocusMode）
 *   3. 快捷键与右键菜单标签更新
 *   4. React Toast 初始化
 *
 * 业务逻辑已拆分至 workbench_private/ 子模块：
 *   - _quadrant-tasks.js  # 四象限任务 CRUD + 过滤 + 渲染
 *   - _notes-workbench.js # 任务-笔记关联逻辑
 *   - _pomodoro.js        # 番茄钟控制
 *   - _calendar.js        # 日历渲染
 *   - _dashboard.js       # 行为仪表盘 + AI 面板
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const storageV2 = ns.storageV2;
    const DEFAULT_V2_CONFIG = ns.DEFAULT_V2_CONFIG;

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

    /* ===== 侧边栏折叠/展开 ===== */
    ns.toggleQuadrantSidebar = function () {
        const panel = document.getElementById('wbQuadrantPanel');
        if (!panel) return;
        const isCollapsed = panel.classList.toggle('collapsed');
        console.log('[面板] 四象限侧边栏 ' + (isCollapsed ? '折叠' : '展开'));
    };

    ns.toggleRightSidebar = function () {
        const panel = document.getElementById('wbSidebarRight');
        if (!panel) return;
        const isCollapsed = panel.classList.toggle('collapsed');
        console.log('[面板] 右侧栏（日历+番茄钟） ' + (isCollapsed ? '折叠' : '展开'));
    };

    /* ===== 专注模式切换 ===== */

    /** 一键切换专注模式/日常模式 */
    ns.toggleFocusMode = function () {
        ns.logger && ns.logger.info('focus-mode', 'toggleFocusMode 被调用', {
            currentMode: state.currentDevhomeMode,
            stack: new Error().stack ? new Error().stack.split('\n').slice(1, 3).join(' | ') : ''
        });
        if (state.currentDevhomeMode === 'workbench') {
            ns.exitFocusMode();
        } else {
            ns.enterFocusMode();
        }
    };

    /** 进入专注模式 */
    ns.enterFocusMode = function () {
        // 幂等性保护：已在专注模式中则忽略重复调用
        if (state.currentDevhomeMode === 'workbench') {
            if (ns.logger) ns.logger.debug('focus-mode', 'enterFocusMode 跳过：已在专注模式');
            return;
        }

        ns.logger && ns.logger.info('focus-mode', 'enterFocusMode 开始', {
            currentPage: state.currentPage,
            notesCount: (state.notes || []).length
        });

        // 保存当前分类页索引和加载快捷键配置，退出时恢复
        state._savedPageIndex = state.currentPage;

        // 记忆当前笔记编辑器状态（退出时恢复）
        state._savedNotebookFilter = state._notebookFilter;
        state._savedCurrentNoteId = state.currentNote ? state.currentNote.id : null;

        // 恢复上次选择的笔记本筛选
        if (state._lastNotebookId) {
            state._notebookFilter = state._lastNotebookId;
        }

        // 加载快捷键（如果还没加载过）
        if (!state._focusShortcut) {
            storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG).then(function (config) {
                state._focusShortcut = config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
                ns.updateContextMenuLabel();
            });
        }

        // 隐藏日常模式专属元素
        try {
            const matrixCanvas = document.getElementById('matrixCanvas');
            if (matrixCanvas) matrixCanvas.style.display = 'none';
            const bgContainer = document.getElementById('bgContainer');
            if (bgContainer) bgContainer.style.display = 'none';
        } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', '隐藏日常元素失败', e.message);
        }

        // 切换状态
        state.workbenchVisible = true;
        state.currentDevhomeMode = 'workbench';
        state._quadrantFilter = 'active';
        state.workbench = ns.getWorkbenchState();

        // 显示专注模式 UI
        try {
            if (!dom.devhomeStage) throw new Error('devhomeStage DOM 未找到');
            if (!dom.container) throw new Error('container DOM 未找到');
            dom.devhomeStage.classList.add('visible');
            dom.container.classList.add('devhome-dimmed');
        } catch (e) {
            ns.logger && ns.logger.error('focus-mode', '显示专注模式 UI 失败', e.message);
            // 回滚状态
            state.currentDevhomeMode = 'daily';
            state.workbenchVisible = false;
            ns.showToast && ns.showToast('进入专注模式失败，请刷新页面重试', 'error');
            return;
        }

        console.log('[模式] 进入专注模式');
        if (typeof ns.startDeadlineChecker === 'function') ns.startDeadlineChecker();

        // 渲染各模块（逐个 try-catch 防止一个模块失败阻断其他模块）
        const renderErrors = [];
        try { ns.renderQuadrantBoard(); } catch (e) {
            renderErrors.push('四象限: ' + e.message);
            ns.logger && ns.logger.error('focus-mode', 'renderQuadrantBoard 失败', e.message);
        }
        try { ns.renderMiniCalendar(new Date()); } catch (e) {
            renderErrors.push('日历: ' + e.message);
            ns.logger && ns.logger.error('focus-mode', 'renderMiniCalendar 失败', e.message);
        }
        try { ns.renderCalendar(new Date()); } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', 'renderCalendar 失败', e.message);
        }
        try { ns.renderNotesList(state._notesFilter || 'all', state._notesSearch || ''); } catch (e) {
            renderErrors.push('笔记: ' + e.message);
            ns.logger && ns.logger.error('focus-mode', 'renderNotesList 失败', e.message);
        }
        try { if (typeof ns.renderCustomFilters === 'function') ns.renderCustomFilters(); } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', 'renderCustomFilters 失败', e.message);
        }
        try { if (typeof ns.renderNotebookDropdown === 'function') ns.renderNotebookDropdown(); } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', 'renderNotebookDropdown 失败', e.message);
        }
        try { if (typeof ns.renderPomodoroTaskSelector === 'function') ns.renderPomodoroTaskSelector(); } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', 'renderPomodoroTaskSelector 失败', e.message);
        }
        try { ns.updateContextMenuLabel(); } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', 'updateContextMenuLabel 失败', e.message);
        }

        if (renderErrors.length > 0) {
            ns.logger && ns.logger.warn('focus-mode', '部分模块渲染失败', renderErrors);
        }

        // 异步加载 v2 任务数据
        storageV2.get(storageV2.KEYS.TASKS, null).then(function (v2Tasks) {
            if (v2Tasks && v2Tasks.length > 0) {
                const quadrants = { q1: { tasks: [] }, q2: { tasks: [] }, q3: { tasks: [] }, q4: { tasks: [] } };
                v2Tasks.forEach(function (t) {
                    if (quadrants[t.quadrant]) quadrants[t.quadrant].tasks.push(normalizeV2Task(t));
                });
                state.workbench = { quadrants: quadrants };
                ns.renderQuadrantBoard();
                ns.logger && ns.logger.info('focus-mode', 'v2 任务数据已加载', { count: v2Tasks.length });
            }
        }).catch(function (err) {
            ns.logger && ns.logger.warn('focus-mode', 'v2 任务加载失败（使用兜底数据）', err.message);
        });

        ns.logger && ns.logger.info('focus-mode', 'enterFocusMode 完成', { renderErrors: renderErrors.length });
    };

    /** v2 任务数据规范化 */
    function normalizeV2Task(task) {
        if (!task.status) { task.status = task.completed ? 'completed' : 'active'; }
        if (!task.createdAt) task.createdAt = Date.now();
        if (!task.plannedAt && task.deadline) task.plannedAt = task.deadline;
        delete task.completed;
        delete task.deadline;
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

    /** 退出专注模式，恢复日常模式 */
    ns.exitFocusMode = function () {
        if (state.currentDevhomeMode === 'daily') return;
        ns.logger && ns.logger.info('focus-mode', 'exitFocusMode 开始');

        // 保存当前编辑器内容并记住笔记本筛选
        ns.closeNoteEditor().catch(function (e) {
            ns.logger && ns.logger.warn('focus-mode', 'closeNoteEditor 失败', e.message);
        });

        // 持久化最后选中的笔记本 ID
        state._lastNotebookId = state._notebookFilter;
        storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG).then(function (config) {
            config.lastNotebookId = state._lastNotebookId || null;
            return storageV2.set(storageV2.KEYS.CONFIG, config);
        }).catch(function (e) {
            ns.logger && ns.logger.warn('focus-mode', '保存 lastNotebookId 失败', e.message);
        });

        // 恢复日常模式专属元素
        try {
            const matrixCanvas = document.getElementById('matrixCanvas');
            if (matrixCanvas && ns.matrixRain && ns.matrixRain.isRunning()) {
                matrixCanvas.style.display = 'block';
            }
            const bgContainer = document.getElementById('bgContainer');
            if (bgContainer) bgContainer.style.display = '';
        } catch (e) {
            ns.logger && ns.logger.warn('focus-mode', '恢复日常元素失败', e.message);
        }

        state.currentDevhomeMode = 'daily';
        console.log('[模式] 退出专注模式');
        if (typeof ns.stopDeadlineChecker === 'function') ns.stopDeadlineChecker();
        state.workbenchVisible = false;
        if (dom.devhomeStage) dom.devhomeStage.classList.remove('visible');
        if (dom.container) dom.container.classList.remove('devhome-dimmed');

        // 恢复之前保存的分类页
        if (typeof state._savedPageIndex === 'number' && state._savedPageIndex !== state.currentPage) {
            state.currentPage = state._savedPageIndex;
            if (typeof ns.tileManager !== 'undefined' && ns.tileManager.updateCurrentTiles) {
                ns.tileManager.updateCurrentTiles();
                ns.renderTiles();
            }
        }
        delete state._savedPageIndex;
        ns.updateContextMenuLabel();
        ns.logger && ns.logger.info('focus-mode', 'exitFocusMode 完成');
    };

    /* 兼容旧入口 */
    ns.openWorkbenchPanel = ns.enterFocusMode;
    ns.showDailyMode = ns.exitFocusMode;
    ns.closeWorkbenchPanel = ns.exitFocusMode;

    /** 更新右键菜单中的专注模式标签和快捷键显示 */
    ns.updateContextMenuLabel = function () {
        if (!dom.ctxFocusModeLabel) return;
        const isFocus = state.currentDevhomeMode === 'workbench';
        dom.ctxFocusModeLabel.textContent = isFocus ? '退出专注模式' : '进入专注模式';

        if (dom.ctxFocusModeKey) {
            const sc = state._focusShortcut || { ctrl: true, key: 'k' };
            const parts = [];
            if (sc.ctrl) parts.push('Ctrl');
            if (sc.shift) parts.push('Shift');
            if (sc.alt) parts.push('Alt');
            parts.push(sc.key.toUpperCase());
            dom.ctxFocusModeKey.textContent = parts.join('+');
        }
    };

    /** 检测按键是否匹配专注模式快捷键 */
    ns.isFocusModeShortcut = function (e) {
        const sc = state._focusShortcut || { ctrl: true, key: 'k' };
        if (!sc.key) return false;
        const ctrlOk = sc.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftOk = sc.shift ? e.shiftKey : !e.shiftKey;
        const altOk = sc.alt ? e.altKey : !e.altKey;
        const keyOk = e.key && e.key.toLowerCase() === sc.key.toLowerCase();
        return ctrlOk && shiftOk && altOk && keyOk;
    };

    /** 挂载 React 通知系统容器（首次调用时创建，幂等） */
    ns.initReactToast = function () {
        const root = document.getElementById('reactToastRoot');
        if (!root || !window.ReactDOM || !window.ToastApp) return;
        if (root._reactInited) return;
        const toastRoot = ReactDOM.createRoot(root);
        toastRoot.render(React.createElement(window.ToastApp.ToastContainer));
        root._reactInited = true;
        root._reactRoot = toastRoot;
        console.log('[面板] React Toast 通知系统已挂载');
    };

})(window.DevHome);
