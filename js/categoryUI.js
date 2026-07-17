/**
 * DevHome Workbench - 分类 UI
 * 分类按钮行、悬浮弹窗、页面切换动画、滚轮翻页、分类拖拽重排。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const storage = ns.storage;
    const $$ = ns.$$;
    const escapeHtml = ns.escapeHtml;
    const tileManager = ns.tileManager;

    /* ===== 分类按钮行 ===== */
    const timesSvg = ns.icon('x', 'dh-icon--sm');
    const plusSvg = ns.icon('plus', 'dh-icon--sm');
    function renderCatRow() {
        if (!dom.catRow) return;
        const buttons = state.pageNames.map(function (name, idx) {
            const cls = idx === state.currentPage ? 'cat-btn active' : 'cat-btn';
            return '<button class="' + cls + '" data-page="' + idx + '" type="button">' +
                '<span class="cat-btn-label">' + escapeHtml(name) + '</span>' +
                '<span class="cat-delete-btn" role="button" tabindex="0" data-cat-delete="' + idx + '" aria-label="删除分类 ' + escapeHtml(name) + '">' +
                timesSvg + '</span></button>';
        }).join('');
        dom.catRow.innerHTML = buttons + '<button class="cat-add-btn" type="button" data-cat-add="true" title="新建分类" aria-label="新建分类">' + plusSvg + '</button>';
        dom.catRow.classList.toggle('category-edit-mode', state.categoryEditMode);
    }

    ns.applyCategoryButtonMode = function (enabled, save) {
        if (save !== false) storage.set('cat_row', enabled);
        if (dom.catRowText) dom.catRowText.textContent = enabled ? '分类按钮：开' : '分类按钮：关';
        if (enabled) renderCatRow();
        if (dom.catRow) dom.catRow.classList.toggle('visible', enabled);
        updateCatRowActive();
    };

    function updateCatRowActive() {
        if (!dom.catRow || !dom.catRow.classList.contains('visible')) return;
        const btns = dom.catRow.querySelectorAll('.cat-btn');
        btns.forEach(function (btn, idx) { btn.classList.toggle('active', idx === state.currentPage); });
    }

    ns.refreshCatRowIfVisible = function () {
        renderCatRow();
    };

    /* ===== 页面切换（带动画） ===== */
    ns.changePageWithAnimation = function (newPage, t0, targetName) {
        if (newPage < 0 || newPage >= state.totalPages) {
            console.warn('[分类切换] 越界! pageIdx:', newPage, 'totalPages:', state.totalPages);
            return;
        }
        if (newPage === state.currentPage) {
            console.log('[分类切换] 跳过 - 已在当前分类:', (targetName || state.pageNames[newPage]), '耗时:', (performance.now() - (t0 || 0)).toFixed(1) + 'ms');
            return;
        }
        tileManager.save();
        state.currentPage = newPage;
        tileManager.updateCurrentTiles();
        if (storage.get('category_memory', false)) storage.set('last_page', newPage);
        renderCatRow();
        ns.renderTiles();
        console.log('[分类切换] 成功切换到:', state.pageNames[newPage], '(pageIdx:', newPage, ') 耗时:', (performance.now() - (t0 || 0)).toFixed(1) + 'ms');
    };

    /* ===== 滚轮翻页 ===== */
    let wheelAccumulator = 0;
    const WHEEL_THRESHOLD = 25;
    const WHEEL_COOLDOWN = 350;
    let lastWheelPageTime = 0;

    ns.handleWheelScroll = function (e) {
        if (state.pageTransition) return;
        e.preventDefault();
        const delta = e.deltaY || e.deltaX || 0;
        if (delta === 0) return;
        if ((delta > 0 && wheelAccumulator < 0) || (delta < 0 && wheelAccumulator > 0)) wheelAccumulator = 0;
        wheelAccumulator += delta;
        const now = Date.now();
        if (now - lastWheelPageTime < WHEEL_COOLDOWN) return;
        if (wheelAccumulator > WHEEL_THRESHOLD) {
            wheelAccumulator = 0;
            if (state.currentPage < state.totalPages - 1) { lastWheelPageTime = now; ns.changePageWithAnimation(state.currentPage + 1); }
        } else if (wheelAccumulator < -WHEEL_THRESHOLD) {
            wheelAccumulator = 0;
            if (state.currentPage > 0) { lastWheelPageTime = now; ns.changePageWithAnimation(state.currentPage - 1); }
        }
    };

    ns.addNewPage = function () { tileManager.addNewPage(); ns.renderTiles(); ns.refreshCatRowIfVisible(); };
    ns.removeCurrentPage = function () {
        if (state.totalPages <= 1) { ns.showToast('至少需要保留一个分类！', 'error'); return; }
        ns.deleteCategoryByIndex(state.currentPage);
    };

    /* ===== 分类拖拽 ===== */
    const CATEGORY_LONG_PRESS_MS = 200;

    function setCategoryEditMode(enabled) {
        state.categoryEditMode = enabled;
        if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', enabled);
    }

    function clearCategoryLongPressTimer() {
        if (state.categoryLongPressTimer) { clearTimeout(state.categoryLongPressTimer); state.categoryLongPressTimer = null; }
    }

    ns.resetCategoryDragState = function () {
        clearCategoryLongPressTimer(); state.categoryDragging = null; state.categoryDragOver = null;
        state.categoryDragReady = false; state.preventNextCategoryClick = false;
        if (dom.catRow) {
            dom.catRow.classList.remove('category-drag-active');
            dom.catRow.querySelectorAll('.cat-btn').forEach(function (btn) {
                btn.classList.remove('dragging', 'drag-over');
                btn.style.position = ''; btn.style.zIndex = ''; btn.style.left = ''; btn.style.top = '';
                btn.style.width = ''; btn.style.height = ''; btn.style.pointerEvents = '';
            });
        }
    };

    ns.prepareCategoryPointer = function (btn, clientX, clientY) {
        clearCategoryLongPressTimer();
        state.categoryDragMoved = false; state.categoryDragReady = false; state.categoryDragging = btn;
        state.dragStartX = clientX; state.dragStartY = clientY;
        const rect = btn.getBoundingClientRect();
        state.dragOffsetX = clientX - rect.left; state.dragOffsetY = clientY - rect.top;
        state.categoryLongPressTimer = setTimeout(function () {
            if (state.categoryDragging === btn && !state.categoryDragMoved) {
                state.categoryDragReady = true; state.preventNextCategoryClick = true; setCategoryEditMode(true);
            }
        }, CATEGORY_LONG_PRESS_MS);
    };

    function activateCategoryDrag(clientX, clientY) {
        if (!state.categoryDragging || state.categoryDragMoved) return;
        state.categoryDragMoved = true; state.preventNextCategoryClick = true; setCategoryEditMode(true);
        if (dom.catRow) dom.catRow.classList.add('category-drag-active');
        const btn = state.categoryDragging, rect = btn.getBoundingClientRect();
        btn.style.width = rect.width + 'px'; btn.style.height = rect.height + 'px';
        btn.style.left = rect.left + 'px'; btn.style.top = rect.top + 'px';
        btn.style.position = 'fixed'; btn.style.zIndex = '1000'; btn.style.pointerEvents = 'none';
        btn.classList.add('dragging');
        moveCategoryDrag(clientX, clientY);
    }

    function moveCategoryDrag(clientX, clientY) {
        const btn = state.categoryDragging; if (!btn) return;
        btn.style.left = (clientX - state.dragOffsetX) + 'px';
        btn.style.top = (clientY - state.dragOffsetY) + 'px';
    }

    function updateCategoryDragOver(clientX, clientY) {
        const buttons = $$('.cat-btn:not(.dragging)'); let bestBtn = null, bestDist = Infinity;
        buttons.forEach(function (btn) {
            const rect = btn.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const dx = clientX - cx, dy = clientY - cy;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; bestBtn = btn; }
        });
        buttons.forEach(function (btn) { btn.classList.toggle('drag-over', btn === bestBtn); });
        state.categoryDragOver = bestBtn;
    }

    ns.doCategoryDrag = function (e) {
        if (!state.categoryDragging) return;
        const mx = Math.abs(e.clientX - state.dragStartX), my = Math.abs(e.clientY - state.dragStartY);
        if (!state.categoryDragMoved) {
            if (mx < 5 && my < 5) return;
            if (!state.categoryDragReady && !state.categoryEditMode) { ns.resetCategoryDragState(); return; }
            clearCategoryLongPressTimer(); activateCategoryDrag(e.clientX, e.clientY);
        }
        moveCategoryDrag(e.clientX, e.clientY);
        updateCategoryDragOver(e.clientX, e.clientY);
    };

    ns.stopCategoryDrag = function () {
        if (!state.categoryDragging) return;
        const fi = parseInt(state.categoryDragging.dataset.page, 10);
        const ti = state.categoryDragOver ? parseInt(state.categoryDragOver.dataset.page, 10) : fi;
        const moved = state.categoryDragMoved;
        ns.resetCategoryDragState();
        if (moved && !isNaN(fi) && !isNaN(ti) && fi !== ti) tileManager.reorderPage(fi, ti);
    };

    ns.deleteCategoryByIndex = function (pageIndex) {
        if (state.totalPages <= 1) { ns.showToast('至少需要保留一个分类！', 'error'); return; }
        if (pageIndex < 0 || pageIndex >= state.totalPages) return;
        const name = state.pageNames[pageIndex] || '第' + (pageIndex + 1) + '页';
        const page = tileManager.pagesData[pageIndex] || {};
        let count = Array.isArray(page.tiles) ? page.tiles.length : 0;
        ns.showConfirm('删除分类"' + name + '"时，默认会把 ' + count + ' 个快捷方式移动到"常用"。\n\n确定：移动到常用并删除分类\n取消：直接删除这些快捷方式', { title: '删除分类', okLabel: '移动到常用', cancelLabel: '直接删除' }).then(function (moveToCommon) {
            if (moveToCommon) { tileManager.removePageAt(pageIndex, 'moveToCommon'); return; }
            ns.showConfirm('直接删除分类"' + name + '"及其中 ' + count + ' 个快捷方式吗？此操作不可恢复。', { title: '确认删除' }).then(function (confirmed) {
                if (confirmed) { tileManager.removePageAt(pageIndex, 'deleteTiles'); }
            });
        });
    };

})(window.DevHome);
