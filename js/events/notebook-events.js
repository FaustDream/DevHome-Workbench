/**
 * 笔记本下拉菜单 + 长按上下文菜单事件模块
 * 从 events.js 拆分，负责笔记本选择、创建、重命名、删除事件
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindNotebookEvents = function () {
        var state = ns.state;
        var dom = ns.dom;

        if (dom.wbNotebookDropdownBtn) {
            // 点击下拉按钮 → 展开/收起菜单
            dom.wbNotebookDropdownBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var menu = dom.wbNotebookDropdownMenu;
                if (!menu) return;
                var isOpen = menu.style.display === 'block';
                if (isOpen) {
                    menu.style.display = 'none';
                } else {
                    ns.renderNotebookDropdown();
                    var btnRect = dom.wbNotebookDropdownBtn.getBoundingClientRect();
                    menu.style.position = 'fixed';
                    menu.style.top = (btnRect.bottom + 4) + 'px';
                    menu.style.left = btnRect.left + 'px';
                    menu.style.zIndex = '3100';
                    menu.style.display = 'block';
                }
                console.log('[交互] 笔记本下拉 ' + (isOpen ? '关闭' : '打开'));
            });
            // 菜单项点击 → 切换笔记本 + 长按菜单
            if (dom.wbNotebookDropdownMenu) {
                dom.wbNotebookDropdownMenu.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var item = e.target.closest('.wb-notebook-dropdown-item');
                    if (!item) return;
                    var notebookId = item.dataset.notebookId || null;
                    state._notebookFilter = notebookId;
                    if (notebookId) state._lastNotebookId = notebookId;
                    // 持久化
                    ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG).then(function (config) {
                        config.lastNotebookId = notebookId;
                        ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                    });
                    ns.renderNotebookDropdown();
                    dom.wbNotebookDropdownMenu.style.display = 'none';
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                    // 如果当前编辑的笔记不属于新笔记本，关闭编辑器
                    if (notebookId && state.currentNote && state.currentNote.notebookId !== notebookId) {
                        ns.closeNoteEditor();
                        console.log('[交互] 笔记本筛选 关闭编辑器（笔记不在本笔记本）');
                    }
                    console.log('[交互] 笔记本筛选 ' + (notebookId || '全部'));
                });
                // 长按 → 重命名/删除
                var nbMenuLongPress = null;
                dom.wbNotebookDropdownMenu.addEventListener('pointerdown', function (e) {
                    var item = e.target.closest('.wb-notebook-dropdown-item:not([data-notebook-id=""])');
                    if (!item) return;
                    nbMenuLongPress = setTimeout(function () {
                        var nbId = item.dataset.notebookId;
                        var nb = state.notebooks.find(function (n) { return n.id === nbId; });
                        if (!nb) return;
                        dom.wbNotebookDropdownMenu.style.display = 'none';
                        // 弹出操作菜单
                        var ctxMenu = document.getElementById('wbNotebookCtxMenu');
                        if (!ctxMenu) {
                            ctxMenu = document.createElement('div');
                            ctxMenu.id = 'wbNotebookCtxMenu';
                            ctxMenu.style.cssText = 'position:fixed;background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:8px;padding:4px;z-index:3100;box-shadow:var(--shadow-lg);min-width:140px;';
                            document.body.appendChild(ctxMenu);
                        }
                        ctxMenu.innerHTML = [
                            { label: '重命名', action: function () {
                                ns.showPrompt('重命名笔记本：', { title: '重命名笔记本', defaultValue: nb.name }).then(function (newName) {
                                    if (newName && newName.trim() && newName.trim() !== nb.name) {
                                        ns.renameNotebook(nbId, newName.trim());
                                        ns.renderNotebookDropdown();
                                    }
                                });
                            }},
                            { label: '删除', action: function () {
                                ns.showConfirm('删除笔记本「' + nb.name + '」，笔记将移回未分类。确定？', { title: '删除笔记本' }).then(function (ok) {
                                    if (ok) { ns.deleteNotebook(nbId); ns.renderNotebookDropdown(); }
                                });
                            }}
                        ].map(function (a) {
                            return '<div class="wb-menu-item" style="padding:8px 12px;cursor:pointer;border-radius:4px;font-size:13px;color:var(--color-text);">' + ns.escapeHtml(a.label) + '</div>';
                        }).join('');
                        // 定位菜单
                        var ir = item.getBoundingClientRect();
                        ctxMenu.style.top = (ir.top) + 'px';
                        ctxMenu.style.left = (ir.right + 4) + 'px';
                        ctxMenu.style.display = 'block';
                        // 绑定菜单操作
                        var items = ctxMenu.querySelectorAll('.wb-menu-item');
                        items[0].addEventListener('click', function () { ctxMenu.style.display = 'none'; });
                        items[1].addEventListener('click', function () { ctxMenu.style.display = 'none'; });
                        console.log('[交互] 笔记本长按 ' + nb.name);
                    }, 800);
                });
                dom.wbNotebookDropdownMenu.addEventListener('pointerup', function () {
                    if (nbMenuLongPress) { clearTimeout(nbMenuLongPress); nbMenuLongPress = null; }
                });
            }
        }

        // 点击外部关闭下拉菜单
        document.addEventListener('click', function (e) {
            var nbMenu = dom.wbNotebookDropdownMenu;
            if (nbMenu && nbMenu.style.display === 'block' &&
                !e.target.closest('#wbNotebookDropdown') && !e.target.closest('#wbNotebookCtxMenu')) {
                nbMenu.style.display = 'none';
            }
            var ctxMenu = document.getElementById('wbNotebookCtxMenu');
            if (ctxMenu && ctxMenu.style.display === 'block' && !e.target.closest('#wbNotebookCtxMenu')) {
                ctxMenu.style.display = 'none';
            }
        });
    };

})(window.DevHome);
