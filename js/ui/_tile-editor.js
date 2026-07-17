/**
 * ui 子模块 — 磁贴编辑 + 通用弹窗 + 编辑器右键菜单
 * 职责：磁贴增改弹窗（Shadcn Dialog）、通用模态弹窗工厂、编辑器右键菜单
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;

    /* ===== 磁贴编辑弹窗 ===== */

    /** 随机纯色生成器：从预设暖色调色板中随机选取，供 favicon 失败时使用 */
    function randomTileColor() {
        const palette = [
            '#c0692a', '#d94a3a', '#e67e22', '#f39c12', '#27ae60',
            '#2ecc71', '#1abc9c', '#2980b9', '#3498db', '#8e44ad',
            '#9b59b6', '#16a085', '#e74c3c', '#7f8c8d', '#2c3e50'
        ];
        return palette[Math.floor(Math.random() * palette.length)];
    }

    ns.openUploadModal = function () {
        state.editingTile = null;
        console.log('[面板] 打开添加磁贴弹窗');
        window.ShadcnDialogs.showTileForm('添加磁贴', '', 'https://').then(function (result) {
            if (!result) return;
            const tileData = { label: result.name, url: result.url, type: 'favicon', icon: '', color: randomTileColor() };
            ns.tileManager.add(tileData);
            console.log('[编辑] 保存磁贴 name=' + result.name + ' url=' + result.url);
            ns.renderTiles();
        });
    };

    ns.openEditModal = function (tile) {
        state.editingTile = tile;
        console.log('[面板] 打开编辑磁贴弹窗 name=' + tile.label);
        window.ShadcnDialogs.showTileForm('编辑磁贴', tile.label, tile.url).then(function (result) {
            if (!result) return;
            const tileData = { label: result.name, url: result.url, type: 'favicon', icon: '', color: tile.color || randomTileColor() };
            ns.tileManager.update(tile.id, tileData);
            console.log('[编辑] 保存磁贴 name=' + result.name + ' url=' + result.url);
            ns.renderTiles();
        });
    };

    ns.closeModal = function () {
        if (window.ShadcnDialogs) window.ShadcnDialogs.closeAll();
        state.editingTile = null;
    };

    ns.saveTile = function () {
        // 保留兼容旧事件绑定，新流程已走 showTileForm Promise 回调
        ns.showToast('请通过弹窗保存', 'info');
    };

    /* ===== 通用弹窗工厂（消除 4+ 处重复的 overlay → dialog → 事件模式） ===== */
    ns.createModal = function (title, bodyHTML, footerHTML, opts) {
        opts = opts || {};
        const maxWidth = opts.maxWidth || 380;

        const overlay = document.createElement('div');
        overlay.className = 'wb-modal-overlay' + (opts.className ? ' ' + opts.className : '');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2900;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.className = 'wb-modal-dialog';
        dialog.style.cssText = 'background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:20px;padding:20px;width:min(90vw,' + maxWidth + 'px);box-shadow:var(--shadow-lg);';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = 'font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 8px;';

        const bodyEl = document.createElement('div');
        bodyEl.innerHTML = bodyHTML;

        const footerEl = document.createElement('div');
        footerEl.innerHTML = footerHTML;

        dialog.appendChild(titleEl);
        dialog.appendChild(bodyEl);
        dialog.appendChild(footerEl);
        overlay.appendChild(dialog);

        const closeFn = function () {
            if (overlay.isConnected) overlay.remove();
            if (opts.onClose) opts.onClose();
        };

        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeFn(); });
        document.body.appendChild(overlay);

        return { overlay: overlay, dialog: dialog, bodyEl: bodyEl, footerEl: footerEl, close: closeFn };
    };

    /* ===== 编辑器右键菜单 ===== */
    ns.showEditorContextMenu = function (e) {
        e.preventDefault(); e.stopPropagation();
        const menu = document.getElementById('editorContextMenu');
        if (!menu) { console.warn('[警告] editorContextMenu DOM 未找到'); return; }
        console.log('[面板] 打开编辑器右键菜单 坐标(' + e.clientX + ',' + e.clientY + ')');
        menu.classList.add('visible');
        const menuRect = menu.getBoundingClientRect();
        let posX = e.clientX + 8, posY = e.clientY + 8;
        if (posX + menuRect.width > window.innerWidth - 8) posX = e.clientX - menuRect.width - 8;
        if (posY + menuRect.height > window.innerHeight - 8) posY = e.clientY - menuRect.height - 8;
        posX = Math.max(8, posX); posY = Math.max(8, posY);
        menu.style.left = posX + 'px';
        menu.style.top = posY + 'px';
        setTimeout(function () { document.addEventListener('click', hideEditorMenu, { once: true }); }, 0);
    };

    function hideEditorMenu() {
        const menu = document.getElementById('editorContextMenu');
        if (menu) menu.classList.remove('visible');
    }

    ns.handleEditorMenuAction = function (action) {
        if (action === 'copy') { document.execCommand('copy'); }
        else if (action === 'paste') { document.execCommand('paste'); }
        hideEditorMenu();
    };

})(window.DevHome);
