/**
 * 分类按钮行事件模块
 * 从 events.js 拆分，负责分类按钮点击、新增、删除、拖拽排序事件
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindCategoryEvents = function () {
        var state = ns.state;
        var dom = ns.dom;

        if (dom.catRow) {
            dom.catRow.addEventListener('click', function (e) {
                var addBtn = e.target.closest('.cat-add-btn');
                if (addBtn) { e.preventDefault(); e.stopPropagation(); ns.addNewPage(); ns.resetCategoryDragState(); state.categoryEditMode = true; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', true); return; }
                var deleteBtn = e.target.closest('.cat-delete-btn');
                if (deleteBtn) { e.preventDefault(); e.stopPropagation(); var pi = parseInt(deleteBtn.dataset.catDelete, 10); if (!isNaN(pi)) ns.deleteCategoryByIndex(pi); return; }
                var btn = e.target.closest('.cat-btn');
                if (!btn) return;
                e.preventDefault(); e.stopPropagation();
                if (state.preventNextCategoryClick) { state.preventNextCategoryClick = false; return; }
                var pageIdx = parseInt(btn.dataset.page, 10);
                if (!isNaN(pageIdx) && pageIdx !== state.currentPage) ns.changePageWithAnimation(pageIdx);
            });
            dom.catRow.addEventListener('mousedown', function (e) {
                var btn = e.target.closest('.cat-btn');
                if (!btn || e.target.closest('.cat-delete-btn') || e.button !== 0) return;
                ns.prepareCategoryPointer(btn, e.clientX, e.clientY);
                document.addEventListener('mousemove', ns.doCategoryDrag);
                document.addEventListener('mouseup', ns.stopCategoryDrag);
            });
        }
    };

})(window.DevHome);
