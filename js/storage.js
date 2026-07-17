/**
 * DevHome Workbench - 存储抽象层
 * tabpage_*：承载原有磁贴、分类、背景、隐藏状态。
 * devhome_*：二开新增的工作台配置，避免升级失败污染原始首页内核。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 本地存储（tabpage_ 前缀） ===== */
    ns.storage = {
        get(key, fallback) {
            try {
                const raw = localStorage.getItem('tabpage_' + key);
                return raw !== null ? JSON.parse(raw) : fallback;
            } catch (e) {
                console.warn('[存储] 读取 tabpage_' + key + ' 失败:', e.message);
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem('tabpage_' + key, JSON.stringify(value));
                // 文件系统配置同步：标记数据脏，3 秒防抖后写入 devhome-config.json
                if (ns.fileConfig && typeof ns.fileConfig.markDirty === 'function') {
                    ns.fileConfig.markDirty();
                }
            } catch (e) { console.warn('[存储] 写入 tabpage_' + key + ' 失败:', e.message); }
        },
        clear(key) {
            try {
                localStorage.removeItem('tabpage_' + key);
            } catch (e) { console.warn('[存储] 清除 tabpage_' + key + ' 失败:', e.message); }
        }
    };

    /* ===== DevHome 工作台存储（devhome_ 前缀） ===== */
    ns.devhomeStorage = {
        get(key, fallback) {
            try {
                const raw = localStorage.getItem('devhome_' + key);
                return raw !== null ? JSON.parse(raw) : fallback;
            } catch (e) {
                console.warn('[存储] 读取 devhome_' + key + ' 失败:', e.message);
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem('devhome_' + key, JSON.stringify(value));
                // 文件系统配置同步：工作台数据变更也触发写盘
                if (ns.fileConfig && typeof ns.fileConfig.markDirty === 'function') {
                    ns.fileConfig.markDirty();
                }
            } catch (e) { console.warn('[存储] 写入 devhome_' + key + ' 失败:', e.message); }
        }
    };

    /* ===== 页面快照备份：数据变更前自动保存最多 3 份 ===== */
    ns.backupPagesSnapshot = function (reason, pagesData, pageNames) {
        try {
            const snapshots = ns.storage.get('page_backups', []);
            snapshots.unshift({
                reason: reason,
                timestamp: Date.now(),
                pages: pagesData,
                pageNames: pageNames
            });
            ns.storage.set('page_backups', snapshots.slice(0, 3));
        } catch (_) { }
    };

})(window.DevHome);
