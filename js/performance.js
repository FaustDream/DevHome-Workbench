/**
 * 性能监控面板
 * 右下角显示当前标签页 JS 堆内存使用情况。
 * 每秒刷新，仅模块开启时显示。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var refreshTimer = null;

    /** 格式化字节为可读文本 */
    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '--';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** 获取内存信息 */
    function getMemoryInfo() {
        // Chrome 特有 API
        if (performance && performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /** 计算使用百分比 */
    function getPercent(used, limit) {
        if (!limit || limit <= 0) return 0;
        return Math.round(used / limit * 100);
    }

    /** 获取状态颜色 */
    function getStatusColor(percent) {
        if (percent < 50) return 'var(--color-accent)';      // 绿色/正常
        if (percent < 75) return '#ffcc66';                   // 黄色/警告
        return 'var(--color-danger)';                         // 红色/危险
    }

    /** 刷新显示 */
    function refresh() {
        var el = document.getElementById('perfMonitor');
        if (!el) return;
        if (!ns.isModuleEnabled('perfMonitor')) { el.style.display = 'none'; stop(); return; }
        el.style.display = '';
        var mem = getMemoryInfo();
        if (!mem) {
            el.innerHTML = '<span class="perf-label">MEM</span><span class="perf-value">N/A</span>';
            return;
        }
        var pct = getPercent(mem.used, mem.limit);
        var color = getStatusColor(pct);
        el.innerHTML = '<span class="perf-label">MEM</span>'
            + '<span class="perf-value" style="color:' + color + '">' + formatBytes(mem.used) + '</span>'
            + '<span class="perf-pct" style="color:' + color + '">' + pct + '%</span>';
        el.title = 'JS 堆内存：已用 ' + formatBytes(mem.used)
            + ' / 限制 ' + formatBytes(mem.limit)
            + '（总计 ' + formatBytes(mem.total) + '）';
    }

    function start() {
        stop();
        refresh();
        refreshTimer = setInterval(refresh, 1000);
    }

    function stop() {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }

    /** 初始化性能监控 */
    ns.initPerfMonitor = function () {
        if (!ns.isModuleEnabled('perfMonitor')) {
            var el = document.getElementById('perfMonitor');
            if (el) el.style.display = 'none';
            return;
        }
        start();
        console.log('[性能] 监控面板启动');
    };

    /** 停止监控（页面卸载时调用） */
    ns.stopPerfMonitor = function () { stop(); };

})(window.DevHome);
