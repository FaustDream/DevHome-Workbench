/**
 * 四象限任务面板事件模块
 * 负责任务勾选完成、更多操作菜单、添加任务、浮动右键菜单操作
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindQuadrantEvents = function () {
        var quadrantNav = document.getElementById('wbQuadrantNav');
        if (quadrantNav) {
            quadrantNav.addEventListener('click', function (e) {
                var check = e.target.closest('.wb-task-check');
                if (check) {
                    e.stopPropagation();
                    ns.completeQuadrantTask(check.dataset.quadrant, check.dataset.taskId);
                    return;
                }
                var moreBtn = e.target.closest('.wb-task-more-btn');
                if (moreBtn) {
                    e.stopPropagation();
                    ns.showTaskContextMenu(moreBtn.dataset.taskId, moreBtn.dataset.quadrant, e);
                    return;
                }
                var addBtn = e.target.closest('.wb-quadrant-group-add');
                if (addBtn) {
                    e.stopPropagation();
                    ns.showQuadrantInput(addBtn.dataset.quadrant, addBtn);
                    console.log('[交互] 点击象限添加任务 ' + addBtn.dataset.quadrant);
                    return;
                }
            });
        }

        // 浮动菜单操作（在 document 上委托）
        document.addEventListener('click', function (e) {
            var menuItem = e.target.closest('.wb-task-context-menu button');
            if (!menuItem) return;
            e.stopPropagation();
            var action = menuItem.dataset.action;
            var taskId = menuItem.dataset.taskId;
            var quadrant = menuItem.dataset.quadrant;

            if (action === 'move') {
                ns.changeTaskQuadrant(taskId, menuItem.dataset.from, menuItem.dataset.to);
                ns.hideTaskContextMenu();
            } else if (action === 'edit') {
                ns.hideTaskContextMenu();
                ns.editQuadrantTask(taskId, quadrant);
            } else if (action === 'set-time') {
                ns.hideTaskContextMenu();
                ns.setTaskTime(taskId, quadrant);
            } else if (action === 'delete') {
                ns.cancelQuadrantTask(quadrant, taskId);
                ns.hideTaskContextMenu();
            } else if (action === 'link-notes') {
                ns.showTaskLinkNotesPopup(taskId);
                ns.hideTaskContextMenu();
            } else if (action === 'view-linked-notes') {
                ns.showTaskLinkedNotesView(taskId);
                ns.hideTaskContextMenu();
            }
        });
    };

})(window.DevHome);
