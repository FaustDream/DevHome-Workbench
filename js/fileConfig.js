/**
 * DevHome Workbench - 文件系统配置管理
 *
 * 核心职责：
 *   1. 通过 File System Access API 管理配置目录，按数据类别分目录存储
 *   2. Handle 持久化到 IndexedDB，支持跨会话恢复
 *   3. localStorage ↔ 文件双向同步（启动读盘、变更防抖写盘）
 *   4. 权限失效检测、警告条控制、扩展图标角标管理
 *
 * 目录结构：
 *   config_dir/
 *   ├── manifest.json          # 版本标识（用于检测旧格式）
 *   ├── notes/
 *   │   └── data.json          # 笔记列表
 *   ├── captures/
 *   │   └── data.json          # 快速捕获列表
 *   ├── tasks/
 *   │   └── data.json          # 四象限任务
 *   ├── tiles/
 *   │   └── data.json          # 磁贴、分类、设置
 *   ├── pomodoro/
 *   │   └── data.json          # 番茄钟记录
 *   ├── behavior/
 *   │   └── data.json          # 行为追踪数据
 *   └── config/
 *       └── app.json           # 应用配置（AI、快捷键、自定义标签等）
 *
 * 设计决策：
 *   - File System Access API（showDirectoryPicker），零外部依赖
 *   - 按数据类别分目录，便于浏览和手动备份恢复
 *   - localStorage 保留作运行时缓存，3 秒防抖双写到文件
 *   - IndexedDB 存 DirectoryHandle，失效时黄色警告条提醒
 *   - 兼容旧版单文件 devhome-config.json 格式并自动迁移
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 常量 ===== */
    var INDEXEDDB_NAME = 'DevHomeFileConfig';
    var INDEXEDDB_STORE = 'handles';
    var HANDLE_KEY = 'directoryHandle';
    var WRITE_DEBOUNCE_MS = 1000;  // 1 秒防抖

    /**
     * 数据类别 → 子目录 + 文件名 映射
     * 笔记为独立文件（每个笔记一个 JSON），其他类别为单文件
     */
    var DATA_LAYOUT = {
        notes:      { dir: 'notes',    desc: '笔记',     individual: true },
        captures:   { dir: 'captures', desc: '快速捕获',  file: 'captures.json' },
        tasks:      { dir: 'tasks',    desc: '四象限任务', file: 'tasks.json' },
        tiles:      { dir: 'tiles',    desc: '磁贴与分类', file: 'tiles.json' },
        pomodoro:   { dir: 'pomodoro', desc: '番茄钟记录', file: 'pomodoro.json' },
        behavior:   { dir: 'behavior', desc: '行为追踪',  file: 'behavior.json' },
        config:     { dir: 'config',   desc: '应用配置',  file: 'app.json' }
    };

    /** localStorage 缓存键前缀（用于收集数据） */
    var CACHE_PREFIX = 'devhome_v2_cache_';

    /* ===== 内部状态 ===== */
    var dirHandle = null;        // FileSystemDirectoryHandle
    var isReady = false;         // 配置目录是否已就绪
    var dirtyCategories = {};    // { category: true } — 按类别追踪脏数据，避免全量写入
    var writeTimer = null;       // 防抖计时器
    var syncInProgress = false;  // 是否正在写入
    var lastSyncTime = 0;        // 上次同步时间戳
    var lastSyncError = null;    // 上次同步错误信息
    var dirHandleDB = null;      // IndexedDB 连接
    var writePermissionPending = false; // write 权限是否待授权

    /* ===== 浏览器兼容性检测 ===== */
    function isFileSystemAPISupported() {
        return typeof window.showDirectoryPicker === 'function';
    }

    /* ===== IndexedDB Handle 持久化 ===== */

    function openHandlesDB() {
        if (dirHandleDB) return Promise.resolve(dirHandleDB);
        return new Promise(function (resolve, reject) {
            var request = indexedDB.open(INDEXEDDB_NAME, 1);
            request.onerror = function () { reject(request.error); };
            request.onsuccess = function () { dirHandleDB = request.result; resolve(dirHandleDB); };
            request.onupgradeneeded = function () {
                var db = request.result;
                if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
                    db.createObjectStore(INDEXEDDB_STORE);
                }
            };
        });
    }

    function saveHandleToDB(handle) {
        console.log('[FileConfig] IndexedDB 保存 handle:', handle.name);
        return openHandlesDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(INDEXEDDB_STORE, 'readwrite');
                var store = tx.objectStore(INDEXEDDB_STORE);
                store.put(handle, HANDLE_KEY);
                tx.oncomplete = function () {
                    console.log('[FileConfig] IndexedDB 保存成功:', handle.name);
                    resolve();
                };
                tx.onerror = function () {
                    console.error('[FileConfig] IndexedDB 保存失败:', tx.error);
                    reject(tx.error);
                };
            });
        });
    }

    function loadHandleFromDB() {
        return openHandlesDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(INDEXEDDB_STORE, 'readonly');
                var store = tx.objectStore(INDEXEDDB_STORE);
                var request = store.get(HANDLE_KEY);
                request.onsuccess = function () {
                    var result = request.result || null;
                    console.log('[FileConfig] IndexedDB 读取 handle:', result ? (result.name || '存在') : 'null');
                    resolve(result);
                };
                request.onerror = function () {
                    console.error('[FileConfig] IndexedDB 读取 handle 失败:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function clearHandleFromDB() {
        return openHandlesDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(INDEXEDDB_STORE, 'readwrite');
                var store = tx.objectStore(INDEXEDDB_STORE);
                store.delete(HANDLE_KEY);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    /* ===== 权限检测 ===== */

    /** 静默查询权限（仅 query，不弹窗） */
    async function verifyPermissionQuiet(handle, withWrite) {
        var opts = { mode: withWrite ? 'readwrite' : 'read' };
        try {
            return (await handle.queryPermission(opts)) === 'granted';
        } catch (_) {
            return false;
        }
    }

    /** 带弹窗的权限检测（需要用户手势） */
    async function verifyPermission(handle, withWrite) {
        var opts = { mode: withWrite ? 'readwrite' : 'read' };
        try {
            if (await handle.queryPermission(opts) === 'granted') return true;
            if (await handle.requestPermission(opts) === 'granted') return true;
            return false;
        } catch (_) {
            return false;
        }
    }

    /* ===== 分类文件读写 ===== */

    /** 从子目录读取一个类别的数据（支持独立文件和单文件两种模式） */
    async function readCategoryFile(category) {
        if (!dirHandle) return null;
        var layout = DATA_LAYOUT[category];
        if (!layout) return null;
        // 笔记：独立文件模式
        if (layout.individual) return readIndividualNotes();
        // 其他：单文件模式
        try {
            var subDir = await dirHandle.getDirectoryHandle(layout.dir, { create: false });
            var fileHandle = await subDir.getFileHandle(layout.file, { create: false });
            var file = await fileHandle.getFile();
            return JSON.parse(await file.text());
        } catch (e) {
            if (e.name === 'NotFoundError') return null;
            throw e;
        }
    }

    /** 将数据写入子目录（支持独立文件和单文件两种模式） */
    async function writeCategoryFile(category, data) {
        if (!dirHandle) throw new Error('目录未授权');
        var layout = DATA_LAYOUT[category];
        if (!layout) throw new Error('未知数据类别: ' + category);
        // 笔记：独立文件模式
        if (layout.individual) return writeIndividualNotes(data);
        // 其他：单文件模式
        var subDir = await dirHandle.getDirectoryHandle(layout.dir, { create: true });
        var fileHandle = await subDir.getFileHandle(layout.file, { create: true });
        var writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    }

    /* ===== 笔记独立文件读写 ===== */

    /** 读取笔记目录下所有独立 JSON 文件 */
    async function readIndividualNotes() {
        if (!dirHandle) return null;
        try {
            var notesDir = await dirHandle.getDirectoryHandle('notes', { create: false });
            var notes = [];
            for await (var entry of notesDir.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                    try {
                        var file = await entry.getFile();
                        var data = JSON.parse(await file.text());
                        // 兼容：如果内容是数组则是旧 data.json 格式，展开所有笔记
                        if (Array.isArray(data)) {
                            data.forEach(function (n) { if (n && n.id) notes.push(n); });
                        } else if (data && data.id) {
                            notes.push(data);
                        }
                    } catch (_) { /* 跳过损坏文件 */ }
                }
            }
            return notes.length > 0 ? notes : null;
        } catch (e) {
            if (e.name === 'NotFoundError') return null;
            console.warn('[FileConfig] 读取独立笔记失败:', e);
            return null;
        }
    }

    /** 将笔记数组写入独立 JSON 文件（并清理旧 data.json） */
    async function writeIndividualNotes(notes) {
        if (!dirHandle || !Array.isArray(notes)) return;
        var notesDir = await dirHandle.getDirectoryHandle('notes', { create: true });
        // 收集已存在的文件名
        var existingNames = new Set();
        for await (var e of notesDir.values()) {
            if (e.kind === 'file' && e.name.endsWith('.json')) {
                existingNames.add(e.name);
            }
        }
        // 写入每个笔记
        var writtenNames = new Set();
        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            var fileName = (note.id || ('note_' + i)) + '.json';
            writtenNames.add(fileName);
            var fileHandle = await notesDir.getFileHandle(fileName, { create: true });
            var writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(note, null, 2));
            await writable.close();
        }
        // 删除不再需要的文件（包括旧 data.json）
        existingNames.forEach(function (name) {
            if (!writtenNames.has(name)) {
                try { notesDir.removeEntry(name); } catch (_) {}
            }
        });
    }

    /* ===== 数据收集与恢复 ===== */

    /**
     * 收集所有需要持久化的数据，按类别组织
     * @returns {object} { notes, captures, tasks, tiles, pomodoro, behavior, config }
     */
    var collectAllData = ns.fileConfig_collectAllData = function () {
        var result = {};

        // 笔记数据
        try {
            var notesRaw = localStorage.getItem(CACHE_PREFIX + 'notes');
            result.notes = notesRaw ? JSON.parse(notesRaw) : [];
        } catch (_) { result.notes = []; }

        // 快速捕获数据
        try {
            var capturesRaw = localStorage.getItem(CACHE_PREFIX + 'captures');
            result.captures = capturesRaw ? JSON.parse(capturesRaw) : [];
        } catch (_) { result.captures = []; }

        // 四象限任务（优先 v2/tasks，回退 devhome_workbench）
        try {
            var tasksRaw = localStorage.getItem(CACHE_PREFIX + 'tasks');
            if (tasksRaw) {
                result.tasks = JSON.parse(tasksRaw);
            } else {
                var wbRaw = localStorage.getItem('devhome_workbench');
                var wbData = wbRaw ? JSON.parse(wbRaw) : null;
                // 从旧格式提取任务
                var tasks = [];
                if (wbData && wbData.quadrants) {
                    ['q1', 'q2', 'q3', 'q4'].forEach(function (q) {
                        var qt = wbData.quadrants[q];
                        if (qt && qt.tasks) {
                            qt.tasks.forEach(function (t) {
                                tasks.push({
                                    id: t.id || ('task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
                                    title: t.title || '',
                                    description: t.description || '',
                                    quadrant: q,
                                    status: t.status || (t.completed ? 'completed' : 'active'),
                                    noteId: null,
                                    pomodoroCount: 0,
                                    createdAt: t.createdAt || Date.now(),
                                    completedAt: t.completedAt || (t.completed ? Date.now() : null),
                                    cancelledAt: t.cancelledAt || null
                                });
                            });
                        }
                    });
                }
                result.tasks = tasks;
            }
        } catch (_) { result.tasks = []; }

        // 磁贴与分类 + 设置（合并为 tiles 类别）
        result.tiles = {};
        try {
            var pagesRaw = localStorage.getItem('tabpage_pages');
            result.tiles.pages = pagesRaw ? JSON.parse(pagesRaw) : [];
        } catch (_) { result.tiles.pages = []; }
        try {
            var pageNamesRaw = localStorage.getItem('tabpage_page_names');
            result.tiles.pageNames = pageNamesRaw ? JSON.parse(pageNamesRaw) : [];
        } catch (_) { result.tiles.pageNames = []; }
        result.tiles.settings = {};
        [
            'shortcut_size', 'shortcut_columns', 'auto_focus', 'category_memory',
            'last_page', 'engine', 'bg', 'char_size', 'flow_speed',
            'char_density'
        ].forEach(function (key) {
            try {
                var val = localStorage.getItem('tabpage_' + key);
                if (val !== null) result.tiles.settings[key] = JSON.parse(val);
            } catch (_) { /* 跳过 */ }
        });
        try {
            var popupRaw = localStorage.getItem('devhome_ext_settings');
            result.tiles.popupSettings = popupRaw ? JSON.parse(popupRaw) : null;
        } catch (_) { result.tiles.popupSettings = null; }

        // 番茄钟记录
        try {
            var pomoRaw = localStorage.getItem(CACHE_PREFIX + 'pomodoro_sessions');
            result.pomodoro = pomoRaw ? JSON.parse(pomoRaw) : [];
        } catch (_) { result.pomodoro = []; }

        // 行为追踪数据
        try {
            var behaviorRaw = localStorage.getItem(CACHE_PREFIX + 'behavior');
            result.behavior = behaviorRaw ? JSON.parse(behaviorRaw) : null;
        } catch (_) { result.behavior = null; }

        // 应用配置（AI、快捷键、自定义标签等）
        try {
            var configRaw = localStorage.getItem(CACHE_PREFIX + 'config');
            result.config = configRaw ? JSON.parse(configRaw) : null;
        } catch (_) { result.config = null; }

        return result;
    };

    /**
     * 将分类数据恢复到 localStorage 和 chrome.storage.local
     * @param {object} configData - collectAllData 的返回值
     */
    var restoreAllData = ns.fileConfig_restoreAllData = async function (configData) {
        if (!configData) return;

        // 磁贴与设置
        if (configData.tiles) {
            var t = configData.tiles;
            if (Array.isArray(t.pages)) localStorage.setItem('tabpage_pages', JSON.stringify(t.pages));
            if (Array.isArray(t.pageNames)) localStorage.setItem('tabpage_page_names', JSON.stringify(t.pageNames));
            if (t.settings) {
                Object.keys(t.settings).forEach(function (key) {
                    localStorage.setItem('tabpage_' + key, JSON.stringify(t.settings[key]));
                });
            }
            if (t.popupSettings) localStorage.setItem('devhome_ext_settings', JSON.stringify(t.popupSettings));
        }

        // 笔记 → chrome.storage.local
        if (Array.isArray(configData.notes)) {
            try {
                await ns.storageV2.set(ns.storageV2.KEYS.NOTES, configData.notes);
                console.log('[FileConfig] 恢复了 ' + configData.notes.length + ' 条笔记');
            } catch (e) {
                try { localStorage.setItem(CACHE_PREFIX + 'notes', JSON.stringify(configData.notes)); } catch (_) {}
                console.warn('[FileConfig] 笔记恢复失败，已降级到缓存:', e);
            }
        }

        // 捕获 → chrome.storage.local
        if (Array.isArray(configData.captures)) {
            try {
                await ns.storageV2.set(ns.storageV2.KEYS.CAPTURES, configData.captures);
                console.log('[FileConfig] 恢复了 ' + configData.captures.length + ' 条捕获');
            } catch (e) {
                try { localStorage.setItem(CACHE_PREFIX + 'captures', JSON.stringify(configData.captures)); } catch (_) {}
                console.warn('[FileConfig] 捕获恢复失败，已降级到缓存:', e);
            }
        }

        // 任务 → chrome.storage.local
        if (Array.isArray(configData.tasks)) {
            try {
                await ns.storageV2.set(ns.storageV2.KEYS.TASKS, configData.tasks);
                console.log('[FileConfig] 恢复了 ' + configData.tasks.length + ' 条任务');
            } catch (e) {
                try { localStorage.setItem(CACHE_PREFIX + 'tasks', JSON.stringify(configData.tasks)); } catch (_) {}
                console.warn('[FileConfig] 任务恢复失败，已降级到缓存:', e);
            }
        }

        // 番茄钟 → chrome.storage.local
        if (Array.isArray(configData.pomodoro)) {
            try {
                await ns.storageV2.set(ns.storageV2.KEYS.POMODORO_SESSIONS, configData.pomodoro);
                console.log('[FileConfig] 恢复了 ' + configData.pomodoro.length + ' 条番茄钟记录');
            } catch (e) {
                try { localStorage.setItem(CACHE_PREFIX + 'pomodoro_sessions', JSON.stringify(configData.pomodoro)); } catch (_) {}
            }
        }

        // 行为追踪 → chrome.storage.local
        if (configData.behavior) {
            try {
                await ns.storageV2.set(ns.storageV2.KEYS.BEHAVIOR, configData.behavior);
                console.log('[FileConfig] 恢复了行为追踪数据');
            } catch (e) {
                try { localStorage.setItem(CACHE_PREFIX + 'behavior', JSON.stringify(configData.behavior)); } catch (_) {}
            }
        }

        // 应用配置（包含自定义标签分类等）→ chrome.storage.local
        if (configData.config) {
            try {
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, configData.config);
                var customTypes = configData.config.customNoteTypes;
                if (Array.isArray(customTypes) && customTypes.length > 0) {
                    console.log('[FileConfig] 恢复了应用配置（含 ' + customTypes.length + ' 个自定义标签）');
                } else {
                    console.log('[FileConfig] 恢复了应用配置');
                }
            } catch (e) {
                try { localStorage.setItem(CACHE_PREFIX + 'config', JSON.stringify(configData.config)); } catch (_) {}
                console.warn('[FileConfig] 配置恢复失败，已降级到缓存:', e);
            }
        }
    };

    /* ===== 是否有本地缓存数据 ===== */
    function hasLocalData() {
        return localStorage.getItem('tabpage_pages') !== null ||
               localStorage.getItem(CACHE_PREFIX + 'notes') !== null ||
               localStorage.getItem(CACHE_PREFIX + 'tasks') !== null;
    }

    /** 检查目录数据是否非空 */
    function hasAnyCategoryData(data) {
        if (!data) return false;
        return Object.keys(data).some(function (k) {
            var v = data[k];
            if (Array.isArray(v)) return v.length > 0;
            if (v && typeof v === 'object' && k === 'tiles') return (v.pages || []).length > 0;
            return v !== null && v !== undefined;
        });
    }

    /* ===== 分类文件写入（全量） ===== */

    /** 将所有类别数据写入对应子目录文件 */
    async function writeAllCategoryFiles() {
        var data = collectAllData();
        var categories = Object.keys(DATA_LAYOUT);

        for (var i = 0; i < categories.length; i++) {
            var cat = categories[i];
            if (data[cat] !== undefined) {
                try {
                    await writeCategoryFile(cat, data[cat]);
                } catch (e) {
                    console.warn('[FileConfig] 写入 ' + DATA_LAYOUT[cat].desc + ' 失败:', e.name, e.message);
                }
            }
        }

        lastSyncTime = Date.now();
        lastSyncError = null;
    }

    /** 从子目录读取所有类别数据 */
    async function readAllCategoryFiles() {
        var data = {};
        var categories = Object.keys(DATA_LAYOUT);
        var hasAny = false;

        for (var i = 0; i < categories.length; i++) {
            var cat = categories[i];
            try {
                var catData = await readCategoryFile(cat);
                if (catData !== null) {
                    data[cat] = catData;
                    hasAny = true;
                }
            } catch (e) {
                console.warn('[FileConfig] 读取 ' + DATA_LAYOUT[cat].desc + ' 失败:', e);
            }
        }

        return hasAny ? data : null;
    }

    /* ===== 警告条 ===== */

    function showWarningBar(message, isError) {
        var bar = document.getElementById('configWarningBar');
        var text = document.getElementById('configWarningText');
        var btn = document.getElementById('configSelectDirBtn');
        if (!bar || !text) return;
        text.textContent = message || '请选择配置目录以持久化数据';
        bar.className = 'config-warning-bar' + (isError ? ' config-warning-bar--error' : '');
        bar.style.display = 'flex';
        if (btn) {
            btn.style.display = isFileSystemAPISupported() ? '' : 'none';
        }
    }

    function hideWarningBar() {
        var bar = document.getElementById('configWarningBar');
        if (bar) {
            bar.style.opacity = '0';
            setTimeout(function () { bar.style.display = 'none'; }, 300);
        }
    }

    function updateBadge(text, color) {
        try {
            if (typeof chrome !== 'undefined' && chrome.action) {
                chrome.action.setBadgeText({ text: text || '' });
                if (color) chrome.action.setBadgeBackgroundColor({ color: color });
            }
        } catch (_) { /* 不破坏新标签页逻辑 */ }
    }

    /* ===== 同步逻辑 ===== */

    /**
     * 标记数据脏，触发防抖写盘
     * @param {string} [category] - 可选，指定变更的数据类别；不传则标记全部类别
     */
    function markDirty(category) {
        // 即使目录未就绪也追踪脏数据，选目录后立即同步
        if (category) {
            dirtyCategories[category] = true;
        } else {
            // 无参数 → 标记全部类别（兼容 storage.js 旧调用）
            Object.keys(DATA_LAYOUT).forEach(function (k) { dirtyCategories[k] = true; });
        }
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(function () { syncToFile(false); }, WRITE_DEBOUNCE_MS);
    }

    /** 恢复目录权限（需要用户手势，使用 readwrite 匹配原始授权模式） */
    async function tryRecoverReadPermission() {
        if (!dirHandle) return false;
        try {
            // 必须用 readwrite 模式 — 原始 showDirectoryPicker 授予的就是 readwrite
            var opts = { mode: 'readwrite' };
            if ((await dirHandle.queryPermission(opts)) === 'granted') {
                writePermissionPending = false;
                hideWarningBar();
                updateBadge('', '#e74c3c');
                return true;
            }
            if ((await dirHandle.requestPermission(opts)) === 'granted') {
                writePermissionPending = false;
                hideWarningBar();
                updateBadge('', '#e74c3c');
                return true;
            }
            return false;
        } catch (_) { return false; }
    }

    async function tryRecoverWritePermission() {
        if (!dirHandle) return false; // 无 handle → 无法恢复，需重新选择目录
        if (!writePermissionPending) return true;
        try {
            var opts = { mode: 'readwrite' };
            if (await dirHandle.queryPermission(opts) === 'granted') {
                writePermissionPending = false;
                hideWarningBar();
                updateBadge('', '#e74c3c');
                return true;
            }
            if (await dirHandle.requestPermission(opts) === 'granted') {
                writePermissionPending = false;
                hideWarningBar();
                updateBadge('', '#e74c3c');
                return true;
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    /** 仅写入标记为脏的类别（force=true 时写全部） */
    async function syncToFile(force) {
        if (!isReady || syncInProgress) return;
        if (!dirHandle) return;

        // 确定需要写入的类别
        var categories;
        if (force) {
            // 强制全部写入
            categories = Object.keys(DATA_LAYOUT);
        } else {
            categories = Object.keys(dirtyCategories);
            if (categories.length === 0) return; // 没有脏数据
        }

        if (writePermissionPending) {
            try {
                var recovered = await tryRecoverWritePermission();
                if (!recovered) {
                    console.warn('[FileConfig] 写入跳过：write 权限待用户授权');
                    return;
                }
            } catch (_) { return; }
        }

        syncInProgress = true;
        try {
            var data = collectAllData();
            // 仅写入脏类别（或 force 时写全部）
            for (var i = 0; i < categories.length; i++) {
                var cat = categories[i];
                if (data[cat] !== undefined) {
                    try {
                        await writeCategoryFile(cat, data[cat]);
                    } catch (e) {
                        console.warn('[FileConfig] 写入 ' + DATA_LAYOUT[cat].desc + ' 失败:', e.name, e.message);
                    }
                }
            }
            dirtyCategories = {};   // 清空脏标记
            lastSyncTime = Date.now();
            lastSyncError = null;
        } catch (e) {
            lastSyncError = e.message || '写入失败';
            console.error('[FileConfig] 同步文件失败:', e);
        } finally {
            syncInProgress = false;
        }
    }

    /**
     * 页面关闭/刷新时尝试强制刷盘
     * 清除防抖定时器，fire-and-forget 异步写入（不阻塞页面关闭）。
     * 即便写入未完成，localStorage 数据仍在，下次启动可恢复。
     */
    function _onBeforeUnload() {
        if (writeTimer) {
            clearTimeout(writeTimer);
            writeTimer = null;
        }
        // 标记全部类别为脏，确保写入完整
        Object.keys(DATA_LAYOUT).forEach(function (k) { dirtyCategories[k] = true; });
        syncToFile(true); // fire-and-forget，不 await
    }

    // 注册 beforeunload 监听（仅一次）
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', _onBeforeUnload);
    }

    /* ===== chrome.storage 变更自动同步 ===== */
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function (changes, areaName) {
            if (areaName !== 'local') return;
            if (!dirHandle || !isReady) return;

            // 将 chrome.storage key 映射到 DATA_LAYOUT 类别
            var KEY_TO_CATEGORY = {
                'v2/notes': 'notes',
                'v2/captures': 'captures',
                'v2/tasks': 'tasks',
                'v2/pomodoro_sessions': 'pomodoro',
                'v2/behavior': 'behavior',
                'v2/config': 'config'
            };

            Object.keys(changes).forEach(function (key) {
                var cat = KEY_TO_CATEGORY[key];
                if (cat) {
                    dirtyCategories[cat] = true;
                }
            });

            // 有脏数据 → 触发防抖写盘
            if (Object.keys(dirtyCategories).length > 0 && !syncInProgress) {
                if (writeTimer) clearTimeout(writeTimer);
                writeTimer = setTimeout(function () { syncToFile(false); }, WRITE_DEBOUNCE_MS);
            }
        });
    }

    /* ===== 启动入口 ===== */

    async function init() {
        if (!isFileSystemAPISupported()) {
            console.warn('[FileConfig] 浏览器不支持 File System Access API');
            isReady = true;
            hideWarningBar();
            return { ready: true, dirName: '', unsupported: true };
        }

        try {
            var handle = await loadHandleFromDB();
            if (handle) {
                console.log('[FileConfig] 从 IndexedDB 恢复 handle:', handle.name);
                dirHandle = handle;
                isReady = true;

                // 静默尝试恢复权限，不阻塞启动
                var readPermitted = await verifyPermissionQuiet(handle, false);
                console.log('[FileConfig] 权限静默查询:', readPermitted ? 'granted' : 'prompt');

                if (readPermitted) {
                    writePermissionPending = !(await verifyPermissionQuiet(handle, true));
                    // 权限可用 → 后台静默从文件读数据覆盖
                    var categoryData = await readAllCategoryFiles();
                    if (categoryData && hasAnyCategoryData(categoryData)) {
                        await restoreAllData(categoryData);
                        console.log('[FileConfig] 已从文件恢复数据');
                    } else if (!writePermissionPending && hasLocalData()) {
                        // 文件为空但有本地数据 → 写入
                        writeAllCategoryFiles().catch(function () {});
                    }
                    updateBadge('', writePermissionPending ? '#ffcc66' : '#e74c3c');
                } else {
                    // 权限暂不可用 → 使用本地存储，不弹警告条
                    updateBadge('·', '#ffcc66');
                    console.log('[FileConfig] handle 已在，权限暂不可用（浏览器重启正常现象），使用本地存储');
                }
                hideWarningBar();
                return { ready: true, dirName: handle.name };
            }

            // IndexedDB 无 handle → 正常使用本地存储
            isReady = true;
            hideWarningBar();
            if (!hasLocalData()) {
                // 真正首次使用 → 静默，不弹窗
                updateBadge('', '#e74c3c');
                return { ready: true, dirName: '', firstRun: true };
            }
            updateBadge('', '#e74c3c');
            return { ready: true, dirName: '', localStorageOnly: true };

        } catch (e) {
            console.error('[FileConfig] 初始化失败:', e);
            isReady = true;
            return { ready: true, dirName: '', error: e.message };
        }
    }

    /** 用户点击"选择目录"按钮的处理 */
    async function handleUserPickDir() {
        if (!isFileSystemAPISupported()) {
            ns.showToast('当前浏览器不支持此功能，请使用 Chrome 或 Edge。', 'error');
            return false;
        }
        try {
            var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            dirHandle = handle;
            console.log('[FileConfig] 用户选择了目录:', handle.name);

            // 直接读取分类目录数据，不再依赖 manifest
            var categoryData = await readAllCategoryFiles();
            if (categoryData) {
                await restoreAllData(categoryData);
                showToast('数据已从 ' + handle.name + ' 完整恢复', 'success');
                console.log('[FileConfig] 从目录恢复了 ' + Object.keys(categoryData).length + ' 个类别');
            } else {
                // 空目录/无数据 → 从 localStorage 同步写入
                await writeAllCategoryFiles();
                showToast(hasLocalData() ? '数据已同步到 ' + handle.name : '配置目录已就绪：' + handle.name, 'success');
                console.log('[FileConfig] 本地数据已写入到目录');
            }

            // 持久化 handle 到 IndexedDB
            try {
                await saveHandleToDB(handle);
                console.log('[FileConfig] Handle 已保存到 IndexedDB');
            } catch (dbErr) {
                console.error('[FileConfig] 保存 Handle 到 IndexedDB 失败:', dbErr);
                showWarningBar('目录已选择但未能保存状态，刷新后可能需要重新选择', false);
            }

            isReady = true;
            writePermissionPending = false;
            updateBadge('', '#e74c3c');
            hideWarningBar();
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false;
            console.error('[FileConfig] 选择目录失败:', e);
            showWarningBar('选择目录失败：' + (e.message || '未知错误'), true);
            return false;
        }
    }

    /** 获取数据摘要（用于迁移提示） */
    function getCategorySummary() {
        var data = collectAllData();
        var parts = [];
        if (data.tiles && data.tiles.pages && data.tiles.pages.length > 0) parts.push(data.tiles.pages.length + ' 个分类');
        if (data.notes && data.notes.length > 0) parts.push(data.notes.length + ' 条笔记');
        if (data.tasks && data.tasks.length > 0) parts.push(data.tasks.length + ' 个任务');
        if (data.captures && data.captures.length > 0) parts.push(data.captures.length + ' 条捕获');
        return parts.length > 0 ? parts.join('、') : '初始数据';
    }

    /** 获取磁贴分类数量 */
    function getPageCount() {
        try {
            var raw = localStorage.getItem('tabpage_pages');
            if (!raw) return 0;
            return JSON.parse(raw).length || 0;
        } catch (_) { return 0; }
    }

    /* ===== Toast 提示 ===== */
    function showToast(message, type) {
        try {
            var toast = document.createElement('div');
            toast.className = 'file-config-toast' + (type === 'success' ? ' file-config-toast--success' : '');
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--color-surface);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--color-text);padding:10px 24px;border-radius:var(--radius-full);font-size:var(--font-size-sm);z-index:9999;border:1px solid var(--color-border);transition:opacity 0.3s ease;pointer-events:none;';
            document.body.appendChild(toast);
            setTimeout(function () { toast.style.opacity = '0'; }, 2500);
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
        } catch (_) { /* Toast 不阻塞主流程 */ }
    }

    /* ===== Popup 端配置检查 ===== */
    async function checkConfigForPopup() {
        try {
            if (!isFileSystemAPISupported()) return { configured: true };
            var handle = await loadHandleFromDB();
            return { configured: !!handle };
        } catch (_) {
            return { configured: false };
        }
    }

    /* ===== 暴露 API ===== */

    ns.fileConfig = {
        init: init,
        pickDir: handleUserPickDir,
        markDirty: markDirty,
        syncToFile: function () { return syncToFile(true); },
        _tryRecoverWrite: tryRecoverWritePermission,
        _tryRecoverRead: tryRecoverReadPermission,
        isReady: function () { return isReady; },
        getDirName: function () { return dirHandle ? dirHandle.name : ''; },
        getSyncInfo: function () {
            return {
                dirName: dirHandle ? dirHandle.name : '',
                lastSyncTime: lastSyncTime,
                lastError: lastSyncError,
                isReady: isReady,
                browserSupport: isFileSystemAPISupported()
            };
        },
        showWarningBar: showWarningBar,
        hideWarningBar: hideWarningBar,
        updateBadge: updateBadge,
        collectAllData: collectAllData,
        restoreAllData: restoreAllData,
        checkConfigForPopup: checkConfigForPopup,
        showToast: showToast,
        isSupported: isFileSystemAPISupported
    };

})(window.DevHome);
