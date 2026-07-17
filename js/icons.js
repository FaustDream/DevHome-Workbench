/**
 * DevHome Workbench - iconfont Symbol 引用图标渲染工具
 * 采用阿里巴巴矢量图库 Symbol 引用方式，统一输出 <svg><use href="#dh-icon-xxx"/></svg>。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /**
     * 渲染 iconfont 图标 HTML（Symbol 引用方式）。
     * @param {string} name - 图标名（对应 sprite 中的 #dh-icon-xxx）
     * @param {string} extraClass - 额外 CSS 类名（尺寸等）
     * @param {string} title - 辅助标题
     * @returns {string} SVG 元素 HTML 字符串
     */
    ns.icon = function (name, extraClass, title) {
        var safeName = String(name || 'info').replace(/[^a-z0-9-]/gi, '');
        var cls = 'dh-icon dh-icon--' + safeName + (extraClass ? ' ' + String(extraClass) : '');
        var titleAttr = title
            ? ' aria-label="' + ns.escapeHtml(String(title)) + '" title="' + ns.escapeHtml(String(title)) + '"'
            : ' aria-hidden="true"';
        return '<svg class="' + cls + '"' + titleAttr + '>' +
            '<use href="#dh-icon-' + safeName + '"></use>' +
            '</svg>';
    };

    /**
     * 输出图标 + 文本的组合 HTML。
     * @param {string} name - 图标名
     * @param {string} label - 文本
     * @param {string} extraClass - 额外类名
     * @returns {string}
     */
    ns.iconLabel = function (name, label, extraClass) {
        return ns.icon(name, extraClass || 'dh-icon--md') + '<span>' + ns.escapeHtml(String(label || '')) + '</span>';
    };
})(window.DevHome);
