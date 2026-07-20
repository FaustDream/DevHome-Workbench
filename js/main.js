/**
 * DevHome Workbench - 启动入口
 * 初始化所有子系统并按依赖顺序启动。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

let state = ns.state;
let dom = ns.dom;
let storage = ns.storage;

    /* ===== 快捷方式尺寸/列数快捷绑定 ===== */
    ns.applyShortcutSize = function (size, save) {
let key = ns.normalizeShortcutSize(size);
let config = ns.SHORTCUT_SIZE_OPTIONS[key];
let root = document.documentElement;
        root.dataset.shortcutSize = key;
        root.style.setProperty('--shortcut-container', config.container);
        root.style.setProperty('--shortcut-icon', config.icon);
        root.style.setProperty('--shortcut-gap', config.gap);
        root.style.setProperty('--shortcut-radius', config.radius);
        root.style.setProperty('--shortcut-label-size', config.fontSize);
        root.style.setProperty('--shortcut-label-bottom', config.labelBottom);
        root.style.setProperty('--shortcut-add-icon', config.addIcon);
        if (save !== false) storage.set('shortcut_size', key);
        ns.updateShortcutSizeMenu(key);
    };

    ns.updateShortcutSizeMenu = function (size) {
let key = ns.normalizeShortcutSize(size || storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE));
let config = ns.SHORTCUT_SIZE_OPTIONS[key];
        if (dom.shortcutSizeText) dom.shortcutSizeText.textContent = '快捷方式：' + config.name;
        ns.$$('.shortcut-size-btn').forEach(function (btn) { btn.classList.toggle('active', btn.dataset.shortcutSize === key); });
    };

    ns.applyShortcutColumns = function (columns, save) {
let key = ns.normalizeShortcutColumns(columns);
        document.documentElement.style.setProperty('--shortcut-columns', key);
        if (save !== false) storage.set('shortcut_columns', key);
        ns.updateShortcutColumnsMenu(key);
    };

    ns.updateShortcutColumnsMenu = function (columns) {
let key = ns.normalizeShortcutColumns(columns !== undefined ? columns : storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS));
let config = ns.SHORTCUT_COLUMN_OPTIONS[key];
        if (dom.shortcutColumnsText) dom.shortcutColumnsText.textContent = '每排：' + config.label;
        ns.$$('.shortcut-columns-btn').forEach(function (btn) { btn.classList.toggle('active', btn.dataset.shortcutColumns === key); });
    };

    /* ===== F5 布局系统启动时应用 ===== */
    ns.applyLayoutConfig = function () {
let config;
        try {
let raw = localStorage.getItem('tabpage_layout_config');
            if (raw) {
                config = JSON.parse(raw);
                config = Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG, config, {
                    custom: Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG.custom, config.custom || {})
                });
            } else {
                config = Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG, {
                    custom: Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG.custom)
                });
            }
        } catch (e) {
            config = Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG, {
                custom: Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG.custom)
            });
        }

