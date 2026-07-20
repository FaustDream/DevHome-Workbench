/**
 * DevHome Workbench - 全局状态与 DOM 缓存
 * state：应用运行时的所有可变状态。
 * dom：所有 DOM 元素引用集中存储，便于全局访问。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns.perfStart = performance.now();

    /* ===== DOM 快捷选择器 ===== */
    ns.$ = function (sel) { return document.querySelector(sel); };
    ns.$$ = function (sel) { return document.querySelectorAll(sel); };

    /* ===== DOM 缓存：集中管理所有元素引用 ===== */
    ns.dom = {
        container: ns.$('.container'),
        searchContainer: ns.$('#searchContainer'),
        searchInput: ns.$('#searchInput'),
        searchButton: ns.$('#searchButton'),
        engineSelector: ns.$('#engineSelector'),
        currentEngine: ns.$('#currentEngine'),
        engineDropdown: ns.$('#engineDropdown'),
        tilesContainer: ns.$('#tilesContainer'),

        contextMenu: ns.$('#contextMenu'),
        blankContextMenu: ns.$('#blankContextMenu'),
        settingsGearBtn: ns.$('#settingsGearBtn'),
        settingsOverlay: ns.$('#settingsOverlay'),
        settingsPanel: ns.$('#settingsPanel'),
        settingsCloseBtn: ns.$('#settingsCloseBtn'),
        bgContainer: ns.$('#bgContainer'),
        bgImage: ns.$('#bgImage'),
        bgVideo: ns.$('#bgVideo'),
        bgOverlay: ns.$('#bgOverlay'),
        bgInput: ns.$('#bgInput'),
        autoFocusText: ns.$('#autoFocusText'),
        categoryMemoryText: ns.$('#categoryMemoryText'),
        shortcutSizeText: ns.$('#shortcutSizeText'),
        shortcutColumnsText: ns.$('#shortcutColumnsText'),
        catRow: ns.$('#catRow'),
        catRowText: ns.$('#catRowText'),
        importInput: ns.$('#importInput'),
        devhomeStage: ns.$('#devhomeStage'),
        devhomeBackHome: ns.$('#devhomeBackHome'),
        quadrantFilterBtn: ns.$('#quadrantFilterBtn'),
        quadrantGrid: ns.$('#quadrantGrid'),
        q1TaskList: ns.$('#q1TaskList'),
        q2TaskList: ns.$('#q2TaskList'),
        q3TaskList: ns.$('#q3TaskList'),
        q4TaskList: ns.$('#q4TaskList'),
        q1Count: ns.$('#q1Count'),
        q2Count: ns.$('#q2Count'),
        q3Count: ns.$('#q3Count'),
        q4Count: ns.$('#q4Count'),
        devhomeClearDone: ns.$('#devhomeClearDone'),
        changelogBtn: ns.$('#changelogBtn'),
        // 文件配置 UI
        configWarningBar: ns.$('#configWarningBar'),
        configWarningText: ns.$('#configWarningText'),
        configSelectDirBtn: ns.$('#configSelectDirBtn'),
        configSyncBtn: ns.$('#configSyncBtn'),
        configSyncStatus: ns.$('#configSyncStatus'),
        configChangeDirBtn: ns.$('#configChangeDirBtn'),
        configDirLabel: ns.$('#configDirLabel'),
        // v2 工作台 DOM
        wbNav: ns.$('#wbNav'),
        wbContent: ns.$('#wbContent'),
        wbCaptureInput: ns.$('#wbCaptureInput'),
        wbCaptureRecent: ns.$('#wbCaptureRecent'),
        wbNotesSearch: ns.$('#wbNotesSearch'),
        wbNotesFilters: ns.$('#wbNotesFilters'),
        wbNotesList: ns.$('#wbNotesList'),
        wbNotesAddBtn: ns.$('#wbNotesAddBtn'),
        wbNotesEditorEmpty: ns.$('#wbNotesEditorEmpty'),
        wbNotesEditorActive: ns.$('#wbNotesEditorActive'),
        wbNoteTitle: ns.$('#wbNoteTitle'),
        wbNoteType: ns.$('#wbNoteType'),
        wbNoteTypeBadge: ns.$('#wbNoteTypeBadge'),
        wbCustomFilters: ns.$('#wbCustomFilters'),
        wbFilterAddBtn: ns.$('#wbFilterAddBtn'),
        wbNoteDeleteBtn: ns.$('#wbNoteDeleteBtn'),
        wbNoteContent: ns.$('#wbNoteContent'),
        wbNotesEmptyMsg: ns.$('#wbNotesEmptyMsg'),
        wbCalendarTitle: ns.$('#wbCalendarTitle'),
        wbCalendarDays: ns.$('#wbCalendarDays'),
        wbCalendarDetail: ns.$('#wbCalendarDetail'),
        wbPomodoroCircle: ns.$('#wbPomodoroCircle'),
        wbPomodoroTime: ns.$('#wbPomodoroTime'),
        wbPomodoroLabel: ns.$('#wbPomodoroLabel'),
        wbPomodoroProgress: ns.$('#wbPomodoroProgress'),
        wbPomodoroHistoryList: ns.$('#wbPomodoroHistoryList'),
        wbMeStreakNum: ns.$('#wbMeStreakNum'),
        wbMeStatTasks: ns.$('#wbMeStatTasks'),
        wbMeStatPomodoros: ns.$('#wbMeStatPomodoros'),
        wbMeStatFocus: ns.$('#wbMeStatFocus'),
        wbMeStatNotes: ns.$('#wbMeStatNotes'),
        wbMeExportList: ns.$('#wbMeExportList'),
        wbMeToggleStrict: ns.$('#wbMeToggleStrict'),
        wbMeToggleFileSync: ns.$('#wbMeToggleFileSync'),
        wbMeShortcutCtrl: ns.$('#wbMeShortcutCtrl'),
        wbMeShortcutShift: ns.$('#wbMeShortcutShift'),
        wbMeShortcutAlt: ns.$('#wbMeShortcutAlt'),
        wbMeShortcutKey: ns.$('#wbMeShortcutKey'),
        wbMeShortcutSave: ns.$('#wbMeShortcutSave'),
        ctxFocusModeLabel: ns.$('#ctxFocusModeLabel'),
        ctxFocusModeKey: ns.$('#ctxFocusModeKey'),
        // 笔记本 DOM
        wbNotebookDropdown: ns.$('#wbNotebookDropdown'),
        wbNotebookDropdownBtn: ns.$('#wbNotebookDropdownBtn'),
        wbNotebookDropdownLabel: ns.$('#wbNotebookDropdownLabel'),
        wbNotebookDropdownMenu: ns.$('#wbNotebookDropdownMenu'),
        wbNotebookAddBtn: ns.$('#wbNotebookAddBtn'),
        wbTagAddBtn: ns.$('#wbTagAddBtn'),
        wbNotebookBadge: ns.$('#wbNotebookBadge'),
        // 代理配置 DOM
        proxyEnabledToggle: ns.$('#proxyEnabledToggle'),
        proxyConfigSection: ns.$('#proxyConfigSection'),
        proxyModeSeg: ns.$('#proxyModeSeg'),
        proxyManualConfig: ns.$('#proxyManualConfig'),
        proxyHostInput: ns.$('#proxyHostInput'),
        proxyPortInput: ns.$('#proxyPortInput'),
        proxyStatusBadge: ns.$('#proxyStatusBadge'),
        googleStatusBadge: ns.$('#googleStatusBadge'),
        proxyRetestBtn: ns.$('#proxyRetestBtn')
    };

    /* ===== 全局状态 ===== */
    ns.state = {
        currentEngine: 'google',
        engineUrl: 'https://www.google.com/search?q=',
        lastMinute: -1,
        lastDate: '',
        dragging: null,
        dragStartX: 0,
        dragStartY: 0,
        dragOffsetX: 0,
        dragOffsetY: 0,
        dragOver: null,
        dragMoved: false,
        dragReady: false,
        dragLongPressTimer: null,
        categoryDragging: null,
        categoryDragOver: null,
        categoryDragMoved: false,
        categoryDragReady: false,
        categoryLongPressTimer: null,
        categoryEditMode: false,
        preventNextCategoryClick: false,
        tileEditMode: false,
        preventNextTileClick: false,
        contextMenuTarget: null,
        editingTile: null,
        searchHistory: [],
        suggestionsVisible: false,
        selectedSuggestionIndex: -1,
        currentPage: 0,
        totalPages: 1,
        pageNames: ['第1页'],
        pageTransition: false,
        workbenchVisible: false,
        currentDevhomeMode: 'daily',
        workbench: null,
        configReady: false,  // 文件配置目录是否已就绪
        // v2 状态
        activeWbTab: 'dashboard',       // 当前工作台 Tab
        notes: [],                       // 笔记列表
        captures: [],                    // 快速捕获列表
        currentNote: null,              // 当前编辑的笔记
        currentCalendarDate: null,      // 当前日历视图日期
        pomodoroDuration: 25,           // 当前番茄钟时长
        pomodoroRestDuration: 5,        // 当前休息时长
        pomodoroMode: 'default',        // 番茄钟模式
        pomodoroCountUp: false,         // 正计时模式 true=正计时 false=倒计时
        pomodoroAutoCycle: true,        // 自动循环工作↔休息
        _pomodoroCountUpTimer: null,    // 正计时本地 setInterval ID
        _pomodoroIsResting: false,      // 当前是否在休息阶段
        _pomodoroSessionCount: 0,       // 当前已完成轮次
        exportFilter: 'all',            // 导出筛选
        _currentNoteType: 'note',        // 当前编辑笔记的类型
        _calendarView: 'month',          // 日历视图：month | week
        _quadrantCollapsed: false,       // 四象限侧边栏折叠状态
        _rightbarCollapsed: false,       // 右侧栏折叠状态
        _customTypeLabels: {},           // 自定义类型标签映射表（key→label）
        _customTypeIcons: {},            // 自定义类型图标映射表（key→icon）
        notebooks: [],                    // 笔记本列表
        _notebookFilter: null,           // 当前筛选的笔记本 ID（null = 全部笔记）
        _lastNotebookId: null,           // 上次选中的笔记本 ID（跨会话记住）
        _notesFilter: 'all',             // 当前笔记类型筛选（'all' | 'note' | 'capture' | 自定义typeKey）
        _notesSearch: '',                // 当前笔记搜索关键词
        _savedNotebookFilter: null,      // 离开专注模式前暂存的笔记本筛选 ID
        _savedCurrentNoteId: null        // 离开专注模式前暂存的当前笔记 ID
    };

    /* ===== 轻量级状态订阅（发布/订阅模式） =====
       用于需要跨模块响应的状态变更（如番茄钟完成→更新任务进度）。
       不影响现有 ns.state 直接读写，仅作为可选的事件通知层。
       使用方式：
         ns.store.on('pomodoroComplete', function(data) { ... });
         ns.store.emit('pomodoroComplete', { count: 3 }); */
    ns.store = {
        _listeners: {},
        /**
         * 订阅事件
         * @param {string} event - 事件名
         * @param {function} fn - 回调函数
         */
        on: function (event, fn) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(fn);
        },
        /**
         * 取消订阅
         * @param {string} event - 事件名
         * @param {function} fn - 要移除的回调（不传则清空该事件的所有监听器）
         */
        off: function (event, fn) {
            if (!this._listeners[event]) return;
            if (fn) {
                this._listeners[event] = this._listeners[event].filter(function (l) { return l !== fn; });
            } else {
                delete this._listeners[event];
            }
        },
        /**
         * 触发事件
         * @param {string} event - 事件名
         * @param {*} data - 传递给监听器的数据
         */
        emit: function (event, data) {
            const listeners = this._listeners[event];
            if (!listeners) return;
            listeners.forEach(function (fn) {
                try { fn(data); } catch (e) {
                    console.warn('[Store] 事件 ' + event + ' 监听器异常:', e.message);
                }
            });
        }
    };

})(window.DevHome);
