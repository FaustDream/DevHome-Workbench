/**
 * ui 子模块 — 右键菜单
 * 职责：磁贴右键菜单、空白区域右键菜单、分类子菜单、菜单动作处理
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const escapeHtml = ns.escapeHtml;
    const tileManager = ns.tileManager;

    /* ===== 右键菜单 ===== */
    let submenuTimer = null;
    let submenuMode = ''; // 'move' 或 'copy'

    function populateSubMenu(container, pageNames, excludeIndex) {
        container.innerHTML = '';
        pageNames.forEach(function (name, idx) {
            if (idx === excludeIndex) return;
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.setAttribute('data-page', idx);
            const arrowSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="opacity:0.5"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            item.innerHTML = arrowSvg + '<span>' + escapeHtml(name) + '</span>';
            container.appendChild(item);
        });
    }

    function showCategorySubMenu(parentItem) {
        clearTimeout(submenuTimer);
        const subMenu = document.getElementById('ctxCategorySubMenu');
        if (!subMenu) return;
        submenuMode = parentItem.dataset.submenu;
        populateSubMenu(subMenu, state.pageNames, state.currentPage);
        if (!subMenu.children.length) { hideCategorySubMenu(); return; }

        const parentRect = parentItem.getBoundingClientRect();
        const ctxRect = dom.contextMenu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 4;
        subMenu.classList.add('visible');
        const subRect = subMenu.getBoundingClientRect();

        const rightSpace = vw - ctxRect.right - margin;
        const leftSpace = ctxRect.left - margin;
        if (rightSpace >= subRect.width) {
            subMenu.style.left = (ctxRect.right + margin) + 'px';
        } else if (leftSpace >= subRect.width) {
            subMenu.style.left = (ctxRect.left - subRect.width - margin) + 'px';
        } else {
            subMenu.style.left = Math.max(margin, vw - subRect.width - margin) + 'px';
        }

        let topPos = parentRect.top;
        if (topPos + subRect.height > vh - margin) {
            topPos = Math.max(margin, vh - subRect.height - margin);
        }
        subMenu.style.top = topPos + 'px';
    }

    function hideCategorySubMenu() {
        clearTimeout(submenuTimer);
        submenuTimer = setTimeout(function () {
            const sub = document.getElementById('ctxCategorySubMenu');
            if (sub) sub.classList.remove('visible');
            submenuMode = '';
        }, 150);
    }

    ns.cancelSubMenuTimer = function () { clearTimeout(submenuTimer); };

    /* ===== 磁贴右键菜单 ===== */
    ns.showContextMenu = function (e) {
        e.preventDefault(); e.stopPropagation();
        const tile = e.currentTarget;
        state.contextMenuTarget = tile;
        dom.contextMenu.style.left = e.clientX + 'px';
        dom.contextMenu.style.top = e.clientY + 'px';

        const hasMulti = state.totalPages > 1;
        const ctxDivider = document.getElementById('ctxMoveDivider');
        const ctxMoveItem = document.getElementById('ctxMoveToItem');
        const ctxCopyItem = document.getElementById('ctxCopyToItem');
        if (ctxDivider) ctxDivider.style.display = hasMulti ? '' : 'none';
        if (ctxMoveItem) {
            ctxMoveItem.style.display = hasMulti ? '' : 'none';
            if (hasMulti) {
                ctxMoveItem.onmouseenter = function () { showCategorySubMenu(ctxMoveItem); };
                ctxMoveItem.onmouseleave = hideCategorySubMenu;
            }
        }
        if (ctxCopyItem) {
            ctxCopyItem.style.display = hasMulti ? '' : 'none';
            if (hasMulti) {
                ctxCopyItem.onmouseenter = function () { showCategorySubMenu(ctxCopyItem); };
                ctxCopyItem.onmouseleave = hideCategorySubMenu;
            }
        }
        dom.contextMenu.classList.add('visible');
        setTimeout(function () { document.addEventListener('click', hideContextMenu, { once: true }); }, 0);
    };

    function hideContextMenu() {
        dom.contextMenu.classList.remove('visible');
        state.contextMenuTarget = null;
        const sub = document.getElementById('ctxCategorySubMenu');
        if (sub) sub.classList.remove('visible');
        submenuMode = '';
    }

    ns.handleContextMenuAction = function (action) {
        if (!state.contextMenuTarget) return;
        const tileId = state.contextMenuTarget.dataset.tileId;
        const tile = tileManager.currentTiles.find(function (t) { return t.id === tileId; });
        if (!tile) { hideContextMenu(); return; }
        switch (action) {
            case 'edit': ns.openEditModal(tile); break;
            case 'delete':
                ns.showConfirm('确定要删除磁贴 "' + tile.label + '" 吗？', { title: '删除磁贴' }).then(function (ok) {
                    if (ok) { tileManager.remove(tileId); ns.renderTiles(); }
                });
                break;
            case 'upload': ns.openUploadModal(); break;
        }
        hideContextMenu();
    };

    ns.handleSubMenuClick = function (targetPageIdx) {
        if (!state.contextMenuTarget) return;
        if (isNaN(targetPageIdx) || targetPageIdx === state.currentPage) { hideContextMenu(); return; }
        const tileId = state.contextMenuTarget.dataset.tileId;
        const tile = tileManager.currentTiles.find(function (t) { return t.id === tileId; });
        if (!tile) { hideContextMenu(); return; }
        if (submenuMode === 'copy') {
            tileManager.copyTileToPage(tileId, targetPageIdx);
        } else {
            tileManager.moveTileToPage(tileId, targetPageIdx);
        }
        hideContextMenu();
    };

    /* ===== 空白区域右键菜单 ===== */
    ns.showBlankContextMenu = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (e.target.closest('.tile')) return;

        const isFocus = state.currentDevhomeMode !== 'daily';
        const wbItem = dom.blankContextMenu.querySelector('[data-action="openWorkbench"]');
        if (wbItem) {
            const isDaily = !isFocus;
            wbItem.querySelector('span').textContent = isDaily ? '进入专注模式' : '退出专注模式';
            const wbIcon = wbItem.querySelector('svg');
            if (wbIcon) {
                wbIcon.innerHTML = isDaily
                    ? '<rect x="1.5" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 13V10.5h4V13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
                    : '<path d="M2 7h10M7 2l-5 5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
            }
        }

        const dailyOnlyItems = dom.blankContextMenu.querySelectorAll('.ctx-daily-only');
        dailyOnlyItems.forEach(function (item) { item.style.display = isFocus ? 'none' : ''; });

        dom.blankContextMenu.classList.add('visible');
        const menuRect = dom.blankContextMenu.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let posX = e.clientX + 8, posY = e.clientY + 8;
        if (posX + menuRect.width > vw - 8) posX = e.clientX - menuRect.width - 8;
        if (posY + menuRect.height > vh - 8) posY = e.clientY - menuRect.height - 8;
        posX = Math.max(8, posX); posY = Math.max(8, posY);
        dom.blankContextMenu.style.left = posX + 'px';
        dom.blankContextMenu.style.top = posY + 'px';
        setTimeout(function () { document.addEventListener('click', ns.hideBlankContextMenu, { once: true }); }, 0);
    };

    ns.hideBlankContextMenu = function () { dom.blankContextMenu.classList.remove('visible'); };

    ns.handleBlankMenuAction = function (action) {
        switch (action) {
            case 'refresh':
                if (state.currentDevhomeMode !== 'daily') {
                    localStorage.setItem('_devhome_last_mode', state.currentDevhomeMode);
                }
                location.reload();
                break;
            case 'addTile': ns.openUploadModal(); break;
            case 'openWorkbench': ns.toggleFocusMode(); break;
            case 'addPage': ns.addNewPage(); break;

        }
        ns.hideBlankContextMenu();
    };

})(window.DevHome);
