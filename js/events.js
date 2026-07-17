/**
 * DevHome Workbench - 事件绑定编排层
 *
 * 本文件仅负责按顺序调用各领域事件模块的 bind 函数。
 * 实际事件逻辑已拆分至 js/events/ 目录下的独立模块：
 *   - category-events.js   # 分类按钮行事件
 *   - notebook-events.js   # 笔记本下拉菜单 + 右键菜单事件
 *   - toolbar-events.js    # 工具栏按钮事件
 *   - quadrant-events.js   # 四象限任务面板事件
 *   - calendar-events.js   # 日历导航事件
 *   - pomodoro-events.js   # 番茄钟控制事件
 *   - filter-events.js     # 筛选标签事件
 *   - settings-events.js   # 设置面板 + F4/F5/F6/F8/F9 + AI + 导出事件
 *   - search-events.js     # 搜索相关事件
 *   - global-events.js     # 全局键盘/右键/文档事件
 *   - misc-events.js       # 磁贴/捕获/笔记列表/徽章/自动保存事件
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;

    /* ===== 主入口 ===== */
    ns.bindEvents = function () {
        // 防重复绑定
        if (state._eventsBound) {
            console.log('[事件] bindEvents 已绑定，跳过重复调用');
            return;
        }
        state._eventsBound = true;
        console.log('[事件] bindEvents 首次绑定');

        // 按领域依次绑定事件（调用各模块暴露的 _bindXxx 函数）
        ns._bindCategoryEvents();
        ns._bindNotebookEvents();
        ns._bindToolbarEvents();
        ns._bindQuadrantEvents();
        ns._bindCalendarEvents();
        ns._bindPomodoroEvents();
        ns._bindFilterEvents();
        ns._bindSettingsEvents();
        ns._bindSearchEvents();
        ns._bindGlobalEvents();
        ns._bindMiscEvents();
    };

})(window.DevHome);
