/**
 * DevHome Workbench v2 - chrome.storage.local 存储抽象层
 *
 * 职责：
 *   1. 提供带 v2/ 前缀的 chrome.storage.local 读写 API
 *   2. 数据迁移：从 localStorage (devhome_*) 迁移到 chrome.storage.local
 *   3. localStorage 缓存加速（启动时从 chrome.storage 同步）
 *   4. 并发写入乐观锁（_version 字段 compare-and-swap）
 *   5. localStorage 缓存过期检测（_cacheTime 时间戳，>24h 过期）
 *
 * chrome.storage.local 是异步 API，所有方法返回 Promise。
 * 写操作同时更新 localStorage 缓存以加速后续读取。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var STORAGE_PREFIX = 'v2/';
    var CACHE_PREFIX = 'devhome_v2_cache_';
    var CACHE_META_PREFIX = 'devhome_v2_meta_';   // 缓存元数据（版本号 + 时间戳）
    var CACHE_TTL_MS = 24 * 60 * 60 * 1000;       // 缓存过期时间：24 小时
    var MAX_RETRY = 3;                             // 乐观锁最大重试次数

    /* ===== 检查 chrome.storage.local 是否可用 ===== */
    function isAvailable() {
        return !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
    }

    /* ===== 核心读写 API ===== */

    /**
     * 从 chrome.storage.local 读取数据
     * @param {string} key - 不含前缀的 key（如 'notes', 'config'）
     * @param {*} fallback - 默认值
     * @returns {Promise<*>}
     */
    /**
     * 解包乐观锁包装，返回原始值
     * 乐观锁将非对象值包装为 { data: value, _version: N }
     * 对象值直接在对象上添加 _version 字段
     */
    function unwrapValue(value) {
        if (value === null || value === undefined) return value;
        // 如果是 { data: ..., _version: ... } 包装格式（数组或基本类型）
        if (typeof value === 'object' && !Array.isArray(value) && value.data !== undefined && value._version !== undefined) {
            // 如果只有 data 和 _version 两个字段，直接返回 data
            var keys = Object.keys(value);
            if (keys.length === 2 && keys.indexOf('data') >= 0 && keys.indexOf('_version') >= 0) {
                return value.data;
            }
        }
        return value;
    }

    async function get(key, fallback) {
        if (!isAvailable()) {
            // 降级：从 localStorage 缓存读取（检查过期）
            var cached = getFromCache(key, fallback);
            return unwrapValue(cached);
        }
        try {
            var result = await chrome.storage.local.get(STORAGE_PREFIX + key);
            var value = result[STORAGE_PREFIX + key];
            if (value !== undefined) {
                // 同步到 localStorage 缓存（含时间戳）
                setToCache(key, value);
                return unwrapValue(value);
            }
            return fallback;
        } catch (e) {
            console.warn('[StorageV2] 读取失败，降级到缓存:', e);
            var cached = getFromCache(key, fallback);
            return unwrapValue(cached);
        }
    }

    /**
     * 写入数据到 chrome.storage.local（含乐观锁版本控制）
     *
     * 乐观锁策略：
     *   1. 读取当前 version（_version 字段）
     *   2. 写入时传入期望的 version，chrome.storage.local 不支持 CAS，
     *      所以采用"读取-比较-写入"三步重试：
     *      a. 先读当前值获取 version
     *      b. version+1 后写入
     *      c. 写入后立即读取验证 version 是否被其他标签页覆盖
     *      d. 如果被覆盖则重试（最多 MAX_RETRY 次）
     *
     * @param {string} key - 不含前缀的 key
     * @param {*} value - 要存储的值
     * @returns {Promise<void>}
     */
    async function set(key, value) {
        // 始终更新 localStorage 缓存
        setToCache(key, value);

        if (!isAvailable()) return;

        var retries = 0;
        while (retries < MAX_RETRY) {
            try {
                // 1. 读取当前 version
                var current = await chrome.storage.local.get(STORAGE_PREFIX + key);
                var currentData = current[STORAGE_PREFIX + key];
                var currentVersion = (currentData && currentData._version) ? currentData._version : 0;

                // 2. 将 _version 嵌入到 value 中
                var newVersion = currentVersion + 1;
                var wrappedValue;
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    // 如果是对象，直接在对象上设置 _version（浅拷贝避免修改原始对象）
                    wrappedValue = Object.assign({}, value, { _version: newVersion });
                } else {
                    // 如果是数组或其他类型，包装为 { data, _version }
                    wrappedValue = { data: value, _version: newVersion };
                }

                // 3. 写入
                var obj = {};
                obj[STORAGE_PREFIX + key] = wrappedValue;
                await chrome.storage.local.set(obj);

                // 4. 验证写入是否成功（检查 _version 是否被覆盖）
                var verify = await chrome.storage.local.get(STORAGE_PREFIX + key);
                var verifiedData = verify[STORAGE_PREFIX + key];
                if (verifiedData && verifiedData._version === newVersion) {
                    // 写入成功
                    break;
                }

                // version 不匹配，被其他标签页覆盖，重试
                retries++;
                if (retries >= MAX_RETRY) {
                    console.warn('[StorageV2] 乐观锁重试 ' + MAX_RETRY + ' 次后仍失败，最后写入的 version 可能被覆盖');
                }
            } catch (e) {
                console.warn('[StorageV2] 写入失败:', e);
                break;
            }
        }

        // 所有持久化数据变更时标记对应文件脏，触发 1 秒防抖写盘
        var keyToCategory = { notes: 'notes', captures: 'captures', tasks: 'tasks', notebooks: 'notebooks',
            pomodoro_sessions: 'pomodoro', behavior: 'behavior', config: 'config' };
        var category = keyToCategory[key];
        if (category && ns.fileConfig && typeof ns.fileConfig.markDirty === 'function') {
            ns.fileConfig.markDirty(category);
        }
    }

    /**
     * 删除数据
     * @param {string} key - 不含前缀的 key
     * @returns {Promise<void>}
     */
    async function remove(key) {
        removeFromCache(key);
        if (!isAvailable()) return;
        try {
            await chrome.storage.local.remove(STORAGE_PREFIX + key);
        } catch (e) {
            console.warn('[StorageV2] 删除失败:', e);
        }
    }

    /* ===== localStorage 缓存（含时间戳过期检测） ===== */

    /**
     * 从 localStorage 缓存读取数据，检查是否过期
     * 缓存结构：{ value: 原始数据, _cacheTime: 写入时间戳 }
     */
    function getFromCache(key, fallback) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + key);
            if (raw === null) return fallback;
            var parsed = JSON.parse(raw);
            // 兼容旧缓存格式（无 _cacheTime 字段）
            if (parsed && typeof parsed === 'object' && parsed._cacheTime) {
                var age = Date.now() - parsed._cacheTime;
                if (age > CACHE_TTL_MS) {
                    console.log('[StorageV2] 缓存过期: ' + key + ' (' + Math.round(age / 3600000) + 'h)，需从 chrome.storage 重新加载');
                    // 不清除缓存，下次成功读取后会更新
                }
                return parsed.value !== undefined ? parsed.value : fallback;
            }
            // 旧格式直接返回（无时间戳）
            return parsed;
        } catch {
            return fallback;
        }
    }

    /**
     * 写入 localStorage 缓存，附带时间戳
     * 缓存结构：{ value: 原始数据, _cacheTime: Date.now() }
     */
    function setToCache(key, value) {
        try {
            var cacheEntry = {
                value: value,
                _cacheTime: Date.now()
            };
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
        } catch {
            // localStorage 满了，静默失败
        }
    }

    function removeFromCache(key) {
        try {
            localStorage.removeItem(CACHE_PREFIX + key);
        } catch { }
    }

    /**
     * 检查缓存是否过期
     * @param {string} key - 缓存 key
     * @returns {boolean} true 表示已过期
     */
    function isCacheExpired(key) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return true;
            var parsed = JSON.parse(raw);
            if (parsed && parsed._cacheTime) {
                return (Date.now() - parsed._cacheTime) > CACHE_TTL_MS;
            }
            return true; // 无时间戳的旧缓存视为过期
        } catch {
            return true;
        }
    }

    /**
     * 获取缓存的剩余有效时间（毫秒）
     * @param {string} key - 缓存 key
     * @returns {number} 剩余有效毫秒数，已过期返回 0
     */
    function getCacheRemainingTTL(key) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return 0;
            var parsed = JSON.parse(raw);
            if (parsed && parsed._cacheTime) {
                var remaining = CACHE_TTL_MS - (Date.now() - parsed._cacheTime);
                return remaining > 0 ? remaining : 0;
            }
            return 0;
        } catch {
            return 0;
        }
    }

    /* ===== 数据迁移 ===== */

    /**
     * 将旧格式 localStorage 数据迁移到 chrome.storage.local
     * 迁移项：
     *   - devhome_workbench → v2/tasks（四象限任务）
     *
     * 幂等：如果 v2/tasks 已存在则跳过
     */
    async function migrateFromLegacy() {
        if (!isAvailable()) {
            console.log('[StorageV2] chrome.storage 不可用，跳过迁移');
            return { migrated: false, reason: 'unavailable' };
        }

        try {
            // 检查是否已迁移
            var existing = await get('tasks', null);
            if (existing !== null) {
                console.log('[StorageV2] 数据已迁移，跳过');
                return { migrated: false, reason: 'already_migrated' };
            }

            // 读取旧数据
            var legacyTasks = ns.devhomeStorage.get('workbench', null);
            if (!legacyTasks || !legacyTasks.quadrants) {
                console.log('[StorageV2] 无旧数据需要迁移');
                return { migrated: false, reason: 'no_legacy_data' };
            }

            // 转换为新格式
            var tasks = [];
            ns.forEachQuadrant(function (q) {
                var quadrantTasks = legacyTasks.quadrants[q] && legacyTasks.quadrants[q].tasks;
                if (!quadrantTasks) return;
                quadrantTasks.forEach(function (t) {
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
            });

            await set('tasks', tasks);
            console.log('[StorageV2] 迁移完成：' + tasks.length + ' 条任务');
            return { migrated: true, count: tasks.length };
        } catch (e) {
            console.error('[StorageV2] 迁移失败:', e);
            return { migrated: false, reason: 'error', error: e.message };
        }
    }

    /* ===== 外部变更监听 =====
       当 Service Worker 等外部上下文直接修改 chrome.storage.local 时，
       自动同步 localStorage 缓存，确保页面端数据一致性。 */
    if (isAvailable()) {
        chrome.storage.onChanged.addListener(function (changes, areaName) {
            if (areaName !== 'local') return;
            Object.keys(changes).forEach(function (fullKey) {
                if (!fullKey.startsWith(STORAGE_PREFIX)) return;
                var shortKey = fullKey.replace(STORAGE_PREFIX, '');
                var newValue = changes[fullKey].newValue;
                if (newValue !== undefined) {
                    setToCache(shortKey, newValue);
                } else {
                    removeFromCache(shortKey);
                }
            });
        });
    }

    /* ===== 批量操作 ===== */

    /**
     * 获取所有 v2/ 前缀的数据
     * 优化：传入具体 key 数组而非 get(null)，避免读取 chrome.storage.local 中
     * 所有扩展无关的数据（如其他扩展的存储项），减少不必要的序列化开销。
     * @returns {Promise<Object>}
     */
    async function getAll() {
        var knownKeys = ['config', 'notes', 'captures', 'tasks', 'notebooks', 'pomodoro_sessions', 'behavior', 'encouragement_pool'];

        if (!isAvailable()) {
            // 从缓存收集
            var result = {};
            knownKeys.forEach(function (k) {
                result[k] = getFromCache(k, null);
            });
            return result;
        }
        try {
            // 传入具体 key 数组而非 get(null)，避免读取整个 storage 区域
            var prefixedKeys = knownKeys.map(function (k) { return STORAGE_PREFIX + k; });
            var all = await chrome.storage.local.get(prefixedKeys);
            var result = {};
            knownKeys.forEach(function (k) {
                var value = all[STORAGE_PREFIX + k];
                if (value !== undefined) {
                    result[k] = value;
                }
            });
            return result;
        } catch (e) {
            console.warn('[StorageV2] 批量读取失败:', e);
            return {};
        }
    }

    /* ===== 存储配额监控（O21） ===== */

    /** 配额警告阈值：使用量超过 90% 时发出警告 */
    var QUOTA_WARN_THRESHOLD = 0.9;
    /** 上次配额检查时间戳，避免频繁检查 */
    var _lastQuotaCheck = 0;
    /** 配额检查间隔（毫秒）：30 秒 */
    var QUOTA_CHECK_INTERVAL = 30000;

    /**
     * 获取当前 storage.local 配额使用情况
     * @returns {Promise<{bytesUsed: number, quotaBytes: number, percentUsed: number}>}
     */
    async function getQuotaInfo() {
        if (!isAvailable()) {
            return { bytesUsed: 0, quotaBytes: 0, percentUsed: 0, available: false };
        }

        try {
            var bytesUsed = await chrome.storage.local.getBytesInUse(null);
            var quotaBytes = chrome.storage.local.QUOTA_BYTES;
            return {
                bytesUsed: bytesUsed,
                quotaBytes: quotaBytes,
                percentUsed: quotaBytes > 0 ? Math.round(bytesUsed / quotaBytes * 10000) / 100 : 0,
                available: true
            };
        } catch (e) {
            console.warn('[StorageV2] 获取配额信息失败:', e.message);
            return { bytesUsed: 0, quotaBytes: 0, percentUsed: 0, available: false };
        }
    }

    /**
     * 检查存储配额是否接近上限
     * 若超过阈值（90%），发出控制台警告
     * 内置节流：30 秒内不重复检查
     * @returns {Promise<{warn: boolean, info: object}>}
     */
    async function checkQuota() {
        var now = Date.now();
        if (now - _lastQuotaCheck < QUOTA_CHECK_INTERVAL) {
            return { warn: false, throttled: true };
        }
        _lastQuotaCheck = now;

        var info = await getQuotaInfo();
        if (!info.available) return { warn: false, info: info };

        if (info.percentUsed >= QUOTA_WARN_THRESHOLD * 100) {
            console.warn(
                '[StorageV2] 存储配额告警！已使用 ' + formatBytes(info.bytesUsed) +
                ' / ' + formatBytes(info.quotaBytes) +
                ' (' + info.percentUsed.toFixed(1) + '%)'
            );
            return { warn: true, info: info };
        }

        console.log(
            '[StorageV2] 存储配额正常: ' + formatBytes(info.bytesUsed) +
            ' / ' + formatBytes(info.quotaBytes) +
            ' (' + info.percentUsed.toFixed(1) + '%)'
        );
        return { warn: false, info: info };
    }

    /**
     * 格式化字节数为可读字符串
     * @param {number} bytes
     * @returns {string}
     */
    function formatBytes(bytes) {
        if (bytes === undefined || bytes === null) return '未知';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    /* ===== 暴露 API ===== */

    ns.storageV2 = {
        get: get,
        set: set,
        remove: remove,
        getAll: getAll,
        migrateFromLegacy: migrateFromLegacy,
        isAvailable: isAvailable,
        isCacheExpired: isCacheExpired,
        getCacheRemainingTTL: getCacheRemainingTTL,
        // O21: 存储配额监控
        getQuotaInfo: getQuotaInfo,
        checkQuota: checkQuota,
        // 常量导出
        KEYS: {
            CONFIG: 'config',
            NOTES: 'notes',
            CAPTURES: 'captures',
            TASKS: 'tasks',
            NOTEBOOKS: 'notebooks',
            POMODORO_SESSIONS: 'pomodoro_sessions',
            BEHAVIOR: 'behavior',
            ENCOURAGEMENT_POOL: 'encouragement_pool'
        }
    };

})(window.DevHome);
