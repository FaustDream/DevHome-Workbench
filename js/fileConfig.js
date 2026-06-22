/**
 * DevHome Workbench - 文件系统配置管理
 *
 * 核心职责：
 *   1. 通过 File System Access API 管理配置目录和 devhome-config.json
 *   2. Handle 持久化到 IndexedDB，支持跨会话恢复
 *   3. localStorage ↔ 文件双向同步（启动读盘、变更防抖写盘）
 *   4. 权限失效检测、警告条控制、扩展图标角标管理
 *
 * 设计决策：
 *   - File System Access API（showDirectoryPicker），零外部依赖
 *   - 单文件 devhome-config.json 全量存储（不含搜索历史）
 *   - localStorage 保留作运行时缓存，3 秒防抖双写到文件
 *   - IndexedDB 存 DirectoryHandle，失效时黄色警告条提醒
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 常量 ===== */
    var CONFIG_FILE_NAME = 'devhome-config.json';
    var INDEXEDDB_NAME = 'DevHomeFileConfig';
    var INDEXEDDB_STORE = 'handles';
    var HANDLE_KEY = 'directoryHandle';
    var SYNC_VERSION = 1;
    var WRITE_DEBOUNCE_MS = 3000;

    /* ===== 内部状态 ===== */
    var dirHandle = null;        // FileSystemDirectoryHandle
    var fileHandle = null;       // FileSystemFileHandle
    var isReady = false;         // 配置目录是否已就绪
    var isDirty = false;         // 是否有未同步的变更
    var writeTimer = null;       // 防抖计时器
    var syncInProgress = false;  // 是否正在写入
    var lastSyncTime = 0;        // 上次同步时间戳
    var lastSyncError = null;    // 上次同步错误信息
    var dirHandleDB = null;      // IndexedDB 连接
    var writePermissionPending = false; // write 权限是否待授权（read 已就绪但 readwrite 失败）

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
        return openHandlesDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(INDEXEDDB_STORE, 'readwrite');
                var store = tx.objectStore(INDEXEDDB_STORE);
                store.put(handle, HANDLE_KEY);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function loadHandleFromDB() {
        return openHandlesDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(INDEXEDDB_STORE, 'readonly');
                var store = tx.objectStore(INDEXEDDB_STORE);
                var request = store.get(HANDLE_KEY);
                request.onsuccess = function () { resolve(request.result || null); };
                request.onerror = function () { reject(request.error); };
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

    /** 验证 DirectoryHandle 权限是否有效（尝试请求读写权限） */
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

    /* ===== 文件读写 ===== */

    /** 从配置目录读取 devhome-config.json */
    async function readConfigFile() {
        if (!dirHandle) return null;
        try {
            fileHandle = await dirHandle.getFileHandle(CONFIG_FILE_NAME, { create: false });
            var file = await fileHandle.getFile();
            var text = await file.text();
            return JSON.parse(text);
        } catch (e) {
            if (e.name === 'NotFoundError') return null;
            throw e; // 权限或其他错误向上抛
        }
    }

    /** 将数据写入 devhome-config.json */
    async function writeConfigFile(data) {
        if (!dirHandle) throw new Error('目录未授权');
        fileHandle = await dirHandle.getFileHandle(CONFIG_FILE_NAME, { create: true });
        var writable = await fileHandle.createWritable();
        var json = JSON.stringify(data, null, 2);
        await writable.write(json);
        await writable.close();
        lastSyncTime = Date.now();
        lastSyncError = null;
    }

    /* ===== 数据收集与恢复 ===== */

    /** 收集所有需要持久化的数据，组装为统一 JSON 结构 */
    var collectAllData = ns.fileConfig_collectAllData = function () {
        var data = { syncVersion: SYNC_VERSION, updatedAt: new Date().toISOString() };

        // 磁贴与分类数据
        try {
            var pagesRaw = localStorage.getItem('tabpage_pages');
            data.pages = pagesRaw ? JSON.parse(pagesRaw) : [];
        } catch (_) { data.pages = []; }
        try {
            var pageNamesRaw = localStorage.getItem('tabpage_page_names');
            data.pageNames = pageNamesRaw ? JSON.parse(pageNamesRaw) : [];
        } catch (_) { data.pageNames = []; }

        // 工作台数据
        try {
            var wbRaw = localStorage.getItem('devhome_workbench');
            data.workbench = wbRaw ? JSON.parse(wbRaw) : null;
        } catch (_) { data.workbench = null; }

        // 页面设置（tabpage_ 前缀 + popup 设置）
        data.settings = {};
        var pageSettingsMap = [
            'shortcut_size', 'shortcut_columns', 'auto_focus', 'category_memory',
            'last_page', 'cat_row', 'engine', 'bg', 'char_size', 'flow_speed',
            'char_density'
        ];
        pageSettingsMap.forEach(function (key) {
            try {
                var val = localStorage.getItem('tabpage_' + key);
                if (val !== null) data.settings[key] = JSON.parse(val);
            } catch (_) { /* 跳过损坏的项 */ }
        });

        // 弹窗设置
        try {
            var popupRaw = localStorage.getItem('devhome_ext_settings');
            data.popupSettings = popupRaw ? JSON.parse(popupRaw) : null;
        } catch (_) { data.popupSettings = null; }

        return data;
    };

    /** 将配置文件数据恢复到 localStorage */
    var restoreAllData = ns.fileConfig_restoreAllData = function (configData) {
        if (!configData) return;

        // 磁贴数据
        if (Array.isArray(configData.pages)) {
            localStorage.setItem('tabpage_pages', JSON.stringify(configData.pages));
        }
        if (Array.isArray(configData.pageNames)) {
            localStorage.setItem('tabpage_page_names', JSON.stringify(configData.pageNames));
        }

        // 工作台数据
        if (configData.workbench) {
            localStorage.setItem('devhome_workbench', JSON.stringify(configData.workbench));
        }

        // 页面设置
        if (configData.settings) {
            Object.keys(configData.settings).forEach(function (key) {
                localStorage.setItem('tabpage_' + key, JSON.stringify(configData.settings[key]));
            });
        }

        // 弹窗设置
        if (configData.popupSettings) {
            localStorage.setItem('devhome_ext_settings', JSON.stringify(configData.popupSettings));
        }
    };

    /* ===== 是否有本地缓存数据 ===== */
    function hasLocalData() {
        return localStorage.getItem('tabpage_pages') !== null ||
               localStorage.getItem('devhome_workbench') !== null;
    }

    /* ===== 迁移：localStorage → 文件 ===== */
    async function migrateLocalStorageToFile() {
        var data = collectAllData();
        await writeConfigFile(data);
    }

    /* ===== 警告条 ===== */

    /** 新标签页顶部警告条 */
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

    /** 扩展图标角标 */
    function updateBadge(text, color) {
        try {
            if (typeof chrome !== 'undefined' && chrome.action) {
                chrome.action.setBadgeText({ text: text || '' });
                if (color) chrome.action.setBadgeBackgroundColor({ color: color });
            }
        } catch (_) { /* popup 不破坏新标签页逻辑 */ }
    }

    /* ===== 同步逻辑 ===== */

    /** 标记数据脏，触发防抖写盘 */
    function markDirty() {
        if (!isReady) return;
        isDirty = true;
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(function () { syncToFile(false); }, WRITE_DEBOUNCE_MS);
    }

    /** 尝试重新获取 write 权限（在已有 handle 且具备用户手势的上下文中调用） */
    async function tryRecoverWritePermission() {
        if (!dirHandle || !writePermissionPending) return true; // 无需恢复
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

    /** 将当前数据同步写入文件 */
    async function syncToFile(force) {
        if (!isReady || syncInProgress) return;
        if (!force && !isDirty) return;
        if (!dirHandle) return;

        // 如果 write 权限待授权，尝试静默恢复（可能仍无用户手势，会失败）
        if (writePermissionPending) {
            try {
                var recovered = await tryRecoverWritePermission();
                if (!recovered) {
                    console.warn('[FileConfig] 写入跳过：write 权限待用户授权');
                    return; // 静默跳过，等用户下次点击时恢复
                }
            } catch (_) {
                return; // 恢复失败，静默跳过
            }
        }

        syncInProgress = true;
        try {
            await migrateLocalStorageToFile();
            isDirty = false;
            lastSyncError = null;
        } catch (e) {
            lastSyncError = e.message || '写入失败';
            console.error('[FileConfig] 同步文件失败:', e);
        } finally {
            syncInProgress = false;
        }
    }

    /* ===== 启动入口 ===== */

    /**
     * 初始化文件配置系统
     *
     * 关键设计：启动阶段仅验证 read 权限，避免 requestPermission(readwrite) 在无用户手势
     * 上下文中失败（Chrome 仅在首个标签页关闭后恢复 readwrite 权限时可能抛出
     * NotAllowedError）。write 权限延迟到实际写入时再请求（如用户点击保存时具备手势）。
     *
     * @returns {Promise<{ready: boolean, needsMigration: boolean, existingData: boolean, dirName: string}>}
     */
    async function init() {
        // 浏览器不支持 File System Access API
        if (!isFileSystemAPISupported()) {
            console.warn('[FileConfig] 当前浏览器不支持 File System Access API，回退到 localStorage 模式');
            // 不阻塞，直接标记就绪（用 localStorage 原生模式）
            isReady = true;
            hideWarningBar();
            updateBadge('', '#e74c3c');
            return { ready: true, needsMigration: false, existingData: hasLocalData(), dirName: '', unsupported: true };
        }

        try {
            // 1. 尝试从 IndexedDB 恢复 DirectoryHandle
            var handle = await loadHandleFromDB();
            if (handle) {
                // 2. 先验证 read 权限（不需要用户手势，从 IndexedDB 恢复后通常自动 granted）
                var readPermitted = await verifyPermission(handle, false);
                if (!readPermitted) {
                    // read 权限也失败 → handle 确实失效了，清理
                    dirHandle = null;
                    fileHandle = null;
                    await clearHandleFromDB();
                    // 如果 localStorage 有数据，降级为 localStorage 模式，不阻塞
                    if (hasLocalData()) {
                        isReady = true;
                        hideWarningBar();
                        updateBadge('', '#e74c3c');
                        console.log('[FileConfig] handle 权限失效，降级使用 localStorage');
                        return { ready: true, needsMigration: false, existingData: true, dirName: '', localStorageOnly: true };
                    }
                    showWarningBar('请选择一个文件夹存放配置和磁贴数据', true);
                    updateBadge('!', '#e74c3c');
                    return { ready: false, needsMigration: false, existingData: false, dirName: '' };
                }

                dirHandle = handle;

                // 3. 验证 write 权限（可能因无用户手势而失败，不阻塞启动）
                var writePermitted = await verifyPermission(handle, true);
                writePermissionPending = !writePermitted;

                // 4. 读取配置文件（仅需 read 权限）
                var configData = null;
                try {
                    configData = await readConfigFile();
                } catch (readErr) {
                    console.warn('[FileConfig] 读取配置文件失败:', readErr);
                }

                if (configData) {
                    // 文件存在 → 恢复到 localStorage
                    restoreAllData(configData);
                    isReady = true;
                    updateBadge('', writePermitted ? '#e74c3c' : '#ffcc66');
                    hideWarningBar();
                    if (!writePermitted) {
                        // write 权限待授权，显示非错误级别提示
                        showWarningBar(
                            '配置已从 "' + dirHandle.name + '" 读取，点击授权写入权限以启用自动同步',
                            false
                        );
                    }
                    return { ready: true, needsMigration: false, existingData: true, dirName: dirHandle.name };
                } else {
                    // 目录有效但无配置文件
                    var hasLocalDataNow = hasLocalData();
                    if (writePermitted) {
                        if (hasLocalDataNow) {
                            await migrateLocalStorageToFile();
                            showToast('已将 ' + getPageCount() + ' 个分类的配置迁移到文件', 'success');
                        } else {
                            // 新用户，写入默认数据
                            await migrateLocalStorageToFile();
                        }
                    }
                    isReady = true;
                    updateBadge('', writePermitted ? '#e74c3c' : '#ffcc66');
                    hideWarningBar();
                    if (!writePermitted && hasLocalDataNow) {
                        showWarningBar(
                            '配置目录 "' + dirHandle.name + '" 需要写入权限才能自动同步，请点击重新授权',
                            false
                        );
                    }
                    return { ready: true, needsMigration: hasLocalDataNow, existingData: hasLocalDataNow, dirName: dirHandle.name };
                }
            }

            // 5. IndexedDB 无 handle
            //    设计决策：FileSystemDirectoryHandle 在 Chrome 扩展新标签页全部关闭后无法从
            //    IndexedDB 跨会话恢复（结构化克隆限制），因此文件配置仅作为"增强备份"，不阻塞
            //    正常使用。localStorage 是可靠的主存储。
            var hasLocalDataFlag = hasLocalData();
            if (hasLocalDataFlag) {
                // localStorage 有数据 → 直接用，不弹警告条，静默就绪
                isReady = true;
                hideWarningBar();
                updateBadge('', '#e74c3c');
                console.log('[FileConfig] 无持久化 handle，使用 localStorage 模式（数据已存在）');
                return { ready: true, needsMigration: false, existingData: true, dirName: '', localStorageOnly: true };
            }
            // localStorage 无数据 → 首次使用，提示用户选择目录以创建初始配置
            showWarningBar('请选择一个文件夹存放配置和磁贴数据', false);
            updateBadge('!', '#e74c3c');
            return { ready: false, needsMigration: false, existingData: false, dirName: '' };

        } catch (e) {
            console.error('[FileConfig] 初始化失败:', e);
            // 降级：标记就绪，使用 localStorage
            isReady = true;
            hideWarningBar();
            updateBadge('', '#e74c3c');
            return { ready: true, needsMigration: false, existingData: hasLocalData(), dirName: '', error: e.message };
        }
    }

    /** 用户点击"选择目录"按钮的处理 */
    async function handleUserPickDir() {
        if (!isFileSystemAPISupported()) {
            alert('当前浏览器不支持此功能，请使用 Chrome 或 Edge。');
            return false;
        }
        try {
            var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            dirHandle = handle;
            fileHandle = null;

            // 检查目录内是否已有配置文件
            var existingConfig = await readConfigFile();
            if (existingConfig) {
                // 已有配置 → 恢复到 localStorage（跨机器恢复场景）
                restoreAllData(existingConfig);
                showToast('配置已从 ' + handle.name + ' 恢复', 'success');
            } else if (hasLocalData()) {
                // 无文件但有 localStorage → 迁移到文件
                await migrateLocalStorageToFile();
                showToast('已将 ' + getPageCount() + ' 个分类的配置迁移到文件', 'success');
            } else {
                // 全新初始化
                await migrateLocalStorageToFile();
                showToast('配置目录已就绪：' + handle.name, 'success');
            }

            // 持久化 handle
            await saveHandleToDB(handle);
            isReady = true;
            writePermissionPending = false; // 用户显式选择目录，已具备 write 权限
            updateBadge('', '#e74c3c');
            hideWarningBar();
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false; // 用户取消选择
            console.error('[FileConfig] 选择目录失败:', e);
            showWarningBar('选择目录失败：' + (e.message || '未知错误'), true);
            return false;
        }
    }

    /** 获取磁贴分类数量（用于迁移提示） */
    function getPageCount() {
        try {
            var raw = localStorage.getItem('tabpage_pages');
            if (!raw) return 0;
            return JSON.parse(raw).length || 0;
        } catch (_) { return 0; }
    }

    /** Toast 提示 */
    function showToast(message, type) {
        try {
            var toast = document.createElement('div');
            toast.className = 'file-config-toast' + (type === 'success' ? ' file-config-toast--success' : '');
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--devhome-card-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--text-primary);padding:10px 24px;border-radius:var(--radius-full);font-size:var(--font-size-sm);z-index:9999;border:1px solid var(--glass-border);transition:opacity 0.3s ease;pointer-events:none;';
            document.body.appendChild(toast);
            setTimeout(function () { toast.style.opacity = '0'; }, 2500);
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
        } catch (_) { /* Toast 不阻塞主流程 */ }
    }

    /* ===== Popup 端配置检查（精简版，用于弹窗） ===== */

    /** Popup 端无需完整启动流程，仅验证配置目录存在性 */
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
        /** 启动入口：恢复/检测配置目录，返回就绪状态 */
        init: init,

        /** 用户选择配置目录 */
        pickDir: handleUserPickDir,

        /** 标记数据脏，触发 3 秒防抖写盘 */
        markDirty: markDirty,

        /** 手动立即同步到文件（设置面板"立即同步"按钮） */
        syncToFile: function () { return syncToFile(true); },

        /** 尝试恢复 write 权限（需在用户手势上下文中调用），供警告条按钮使用 */
        _tryRecoverWrite: tryRecoverWritePermission,

        /** 配置是否已就绪 */
        isReady: function () { return isReady; },

        /** 获取配置目录名 */
        getDirName: function () { return dirHandle ? dirHandle.name : ''; },

        /** 获取上次同步信息 */
        getSyncInfo: function () {
            return {
                dirName: dirHandle ? dirHandle.name : '',
                lastSyncTime: lastSyncTime,
                lastError: lastSyncError,
                isReady: isReady,
                browserSupport: isFileSystemAPISupported()
            };
        },

        /** 显示新标签页顶部警告条（外部调用） */
        showWarningBar: showWarningBar,

        /** 隐藏新标签页顶部警告条（外部调用） */
        hideWarningBar: hideWarningBar,

        /** 更新扩展图标角标 */
        updateBadge: updateBadge,

        /** 收集全部数据（供弹窗或其他地方使用） */
        collectAllData: collectAllData,

        /** 恢复全部数据 */
        restoreAllData: restoreAllData,

        /** Popup 专用：检查配置状态 */
        checkConfigForPopup: checkConfigForPopup,

        /** 显示 Toast 提示 */
        showToast: showToast,

        /** 浏览器是否支持 File System Access API */
        isSupported: isFileSystemAPISupported
    };

})(window.DevHome);
