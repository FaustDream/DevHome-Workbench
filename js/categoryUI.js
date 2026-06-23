/**
 * DevHome Workbench - 分类 UI
 * 分类按钮行、悬浮弹窗、页面切换动画、滚轮翻页、分类拖拽重排。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var storage = ns.storage;
    var $$ = ns.$$;
    var escapeHtml = ns.escapeHtml;
    var tileManager = ns.tileManager;

    /* ===== 页面指示器 ===== */
    ns.updatePageIndicator = function () {
        var currentName = state.pageNames[state.currentPage] || '' + (state.currentPage + 1);
        dom.pageName.textContent = currentName;
        dom.prevPage.disabled = state.currentPage <= 0;
        dom.nextPage.disabled = state.currentPage >= state.totalPages - 1;
        updateCatRowActive();
        updateCategoryPopoverActive();
    };

    /* ===== 分类按钮行 ===== */
    var timesSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    var plusSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    function renderCatRow() {
        if (!dom.catRow) return;
        var buttons = state.pageNames.map(function (name, idx) {
            var cls = idx === state.currentPage ? 'cat-btn active' : 'cat-btn';
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
        if (dom.pageIndicator) {
            dom.pageIndicator.classList.toggle('category-indicator-hidden', enabled);
            dom.pageIndicator.classList.remove('category-menu-open');
        }
        updateCatRowActive();
    };

    function updateCatRowActive() {
        if (!dom.catRow || !dom.catRow.classList.contains('visible')) return;
        var btns = dom.catRow.querySelectorAll('.cat-btn');
        btns.forEach(function (btn, idx) { btn.classList.toggle('active', idx === state.currentPage); });
    }

    /* ===== 分类悬浮弹窗 ===== */
    // 标记弹窗区域是否有 mousedown 正在进行中，防止此期间 innerHTML 替换销毁点击目标
    var popoverMouseDown = false;
    ns._setPopoverMouseDown = function (v) { popoverMouseDown = v; };

    var renameSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1l2 2-6 6H1V7l6-6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var trashSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 2.5h7M3.5 2.5V1.5h3v1M2.5 2.5v6h5v-6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    ns.renderCategoryPopover = function () {
        if (!dom.categoryPopover) return;
        if (popoverMouseDown) return; // mousedown 进行中，禁止 re-render 以免销毁被点击按钮
        clearTimeout(categoryPopoverCloseTimer);
        dom.categoryPopover.innerHTML = state.pageNames.map(function (name, idx) {
            var page = tileManager.pagesData[idx] || {};
            var tiles = Array.isArray(page.tiles) ? page.tiles.length : 0;
            var cls = idx === state.currentPage ? 'category-popover-item active' : 'category-popover-item';
            // 分类项：名称 + 快捷方式数量 + 重命名按钮 + 删除按钮（至少保留一个分类时隐藏删除）
            var showDelete = state.totalPages > 1;
            return '<div class="' + cls + '" data-page="' + idx + '" title="点击切换到此分类">' +
                '<span class="category-popover-name">' + escapeHtml(name) + '</span>' +
                '<span class="category-popover-count">' + tiles + '</span>' +
                '<span class="category-popover-rename-btn" title="重命名分类" role="button" tabindex="0" aria-label="重命名 ' + escapeHtml(name) + '">' + renameSvg + '</span>' +
                (showDelete ? '<span class="category-popover-delete-btn" title="删除分类" role="button" tabindex="0" aria-label="删除 ' + escapeHtml(name) + '">' + trashSvg + '</span>' : '') +
                '</div>';
        }).join('');
    };

    function updateCategoryPopoverActive() {
        if (!dom.categoryPopover) return;
        var btns = dom.categoryPopover.querySelectorAll('.category-popover-item');
        if (btns.length !== state.pageNames.length) { ns.renderCategoryPopover(); return; }
        btns.forEach(function (btn, idx) { btn.classList.toggle('active', idx === state.currentPage); });
    }

    ns.refreshCategoryPopover = function () { ns.renderCategoryPopover(); };

    var categoryPopoverCloseTimer = null;

    /** 执行弹窗显示的核心逻辑（更新内容 + 显示） */
    function _doShowCategoryPopover() {
        if (!dom.pageIndicator || !dom.categoryPopover) return;
        var btns = dom.categoryPopover.querySelectorAll('.category-popover-item');
        if (btns.length === state.pageNames.length) {
            btns.forEach(function (btn, idx) {
                var page = tileManager.pagesData[idx] || {};
                var tiles = Array.isArray(page.tiles) ? page.tiles.length : 0;
                var countEl = btn.querySelector('.category-popover-count');
                if (countEl) countEl.textContent = tiles;
                btn.classList.toggle('active', idx === state.currentPage);
                // 更新删除按钮显隐
                var deleteBtn = btn.querySelector('.category-popover-delete-btn');
                if (deleteBtn) deleteBtn.style.display = state.totalPages > 1 ? '' : 'none';
            });
        } else {
            ns.renderCategoryPopover();
        }
        dom.pageIndicator.classList.add('category-menu-open');
    }

    function toggleCategoryPopover() {
        if (!dom.pageIndicator) return;
        clearTimeout(categoryPopoverCloseTimer);
        if (dom.pageIndicator.classList.contains('category-menu-open')) {
            dom.pageIndicator.classList.remove('category-menu-open');
        } else {
            _doShowCategoryPopover();
        }
    }

    /* 从浮窗内重命名分类：原地出现输入框，完成自动保存 */
    ns._renameCategoryFromPopover = function (pageIndex) {
        if (pageIndex < 0 || pageIndex >= state.totalPages) return;
        var item = dom.categoryPopover.querySelector('.category-popover-item[data-page="' + pageIndex + '"]');
        if (!item) return;
        var nameSpan = item.querySelector('.category-popover-name');
        if (!nameSpan) return;
        var currentName = (nameSpan.textContent || '').trim();
        // 创建输入框替换名称 span
        var input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'category-popover-input';
        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        var saving = false;
        function save() {
            if (saving) return; saving = true;
            var newName = input.value.trim();
            input.replaceWith(nameSpan);
            if (newName && newName !== currentName) {
                // 解除 popoverMouseDown 锁，确保 renderCategoryPopover 能执行
                ns._setPopoverMouseDown(false);
                tileManager.renamePageAt(pageIndex, newName);
                ns.renderCategoryPopover();
                ns.updatePageIndicator();
                ns.refreshCatRowIfVisible();
            }
        }
        input.addEventListener('blur', save);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = currentName; input.blur(); }
        });
    };

    ns.refreshCatRowIfVisible = function () {
        if (dom.catRow && dom.catRow.classList.contains('visible')) renderCatRow();
        ns.renderCategoryPopover();
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
        ns.renderCategoryPopover();
        ns.updatePageIndicator();
        console.log('[分类切换] 成功切换到:', state.pageNames[newPage], '(pageIdx:', newPage, ') 耗时:', (performance.now() - (t0 || 0)).toFixed(1) + 'ms');
    };

    /* ===== 滚轮翻页 ===== */
    var wheelAccumulator = 0;
    var WHEEL_THRESHOLD = 25;
    var WHEEL_COOLDOWN = 350;
    var lastWheelPageTime = 0;

    ns.handleWheelScroll = function (e) {
        if (state.pageTransition) return;
        e.preventDefault();
        var delta = e.deltaY || e.deltaX || 0;
        if (delta === 0) return;
        if ((delta > 0 && wheelAccumulator < 0) || (delta < 0 && wheelAccumulator > 0)) wheelAccumulator = 0;
        wheelAccumulator += delta;
        var now = Date.now();
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
    var CATEGORY_LONG_PRESS_MS = 200;

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
        var rect = btn.getBoundingClientRect();
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
        var btn = state.categoryDragging, rect = btn.getBoundingClientRect();
        btn.style.width = rect.width + 'px'; btn.style.height = rect.height + 'px';
        btn.style.left = rect.left + 'px'; btn.style.top = rect.top + 'px';
        btn.style.position = 'fixed'; btn.style.zIndex = '1000'; btn.style.pointerEvents = 'none';
        btn.classList.add('dragging');
        moveCategoryDrag(clientX, clientY);
    }

    function moveCategoryDrag(clientX, clientY) {
        var btn = state.categoryDragging; if (!btn) return;
        btn.style.left = (clientX - state.dragOffsetX) + 'px';
        btn.style.top = (clientY - state.dragOffsetY) + 'px';
    }

    function updateCategoryDragOver(clientX, clientY) {
        var buttons = $$('.cat-btn:not(.dragging)'), bestBtn = null, bestDist = Infinity;
        buttons.forEach(function (btn) {
            var rect = btn.getBoundingClientRect();
            var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            var dx = clientX - cx, dy = clientY - cy;
            var dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; bestBtn = btn; }
        });
        buttons.forEach(function (btn) { btn.classList.toggle('drag-over', btn === bestBtn); });
        state.categoryDragOver = bestBtn;
    }

    ns.doCategoryDrag = function (e) {
        if (!state.categoryDragging) return;
        var mx = Math.abs(e.clientX - state.dragStartX), my = Math.abs(e.clientY - state.dragStartY);
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
        var fi = parseInt(state.categoryDragging.dataset.page, 10);
        var ti = state.categoryDragOver ? parseInt(state.categoryDragOver.dataset.page, 10) : fi;
        var moved = state.categoryDragMoved;
        ns.resetCategoryDragState();
        if (moved && !isNaN(fi) && !isNaN(ti) && fi !== ti) tileManager.reorderPage(fi, ti);
    };

    ns.deleteCategoryByIndex = function (pageIndex) {
        if (state.totalPages <= 1) { ns.showToast('至少需要保留一个分类！', 'error'); return; }
        if (pageIndex < 0 || pageIndex >= state.totalPages) return;
        var name = state.pageNames[pageIndex] || '第' + (pageIndex + 1) + '页';
        var page = tileManager.pagesData[pageIndex] || {};
        var count = Array.isArray(page.tiles) ? page.tiles.length : 0;
        ns.showConfirm('删除分类"' + name + '"时，默认会把 ' + count + ' 个快捷方式移动到"常用"。\n\n确定：移动到常用并删除分类\n取消：直接删除这些快捷方式', { title: '删除分类', okLabel: '移动到常用', cancelLabel: '直接删除' }).then(function (moveToCommon) {
            if (moveToCommon) { tileManager.removePageAt(pageIndex, 'moveToCommon'); return; }
            ns.showConfirm('直接删除分类"' + name + '"及其中 ' + count + ' 个快捷方式吗？此操作不可恢复。', { title: '确认删除' }).then(function (confirmed) {
                if (confirmed) { tileManager.removePageAt(pageIndex, 'deleteTiles'); }
            });
        });
    };

    /* ===== 事件导出（供 events.js 使用） ===== */
    ns._toggleCategoryPopover = toggleCategoryPopover;
    ns._renameCategoryFromPopover = ns._renameCategoryFromPopover;

})(window.DevHome);
