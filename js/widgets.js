/**
 * 左侧小部件面板：快速操作、项目看板、系统状态
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;

    /* ===== 项目看板：从四象限任务中提取关键截止日期 ===== */
    function renderKanban() {
        var el = document.getElementById('dhKanbanList');
        if (!el) return;

        // 示例项目数据（后续可从 workbench 状态读取）
        var projects = [];
        var wb = state.workbench;
        if (wb && wb.quadrants) {
            var q1 = wb.quadrants.q1 ? wb.quadrants.q1.tasks : [];
            var q2 = wb.quadrants.q2 ? wb.quadrants.q2.tasks : [];
            var allTasks = q1.concat(q2).filter(function (t) { return !t.completed; });
            // 取前 3 个高优先级任务作为项目看板项
            allTasks.slice(0, 3).forEach(function (t) {
                projects.push({
                    name: t.title || '未命名任务',
                    progress: Math.floor(Math.random() * 60) + 30, // 占位进度
                    deadline: t.dueDate ? formatDeadline(t.dueDate) : '无截止日期'
                });
            });
        }

        // 默认占位数据，确保首次打开不空白
        if (projects.length === 0) {
            projects = [
                { name: '首页重构收尾', progress: 75, deadline: '7月8日' },
                { name: 'API 文档整理', progress: 40, deadline: '7月10日' },
                { name: '周报汇总', progress: 20, deadline: '7月7日' }
            ];
        }

        el.innerHTML = projects.map(function (p) {
            return '<div class="dh-kanban-item">'
                + '<div class="dh-kanban-head"><span class="dh-kanban-name">' + escapeHtml(p.name) + '</span><span class="dh-kanban-deadline">' + escapeHtml(p.deadline) + '</span></div>'
                + '<div class="dh-progress-track"><div class="dh-progress-bar" style="width:' + p.progress + '%;"></div></div>'
                + '<div class="dh-kanban-meta">进度 ' + p.progress + '%</div>'
                + '</div>';
        }).join('');
    }

    function formatDeadline(dateStr) {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ===== 系统状态：内存、存储、任务数 ===== */
    function renderSystemStatus() {
        var el = document.getElementById('dhSystemStatus');
        if (!el) return;

        var mem = '--';
        if (performance && performance.memory) {
            var usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            mem = usedMB + ' MB';
        }

        var taskCount = 0;
        if (state.workbench && state.workbench.quadrants) {
            ['q1', 'q2', 'q3', 'q4'].forEach(function (q) {
                if (state.workbench.quadrants[q] && state.workbench.quadrants[q].tasks) {
                    taskCount += state.workbench.quadrants[q].tasks.filter(function (t) { return !t.completed; }).length;
                }
            });
        }

        el.innerHTML = ''
            + '<div class="dh-status-row"><span class="dh-status-label">内存占用</span><span class="dh-status-value">' + mem + '</span></div>'
            + '<div class="dh-status-row"><span class="dh-status-label">待办任务</span><span class="dh-status-value">' + taskCount + '</span></div>'
            + '<div class="dh-status-row"><span class="dh-status-label">磁贴数量</span><span class="dh-status-value">' + (state.totalPages || 1) + ' 页</span></div>'
            + '<div class="dh-status-row"><span class="dh-status-label">运行状态</span><span class="dh-status-dot"></span><span class="dh-status-value" style="color:var(--color-accent)">正常</span></div>';
    }

    /* ===== 快速操作按钮事件 ===== */
    function bindQuickActions() {
        var container = document.querySelector('.dh-quick-actions');
        if (!container) return;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-dh-action]');
            if (!btn) return;
            var action = btn.dataset.dhAction;
            switch (action) {
                case 'calendar':
                    // 进入工作台并打开日历
                    ns.enterFocusMode();
                    setTimeout(function () {
                        // 工作台已有日历视图，这里仅进入工作台即可
                        console.log('[交互] 快速操作：打开日历');
                    }, 200);
                    break;
                case 'notes':
                    ns.enterFocusMode();
                    console.log('[交互] 快速操作：打开便签');
                    break;
                case 'editor':
                    // 打开 VS Code 或一个代码编辑器链接
                    window.open('https://vscode.dev/', '_blank', 'noopener,noreferrer');
                    console.log('[交互] 快速操作：打开代码编辑器');
                    break;
            }
        });
    }

    /* ===== 初始化 ===== */
    ns.initWidgets = function () {
        renderKanban();
        renderSystemStatus();
        bindQuickActions();
        // 每 5 秒刷新系统状态
        setInterval(renderSystemStatus, 5000);
        console.log('[小部件] 初始化完成');
    };

})(window.DevHome);
