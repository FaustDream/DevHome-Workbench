/**
 * DevHome Workbench - 任务-笔记关联逻辑
 * 从 workbench.js 拆分，职责：笔记关联/解绑/查看/转换到任务
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var escapeHtml = ns.escapeHtml;

    /* ===== 任务-笔记关联 ===== */

    /** 将笔记关联到任务 */
    ns.linkNoteToTask = function (taskId, noteId) {
        var config = ns.getWorkbenchState();
        var found = false;
        ns.forEachQuadrant(function (q) {
            var tasks = ns.getQuadrantTasks(q);
            tasks.forEach(function (t) {
                if (t.id === taskId) {
                    if (!t.noteIds) t.noteIds = [];
                    if (t.noteIds.indexOf(noteId) === -1) {
                        t.noteIds.push(noteId);
                        found = true;
                    }
                }
            });
        });
        if (found) {
            ns.saveWorkbenchState({ quadrants: config.quadrants });
            state.workbench = ns.getWorkbenchState();
            ns.renderQuadrantBoard();
            console.log('[编辑] 笔记 ' + noteId + ' 关联到任务 ' + taskId);
        }
    };

    /** 从任务取消关联笔记 */
    ns.unlinkNoteFromTask = function (taskId, noteId) {
        var config = ns.getWorkbenchState();
        ns.forEachQuadrant(function (q) {
            var tasks = ns.getQuadrantTasks(q);
            tasks.forEach(function (t) {
                if (t.id === taskId && t.noteIds) {
                    t.noteIds = t.noteIds.filter(function (id) { return id !== noteId; });
                }
            });
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
        console.log('[编辑] 笔记 ' + noteId + ' 取消关联任务 ' + taskId);
    };

    /** 静默解绑（不触发 renderQuadrantBoard） */
    ns.unlinkNoteFromTaskSilent = function (taskId, noteId) {
        var config = ns.getWorkbenchState();
        ns.forEachQuadrant(function (q) {
            var tasks = ns.getQuadrantTasks(q);
            tasks.forEach(function (t) {
                if (t.id === taskId && t.noteIds) {
                    t.noteIds = t.noteIds.filter(function (id) { return id !== noteId; });
                }
            });
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
    };

    /** 将笔记直接转为四象限任务（支持指定象限和截止时间） */
    ns.convertNoteToTask = function (noteId, quadrant, plannedAt) {
        quadrant = quadrant || 'q2';
        var note = (state.notes || []).find(function (n) { return n.id === noteId; });
        if (!note) return;
        var title = note.title || '未命名笔记';
        // 提取笔记纯文本内容作为任务描述（前500字）
        var plainContent = (note.content || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
        var config = ns.getWorkbenchState();
        if (!config.quadrants[quadrant]) config.quadrants[quadrant] = { tasks: [] };
        config.quadrants[quadrant].tasks.push({
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            title: title,
            status: 'active',
            noteIds: [noteId],
            content: plainContent,
            plannedAt: plannedAt || null,
            createdAt: Date.now()
        });
        ns.saveWorkbenchState({ quadrants: config.quadrants });
        state.workbench = ns.getWorkbenchState();
        ns.renderQuadrantBoard();
        console.log('[编辑] 笔记转任务: ' + noteId + ' → ' + quadrant + (plannedAt ? ' 截止' + new Date(plannedAt).toISOString().slice(0, 16) : '') + ' 含' + plainContent.length + '字描述');
    };

    /** 获取任务的关联笔记列表（去重） */
    ns.getTaskLinkedNotes = function (taskId) {
        var config = ns.getWorkbenchState();
        var noteIds = [];
        ns.forEachQuadrant(function (q) {
            var tasks = ns.getQuadrantTasks(q);
            var task = tasks.find(function (t) { return t.id === taskId; });
            if (task && task.noteIds) noteIds = task.noteIds;
        });
        // 去重
        var uniqueIds = [];
        var seen = {};
        noteIds.forEach(function (id) {
            if (!seen[id]) { seen[id] = true; uniqueIds.push(id); }
        });
        return (state.notes || []).filter(function (n) { return uniqueIds.indexOf(n.id) !== -1; });
    };

    /** 显示"关联笔记"选择弹窗 */
    ns.showTaskLinkNotesPopup = function (taskId) {
        var allNotes = state.notes || [];
        var linkedNotes = ns.getTaskLinkedNotes(taskId);
        var linkedIds = linkedNotes.map(function (n) { return n.id; });

        var hasNotes = allNotes.length > 0;
        var bodyHtml = hasNotes
            ? allNotes.map(function (note) {
                var isLinked = linkedIds.indexOf(note.id) !== -1;
                var title = note.title || '无标题';
                if (title.length > 25) title = title.slice(0, 25) + '...';
                return '<label class="wb-link-note-item">' +
                    '<input type="checkbox" value="' + escapeHtml(note.id) + '" ' + (isLinked ? 'checked' : '') + '>' +
                    '<span>' + title + '</span></label>';
            }).join('')
            : '<p style="text-align:center;color:var(--color-text-tertiary);padding:16px 0;">暂无笔记，请先在主工作区创建笔记</p>';

        // 创建自定义弹窗
        var overlay = document.createElement('div');
        overlay.className = 'wb-link-popup-overlay';
        overlay.innerHTML = '<div class="wb-link-popup">' +
            '<h3>关联笔记到任务</h3>' +
            '<div class="wb-link-popup-body">' + bodyHtml + '</div>' +
            '<div class="wb-link-popup-footer">' +
                '<button class="wb-link-popup-cancel">取消</button>' +
                '<button class="wb-link-popup-save">保存</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);

        // 点击遮罩关闭
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        // 取消按钮
        overlay.querySelector('.wb-link-popup-cancel').addEventListener('click', function () { overlay.remove(); });
        // 保存按钮
        overlay.querySelector('.wb-link-popup-save').addEventListener('click', function () {
            var checked = overlay.querySelectorAll('.wb-link-note-item input:checked');
            var selectedIds = Array.from(checked).map(function (cb) { return cb.value; });
            // 先取消所有旧关联
            linkedIds.forEach(function (nid) { ns.unlinkNoteFromTaskSilent(taskId, nid); });
            // 建立新关联
            selectedIds.forEach(function (nid) { ns.linkNoteToTask(taskId, nid); });
            overlay.remove();
            console.log('[编辑] 任务 ' + taskId + ' 关联笔记 ' + selectedIds.length + ' 篇');
        });
    };

    /** 查看已关联笔记，支持逐条解绑 */
    ns.showTaskLinkedNotesView = function (taskId) {
        var linkedNotes = ns.getTaskLinkedNotes(taskId);
        var bodyHtml = '';

        if (linkedNotes.length === 0) {
            bodyHtml = '<p class="wb-link-view-empty">暂无关联笔记</p>';
        } else {
            bodyHtml = linkedNotes.map(function (note) {
                var title = note.title || '无标题';
                var preview = (note.content || '').replace(/<[^>]*>/g, '').trim().slice(0, 80);
                if (preview.length >= 80) preview += '...';
                var time = note.updatedAt
                    ? new Date(note.updatedAt).toLocaleDateString('zh-CN')
                    : (note.createdAt ? new Date(note.createdAt).toLocaleDateString('zh-CN') : '');

                return '<div class="wb-link-view-item" data-note-id="' + escapeHtml(note.id) + '">' +
                    '<div class="wb-link-view-info">' +
                        '<div class="wb-link-view-title">' + escapeHtml(title) + '</div>' +
                        '<div class="wb-link-view-preview">' + escapeHtml(preview || '(无内容)') + '</div>' +
                        (time ? '<div class="wb-link-view-time">' + time + '</div>' : '') +
                    '</div>' +
                    '<button class="wb-link-view-unlink" data-note-id="' + escapeHtml(note.id) + '" title="解绑此笔记">解绑</button>' +
                '</div>';
            }).join('');
        }

        var overlay = document.createElement('div');
        overlay.className = 'wb-link-popup-overlay';
        overlay.innerHTML = '<div class="wb-link-popup wb-link-view-popup">' +
            '<h3>已关联笔记（' + linkedNotes.length + ' 篇）</h3>' +
            '<div class="wb-link-popup-body">' + bodyHtml + '</div>' +
            '<div class="wb-link-popup-footer">' +
                '<button class="wb-link-popup-cancel">关闭</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);

        // 关闭时刷新四象限面板（更新 📎 徽章）
        var closeFn = function () {
            overlay.remove();
            ns.renderQuadrantBoard();
        };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeFn(); });
        overlay.querySelector('.wb-link-popup-cancel').addEventListener('click', closeFn);

        // 解绑按钮事件
        overlay.querySelectorAll('.wb-link-view-unlink').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var noteId = btn.dataset.noteId;
                var noteItem = btn.closest('.wb-link-view-item');
                var noteTitle = noteItem ? (noteItem.querySelector('.wb-link-view-title') || {}).textContent || '此笔记' : '此笔记';

                // 二次确认
                var confirmOverlay = document.createElement('div');
                confirmOverlay.className = 'wb-link-popup-overlay';
                confirmOverlay.style.zIndex = '3200';
                confirmOverlay.innerHTML = '<div class="wb-link-popup" style="max-width:280px;">' +
                    '<h3>确认解绑</h3>' +
                    '<p style="padding:12px 16px;font-size:13px;color:var(--color-text-secondary);margin:0;">确定要解除与「' + noteTitle.slice(0, 20) + '」的关联吗？<br><small style="color:var(--color-text-tertiary);">仅移除关联，不删除笔记</small></p>' +
                    '<div class="wb-link-popup-footer">' +
                        '<button class="wb-link-popup-cancel">取消</button>' +
                        '<button class="wb-link-popup-save" style="background:var(--color-danger);">确认解绑</button>' +
                    '</div>' +
                '</div>';
                document.body.appendChild(confirmOverlay);

                confirmOverlay.addEventListener('click', function (ce) { if (ce.target === confirmOverlay) confirmOverlay.remove(); });
                confirmOverlay.querySelector('.wb-link-popup-cancel').addEventListener('click', function () { confirmOverlay.remove(); });
                confirmOverlay.querySelector('.wb-link-popup-save').addEventListener('click', function () {
                    // 使用静默解绑（不触发 renderQuadrantBoard 重建 DOM）
                    ns.unlinkNoteFromTaskSilent(taskId, noteId);
                    confirmOverlay.remove();
                    // 安全移除条目（先检查父节点，防止 DOM 已被移走）
                    if (noteItem && noteItem.parentNode) noteItem.remove();
                    // 更新标题计数
                    var remaining = overlay.querySelectorAll('.wb-link-view-item').length;
                    var titleEl = overlay.querySelector('h3');
                    if (titleEl) titleEl.textContent = '已关联笔记（' + remaining + ' 篇）';
                    if (remaining === 0) {
                        overlay.querySelector('.wb-link-popup-body').innerHTML = '<p class="wb-link-view-empty">暂无关联笔记</p>';
                    }
                    console.log('[编辑] 从任务 ' + taskId + ' 解绑笔记 ' + noteId);
                });
            });
        });
    };

})(window.DevHome);
