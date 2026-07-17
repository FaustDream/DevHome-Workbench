/**
 * DevHome Workbench - 统一链接打开模块
 *
 * 所有链接跳转统一通过此模块，根据用户设置决定是否在新标签页打开：
 *   - 磁贴/书签等网站链接 → 设置项 linkNewTab_tiles
 *   - 搜索引擎结果 → 设置项 linkNewTab_search
 *   - 默认：新标签页打开
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /** 读取链接打开设置（默认全部新标签页） */
    function getOpenSettings() {
        return {
            tiles: true,   // 网站链接默认新标签
            search: true   // 搜索结果默认新标签
        };
    }

    /** 检查指定类型的链接是否应在新标签打开 */
    ns.shouldOpenNewTab = function (type) {
        var key = 'linkNewTab_' + (type || 'tiles');
        try {
            var raw = localStorage.getItem(key);
            if (raw !== null) return raw === 'true';
        } catch (_) {}
        return true; // 默认新标签页打开
    };

    /**
     * 统一打开链接
     * @param {string} url - 目标 URL
     * @param {Object} [opts]
     * @param {boolean} [opts.newTab] - 是否在新标签页打开（不传则读设置）
     * @param {string} [opts.type='tiles'] - 链接类型：'tiles'|'search'
     * @param {string} [opts.target='_blank'] - 链接 target 属性
     */
    ns.openUrl = function (url, opts) {
        opts = opts || {};
        var type = opts.type || 'tiles';
        // 如果显式传了 newTab 用传入值，否则读设置
        var newTab = opts.hasOwnProperty('newTab') ? opts.newTab : ns.shouldOpenNewTab(type);

        if (!url) return;

        // 优先使用 chrome.tabs API（Chrome 扩展环境）
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            if (newTab) {
                chrome.tabs.create({ url: url, active: false });
            } else {
                chrome.tabs.update({ url: url });
            }
            return;
        }

        // 降级：使用 window.open（非扩展环境）
        if (newTab) {
            window.open(url, opts.target || '_blank', 'noopener,noreferrer');
        } else {
            window.location.href = url;
        }
    };

})(window.DevHome);