let root = document.documentElement;
        if (config.mode === 'preset') {
let preset = ns.LAYOUT_PRESETS[config.preset] || ns.LAYOUT_PRESETS['2x6'];
            root.style.setProperty('--shortcut-columns', preset.columns);
        } else {
let c = config.custom;
            root.style.setProperty('--shortcut-columns', c.columns);
            root.style.setProperty('--shortcut-gap', c.colGap + 'px');
            root.style.setProperty('--shortcut-row-gap', c.rowGap + 'px');
            root.style.setProperty('--shortcut-icon', c.iconSize + 'px');
        }
        console.log('[布局] 启动应用 模式=' + config.mode + ' 预设=' + config.preset);
    };

    /* ===== 时间更新 =====
       使用 setInterval 每秒刷新（而非 requestAnimationFrame）：
       rAF 在标签页隐藏时会暂停，导致时钟停走；且 60fps 轮询分钟级变化属于浪费。 */
    function updateTime() {
let now = new Date();
let minute = now.getMinutes();
let hour = now.getHours();
        if (minute !== state.lastMinute && dom.timeMain) {
            state.lastMinute = minute;
            dom.timeMain.textContent = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
        }
let dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
        if (dateStr !== state.lastDate && dom.dateDisplay) {
            state.lastDate = dateStr;
let weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            dom.dateDisplay.textContent = dateStr + ' ' + weekdays[now.getDay()];
        }
    }

    // 每秒刷新一次（仅在必要时更新 DOM）
    setInterval(updateTime, 1000);

    /* ===== 启动 ===== */
    ns.boot = async function () {
let perfBoot = performance.now();

        // === Phase 0: 主题初始化（0ms 开销） ===
        if (ns.theme && typeof ns.theme.init === 'function') {
            ns.theme.init();
        }

        // === Phase 1: 并行执行独立异步操作 ===
let migrationPromise = Promise.resolve();
let configPromise = Promise.resolve({ ready: false });
let v2DataPromise = Promise.resolve();

        if (ns.storageV2 && typeof ns.storageV2.migrateFromLegacy === 'function') {
            migrationPromise = ns.storageV2.migrateFromLegacy().catch(function (e) {
                console.warn('[StorageV2] 迁移异常，不影响正常使用:', e);
            });
        }

        if (ns.fileConfig && typeof ns.fileConfig.init === 'function') {
            configPromise = ns.fileConfig.init().then(function (status) {
                state.configReady = status.ready;
                if (ns.fileConfig.isSupported()) {
                    console.log('%c[FileConfig] %c配置目录' + (status.ready ? '已就绪' : '未设置') + '%c%s',
                        'color:#47f0a2;font-weight:bold', 'color:#b0b0b0',
                        status.dirName ? 'color:#47f0a2' : 'color:#ffcc66',
                        status.dirName ? ' [' + status.dirName + ']' : '');
                }
                return status;
            }).catch(function () { return { ready: false }; });
        }

        // 并行等待迁移和文件配置（两者无依赖关系）
        const [migrationResult, configStatus] = await Promise.all([migrationPromise, configPromise]);

        if (migrationResult && migrationResult.migrated) {
            console.log('%c[StorageV2] %c迁移完成：' + migrationResult.count + ' 条任务',
                'color:#47f0a2;font-weight:bold', 'color:#b0b0b0');
        }

        ns.logger && ns.logger.info('boot', '启动序列开始', { configReady: state.configReady });

        // 代理管理器初始化（异步，不阻塞启动）
        if (ns.proxyManager && typeof ns.proxyManager.init === 'function') {
            ns.proxyManager.init().catch(function (e) {
                console.warn('[Main] 代理管理器初始化失败:', e.message);
            });
            // 代理状态变更时自动更新设置面板
            ns.proxyManager.on('googleReachabilityChanged', function () {
                if (typeof ns._syncProxyControls === 'function') {
                    ns._syncProxyControls();
                }
            });
        }

        // === Phase 2: 立即渲染首屏 UI（不等数据加载完） ===
        ns.initEngine();
        ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
        ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
        ns.applyLayoutConfig();
        ns.openFaviconDB();

        // 磁贴数据加载与首屏渲染并行
let tilesLoadPromise = ns.tileManager.load();
        ns.loadSearchHistory();
        ns.renderTiles(); // 先用缓存数据渲染，后台加载新数据后再刷新
        updateTime();

        // === Phase 3: V2 数据并行加载 ===
        if (ns.notesManager) {
            // 并行加载笔记、捕获、笔记本、配置
            v2DataPromise = Promise.all([
                ns.notesManager.load().catch(function (e) { console.warn('[V2] 笔记加载失败:', e); }),
                ns.notesManager.loadCaptures().catch(function (e) { console.warn('[V2] 捕获加载失败:', e); }),
                ns.notesManager.loadNotebooks().catch(function (e) { console.warn('[V2] 笔记本加载失败:', e); }),
                ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG).then(function (v2Config) {
                    ns.state._lastNotebookId = v2Config.lastNotebookId || null;
                    ns.state._focusShortcut = v2Config.focusShortcut || ns.state._focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
                }).catch(function () {})
            ]);
        }

        await tilesLoadPromise;

        // 数据加载完成后，无条件重新渲染磁贴（修复首次进入和非分类记忆模式下的空白问题）
        ns.tileManager.updateCurrentTiles();
        ns.renderTiles();

        // === Phase 4: 同步 UI 状态 ===
