/**
 * DevHome Workbench v2 - chrome.storage.local 存储抽象层
 *
 * 职责：
 *   1. 提供带 v2/ 前缀的 chrome.storage.local 读写 API
 *   2. 数据迁移：从 localStorage (devhome_*) 迁移到 chrome.storage.local
 *   3. localStorage 缓存加速（启动时从 chrome.storage 同步）
 *
 * chrome.storage.local 是异步 API，所有方法返回 Promise。
 * 写操作同时更新 localStorage 缓存以加速后续读取。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var STORAGE_PREFIX = 'v2/';
    var CACHE_PREFIX = 'devhome_v2_cache_';

    /* ===== 检查 chrome.storage.local 是否可用 ===== */
    function isAvailable() {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    /* ===== 核心读写 API ===== */

    /**
     * 从 chrome.storage.local 读取数据
     * @param {string} key - 不含前缀的 key（如 'notes', 'config'）
     * @param {*} fallback - 默认值
     * @returns {Promise<*>}
     */
    async function get(key, fallback) {
        if (!isAvailable()) {
            // 降级：从 localStorage 缓存读取
            return getFromCache(key, fallback);
        }
        try {
            var result = await chrome.storage.local.get(STORAGE_PREFIX + key);
            var value = result[STORAGE_PREFIX + key];
            if (value !== undefined) {
                // 同步到 localStorage 缓存
                setToCache(key, value);
                return value;
            }
            return fallback;
        } catch (e) {
            console.warn('[StorageV2] 读取失败，降级到缓存:', e);
            return getFromCache(key, fallback);
        }
    }

    /**
     * 写入数据到 chrome.storage.local
     * @param {string} key - 不含前缀的 key
     * @param {*} value - 要存储的值
     * @returns {Promise<void>}
     */
    async function set(key, value) {
        // 始终更新 localStorage 缓存
        setToCache(key, value);

        if (!isAvailable()) return;

        try {
            var obj = {};
            obj[STORAGE_PREFIX + key] = value;
            await chrome.storage.local.set(obj);
        } catch (e) {
            console.warn('[StorageV2] 写入失败:', e);
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

    /* ===== localStorage 缓存 ===== */

    function getFromCache(key, fallback) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function setToCache(key, value) {
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
        } catch {
            // localStorage 满了，静默失败
        }
    }

    function removeFromCache(key) {
        try {
            localStorage.removeItem(CACHE_PREFIX + key);
        } catch { }
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
            var quadrants = ['q1', 'q2', 'q3', 'q4'];
            quadrants.forEach(function (q) {
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

    /* ===== 批量操作 ===== */

    /**
     * 获取所有 v2/ 前缀的数据
     * @returns {Promise<Object>}
     */
    async function getAll() {
        if (!isAvailable()) {
            // 从缓存收集
            var result = {};
            var keys = ['config', 'notes', 'captures', 'tasks', 'pomodoro_sessions', 'behavior', 'encouragement_pool'];
            keys.forEach(function (k) {
                result[k] = getFromCache(k, null);
            });
            return result;
        }
        try {
            var all = await chrome.storage.local.get(null);
            var result = {};
            Object.keys(all).forEach(function (k) {
                if (k.startsWith(STORAGE_PREFIX)) {
                    result[k.replace(STORAGE_PREFIX, '')] = all[k];
                }
            });
            return result;
        } catch (e) {
            console.warn('[StorageV2] 批量读取失败:', e);
            return {};
        }
    }

    /* ===== 暴露 API ===== */

    ns.storageV2 = {
        get: get,
        set: set,
        remove: remove,
        getAll: getAll,
        migrateFromLegacy: migrateFromLegacy,
        isAvailable: isAvailable,
        // 常量导出
        KEYS: {
            CONFIG: 'config',
            NOTES: 'notes',
            CAPTURES: 'captures',
            TASKS: 'tasks',
            POMODORO_SESSIONS: 'pomodoro_sessions',
            BEHAVIOR: 'behavior',
            ENCOURAGEMENT_POOL: 'encouragement_pool'
        }
    };

})(window.DevHome);
