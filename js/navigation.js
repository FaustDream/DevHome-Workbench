/**
 * DevHome Workbench - 视图导航
 * 管理起始页/任务/设置三视图切换
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const CRUMB_MAP = { home: '起始页', tasks: '任务', settings: '设置' };
    let currentView = 'home';

    /**
     * 切换视图
     * 关键：currentView 在副作用前更新，阻断 enterFocusMode → switchView 的重入循环
     */
    function switchView(viewName) {
        if (currentView === viewName) return;
        if (!CRUMB_MAP[viewName]) {
            console.warn('[视图] 无效的视图名称: ' + viewName);
            return;
        }

        const previousView = currentView;
        currentView = viewName;  // 提前更新，防止递归重入

        // 更新视图显示
        document.querySelectorAll('.view').forEach(function (v) {
            v.classList.toggle('active', v.dataset.view === viewName);
        });

        // 任务视图：触发 workbench 初始化
        if (viewName === 'tasks' && typeof ns.enterFocusMode === 'function') {
            try { ns.enterFocusMode(); } catch (e) { console.error('[视图] enterFocusMode 失败:', e); }
        }

        // 离开任务视图：退出 workbench
        if (previousView === 'tasks' && typeof ns.exitFocusMode === 'function') {
            try { ns.exitFocusMode(); } catch (e) { console.error('[视图] exitFocusMode 失败:', e); }
        }

        console.log('[视图] 切换到 ' + CRUMB_MAP[viewName]);
    }

    function getCurrentView() {
        return currentView;
    }

    ns.switchView = switchView;
    ns.getCurrentView = getCurrentView;
})(window.DevHome);
