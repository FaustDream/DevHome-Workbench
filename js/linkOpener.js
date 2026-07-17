/**
 * DevHome Workbench - 统一链接打开模块
 *
 * 所有链接跳转统一通过此模块，确保行为一致：
 *   - 在新标签页打开（不替换当前页面）
 *   - 统一的 rel="noopener noreferrer" 安全策略
 *   - 兼容 Service Worker 和页面上下文
 *
 * @example
 *   ns.openUrl('https://example.com');           // 新标签页打开
 *   ns.openUrl('https://example.com', { newTab: false }); // 当前页打开
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /**
     * 统一打开链接
     * @param {string} url - 目标 URL
     * @param {Object} [opts]
     * @param {boolean} [opts.newTab=true] - 是否在新标签页打开
     * @param {string} [opts.target='_blank'] - 链接 target 属性（当 newTab=true 时）
     */
    ns.openUrl = function (url, opts) {
        opts = opts || {};
        const newTab = opts.newTab !== false; // 默认新标签页

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
