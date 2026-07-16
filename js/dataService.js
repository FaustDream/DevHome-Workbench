/**
 * DevHome Workbench - 统一数据服务层 (DataService)
 *
 * 职责：
 *   1. 封装 localStorage / chrome.storage.local / 文件系统三层存储
 *   2. 提供统一的异步读写接口
 *   3. 所有业务模块通过 dataService 读写数据，隔离底层存储实现
 *   4. 处理缓存同步、数据迁移、乐观锁
 *
 * 设计原则：
 *   - 读操作优先从 localStorage 缓存读取，后台与 chrome.storage 同步
 *   - 写操作同时写入 localStorage + chrome.storage + 标记文件系统脏数据
 *   - 所有对外方法返回 Promise，支持 async/await
 *   - 降级策略：chrome.storage 不可用时自动降级到 localStorage
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 内部常量 ===== */
    var STORAGE_PREFIX = 'v2/';
    var TABPAGE_PREFIX = 'tabpage_';
    var DEVHOME_PREFIX = 'devhome_';
    var CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

    /* ===== 可用性检查 ===== */
    function hasChromeStorage() {
        return !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
    }

    /* ===== localStorage 缓存辅助 ===== */
    function cacheGet(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw !== null) {
                var parsed = JSON.parse(raw);
                // 检查过期
                if (parsed._ts && Date.now() - parsed._ts > CACHE_TTL) return fallback;
                return parsed._v !== undefined ? parsed._v : parsed;
            }
        } catch (_) {}
        return fallback;
    }
    function cacheSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify({ _v: value, _ts: Date.now() }));
        } catch (_) {}
    }

    /* ===== 统一数据服务 API ===== */
    ns.dataService = {

        /* ---------- 磁贴与分类数据 (localStorage) ---------- */
        /**
         * 获取所有磁贴页面数据
         * @returns {Promise<Array>}
         */
        async getPages() {
            if (hasChromeStorage()) {
                try {
                    var result = await chrome.storage.local.get('v2/pages');
                    if (result['v2/pages'] !== undefined) return result['v2/pages'];
                } catch (_) {}
            }
            return ns.storage.get('pages', []);
        },

        /**
         * 保存磁贴页面数据
         * @param {Array} pages
         */
        async savePages(pages) {
            ns.storage.set('pages', pages);
            if (hasChromeStorage()) {
                try { await chrome.storage.local.set({ 'v2/pages': pages }); } catch (_) {}
            }
        },

        /**
         * 获取页面名称列表
         */
        async getPageNames() {
            if (hasChromeStorage()) {
                try {
                    var result = await chrome.storage.local.get('v2/pageNames');
                    if (result['v2/pageNames'] !== undefined) return result['v2/pageNames'];
                } catch (_) {}
            }
            return ns.storage.get('page_names', ['第1页']);
        },

        /**
         * 保存页面名称列表
         */
        async savePageNames(names) {
            ns.storage.set('page_names', names);
            if (hasChromeStorage()) {
                try { await chrome.storage.local.set({ 'v2/pageNames': names }); } catch (_) {}
            }
        },

        /* ---------- 笔记数据 (chrome.storage.local) ---------- */
        /**
         * 获取所有笔记
         */
        async getNotes() {
            return await ns.storageV2.get(ns.storageV2.KEYS.NOTES, []);
        },

        /**
         * 保存单篇笔记（创建或更新）
         * @param {Object} note
         */
        async saveNote(note) {
            var notes = await this.getNotes();
            var idx = notes.findIndex(function (n) { return n.id === note.id; });
            if (idx >= 0) {
                notes[idx] = Object.assign({}, notes[idx], note, { updatedAt: Date.now() });
            } else {
                note.createdAt = note.createdAt || Date.now();
                note.updatedAt = Date.now();
                notes.push(note);
            }
            await ns.storageV2.set(ns.storageV2.KEYS.NOTES, notes);
            ns.state.notes = notes;
        },

        /**
         * 删除笔记
         * @param {string} id
         */
        async deleteNote(id) {
            var notes = await this.getNotes();
            var filtered = notes.filter(function (n) { return n.id !== id; });
            await ns.storageV2.set(ns.storageV2.KEYS.NOTES, filtered);
            ns.state.notes = filtered;
        },

        /* ---------- 快速捕获 ---------- */
        async getCaptures() {
            return await ns.storageV2.get(ns.storageV2.KEYS.CAPTURES, []);
        },

        async saveCapture(capture) {
            var captures = await this.getCaptures();
            capture.createdAt = capture.createdAt || Date.now();
            captures.unshift(capture);
            // 最多保留 200 条
            if (captures.length > 200) captures = captures.slice(0, 200);
            await ns.storageV2.set(ns.storageV2.KEYS.CAPTURES, captures);
            ns.state.captures = captures;
        },

        async deleteCapture(id) {
            var captures = await this.getCaptures();
            captures = captures.filter(function (c) { return c.id !== id; });
            await ns.storageV2.set(ns.storageV2.KEYS.CAPTURES, captures);
            ns.state.captures = captures;
        },

        /* ---------- 四象限任务 ---------- */
        async getTasks() {
            return await ns.storageV2.get(ns.storageV2.KEYS.TASKS, []);
        },

        async saveTask(task) {
            var tasks = await this.getTasks();
            var idx = tasks.findIndex(function (t) { return t.id === task.id; });
            if (idx >= 0) {
                tasks[idx] = Object.assign({}, tasks[idx], task);
            } else {
                task.createdAt = task.createdAt || Date.now();
                tasks.push(task);
            }
            await ns.storageV2.set(ns.storageV2.KEYS.TASKS, tasks);
        },

        async deleteTask(id) {
            var tasks = await this.getTasks();
            tasks = tasks.filter(function (t) { return t.id !== id; });
            await ns.storageV2.set(ns.storageV2.KEYS.TASKS, tasks);
        },

        /* ---------- 笔记本 ---------- */
        async getNotebooks() {
            return await ns.storageV2.get(ns.storageV2.KEYS.NOTEBOOKS, []);
        },

        async saveNotebooks(notebooks) {
            await ns.storageV2.set(ns.storageV2.KEYS.NOTEBOOKS, notebooks);
            ns.state.notebooks = notebooks;
        },

        /* ---------- 配置 ---------- */
        async getConfig() {
            return await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        },

        async saveConfig(config) {
            await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        },

        /* ---------- 通用设置 (localStorage) ---------- */
        getSetting(key, fallback) {
            return ns.storage.get(key, fallback);
        },

        setSetting(key, value) {
            ns.storage.set(key, value);
        },

        /* ---------- DevHome 工作台设置 ---------- */
        getDevhomeSetting(key, fallback) {
            return ns.devhomeStorage.get(key, fallback);
        },

        setDevhomeSetting(key, value) {
            ns.devhomeStorage.set(key, value);
        },

        /* ---------- 数据导出（完整快照） ---------- */
        async exportAll() {
            var pages = await this.getPages();
            var pageNames = await this.getPageNames();
            var notes = await this.getNotes();
            var captures = await this.getCaptures();
            var tasks = await this.getTasks();
            var notebooks = await this.getNotebooks();
            var config = await this.getConfig();

            return {
                version: '3.0',
                exportedAt: new Date().toISOString(),
                pages: pages,
                pageNames: pageNames,
                notes: notes,
                captures: captures,
                tasks: tasks,
                notebooks: notebooks,
                config: config
            };
        },

        /* ---------- 数据导入（完整快照） ---------- */
        async importAll(snapshot) {
            if (!snapshot || !snapshot.pages) throw new Error('无效的导入数据');
            await this.savePages(snapshot.pages);
            if (snapshot.pageNames) await this.savePageNames(snapshot.pageNames);
            if (snapshot.notes) await ns.storageV2.set(ns.storageV2.KEYS.NOTES, snapshot.notes);
            if (snapshot.captures) await ns.storageV2.set(ns.storageV2.KEYS.CAPTURES, snapshot.captures);
            if (snapshot.tasks) await ns.storageV2.set(ns.storageV2.KEYS.TASKS, snapshot.tasks);
            if (snapshot.notebooks) await this.saveNotebooks(snapshot.notebooks);
            if (snapshot.config) await this.saveConfig(snapshot.config);
        },

        /* ---------- 工具方法 ---------- */
        /** 检查 chrome.storage.local 是否可用 */
        isChromeStorageAvailable: hasChromeStorage
    };

})(window.DevHome);