let autoFocusOn = storage.get('auto_focus', false);
        if (dom.autoFocusText) dom.autoFocusText.textContent = autoFocusOn ? '自动聚焦：开' : '自动聚焦：关';
        if (autoFocusOn) setTimeout(function () { if (dom.searchInput) dom.searchInput.focus(); }, 150);

let categoryMemoryOn = storage.get('category_memory', false);
        if (dom.categoryMemoryText) dom.categoryMemoryText.textContent = categoryMemoryOn ? '分类记忆：开' : '分类记忆：关';
        if (categoryMemoryOn) {
let lastPage = storage.get('last_page', 0);
            if (lastPage >= 0 && lastPage < state.totalPages) {
                state.currentPage = lastPage;
                ns.tileManager.updateCurrentTiles();
                ns.renderTiles();
            }
        }

        ns.applyCategoryButtonMode(true, false);
        ns.syncSettingsControls();
        ns.bindEvents();

        // === Phase 5: 延迟加载非首屏模块（不阻塞启动） ===
        requestAnimationFrame(function () {
            // 问候区域（日期+问候+鼓励话语，不再使用卡片容器）
            if (ns.initDailyGreetingCard) ns.initDailyGreetingCard();
            // 天气模块（仅加载缓存数据，不发起网络请求，等用户手动刷新）
            if (ns.initWeather) ns.initWeather();
            // 番茄钟通知设置
            if (ns.syncTaskNotifySettings) ns.syncTaskNotifySettings();
            // React 通知系统
            if (typeof ns.initReactToast === 'function') ns.initReactToast();
        });

        // === Phase 6: 日志 & 收尾 ===
let loadTime = (performance.now() - ns.perfStart).toFixed(2);
        console.log('%c[TabPage] %cLoaded in ' + loadTime + 'ms (boot: ' + (performance.now() - perfBoot).toFixed(2) + 'ms)',
            'color:#4a9eff;font-weight:bold', 'color:#b0b0b0');

let overlay = document.getElementById('focusOverlay');
        if (overlay && document.body.classList.contains('focus-transition')) overlay.classList.add('ready');

        // 刷新恢复：仅在页面刷新时恢复专注模式，新标签页默认日常模式
let navEntry = performance.getEntriesByType('navigation')[0];
let isReload = navEntry && navEntry.type === 'reload';
let savedMode = localStorage.getItem('_devhome_last_mode');
        if (savedMode === 'workbench' && isReload) {
            localStorage.removeItem('_devhome_last_mode');
            setTimeout(function () { ns.enterFocusMode(); }, 100);
        } else {
            localStorage.removeItem('_devhome_last_mode');
        }

        // 监听页面关闭/刷新，保存当前模式
        window.addEventListener('beforeunload', function () {
            if (state.currentDevhomeMode !== 'daily') {
                localStorage.setItem('_devhome_last_mode', state.currentDevhomeMode);
            }
        });
    };

    /* ===== 自动聚焦："狸猫换太子"法 ===== */
    try {
let raw = localStorage.getItem('tabpage_auto_focus');
let autoFocusEnabled = raw !== null ? JSON.parse(raw) : false;
        if (autoFocusEnabled && !window.location.search.includes('focus')) {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: 'index.html?focus' });
                window.close();
            }
        }
    } catch (e) { }

    if (window.location.search.includes('focus')) document.body.classList.add('focus-transition');

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ns.boot);
    else ns.boot();

})(window.DevHome);
