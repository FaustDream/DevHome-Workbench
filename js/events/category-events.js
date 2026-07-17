/**
 * 分类按钮行事件模块
 * 从 events.js 拆分，负责分类按钮点击、新增、删除、拖拽排序事件
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindCategoryEvents = function () {
        const state = ns.state;
        const dom = ns.dom;

        if (dom.catRow) {
            dom.catRow.addEventListener('click', function (e) {
                const addBtn = e.target.closest('.cat-add-btn');
                if (addBtn) { e.preventDefault(); e.stopPropagation(); ns.addNewPage(); ns.resetCategoryDragState(); state.categoryEditMode = true; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', true); return; }
                const deleteBtn = e.target.closest('.cat-delete-btn');
                if (deleteBtn) { e.preventDefault(); e.stopPropagation(); const pi = parseInt(deleteBtn.dataset.catDelete, 10); if (!isNaN(pi)) ns.deleteCategoryByIndex(pi); return; }
                const btn = e.target.closest('.cat-btn');
                if (!btn) return;
                e.preventDefault(); e.stopPropagation();
                if (state.preventNextCategoryClick) { state.preventNextCategoryClick = false; return; }
                const pageIdx = parseInt(btn.dataset.page, 10);
                if (!isNaN(pageIdx) && pageIdx !== state.currentPage) ns.changePageWithAnimation(pageIdx);
            });

            // 双击分类按钮进行重命名
            dom.catRow.addEventListener('dblclick', function (e) {
                const btn = e.target.closest('.cat-btn');
                if (!btn || e.target.closest('.cat-delete-btn')) return;
                e.preventDefault(); e.stopPropagation();
                const pageIdx = parseInt(btn.dataset.page, 10);
                if (isNaN(pageIdx)) return;
                const curName = state.pageNames[pageIdx] || '';
                ns.showPrompt('输入新的分类名称', { title: '重命名分类', defaultValue: curName }).then(function (newName) {
                    if (newName && newName !== curName) { ns.tileManager.renamePageAt(pageIdx, newName); }
                });
                console.log('[交互] 双击分类 → 重命名 "' + curName + '"');
            });

            dom.catRow.addEventListener('mousedown', function (e) {
                const btn = e.target.closest('.cat-btn');
                if (!btn || e.target.closest('.cat-delete-btn') || e.button !== 0) return;
                ns.prepareCategoryPointer(btn, e.clientX, e.clientY);
                document.addEventListener('mousemove', ns.doCategoryDrag);
                document.addEventListener('mouseup', ns.stopCategoryDrag);
            });
        }
    };

})(window.DevHome);
