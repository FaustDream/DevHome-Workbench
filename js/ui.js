/**
 * DevHome Workbench - UI 层（编排入口）
 *
 * 架构说明：
 *   本文件为 UI 层的编排入口，所有业务逻辑已拆分到 js/ui/ 私有子目录：
 *     _context-menu.js   — 磁贴/空白区域右键菜单 + 分类子菜单
 *     _settings-panel.js  — 设置面板生命周期 + Tab 切换 + 控件同步 + 动作处理
 *     _tile-editor.js     — 磁贴编辑弹窗 + 通用弹窗工厂 + 编辑器右键菜单
 *
 *  所有子模块通过 window.DevHome 命名空间（IIFE 注入）共享状态与方法。
 *  本文件仅作为编排入口，不包含任何业务逻辑。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    // UI 子模块已在 js/ui/_*.js 中通过 IIFE 自动注册到 ns 命名空间
    // 本文件仅作为编排入口存在，无需额外代码

})(window.DevHome);
