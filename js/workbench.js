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

    /* ===== 任务操作浮动菜单 ===== */
    var _taskMenuEl = null;

    ns.showTaskContextMenu = function (taskId, quadrant, evt) {
        ns.hideTaskContextMenu();
        var qLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };
        var otherQs = QUADRANTS.filter(function (q) { return q !== quadrant; });

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

    /* ===== 任务-笔记关联 ===== */

    /** 将笔记关联到任务 */
    ns.linkNoteToTask = function (taskId, noteId) {
        var config = ns.getWorkbenchState();
        var found = false;
        QUADRANTS.forEach(function (q) {
            var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            tasks.forEach(function (t) {
                if (t.id === taskId) {
                    if (!t.noteIds) t.noteIds = [];
                    if (t.noteIds.indexOf(noteId) === -1) {
                        t.noteIds.push(noteId);
                        found = true;
                    }
                }
            });
        });
        if (found) {
            ns.saveWorkbenchState({ quadrants: config.quadrants });
            state.workbench = ns.getWorkbenchState();
            ns.renderQuadrantBoard();
            console.log('[编辑] 笔记 ' + noteId + ' 关联到任务 ' + taskId);
        }
    };

    /** 从任务取消关联笔记 */
    ns.unlinkNoteFromTask = function (taskId, noteId) {
        var config = ns.getWorkbenchState();
        QUADRANTS.forEach(function (q) {
            var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            tasks.forEach(function (t) {
                if (t.id === taskId && t.noteIds) {
                    t.noteIds = t.noteIds.filter(function (id) { return id !== noteId; });
                }
            });
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
        console.log('[编辑] 笔记 ' + noteId + ' 取消关联任务 ' + taskId);
    };

    /** 将笔记直接转为四象限任务（支持指定象限和截止时间） */
    ns.convertNoteToTask = function (noteId, quadrant, plannedAt) {
        quadrant = quadrant || 'q2';
        var note = (state.notes || []).find(function (n) { return n.id === noteId; });
        if (!note) return;
        var title = note.title || '未命名笔记';
        // 提取笔记纯文本内容作为任务描述（前500字）
        var plainContent = (note.content || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) config.quadrants[quadrant] = { tasks: [] };
        config.quadrants[quadrant].tasks.push({
            id: taskId(),
            title: title,
            status: 'active',
            noteIds: [noteId],
            content: plainContent,
            plannedAt: plannedAt || null,
            createdAt: Date.now()
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
        console.log('[编辑] 笔记转任务: ' + noteId + ' → ' + quadrant + (plannedAt ? ' 截止' + new Date(plannedAt).toISOString().slice(0, 16) : '') + ' 含' + plainContent.length + '字描述');
    };

    /** 获取任务的关联笔记列表（去重） */
    ns.getTaskLinkedNotes = function (taskId) {
        var config = ns.getWorkbenchState();
        var noteIds = [];
        QUADRANTS.forEach(function (q) {
            var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            var task = tasks.find(function (t) { return t.id === taskId; });
            if (task && task.noteIds) noteIds = task.noteIds;
        });
        // 去重
        var uniqueIds = [];
        var seen = {};
        noteIds.forEach(function (id) {
            if (!seen[id]) { seen[id] = true; uniqueIds.push(id); }
        });
        return (state.notes || []).filter(function (n) { return uniqueIds.indexOf(n.id) !== -1; });
    };

    /** 显示"关联笔记"选择弹窗 */
    ns.showTaskLinkNotesPopup = function (taskId) {
        var allNotes = state.notes || [];
        var linkedNotes = ns.getTaskLinkedNotes(taskId);
        var linkedIds = linkedNotes.map(function (n) { return n.id; });

        var hasNotes = allNotes.length > 0;
        var bodyHtml = hasNotes
            ? allNotes.map(function (note) {
                var isLinked = linkedIds.indexOf(note.id) !== -1;
                var title = note.title || '无标题';
                if (title.length > 25) title = title.slice(0, 25) + '...';
                return '<label class="wb-link-note-item">' +
                    '<input type="checkbox" value="' + escapeHtml(note.id) + '" ' + (isLinked ? 'checked' : '') + '>' +
                    '<span>' + title + '</span></label>';
            }).join('')
            : '<p style="text-align:center;color:var(--color-text-tertiary);padding:16px 0;">暂无笔记，请先在主工作区创建笔记</p>';

        // 创建自定义弹窗
        var overlay = document.createElement('div');
        overlay.className = 'wb-link-popup-overlay';
        overlay.innerHTML = '<div class="wb-link-popup">' +
            '<h3>关联笔记到任务</h3>' +
            '<div class="wb-link-popup-body">' + bodyHtml + '</div>' +
            '<div class="wb-link-popup-footer">' +
                '<button class="wb-link-popup-cancel">取消</button>' +
                '<button class="wb-link-popup-save">保存</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);

        // 点击遮罩关闭
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        // 取消按钮
        overlay.querySelector('.wb-link-popup-cancel').addEventListener('click', function () { overlay.remove(); });
        // 保存按钮
        overlay.querySelector('.wb-link-popup-save').addEventListener('click', function () {
            var checked = overlay.querySelectorAll('.wb-link-note-item input:checked');
            var selectedIds = Array.from(checked).map(function (cb) { return cb.value; });
            // 先取消所有旧关联
            linkedIds.forEach(function (nid) { ns.unlinkNoteFromTaskSilent(taskId, nid); });
            // 建立新关联
            selectedIds.forEach(function (nid) { ns.linkNoteToTask(taskId, nid); });
            overlay.remove();
            console.log('[编辑] 任务 ' + taskId + ' 关联笔记 ' + selectedIds.length + ' 篇');
        });
    };

    /** 查看已关联笔记，支持逐条解绑 */
    ns.showTaskLinkedNotesView = function (taskId) {
        var linkedNotes = ns.getTaskLinkedNotes(taskId);
        var bodyHtml = '';

        if (linkedNotes.length === 0) {
            bodyHtml = '<p class="wb-link-view-empty">暂无关联笔记</p>';
        } else {
            bodyHtml = linkedNotes.map(function (note) {
                var title = note.title || '无标题';
                var preview = (note.content || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);
                if (preview.length >= 80) preview += '...';
                var time = note.updatedAt
                    ? new Date(note.updatedAt).toLocaleDateString('zh-CN')
                    : (note.createdAt ? new Date(note.createdAt).toLocaleDateString('zh-CN') : '');

                return '<div class="wb-link-view-item" data-note-id="' + escapeHtml(note.id) + '">' +
                    '<div class="wb-link-view-info">' +
                        '<div class="wb-link-view-title">' + escapeHtml(title) + '</div>' +
                        '<div class="wb-link-view-preview">' + escapeHtml(preview || '(无内容)') + '</div>' +
                        (time ? '<div class="wb-link-view-time">' + time + '</div>' : '') +
                    '</div>' +
                    '<button class="wb-link-view-unlink" data-note-id="' + escapeHtml(note.id) + '" title="解绑此笔记">解绑</button>' +
                '</div>';
            }).join('');
        }

        var overlay = document.createElement('div');
        overlay.className = 'wb-link-popup-overlay';
        overlay.innerHTML = '<div class="wb-link-popup wb-link-view-popup">' +
            '<h3>已关联笔记（' + linkedNotes.length + ' 篇）</h3>' +
            '<div class="wb-link-popup-body">' + bodyHtml + '</div>' +
            '<div class="wb-link-popup-footer">' +
                '<button class="wb-link-popup-cancel">关闭</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);

        // 关闭时刷新四象限面板（更新 📎 徽章）
        var closeFn = function () {
            overlay.remove();
            ns.renderQuadrantBoard();
        };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeFn(); });
        overlay.querySelector('.wb-link-popup-cancel').addEventListener('click', closeFn);

        // 解绑按钮事件
        overlay.querySelectorAll('.wb-link-view-unlink').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var noteId = btn.dataset.noteId;
                var noteItem = btn.closest('.wb-link-view-item');
                var noteTitle = noteItem ? (noteItem.querySelector('.wb-link-view-title') || {}).textContent || '此笔记' : '此笔记';

                // 二次确认
                var confirmOverlay = document.createElement('div');
                confirmOverlay.className = 'wb-link-popup-overlay';
                confirmOverlay.style.zIndex = '3200';
                confirmOverlay.innerHTML = '<div class="wb-link-popup" style="max-width:280px;">' +
                    '<h3>确认解绑</h3>' +
                    '<p style="padding:12px 16px;font-size:13px;color:var(--color-text-secondary);margin:0;">确定要解除与「' + noteTitle.slice(0, 20) + '」的关联吗？<br><small style="color:var(--color-text-tertiary);">仅移除关联，不删除笔记</small></p>' +
                    '<div class="wb-link-popup-footer">' +
                        '<button class="wb-link-popup-cancel">取消</button>' +
                        '<button class="wb-link-popup-save" style="background:var(--color-danger);">确认解绑</button>' +
                    '</div>' +
                '</div>';
                document.body.appendChild(confirmOverlay);

                confirmOverlay.addEventListener('click', function (ce) { if (ce.target === confirmOverlay) confirmOverlay.remove(); });
                confirmOverlay.querySelector('.wb-link-popup-cancel').addEventListener('click', function () { confirmOverlay.remove(); });
                confirmOverlay.querySelector('.wb-link-popup-save').addEventListener('click', function () {
                    // 使用静默解绑（不触发 renderQuadrantBoard 重建 DOM）
                    ns.unlinkNoteFromTaskSilent(taskId, noteId);
                    confirmOverlay.remove();
                    // 安全移除条目（先检查父节点，防止 DOM 已被移走）
                    if (noteItem && noteItem.parentNode) noteItem.remove();
                    // 更新标题计数
                    var remaining = overlay.querySelectorAll('.wb-link-view-item').length;
                    var titleEl = overlay.querySelector('h3');
                    if (titleEl) titleEl.textContent = '已关联笔记（' + remaining + ' 篇）';
                    if (remaining === 0) {
                        overlay.querySelector('.wb-link-popup-body').innerHTML = '<p class="wb-link-view-empty">暂无关联笔记</p>';
                    }
                    // 弹窗关闭时统一刷四象限（更新 📎 徽章）
                    console.log('[编辑] 从任务 ' + taskId + ' 解绑笔记 ' + noteId);
                });
            });
        });
    };
    ns.unlinkNoteFromTaskSilent = function (taskId, noteId) {
        var config = ns.getWorkbenchState();
        QUADRANTS.forEach(function (q) {
            var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            tasks.forEach(function (t) {
                if (t.id === taskId && t.noteIds) {
                    t.noteIds = t.noteIds.filter(function (id) { return id !== noteId; });
                }
            });
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
    };

    /* ===== 侧边栏折叠/展开 ===== */
    ns.toggleQuadrantSidebar = function () {
        var panel = document.getElementById('wbQuadrantPanel');
        if (!panel) return;
        var isCollapsed = panel.classList.toggle('collapsed');
        console.log('[面板] 四象限侧边栏 ' + (isCollapsed ? '折叠' : '展开'));
    };

    /* ===== 右侧栏折叠/展开 ===== */
    ns.toggleRightSidebar = function () {
        var panel = document.getElementById('wbSidebarRight');
        if (!panel) return;
        var isCollapsed = panel.classList.toggle('collapsed');
        console.log('[面板] 右侧栏（日历+番茄钟） ' + (isCollapsed ? '折叠' : '展开'));
    };

    /* ===== 日历视图切换 ===== */
    ns.switchCalendarView = function (view) {
        state._calendarView = view;
        // 更新按钮状态
        document.querySelectorAll('.wb-cal-view-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        // 重新渲染日历
        var daysEl = document.getElementById('wbCalendarDays');
        if (!daysEl) return;
        if (view === 'week') {
            daysEl.classList.add('week-view');
        } else {
            daysEl.classList.remove('week-view');
        }
        ns.renderMiniCalendar(_calendarDate);
        console.log('[面板] 日历切换到' + (view === 'week' ? '周视图' : '月视图'));
    };

    /* ===== 专注模式切换 ===== */

    /**
     * 【专注模式数据存储架构审计】
     *
     * 专注模式涉及的数据按持久化方式分为三层：
     *
     * 1. localStorage（同步、单页、持久化）：
     *    - `devhome_workbench` → 四象限任务完整状态（通过 devhomeStorage.set('workbench',...) 写入）
     *    - ns.getWorkbenchState() 读取合并默认值，退出/进入专注模式均从此恢复
     *
     * 2. chrome.storage.local（异步、跨页、持久化）：
     *    - `v2/tasks` → 四象限任务的 v2 格式拷贝（含 quadrant 字段），由 saveWorkbenchState 同步写入
     *    - `v2/config` → 专注模式快捷键配置（focusShortcut）
     *    - `v2/behavior` → 行为仪表盘数据（streakDays, dailyStats 等）
     *    - `v2/pomodoro_sessions` → 番茄钟历史记录
     *    - `v2/notes` / `v2/captures` → 笔记和捕获（专注模式下笔记面板可读写）
     *
     * 3. 内存（state 对象，页面刷新即丢失）：
     *    - state.currentDevhomeMode → 'daily' | 'workbench'，当前模式标志
     *    - state.workbenchVisible → 工作台 DOM 是否可见
     *    - state._savedPageIndex → 退出专注模式后恢复的磁贴分类页索引
     *    - state._focusShortcut → 当前激活的快捷键配置（从 v2/config 异步加载缓存）
     *    - state._quadrantFilter → 'active' | 'all'，当前任务列表过滤器
     *    - state._pomodoroIsResting / _pomodoroSessionCount → 番茄钟内存状态
     *    - state._pomodoroLastState / _pomodoroDisplayTimer → 倒计时本地推算
     *
     * 持久化调用链：
     *   ns.addQuadrantTask / ns.completeQuadrantTask / ns.cancelQuadrantTask
     *     → ns.saveWorkbenchState() → devhomeStorage.set('workbench', ...) + storageV2.set('tasks', ...)
     *
     * 恢复调用链：
     *   ns.enterFocusMode() → ns.getWorkbenchState() → devhomeStorage.get('workbench')
     *     → 再用 storageV2.get('tasks') 异步覆盖（如有更新）
     *
     * 命名空间隔离：
     *   - devhomeStorage 前缀: devhome_ → 所有工作台相关数据（localStorage 级别）
     *   - storageV2 前缀: v2/ → chrome.storage.local 统一 key 空间
     */

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

        // 加载快捷键（如果还没加载过）
        if (!state._focusShortcut) {
            storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG).then(function (config) {
                state._focusShortcut = config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
                ns.updateContextMenuLabel();
            });
        }

        // 隐藏日常模式专属元素
        try {
            var matrixCanvas = document.getElementById('matrixCanvas');
            if (matrixCanvas) matrixCanvas.style.display = 'none';
            var bgContainer = document.getElementById('bgContainer');
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
        var renderErrors = [];
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
        try { ns.renderNotesList('all', ''); } catch (e) {
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
                var quadrants = { q1: { tasks: [] }, q2: { tasks: [] }, q3: { tasks: [] }, q4: { tasks: [] } };
                v2Tasks.forEach(function (t) {
                    if (quadrants[t.quadrant]) quadrants[t.quadrant].tasks.push(normalizeTask(t));
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

    /** 退出专注模式，恢复日常模式 */
    ns.exitFocusMode = function () {
        if (state.currentDevhomeMode === 'daily') return;
        ns.logger && ns.logger.info('focus-mode', 'exitFocusMode 开始');

        // 恢复日常模式专属元素
        try {
            var matrixCanvas = document.getElementById('matrixCanvas');
            if (matrixCanvas && ns.matrixRain && ns.matrixRain.isRunning()) {
                matrixCanvas.style.display = 'block';
            }
            var bgContainer = document.getElementById('bgContainer');
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
        // 补齐时效性字段
        if (!task.plannedAt && task.deadline) task.plannedAt = task.deadline;
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
        var config = ns.getWorkbenchState();
        state.workbench = config; // 同步清理后的数据回 state
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

    ns.addQuadrantTask = function (quadrant, title, opts) {
        if (!title || !title.trim()) return;
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) config.quadrants[quadrant] = { tasks: [] };
        opts = opts || {};
        config.quadrants[quadrant].tasks.push({
            id: taskId(),
            title: title.trim(),
            status: 'active',
            noteIds: opts.noteIds || [],
            content: opts.content || '',
            plannedAt: opts.plannedAt || null,
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

    /** 显示任务添加内联输入框（支持快速输入标题 + 展开详细模式设置描述和计划时间） */
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
                if (t.id === taskId) t.plannedAt = plannedAt;
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

    /** 挂载 React 通知系统容器（首次调用时创建，幂等） */
    ns.initReactToast = function () {
        var root = document.getElementById('reactToastRoot');
        if (!root || !window.ReactDOM || !window.ToastApp) return;
        if (root._reactInited) return;
        var toastRoot = ReactDOM.createRoot(root);
        toastRoot.render(React.createElement(window.ToastApp.ToastContainer));
        root._reactInited = true;
        root._reactRoot = toastRoot;
        console.log('[面板] React Toast 通知系统已挂载');
    };

    /** 启动截止时间轮询提醒：每分钟扫描活跃任务，到期前2分钟或已超期时弹Toast */
    (function () {
        var _deadlineNotified = {}; // 已提醒的 taskId 集合，避免重复弹窗
        var _deadlineTimer = null;

        ns.startDeadlineChecker = function () {
            if (_deadlineTimer) return;
            _deadlineTimer = setInterval(function () {
                if (state.currentDevhomeMode !== 'workbench') return;
                var config = state.workbench || ns.getWorkbenchState();
                if (!config || !config.quadrants) return;
                QUADRANTS.forEach(function (q) {
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

    /* ===== 番茄钟 ===== */
    /** 辅助：更新番茄钟时间显示 */
    function _pomoUpdateTimeEls(textFn) {
        var timeEl = document.getElementById('wbPomodoroSideTime');
        var text = textFn();
        if (timeEl) timeEl.textContent = text;
    }

    /** 辅助：设置进度环偏移 */
    function _pomoUpdateProgress(offset, total) {
        var el = document.getElementById('wbPomodoroSideProgress');
        var circumference = 402.12; // r=64 → 2*PI*64
        if (el) el.setAttribute('stroke-dashoffset', String(offset * circumference / total));
    }

    /** 格式化秒数为 MM:SS */
    function _formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    /** 停止正计时本地定时器 */
    function _stopCountUpTimer() {
        if (state._pomodoroCountUpTimer) {
            clearInterval(state._pomodoroCountUpTimer);
            state._pomodoroCountUpTimer = null;
        }
    }

    /** 切换倒计时/正计时模式 */
    ns.togglePomodoroMode = function (mode) {
        state.pomodoroCountUp = (mode === 'countup');
        document.querySelectorAll('.wb-pomodoro-mode-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        // 正计时模式下隐藏快捷按钮，倒计时模式显示
        var quickRow = document.querySelector('.wb-pomodoro-sidebar-quick');
        if (quickRow) quickRow.style.display = mode === 'countup' ? 'none' : '';
        ns.updatePomodoroDisplay();
        console.log('[模式] 番茄钟切换到' + (mode === 'countup' ? '正计时' : '倒计时'));
    };

    /** 切换自动循环开关 */
    ns.togglePomodoroAutoCycle = function () {
        state.pomodoroAutoCycle = !state.pomodoroAutoCycle;
        var btn = document.getElementById('wbPomodoroAutoCycleBtn');
        if (btn) {
            btn.classList.toggle('active', state.pomodoroAutoCycle);
            btn.textContent = state.pomodoroAutoCycle ? '循环中' : '单次';
        }
        console.log('[模式] 自动循环 ' + (state.pomodoroAutoCycle ? '开启' : '关闭'));
    };

    /** 修改休息时长 */
    ns.setPomodoroRestDuration = function (minutes) {
        var m = parseInt(minutes) || 5;
        m = Math.max(1, Math.min(30, m));
        state.pomodoroRestDuration = m;
        var input = document.getElementById('wbPomodoroRestInput');
        if (input) input.value = m;
        console.log('[编辑] 休息时长设为 ' + m + ' 分钟');
    };

    /** 设置番茄钟时长 */
    ns.setPomodoroDuration = function (duration) {
        state.pomodoroDuration = duration;
        // 更新快捷圆形按钮 active 状态
        document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
            btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
        });
        ns.updatePomodoroDisplay();
    };

    ns.updatePomodoroDisplay = function () {
        if (state.pomodoroCountUp) {
            _pomoUpdateTimeEls(function () { return '00:00'; });
        } else {
            var text = String(state.pomodoroDuration).padStart(2, '0') + ':00';
            _pomoUpdateTimeEls(function () { return text; });
        }
        var labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '准备开始';
        _pomoUpdateProgress(0, 100);
    };

    /** 渲染番茄钟任务选择器下拉 */
    ns.renderPomodoroTaskSelector = function () {
        var sel = document.getElementById('wbPomodoroTaskSelect');
        if (!sel) return;
        var config = ns.getWorkbenchState();
        var options = '<option value="">无关联</option>';
        var quadrants = ['q1', 'q2', 'q3', 'q4'];
        var qLabels = { q1: '重急', q2: '重缓', q3: '轻急', q4: '轻缓' };
        quadrants.forEach(function (q) {
            var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            tasks.forEach(function (t) {
                if (t.status === 'active') {
                    options += '<option value="' + t.id + '">[' + qLabels[q] + '] ' + ns.escapeHtml(t.title.slice(0, 20)) + '</option>';
                }
            });
        });
        var currentVal = sel.value;
        sel.innerHTML = options;
        if (currentVal) {
            // 保持之前的选择（如果该任务仍存在）
            var exists = sel.querySelector('option[value="' + currentVal + '"]');
            if (exists) sel.value = currentVal;
        }
        sel.addEventListener('change', function () {
            state._pomodoroTaskId = sel.value || null;
            console.log('[编辑] 番茄钟关联任务 ' + (state._pomodoroTaskId || '无'));
        });
    };

    /** 启动番茄钟，支持直接传入时长参数 */
    ns.startPomodoro = function (duration) {
        // 如果传入时长，先设置
        if (typeof duration === 'number' && duration > 0) {
            state.pomodoroDuration = duration;
            document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
                btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
            });
        }

        // 停止旧的正计时定时器
        _stopCountUpTimer();

        // 正计时模式：启动本地 count-up 定时器
        if (state.pomodoroCountUp) {
            state._pomodoroCountUpSeconds = 0;
            _pomoUpdateTimeEls(function () { return '00:00'; });
            _pomoUpdateProgress(100, 100); // 空环
            state._pomodoroCountUpTimer = setInterval(function () {
                state._pomodoroCountUpSeconds = (state._pomodoroCountUpSeconds || 0) + 1;
                var s = state._pomodoroCountUpSeconds;
                _pomoUpdateTimeEls(function () { return _formatTime(s); });
                // 进度环：以2小时为上限从空到满
                var progress = Math.min(s / 7200, 1);
                _pomoUpdateProgress((1 - progress) * 100, 100);
            }, 1000);
        }

        // 通知后台 service worker（倒计时需要，正计时发送大时长用于通知节点）
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            var taskId = state._pomodoroTaskId || null;
            var taskTitle = '';
            if (taskId) {
                var config = ns.getWorkbenchState();
                var quadrants = ['q1', 'q2', 'q3', 'q4'];
                quadrants.forEach(function (q) {
                    var tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
                    tasks.forEach(function (t) {
                        if (t.id === taskId) taskTitle = t.title;
                    });
                });
            }
            chrome.runtime.sendMessage({
                type: 'POMODORO_START',
                data: {
                    duration: state.pomodoroCountUp ? 999 : state.pomodoroDuration,
                    restDuration: state.pomodoroRestDuration,
                    type: state.pomodoroMode,
                    countUp: state.pomodoroCountUp,
                    autoCycle: state.pomodoroAutoCycle,
                    taskId: taskId,
                    taskTitle: taskTitle
                }
            });
        }
        var modeLabel = state.pomodoroCountUp ? '正计时' : (state.pomodoroDuration + '分');
        console.log('[交互] 番茄钟 开始 ' + modeLabel);
        var sideStart = document.getElementById('wbPomodoroSideStart');
        var sideReset = document.getElementById('wbPomodoroSideReset');
        if (sideStart) { sideStart.textContent = '暂停'; sideStart.classList.add('is-running'); }
        if (sideReset) sideReset.style.display = '';
        var labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '专注中...';
    };

    ns.pausePomodoro = function () {
        console.log('[交互] 番茄钟 暂停');
        _stopCountUpTimer();
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_PAUSE' });
        }
        var sideStart = document.getElementById('wbPomodoroSideStart');
        if (sideStart) { sideStart.textContent = '继续'; sideStart.classList.remove('is-running'); }
        var labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '已暂停';
    };

    ns.resetPomodoro = function () {
        console.log('[交互] 番茄钟 重置');
        _stopCountUpTimer();
        state._pomodoroCountUpSeconds = 0;
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_STOP' });
        }
        var sideStart = document.getElementById('wbPomodoroSideStart');
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
        var todayBehavior = behavior.dailyStats && behavior.dailyStats[todayStr];
        if (!todayBehavior || !todayBehavior.streakDay) {
            behavior.lastActiveDate = todayStr;
            behavior.streakDays = (behavior.streakDays || 0) + 1;
            if (!behavior.dailyStats) behavior.dailyStats = {};
            behavior.dailyStats[todayStr] = Object.assign({}, behavior.dailyStats[todayStr] || {}, { streakDay: true });
            await storageV2.set(storageV2.KEYS.BEHAVIOR, behavior);
        }

        // React 渲染：设置全局数据并触发看板刷新
        window.__dashboardData = {
            streak: behavior.streakDays || 0,
            totalCompleted: behavior.totalCompleted || 0,
            totalPomodoros: todaySessions.length,
            totalFocusMinutes: totalFocusMin,
            totalNotes: (state.notes || []).length,
            dailyStats: behavior.dailyStats || {}
        };

        var root = document.getElementById('reactDashboardRoot');
        if (root && window.ReactDOM && window.DashboardApp) {
            // 首次渲染用 createRoot，后续用 __refreshDashboard
            if (!root._reactInited) {
                var reactRoot = ReactDOM.createRoot(root);
                reactRoot.render(React.createElement(window.DashboardApp.Dashboard));
                root._reactInited = true;
                root._reactRoot = reactRoot;
            } else if (window.__refreshDashboard) {
                window.__refreshDashboard();
            }
        } else {
            // 回退：更新原 DOM（dashboard.js 未加载）
            if (dom.wbMeStreakNum) dom.wbMeStreakNum.textContent = behavior.streakDays || 0;
        }

        console.log('[面板] 行为数据看板已刷新 连续' + behavior.streakDays + '天');
    };

    /* ===== AI 调用引擎 ===== */

    /**
     * 通用 AI 调用函数
     * 根据当前激活的供应商和模块，构建请求、调用 API、渲染结果。
     *
     * @param {string} moduleId - 功能模块 ID（如 'daily-summary' | 'quick-chat'）
     * @param {string} [userInput] - 快速对话时用户输入的问题（可选）
     */
    ns.generateAI = async function (moduleId, userInput) {
        var moduleDef = ns.getModuleById(moduleId);
        if (!moduleDef) {
            ns.showToast('未知 AI 模块: ' + moduleId, 'error');
            return;
        }

        // 读取配置
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var providerId = config.aiApi.activeProvider || 'hunyuan';
        var providerConfig = config.aiApi.providers && config.aiApi.providers[providerId]
            ? config.aiApi.providers[providerId]
            : {};

        // 查找供应商元数据（含 API 适配器）
        var provider = ns.getProviderById(providerId);
        // 自定义（OpenAI 兼容）供应商需使用通用适配器，否则无法发起请求
        if (!provider) {
            provider = ns.createOpenAIProvider(providerId, providerConfig);
        }

        // 合并配置（用户保存的覆盖内置默认值）
        var apiKey = providerConfig.apiKey || provider.apiKey;
        var endpoint = providerConfig.endpoint || provider.endpoint;
        var model = providerConfig.model || provider.model;

        if (!apiKey) {
            ns.showToast('请先在下方配置 API Key', 'error');
            return;
        }

        // 收集上下文内容
        var contentText = moduleDef.buildContext ? moduleDef.buildContext() : '';

        // 需要内容的模块，检查是否为空
        if (moduleDef.requireContent && !contentText.trim()) {
            ns.showToast(moduleDef.emptyMessage || '暂无可用内容', 'info');
            return;
        }

        // 需要用户输入的模块
        if (moduleDef.needUserInput && !userInput) {
            // 弹出输入框获取用户问题
            var input = await ns.showPrompt(moduleDef.inputPlaceholder || '输入问题...', {
                title: moduleDef.inputTitle || '快速对话',
                defaultValue: ''
            });
            if (!input) return; // 用户取消
            contentText = input;
        }

        // 显示加载状态
        if (dom.wbMeAiResult) dom.wbMeAiResult.style.display = 'block';
        if (dom.wbMeAiContent) dom.wbMeAiContent.innerHTML =
            '<p style="color:var(--color-text-secondary);">正在调用 ' + provider.name + '（' + model + '）...</p>';

        try {
            // 构建消息
            var messages = [{ role: 'system', content: moduleDef.systemPrompt }];
            if (contentText && contentText.trim()) {
                messages.push({ role: 'user', content: contentText.slice(0, 12000) });
            }
            if (!contentText || !contentText.trim()) {
                // 没有上下文时至少给一个通用提示
                messages.push({ role: 'user', content: '你好' });
            }

            // 通过供应商适配器发起请求
            var response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(provider.buildBody(model, messages))
            });

            if (!response.ok) {
                var errText = await response.text().catch(function () { return ''; });
                throw new Error('API 请求失败: ' + response.status + ' ' + response.statusText + (errText ? ' - ' + errText.slice(0, 200) : ''));
            }

            var data = await response.json();
            var summary = provider.extractContent(data);

            if (!summary) {
                // 兜底：尝试通用 OpenAI 格式
                summary = data.choices && data.choices[0]
                    ? data.choices[0].message.content
                    : JSON.stringify(data);
            }

            if (dom.wbMeAiContent) {
                dom.wbMeAiContent.innerHTML = typeof marked !== 'undefined' && marked.parse
                    ? ns.sanitizeHtml(marked.parse(summary))
                    : '<pre>' + ns.escapeHtml(summary) + '</pre>';
            }

            console.log('[AI] 调用成功 供应商=' + providerId + ' 模块=' + moduleId + ' 模型=' + model);
        } catch (e) {
            if (dom.wbMeAiContent) {
                dom.wbMeAiContent.innerHTML =
                    '<p style="color:#ff6b6b;">生成失败：' + ns.escapeHtml(e.message) + '</p>' +
                    '<p style="color:var(--color-text-tertiary);font-size:11px;">请检查 API Key、端点地址和网络连接</p>';
            }
            console.error('[AI] 错误:', e);
        }
    };

    /** 兼容旧接口：生成每日总结 */
    ns.generateAISummary = function () {
        return ns.generateAI('daily-summary');
    };

    /* ===== 供应商管理 CRUD ===== */

    /** 获取所有供应商（内置 + 自定义）合并后的列表 */
    ns.getMergedProviders = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeProvider = config.aiApi.activeProvider || 'hunyuan';
        var savedProviders = config.aiApi.providers || {};

        // 内置供应商
        var builtinIds = ns.AI_PROVIDERS.map(function (p) { return p.id; });
        var result = [];

        // 先加内置
        ns.AI_PROVIDERS.forEach(function (p) {
            var saved = savedProviders[p.id] || {};
            result.push({
                id: p.id,
                name: saved.name || p.name,
                badge: saved.name || p.badge,
                isBuiltin: true,
                apiKey: saved.apiKey || p.apiKey,
                endpoint: saved.endpoint || p.endpoint,
                model: saved.model || p.model,
                active: p.id === activeProvider
            });
        });

        // 再加自定义（排除已存在的内置 ID）
        Object.keys(savedProviders).forEach(function (pid) {
            if (builtinIds.indexOf(pid) !== -1) return;
            var sp = savedProviders[pid];
            result.push({
                id: pid,
                name: sp.name || pid,
                badge: sp.name || pid,
                isBuiltin: false,
                apiKey: sp.apiKey || '',
                endpoint: sp.endpoint || '',
                model: sp.model || '',
                active: pid === activeProvider
            });
        });

        return result;
    };

    /** 渲染供应商列表到设置面板 */
    ns.renderProviderList = async function () {
        if (!dom.wbAiProviderList) return;
        var providers = await ns.getMergedProviders();
        var html = '';
        providers.forEach(function (p) {
            var cls = p.active ? 'ai-provider-item active' : 'ai-provider-item';
            html += '<div class="' + cls + '" data-provider-id="' + ns.escapeHtml(p.id) + '">' +
                '<div class="ai-provider-info">' +
                    '<div class="ai-provider-name">' + ns.escapeHtml(p.name) + '</div>' +
                    '<div class="ai-provider-model">' + ns.escapeHtml(p.model) + '</div>' +
                '</div>' +
                '<div class="ai-provider-actions">' +
                    '<button class="ai-provider-del-btn" title="删除">×</button>' +
                '</div>' +
            '</div>';
        });
        dom.wbAiProviderList.innerHTML = html;
    };

    /** 选择供应商 */
    ns.selectAiProvider = async function (providerId) {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        config.aiApi.activeProvider = providerId;
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        // 更新表单
        var savedProviders = config.aiApi.providers || {};
        var saved = savedProviders[providerId] || {};
        var builtin = ns.getProviderById(providerId);

        if (dom.wbAiProviderBadge) {
            var name = saved.name || (builtin ? builtin.name : providerId);
            dom.wbAiProviderBadge.textContent = name;
        }
        if (dom.wbMeAiName) dom.wbMeAiName.value = saved.name || (builtin ? builtin.name : '');
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = saved.apiKey || (builtin ? builtin.apiKey : '');
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = saved.endpoint || (builtin ? builtin.endpoint : '');
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = saved.model || (builtin ? builtin.model : '');

        ns.renderProviderList();
        console.log('[AI] 选择供应商 → ' + providerId);
    };

    /** 添加新供应商 */
    ns.addAiProvider = async function () {
        var name = await ns.showPrompt('输入新供应商名称', { title: '添加供应商', defaultValue: '' });
        if (!name) return;
        var id = 'custom_' + Date.now();
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        if (!config.aiApi.providers) config.aiApi.providers = {};
        config.aiApi.providers[id] = { name: name, apiKey: '', endpoint: '', model: '' };
        config.aiApi.activeProvider = id;
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        if (dom.wbMeAiName) dom.wbMeAiName.value = name;
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = '';
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = '';
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = '';
        if (dom.wbAiProviderBadge) dom.wbAiProviderBadge.textContent = name;

        ns.renderProviderList();
        ns.showToast('已添加供应商: ' + name, 'success');
        console.log('[AI] 添加供应商:', name, id);
    };

    /** 删除供应商（仅自定义） */
    ns.deleteAiProvider = async function (providerId) {
        var builtin = ns.getProviderById(providerId);
        if (builtin) { ns.showToast('内置供应商不可删除', 'warning'); return; }

        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        if (config.aiApi.providers) delete config.aiApi.providers[providerId];
        if (config.aiApi.activeProvider === providerId) config.aiApi.activeProvider = 'hunyuan';
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        // 切换到默认供应商
        ns.selectAiProvider('hunyuan');
        ns.showToast('已删除供应商', 'info');
    };

    /** 保存当前编辑的供应商配置，自动请求 host_permissions */
    ns.saveAiProviderConfig = async function () {
        var name = dom.wbMeAiName ? dom.wbMeAiName.value.trim() : '';
        var apiKey = dom.wbMeAiApiKey ? dom.wbMeAiApiKey.value.trim() : '';
        var endpoint = dom.wbMeAiEndpoint ? dom.wbMeAiEndpoint.value.trim() : '';
        var model = dom.wbMeAiModel ? dom.wbMeAiModel.value.trim() : '';

        if (!name) { ns.showToast('请填写供应商名称', 'error'); return; }
        if (!apiKey) { ns.showToast('请填写 API Key', 'error'); return; }

        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeProvider = config.aiApi.activeProvider || 'hunyuan';
        if (!config.aiApi.providers) config.aiApi.providers = {};
        config.aiApi.providers[activeProvider] = { name: name, apiKey: apiKey, endpoint: endpoint, model: model };
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        // 自动请求 host_permissions（避免手动编辑 manifest）
        if (endpoint) {
            try {
                var urlObj = new URL(endpoint);
                var origin = urlObj.origin; // e.g. https://new-api.rugao.me
                var originPattern = origin + '/*';

                // 检查是否已有权限
                var hasPermission = await new Promise(function (resolve) {
                    chrome.permissions.contains({ origins: [originPattern] }, function (result) {
                        resolve(result);
                    });
                });

                if (!hasPermission) {
                    console.log('[AI] 请求 host_permissions:', originPattern);
                    // 弹出浏览器原生权限请求对话框
                    var granted = await new Promise(function (resolve) {
                        chrome.permissions.request({ origins: [originPattern] }, function (result) {
                            resolve(result);
                        });
                    });
                    if (granted) {
                        console.log('[AI] host_permissions 已授权:', originPattern);
                    } else {
                        console.warn('[AI] 用户拒绝 host_permissions:', originPattern);
                        ns.showToast('已保存配置，但访问该域名的请求可能被拦截。可在扩展管理中手动授权。', 'warning');
                    }
                }
            } catch (e) {
                console.warn('[AI] 自动请求 host_permissions 失败:', e.message);
            }
        }

        ns.renderProviderList();
        ns.showToast('配置已保存（' + name + '）', 'success');
    };

    /* ===== 兼容旧 switchAiProvider（已被 selectAiProvider 替代） ===== */
    ns.switchAiProvider = async function (providerId) {
        return ns.selectAiProvider(providerId);
    };

    /* ===== 加载 AI + 快捷键配置到设置面板 UI ===== */
    ns.loadMeConfig = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeProvider = config.aiApi.activeProvider || 'hunyuan';
        var savedProviders = config.aiApi.providers || {};
        var providerConfig = savedProviders[activeProvider] || {};

        var provider = ns.getProviderById(activeProvider);

        // 渲染供应商列表
        ns.renderProviderList();

        // 徽章
        if (dom.wbAiProviderBadge) {
            var name = providerConfig.name || (provider ? provider.name : activeProvider);
            dom.wbAiProviderBadge.textContent = name;
        }

        // AI 配置输入框
        if (dom.wbMeAiName) dom.wbMeAiName.value = providerConfig.name || (provider ? provider.name : '');
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = providerConfig.apiKey || (provider ? provider.apiKey : '');
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = providerConfig.endpoint || (provider ? provider.endpoint : '');
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = providerConfig.model || (provider ? provider.model : '');

        // 加载快捷键（保持不变）

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

    /* ===== 监听后台番茄钟状态（倒计时模式显示更新） =====
       页面端本地自走秒：后台 SW 可能因休眠而停止广播，故此处依据
       phaseStartAt + phaseTotalSeconds 在本地推算剩余时间，保证显示不卡住。 */
    function _pomoApplyState(data) {
        if (state.pomodoroCountUp) return; // 正计时由本地 setInterval 控制
        state._pomodoroLastState = data;

        // 本地推算剩余秒数（SW 休眠时仍可正确倒计时）
        var remaining = data.remaining;
        if (data.active && data.phaseStartAt) {
            remaining = Math.max(0, data.phaseTotalSeconds - Math.floor((Date.now() - data.phaseStartAt) / 1000));
        }

        // 更新休息/工作状态
        state._pomodoroIsResting = data.isResting || false;
        state._pomodoroSessionCount = data.sessionCount || 0;

        var modeEl = document.getElementById('wbPomodoroModeLabel');

        // 番茄钟停止（非自动循环模式主动停止）
        if (!data.active && remaining <= 0) {
            var sideStart = document.getElementById('wbPomodoroSideStart');
            if (sideStart) { sideStart.textContent = '开始'; sideStart.classList.remove('is-running'); }
            if (modeEl) { modeEl.textContent = ''; modeEl.className = 'wb-pomodoro-mode-label'; }
            _stopPomodoroDisplayTimer();
            ns.updatePomodoroDisplay();
            return;
        }

        // 更新模式标签
        if (modeEl && data.active) {
            var sessionInfo = data.sessionCount > 0 ? ' #' + data.sessionCount : '';
            modeEl.textContent = data.isResting ? '休息中' + sessionInfo : '工作中' + sessionInfo;
            modeEl.className = 'wb-pomodoro-mode-label ' + (data.isResting ? 'resting' : 'working');
        }

        // 更新时间和进度环
        _pomoUpdateTimeEls(function () { return _formatTime(remaining); });
        var phaseDuration = data.isResting ? data.restDuration : data.duration;
        var total = phaseDuration * 60;
        if (total > 0) {
            _pomoUpdateProgress(remaining / total * 100, 100);
        }
    }

    function _stopPomodoroDisplayTimer() {
        if (state._pomodoroDisplayTimer) {
            clearInterval(state._pomodoroDisplayTimer);
            state._pomodoroDisplayTimer = null;
        }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(function (message) {
            if (message.type !== 'POMODORO_STATE' || !message.data) return;
            var data = message.data;

            // 启动/停止本地自走秒定时器（仅运行期间）
            if (data.active && !state._pomodoroDisplayTimer) {
                state._pomodoroDisplayTimer = setInterval(function () {
                    if (state._pomodoroLastState) _pomoApplyState(state._pomodoroLastState);
                }, 1000);
            } else if (!data.active && state._pomodoroDisplayTimer) {
                _stopPomodoroDisplayTimer();
            }

            _pomoApplyState(data);
        });
    }

})(window.DevHome);
