/**
 * DevHome Workbench - 启动入口
 * 初始化所有子系统并按依赖顺序启动。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var storage = ns.storage;

    /* ===== 快捷方式尺寸/列数快捷绑定 ===== */
    ns.applyShortcutSize = function (size, save) {
        var key = ns.normalizeShortcutSize(size);
        var config = ns.SHORTCUT_SIZE_OPTIONS[key];
        var root = document.documentElement;
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
        var key = ns.normalizeShortcutSize(size || storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE));
        var config = ns.SHORTCUT_SIZE_OPTIONS[key];
        if (dom.shortcutSizeText) dom.shortcutSizeText.textContent = '快捷方式：' + config.name;
        ns.$$('.shortcut-size-btn').forEach(function (btn) { btn.classList.toggle('active', btn.dataset.shortcutSize === key); });
    };

    ns.applyShortcutColumns = function (columns, save) {
        var key = ns.normalizeShortcutColumns(columns);
        document.documentElement.style.setProperty('--shortcut-columns', key);
        if (save !== false) storage.set('shortcut_columns', key);
        ns.updateShortcutColumnsMenu(key);
    };

    ns.updateShortcutColumnsMenu = function (columns) {
        var key = ns.normalizeShortcutColumns(columns !== undefined ? columns : storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS));
        var config = ns.SHORTCUT_COLUMN_OPTIONS[key];
        if (dom.shortcutColumnsText) dom.shortcutColumnsText.textContent = '每排：' + config.label;
        ns.$$('.shortcut-columns-btn').forEach(function (btn) { btn.classList.toggle('active', btn.dataset.shortcutColumns === key); });
    };

    /* ===== 时间更新 =====
       使用 setInterval 每秒刷新（而非 requestAnimationFrame）：
       rAF 在标签页隐藏时会暂停，导致时钟停走；且 60fps 轮询分钟级变化属于浪费。 */
    function updateTime() {
        var now = new Date();
        var minute = now.getMinutes();
        var hour = now.getHours();
        if (minute !== state.lastMinute && dom.timeMain) {
            state.lastMinute = minute;
            dom.timeMain.textContent = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
        }
        var dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
        if (dateStr !== state.lastDate && dom.dateDisplay) {
            state.lastDate = dateStr;
            var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            dom.dateDisplay.textContent = dateStr + ' ' + weekdays[now.getDay()];
        }
    }

    // 每秒刷新一次（仅在必要时更新 DOM）
    setInterval(updateTime, 1000);

    /* ===== 启动 ===== */
    ns.boot = async function () {
        // 优先应用主题：必须放在最前，确保即使后续步骤（文件配置未就绪、数据加载异常等）
        // 提前 return 或抛错，用户的浅色/深色主题也能正确生效，避免回退到 :root 深色默认值。
        if (ns.theme && typeof ns.theme.init === 'function') {
            ns.theme.init();
        }

        // [v2.0.0] 数据迁移：localStorage → chrome.storage.local
        if (ns.storageV2 && typeof ns.storageV2.migrateFromLegacy === 'function') {
            try {
                var migrationResult = await ns.storageV2.migrateFromLegacy();
                if (migrationResult.migrated) {
                    console.log('%c[StorageV2] %c迁移完成：' + migrationResult.count + ' 条任务',
                        'color:#47f0a2;font-weight:bold', 'color:#b0b0b0');
                }
            } catch (e) {
                console.warn('[StorageV2] 迁移异常，不影响正常使用:', e);
            }
        }

        // [v1.3.0] 优先初始化文件配置系统
        var configStatus;
        if (ns.fileConfig && typeof ns.fileConfig.init === 'function') {
            configStatus = await ns.fileConfig.init();
            state.configReady = configStatus.ready;
            if (ns.fileConfig.isSupported()) {
                console.log('%c[FileConfig] %c配置目录' + (configStatus.ready ? '已就绪' : '未设置') + '%c%s',
                    'color:#47f0a2;font-weight:bold',
                    'color:#b0b0b0',
                    configStatus.dirName ? 'color:#47f0a2' : 'color:#ffcc66',
                    configStatus.dirName ? ' [' + configStatus.dirName + ']' : '');
            }
        }

        // 首次使用且未选目录 → 仍正常加载界面，警告条会提示用户选目录
        // [v2.0.0] 加载 v2 数据（笔记、捕获）+ 快捷键配置
        if (ns.notesManager) {
            try { await ns.notesManager.load(); } catch (e) { console.warn('[V2] 笔记加载失败:', e); }
            try { await ns.notesManager.loadCaptures(); } catch (e) { console.warn('[V2] 捕获加载失败:', e); }
        }
        // 加载专注模式快捷键
        if (ns.storageV2) {
            try {
                var v2Config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                ns.state._focusShortcut = v2Config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
            } catch (e) { }
        }

        ns.initEngine();
        ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
        ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
        ns.openFaviconDB();
        await ns.tileManager.load();
        ns.loadSearchHistory();
        ns.renderTiles();
        if (ns.initWeather) ns.initWeather();
        // 左上角每日问候卡片
        if (ns.initDailyGreetingCard) ns.initDailyGreetingCard();

        var autoFocusOn = storage.get('auto_focus', false);
        if (dom.autoFocusText) dom.autoFocusText.textContent = autoFocusOn ? '自动聚焦：开' : '自动聚焦：关';
        if (autoFocusOn) setTimeout(function () { if (dom.searchInput) dom.searchInput.focus(); }, 150);

        var categoryMemoryOn = storage.get('category_memory', false);
        if (dom.categoryMemoryText) dom.categoryMemoryText.textContent = categoryMemoryOn ? '分类记忆：开' : '分类记忆：关';
        if (categoryMemoryOn) {
            var lastPage = storage.get('last_page', 0);
            if (lastPage >= 0 && lastPage < state.totalPages) {
                state.currentPage = lastPage;
                ns.tileManager.updateCurrentTiles();
                ns.renderTiles();
                }
        }

        ns.applyCategoryButtonMode(true, false);
        ns.syncSettingsControls();
        ns.bindEvents();
        updateTime();

        var loadTime = (performance.now() - ns.perfStart).toFixed(2);
        console.log('%c[TabPage] %cLoaded in ' + loadTime + 'ms', 'color:#4a9eff;font-weight:bold', 'color:#b0b0b0');

        var overlay = document.getElementById('focusOverlay');
        if (overlay && document.body.classList.contains('focus-transition')) overlay.classList.add('ready');

        // 刷新恢复：仅在页面刷新时恢复专注模式，新标签页默认日常模式
        var navEntry = performance.getEntriesByType('navigation')[0];
        var isReload = navEntry && navEntry.type === 'reload';
        var savedMode = localStorage.getItem('_devhome_last_mode');
        if (savedMode === 'workbench' && isReload) {
            localStorage.removeItem('_devhome_last_mode');
            setTimeout(function () { ns.enterFocusMode(); }, 100);
        } else {
            localStorage.removeItem('_devhome_last_mode');
        }

        // 监听页面关闭/刷新，保存当前模式（覆盖 F5 和浏览器刷新按钮）
        window.addEventListener('beforeunload', function () {
            if (state.currentDevhomeMode !== 'daily') {
                localStorage.setItem('_devhome_last_mode', state.currentDevhomeMode);
            }
        });
    };

    /* ===== 自动聚焦："狸猫换太子"法 ===== */
    try {
        var raw = localStorage.getItem('tabpage_auto_focus');
        var autoFocusEnabled = raw !== null ? JSON.parse(raw) : false;
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
