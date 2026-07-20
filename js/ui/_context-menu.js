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
            const arrowSvg = ns.icon('chevron-right', 'dh-icon--sm ctx-sub-arrow');
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
        // 日常模式专属菜单项过滤（如重新获取图片、上传图片）
        const isFocusMode = state.currentDevhomeMode === 'focus';
        const dailyOnlyItems = dom.contextMenu.querySelectorAll('.ctx-daily-only');
        dailyOnlyItems.forEach(function (item) { item.style.display = isFocusMode ? 'none' : ''; });
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
            case 'refreshImage': _handleRefreshImage(tile); break;
            case 'uploadImage': _handleUploadImage(tile); break;
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
            const label = wbItem.querySelector('#ctxFocusModeLabel');
            if (label) label.textContent = isDaily ? '进入专注模式' : '退出专注模式';
            const wbIcon = wbItem.querySelector('.wb-icon');
            if (wbIcon) {
                wbIcon.className = 'wb-icon dh-icon dh-icon--' + (isDaily ? 'workbench' : 'x') + ' dh-icon--md';
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

    /**
     * 重新获取磁贴图片
     * 清除域名关联的 IndexedDB 缓存和内存缓存，
     * 强制重新请求 favicon 服务获取最新图标
     * @param {Object} tile - 磁贴数据对象
     */
    function _handleRefreshImage(tile) {
        console.log('[右键] 重新获取图片 tile=' + tile.label + ' url=' + tile.url);
        // 重置磁贴类型为 favicon，强制重新走 favicon 加载流程
        tile.type = 'favicon';
        tile.imageData = null;
        // 如果磁贴在 IndexedDB 缓存中，清除该域名的缓存
        let domain;
        try {
            domain = new URL(tile.url).hostname;
        } catch (_) { domain = null; }

        // 通知结果回调：成功 → 绿色提示；失败 → 红色提示并附带失败原因
        function notifyIconResult(success, info) {
            if (success) {
                ns.showToast('图标已更新："' + tile.label + '"', 'success');
            } else {
                const reason = (info && info.reason) ? info.reason : '未知原因';
                ns.showToast('图标获取失败（' + tile.label + '）：' + reason, 'error');
            }
        }

        // 先展示进行中提示，再执行实际刷新
        ns.showToast('正在重新获取 "' + tile.label + '" 的图标...', 'info');

        function doRefresh() {
            // 更新 tiles 数据并重新渲染（仅对该磁贴附加结果回调）
            try {
                window.DevHome.tileManager.save();
            } catch (_) {}
            ns.renderTiles({ targetTileId: tile.id, onIconResult: notifyIconResult });
        }

        if (domain && window.DevHome && window.DevHome.openFaviconDB) {
            // 先清除缓存，确保真正重新请求图标服务，再渲染并监听结果
            window.DevHome.openFaviconDB().then(function (db) {
                try {
                    const tx = db.transaction('favicons', 'readwrite');
                    const store = tx.objectStore('favicons');
                    store.delete(domain);
                    console.log('[右键] 已清除域名缓存的 favicon 域名=' + domain);
                } catch (e) {
                    console.warn('[右键] 清除缓存失败:', e.message);
                }
                doRefresh();
            }).catch(function () { doRefresh(); });
        } else {
            doRefresh();
        }
    }

    /**
     * 上传本地图片作为磁贴图标
     * 打开文件选择器 → 读取图片 → 转 base64 data URL → 更新磁贴并保存
     * @param {Object} tile - 磁贴数据对象
     */
    function _handleUploadImage(tile) {
        console.log('[右键] 上传图片 tile=' + tile.label);
        const input = document.getElementById('tileImageInput');
        if (!input) {
            ns.showToast('图片上传功能暂不可用', 'error');
            return;
        }
        // 清除之前的监听器（避免重复绑定）
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        // 更新 DOM 引用（原节点已被替换）
        window.DevHome.dom.tileImageInput = newInput;
        // 绑定文件选择事件
        newInput.addEventListener('change', function () {
            const file = newInput.files && newInput.files[0];
            if (!file) return;
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                ns.showToast('请选择图片文件（jpg、png、gif、webp 等）', 'error');
                return;
            }
            // 验证文件大小（最大 2MB）
            if (file.size > 2 * 1024 * 1024) {
                ns.showToast('图片文件不能超过 2MB', 'error');
                return;
            }
            // 显示加载提示
            ns.showToast('正在处理图片...', 'info');
            const reader = new FileReader();
            reader.onload = function (e) {
                const dataUrl = e.target.result;
                // 更新磁贴为图片类型
                tile.type = 'image';
                tile.imageData = dataUrl;
                // 持久化保存
                try {
                    window.DevHome.tileManager.save();
                } catch (_) {}
                // 重新渲染
                ns.renderTiles();
                console.log('[右键] 已上传图片 文件名=' + file.name + ' 大小=' + Math.round(file.size / 1024) + 'KB');
                ns.showToast('图片已更新', 'success');
            };
            reader.onerror = function () {
                ns.showToast('图片读取失败，请重试', 'error');
            };
            reader.readAsDataURL(file);
            // 重置 input 以支持重复选择同一文件
            newInput.value = '';
        });
        newInput.click();
    }

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
