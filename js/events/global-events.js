/**
 * 全局事件模块
 * 负责文档级点击关闭弹窗、右键菜单、Esc 退出、专注模式快捷键、数字键切换搜索引擎
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindGlobalEvents = function () {
        const state = ns.state;
        const dom = ns.dom;
        const engines = ns.engines;

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.search-engine-selector') && !e.target.closest('.engine-dropdown')) ns.hideEngineDropdown();
            if (state.tileEditMode && !e.target.closest('.tile') && !e.target.closest('.tile-delete-btn')) ns.setTileEditMode(false);
            if (state.categoryEditMode && !e.target.closest('.cat-row')) { state.categoryEditMode = false; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', false); }
            if (!e.target.closest('.search-container')) ns.hideSuggestions();
        });

        document.addEventListener('mouseup', clearLongPressTimer);
        document.addEventListener('mouseup', clearCatLongPressTimer);
        document.addEventListener('touchend', clearLongPressTimer);
        document.addEventListener('touchend', clearCatLongPressTimer);
        function clearLongPressTimer() { if (state.dragLongPressTimer) { clearTimeout(state.dragLongPressTimer); state.dragLongPressTimer = null; } }
        function clearCatLongPressTimer() { if (state.categoryLongPressTimer) { clearTimeout(state.categoryLongPressTimer); state.categoryLongPressTimer = null; } }

        document.addEventListener('keydown', function (e) {
            const activeEl = document.activeElement;
            const isEditing = activeEl === dom.wbNoteTitle
                || activeEl === dom.wbNoteContent
                || activeEl === dom.wbNotesSearch
                || activeEl === dom.wbCaptureInput
                || activeEl === dom.wbMeAiApiKey
                || activeEl === dom.wbMeAiEndpoint
                || activeEl === dom.wbMeAiModel
                || activeEl === dom.wbMeShortcutKey
                || (activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT'));

            // '/' 聚焦搜索框
            if (e.key === '/' && document.activeElement !== dom.searchInput) { e.preventDefault(); dom.searchInput.focus(); }

            // 专注模式下拦截 Ctrl+S
            if (state.currentDevhomeMode === 'workbench' && (e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                return;
            }

            // Esc 键处理
            if (e.key === 'Escape') {
                const isFocusMode = state.currentDevhomeMode !== 'daily';
                const hasEngineDropdown = dom.engineDropdown && dom.engineDropdown.classList.contains('visible');
                const hasSuggestions = state.suggestionsVisible;
                const isSearchFocused = document.activeElement === dom.searchInput;
                const hasSettingsOpen = dom.settingsOverlay && dom.settingsOverlay.classList.contains('visible');
                if (isFocusMode || hasEngineDropdown || hasSuggestions || isSearchFocused || hasSettingsOpen) e.preventDefault();
                if (isFocusMode) ns.exitFocusMode();
                ns.hideEngineDropdown(); ns.hideSuggestions(); ns.closeSettingsPanel();
                if (isSearchFocused) dom.searchInput.blur();
            }

            // 专注模式快捷键
            if (ns.isFocusModeShortcut(e)) { e.preventDefault(); ns.toggleFocusMode(); }

            // Ctrl+I 打开 AI 对话
            if (e.ctrlKey && e.key === 'i' && !e.shiftKey && !e.altKey && !e.metaKey) {
                if (!isEditing) { e.preventDefault(); if (ns.aiChat) ns.aiChat.open(); }
            }

            // 数字键切换搜索引擎
            if (!isEditing && activeEl !== dom.searchInput) {
                const num = parseInt(e.key), engineKeys = Object.keys(engines);
                if (num >= 1 && num <= engineKeys.length) { e.preventDefault(); ns.setEngine(engineKeys[num - 1]); dom.searchInput.focus(); }
            }

            // Alt+数字切换搜索引擎
            if (e.altKey && e.key >= '1' && e.key <= '5') {
                e.preventDefault(); const num2 = parseInt(e.key), ek2 = Object.keys(engines);
                if (num2 >= 1 && num2 <= ek2.length) { ns.setEngine(ek2[num2 - 1]); dom.searchInput.focus(); }
            }

            // Ctrl+Plus/Minus 视图缩放
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === '-')) {
                if (!isEditing && activeEl !== dom.searchInput) {
                    e.preventDefault();
                    const currentScale = parseFloat(localStorage.getItem('tabpage_view_scale') || '1.0');
                    let newScale = e.key === '-' ? currentScale - 0.05 : currentScale + 0.05;
                    newScale = Math.max(0.6, Math.min(1.5, Math.round(newScale * 100) / 100));
                    document.documentElement.style.setProperty('--view-scale', newScale);
                    localStorage.setItem('tabpage_view_scale', newScale);
                    console.log('[设置] 视图缩放 Ctrl+' + (e.key === '-' ? '-' : '+') + ' ' + newScale.toFixed(2));
                }
            }
        });

        // 右键菜单 (磁贴)
        dom.contextMenu.addEventListener('click', function (e) {
            if (e.target.closest('.ctx-has-submenu')) return;
            const item = e.target.closest('.context-menu-item');
            if (item && item.dataset.action) ns.handleContextMenuAction(item.dataset.action);
        });

        // 分类子菜单事件
        const ctxSubMenu = document.getElementById('ctxCategorySubMenu');
        if (ctxSubMenu) {
            ctxSubMenu.addEventListener('mouseenter', function () {
                if (ns.cancelSubMenuTimer) ns.cancelSubMenuTimer();
                clearTimeout(ctxSubMenu._hideTimer);
            });
            ctxSubMenu.addEventListener('mouseleave', function () {
                ctxSubMenu._hideTimer = setTimeout(function () { ctxSubMenu.classList.remove('visible'); }, 200);
            });
            ctxSubMenu.addEventListener('click', function (e) {
                const item = e.target.closest('.context-menu-item');
                if (!item) return;
                const pageIdx = parseInt(item.dataset.page, 10);
                if (!isNaN(pageIdx)) ns.handleSubMenuClick(pageIdx);
            });
        }

        // 全局右键处理
        document.addEventListener('contextmenu', function (e) {
            if (e.target.closest('.tile')) { e.preventDefault(); }
            else if (dom.wbNoteContent && dom.wbNoteContent.contains(e.target) && state.currentDevhomeMode === 'workbench') {
                const sel = window.getSelection();
                if (sel.rangeCount && dom.wbNoteContent.contains(sel.anchorNode)) {
                    state._savedSelection = sel.getRangeAt(0).cloneRange();
                }
                e.preventDefault();
                ns.showEditorContextMenu(e);
            }
            else if (!e.target.closest('.search-container') && !e.target.closest('.engine-selector') && !e.target.closest('.engine-dropdown') && !e.target.closest('.modal')) {
                e.preventDefault(); ns.showBlankContextMenu(e);
            }
        });
    };

})(window.DevHome);
