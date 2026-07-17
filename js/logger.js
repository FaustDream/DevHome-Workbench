/**
 * DevHome Workbench - 轻量级运行时日志组件
 *
 * 功能：
 *   1. 分级日志（DEBUG / INFO / WARN / ERROR）
 *   2. 内存环形缓冲区存储（最近 500 条）
 *   3. 关键业务流程自动标注标签
 *   4. console 同步输出 + 内存持久化
 *   5. 日志查询与导出
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const MAX_LOGS = 500;
    let _logs = [];
    let _tags = {}; // { tagName: true } — 活跃标签索引

    /* ===== 日志条目模型 ===== */
    function LogEntry(level, tag, message, data) {
        this.timestamp = Date.now();
        this.iso = new Date().toISOString();
        this.level = level;   // DEBUG | INFO | WARN | ERROR
        this.tag = tag || ''; // 业务标签：focus-mode | pomodoro | notes | tasks | config
        this.message = message;
        this.data = data || null;
    }

    /* ===== 写入环形缓冲区 ===== */
    function pushLog(entry) {
        _logs.push(entry);
        if (_logs.length > MAX_LOGS) {
            _logs = _logs.slice(-MAX_LOGS);
        }
        if (entry.tag) _tags[entry.tag] = true;
    }

    /* ===== 格式化输出 ===== */
    function formatEntry(entry) {
        const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
        const tag = entry.tag ? ' [' + entry.tag + ']' : '';
        const prefix = time + ' ' + entry.level + tag;
        return { prefix: prefix, msg: entry.message, data: entry.data };
    }

    const logger = {
        LEVELS: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },

        debug: function (tag, message, data) {
            const entry = new LogEntry('DEBUG', tag, message, data);
            pushLog(entry);
            console.debug('%c' + formatEntry(entry).prefix, 'color:#888', formatEntry(entry).msg, data || '');
        },

        info: function (tag, message, data) {
            const entry = new LogEntry('INFO', tag, message, data);
            pushLog(entry);
            console.log('%c' + formatEntry(entry).prefix, 'color:#4a9eff;font-weight:bold',
                formatEntry(entry).msg, data || '');
        },

        warn: function (tag, message, data) {
            const entry = new LogEntry('WARN', tag, message, data);
            pushLog(entry);
            console.warn(formatEntry(entry).prefix, formatEntry(entry).msg, data || '');
        },

        error: function (tag, message, data) {
            const entry = new LogEntry('ERROR', tag, message, data);
            pushLog(entry);
            console.error(formatEntry(entry).prefix, formatEntry(entry).msg, data || '');
        },

        query: function (opts) {
            opts = opts || {};
            const tag = opts.tag;
            const level = opts.level;
            const limit = opts.limit || 100;
            let result = _logs;
            if (tag) result = result.filter(function (e) { return e.tag === tag; });
            if (level) result = result.filter(function (e) { return e.level === level; });
            result = result.slice(-limit);
            return opts.raw ? result : result.map(formatEntry);
        },

        /** 导出所有日志为 JSON 字符串 */
        exportLogs: function () {
            return JSON.stringify(_logs.map(function (e) {
                return { t: e.iso, l: e.level, g: e.tag, m: e.message, d: e.data };
            }), null, 2);
        },

        /** 获取标签索引 */
        getTags: function () {
            return Object.keys(_tags);
        },

        /** 获取日志总数 */
        count: function () {
            return _logs.length;
        },

        /** 清空内存日志 */
        clear: function () {
            _logs = [];
            _tags = {};
        }
    };

    // 暴露到全局命名空间
    ns.logger = logger;

    // 启动日志
    logger.info('system', '日志组件已初始化', { maxLogs: MAX_LOGS, time: new Date().toISOString() });

})(window.DevHome);
