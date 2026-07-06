/**
 * DevHome Workbench - 配置常量
 * 包含快捷方式尺寸、列数、主题配置、搜索引擎、默认工作台数据等全局常量。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 快捷方式尺寸配置 ===== */
    ns.DEFAULT_SHORTCUT_SIZE = 'standard';
    ns.SHORTCUT_SIZE_OPTIONS = {
        small: { name: '小', container: '76px', icon: '36px', gap: '16px', radius: '16px', fontSize: '10px', labelBottom: '6px', addIcon: '20px' },
        standard: { name: '标准', container: '100px', icon: '56px', gap: '24px', radius: '18px', fontSize: '12px', labelBottom: '8px', addIcon: '28px' },
        large: { name: '大', container: '128px', icon: '72px', gap: '32px', radius: '24px', fontSize: '14px', labelBottom: '10px', addIcon: '34px' }
    };

    /* ===== 快捷方式列数配置 ===== */
    ns.DEFAULT_SHORTCUT_COLUMNS = 6;
    ns.TILE_LONG_PRESS_MS = 200;
    ns.SHORTCUT_COLUMN_OPTIONS = {
        6: { label: '6 个', columns: '6' },
        8: { label: '8 个', columns: '8' }
    };

    /* ===== 搜索引擎配置 ===== */
    ns.engines = {
        google:   { svg: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="8" y="11.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">G</text></svg>', name: 'Google', url: 'https://www.google.com/search?q=' },
        baidu:    { badge: '百', name: '百度', url: 'https://www.baidu.com/s?wd=' },
        bing:     { svg: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="8" y="11.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">B</text></svg>', name: 'Bing', url: 'https://www.bing.com/search?q=' },
        duckduckgo:{ svg: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
        yahoo:    { svg: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="8" y="11.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">Y</text></svg>', name: 'Yahoo', url: 'https://search.yahoo.com/search?p=' },
        github:   { badge: 'GH', name: 'GitHub', url: 'https://github.com/search?q=' }
    };

    /* ===== 默认工作台状态（四象限任务） ===== */
    ns.defaultWorkbenchState = {
        enabled: true,
        quadrants: {
            q1: { title: '重要且紧急', subtitle: '立即去做', tasks: [] },
            q2: { title: '重要不紧急', subtitle: '计划去做', tasks: [] },
            q3: { title: '紧急不重要', subtitle: '授权他人', tasks: [] },
            q4: { title: '不紧急不重要', subtitle: '尽量不做', tasks: [] }
        },
        // 保留旧数据字段以兼容，但不再主动使用
        lastProject: '',
        inbox: [],
        projects: [],
        resources: []
    };

    /* ===== v2 默认配置 ===== */

    /** 番茄钟预设时长（分钟） */
    ns.POMODORO_PRESETS = [25, 30, 45, 60];

    /** 番茄钟休息预设（分钟） */
    ns.POMODORO_REST_PRESETS = [5, 10, 15];

    /** 笔记类型 */
    ns.NOTE_TYPES = {
        note: { label: '笔记', icon: '📝' },
        idea: { label: '想法', icon: '💡' },
        bug: { label: 'Bug', icon: '🐛' },
        meeting: { label: '会议', icon: '📋' },
        webclip: { label: '剪藏', icon: '🔗' }
    };

    /** 鼓励文案池 */
    ns.ENCOURAGEMENT_POOL = [
        '又干掉一个🍅',
        '大脑说谢谢',
        '比刚才的自己多坚持了一会儿',
        '专注是一种超能力',
        '休息一下，你值得',
        '今天的你比昨天更强',
        '每一个完成的番茄钟，都是对拖延症的一记重拳',
        '慢慢来，比较快',
        '不完美的行动胜过完美的计划'
    ];

    /** 模块显隐开关默认配置（所有新功能默认开启，用户可在设置中关闭） */
    ns.DEFAULT_MODULE_CONFIG = {
        weather: true,          // 天气预报
        dailyQuote: true,       // 每日金句
        greeting: true,         // 个性化问候语
        bangCommands: true,     // Bang Commands 快捷搜索词缀
        newsFeed: true,         // 资讯热榜 / RSS 订阅
        recentTabs: true,       // 最近关闭 / 历史记录快速访问
        dragLayout: true,       // 自定义布局（长按拖拽）
        perfMonitor: true,      // 性能监控面板
        githubTrending: true    // GitHub Trending 聚合
    };

    /** 空状态幽默文案 */
    ns.EMPTY_STATE_MESSAGES = {
        captures: [
            '这里空空如也，和你的周末计划一样',
            '灵感呢？被猫吃了吗？',
            '先记点什么吧，哪怕只是一个 emoji'
        ],
        notes: [
            '还没有笔记，就像一张白纸',
            '写点什么吧，未来你会感谢现在的自己',
            '笔记区：等待第一位顾客光临'
        ],
        tasks: [
            '暂无任务，享受这片刻的宁静',
            '任务列表：一片祥和',
            '没有任务就是最好的任务'
        ],
        pomodoro: [
            '还没有番茄钟记录，按下开始试试',
            '番茄钟区：这里闻起来很新鲜'
        ]
    };

    /** 行为追踪默认状态 */
    ns.DEFAULT_BEHAVIOR_STATE = {
        streakDays: 0,
        lastActiveDate: null,
        totalTasks: 0,
        totalCompleted: 0,
        totalPomodoros: 0,
        totalFocusMinutes: 0,
        totalNotes: 0,
        totalCaptures: 0,
        dailyStats: {},  // { "2026-06-22": { tasksCreated, tasksCompleted, ... } }
        config: {
            strictMode: false,     // 严厉鞭策模式
            strictLevel: 3,        // 严厉等级 1-5
            showStreak: true,      // 显示连续打卡
            showStats: true        // 显示统计数据
        }
    };

    /* ===== v2 默认配置（存储到 chrome.storage.local） ===== */
    ns.DEFAULT_V2_CONFIG = {
        aiApi: {
            activeProvider: 'hunyuan',     // 当前激活的供应商 ID
            providers: {                   // 各供应商配置（可动态扩展）
                hunyuan: {
                    apiKey: 'sk-KVgtp3GV6gMAvEV2dowFilqMCSc07jQUlc0pHx5I94XWZ',
                    endpoint: 'https://hunyuan.tencentcloudapi.com',
                    model: 'hunyuan-lite'
                },
                deepseek: {
                    apiKey: 'sk-u0W6YLj0vb9Bcc1jiPkAAT96FU185GqE7P9p2w3Djd48asDu',
                    endpoint: 'https://new-api.rugao.me/v1/chat/completions',
                    model: 'deepseek-v4-flash'
                }
            },
            autoSummaryEnabled: false,
            autoSummaryTime: '22:00'
        },
        focusShortcut: {
            ctrl: true,
            shift: false,
            alt: false,
            key: 'k'
        },
        pomodoro: {
            defaultDuration: 25,
            defaultRestDuration: 5,
            type: 'default'            // default | focus
        },
        behavior: {
            strictMode: false,
            strictLevel: 3,
            showStreak: true,
            showStats: true
        },
        fileSync: {
            enabled: false             // 文件自动同步默认关闭
        },
        customNoteTypes: []            // 用户自定义笔记类型 [{key, icon, label}]
    };

    /* ===== 默认磁贴缓存相关 ===== */
    ns.DEFAULTS_VERSION = 'devhome-1.0.0-categorized-defaults';
    ns.INLINE_DEFAULT_CATEGORY_NAMES = ["常用", "AI", "视频", "社交", "开发", "设计", "学习", "工具", "购物", "音乐", "资讯"];

})(window.DevHome);
