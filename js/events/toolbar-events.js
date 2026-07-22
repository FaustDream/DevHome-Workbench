/**
 * 工具栏按钮事件模块
 * 负责退出专注模式、清空任务、活跃/全部过滤、侧边栏折叠、新建笔记/笔记本/标签
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindToolbarEvents = function () {
        const state = ns.state;
        const dom = ns.dom;

        if (dom.devhomeBackHome) dom.devhomeBackHome.addEventListener('click', ns.showDailyMode);

        // 清空历史按钮
        const taskClearBtn = document.getElementById('wbTaskClearBtn');
        if (taskClearBtn) taskClearBtn.addEventListener('click', function () { ns.clearCompletedTasks(); });

        // 活跃/全部切换
        const taskFilterBtn = document.getElementById('wbTaskFilterBtn');
        if (taskFilterBtn) taskFilterBtn.addEventListener('click', function () {
            ns.toggleQuadrantFilter();
            console.log('[交互] 过滤切换 ' + (state._quadrantFilter || 'active'));
        });

        // 侧边栏折叠/展开按钮
        const quadToggleBtn = document.getElementById('wbQuadrantToggle');
        if (quadToggleBtn) quadToggleBtn.addEventListener('click', function () { ns.toggleQuadrantSidebar(); });

        // 右侧栏已在 v5 重构中移除，不再监听折叠按钮

        // 新建笔记
        const wbNotesAddBtn = document.getElementById('wbNotesAddBtn');
        if (wbNotesAddBtn) {
            wbNotesAddBtn.addEventListener('click', function () {
                ns.createNote({ title: '新笔记', content: '', type: 'note', tags: [] }).then(function (note) {
                    ns.openNoteEditor(note);
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                    console.log('[交互] 工具栏 新建笔记');
                });
            });
        }

        // 空状态引导卡片「新建笔记」按钮
        const wbNotesEmptyCreateBtn = document.getElementById('wbNotesEmptyCreateBtn');
        if (wbNotesEmptyCreateBtn) {
            wbNotesEmptyCreateBtn.addEventListener('click', function () {
                ns.createNote({ title: '新笔记', content: '', type: 'note', tags: [] }).then(function (note) {
                    ns.openNoteEditor(note);
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                    console.log('[交互] 空状态 新建笔记');
                });
            });
        }

        // 侧栏顶部「新建笔记」按钮
        const wbSidebarNewBtn = document.getElementById('wbSidebarNewBtn');
        if (wbSidebarNewBtn) {
            wbSidebarNewBtn.addEventListener('click', function () {
                ns.createNote({ title: '新笔记', content: '', type: 'note', tags: [] }).then(function (note) {
                    ns.openNoteEditor(note);
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                    console.log('[交互] 侧栏 新建笔记');
                });
            });
        }

        // 新建笔记本
        const wbNotebookAddBtn = document.getElementById('wbNotebookAddBtn');
        if (wbNotebookAddBtn) {
            if (wbNotebookAddBtn._nbEventBound) { console.log('[诊断] 新建笔记本按钮已绑定，跳过'); }
            wbNotebookAddBtn._nbEventBound = true;
            wbNotebookAddBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                console.log('[交互] 工具栏 新建笔记本 (click count check)');
                ns.showPrompt('请输入笔记本名称：', { title: '新建笔记本' }).then(function (name) {
                    if (name && name.trim()) {
                        ns.createNotebook(name.trim()).then(function () { ns.renderNotebookDropdown(); });
                    }
                });
            });
        }

        // 新建标签
        const wbTagAddBtn = document.getElementById('wbTagAddBtn');
        if (wbTagAddBtn) {
            wbTagAddBtn.addEventListener('click', function () {
                if (typeof ns.startInlineCustomFilter === 'function') {
                    ns.startInlineCustomFilter();
                    console.log('[交互] 工具栏 新建标签');
                }
            });
        }
    };

})(window.DevHome);
