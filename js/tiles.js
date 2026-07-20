/**
 * DevHome Workbench - 磁贴管理、渲染与拖拽
 * tileManager: 磁贴数据的 CRUD 与页面切换。
 * 渲染：将磁贴数组转为 DOM。
 * 拖拽：鼠标/触屏磁贴拖拽重排。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const storage = ns.storage;
    const $$ = ns.$$;
    const escapeHtml = ns.escapeHtml;
    const pageManager = ns.pageManager;
    const loadFavicon = ns.loadFavicon;
    const TILE_LONG_PRESS_MS = ns.TILE_LONG_PRESS_MS;

    /* ===== 磁贴数据管理 ===== */
    ns.tileManager = {
        pagesData: [],
        currentTiles: [],

        load: async function () {
            this.pagesData = await pageManager.load();
            this.updateCurrentTiles();
        },

        updateCurrentTiles: function () {
            const pageData = pageManager.getCurrentPageData(this.pagesData);
            this.currentTiles = pageData.tiles || [];
            this.sortByPosition();
        },

        save: function () {
            // 保存前同步 position 字段与数组下标，防止 sortByPosition() 在重启时恢复旧顺序
            this.currentTiles.forEach(function (tile, idx) { tile.position = idx; });
            this.pagesData = pageManager.updateCurrentPage(this.pagesData, this.currentTiles);
            pageManager.save(this.pagesData);
        },

        add: function (tile) {
        const newTile = Object.assign({}, tile, {
            id: 'tile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
                position: this.currentTiles.length
            });
            this.currentTiles.push(newTile);
            this.save();
            return newTile;
        },

        remove: function (tileId) {
            const index = this.currentTiles.findIndex(function (t) { return t.id === tileId; });
            if (index > -1) { this.currentTiles.splice(index, 1); this.save(); return true; }
            return false;
        },

        update: function (tileId, updates) {
            const tile = this.currentTiles.find(function (t) { return t.id === tileId; });
            if (tile) { Object.assign(tile, updates); this.save(); return true; }
            return false;
        },

        reorder: function (fromIndex, toIndex) {
            if (fromIndex === toIndex) return;
            const moved = this.currentTiles.splice(fromIndex, 1)[0];
            this.currentTiles.splice(toIndex, 0, moved);
            this.save();
        },

        sortByPosition: function () {
            this.currentTiles.sort(function (a, b) { return a.position - b.position; });
        },

        changePage: function (pageIndex) {
            if (pageIndex < 0 || pageIndex >= state.totalPages) return false;
            this.save();
            state.currentPage = pageIndex;
            this.updateCurrentTiles();
            if (storage.get('category_memory', false)) storage.set('last_page', pageIndex);
            return true;
        },

        addNewPage: function () {
            this.save();
            this.pagesData = pageManager.addPage(this.pagesData);
            pageManager.save(this.pagesData);
            state.currentPage = state.totalPages - 1;
            this.currentTiles = [];
            },

        removeCurrentPage: function () {
            if (state.totalPages <= 1) return false;
            this.pagesData = pageManager.removePageWithStrategy(this.pagesData, state.currentPage, 'moveToCommon');
            pageManager.save(this.pagesData);
            this.updateCurrentTiles();
            ns.refreshCatRowIfVisible();
            return true;
        },

        removePageAt: function (pageIndex, strategy) {
            strategy = strategy || 'moveToCommon';
            if (state.totalPages <= 1) return false;
            this.save();
            this.pagesData = pageManager.removePageWithStrategy(this.pagesData, pageIndex, strategy);
            pageManager.save(this.pagesData);
            this.updateCurrentTiles();
            ns.refreshCatRowIfVisible();
            ns.renderTiles();
            return true;
        },

        reorderPage: function (fromIndex, toIndex) {
            if (fromIndex === toIndex) return false;
            this.save();
            this.pagesData = pageManager.reorderPage(this.pagesData, fromIndex, toIndex);
            pageManager.save(this.pagesData);
            this.updateCurrentTiles();
            ns.refreshCatRowIfVisible();
            ns.renderTiles();
            return true;
        },

        renameCurrentPage: function (newName) {
            pageManager.renamePage(state.currentPage, newName);
            this.pagesData[state.currentPage].name = newName;
            pageManager.save(this.pagesData);
            ns.refreshCatRowIfVisible();
        },

        /* 重命名指定索引的分类（从浮窗内操作） */
        renamePageAt: function (pageIndex, newName) {
            if (pageIndex < 0 || pageIndex >= state.totalPages) return;
            pageManager.renamePage(pageIndex, newName);
            if (this.pagesData[pageIndex]) this.pagesData[pageIndex].name = newName;
            pageManager.save(this.pagesData);
        },

        /* 将指定磁贴从当前分类移动到目标分类 */
        moveTileToPage: function (tileId, targetPageIndex) {
            if (targetPageIndex === state.currentPage) return false;
            const tileIndex = this.currentTiles.findIndex(function (t) { return t.id === tileId; });
            if (tileIndex === -1) return false;
            const targetPage = this.pagesData[targetPageIndex];
            if (!targetPage) return false;
            // 从当前分类移除磁贴
            const tile = this.currentTiles.splice(tileIndex, 1)[0];
            this.save();
            // 追加到目标分类末尾
            if (!targetPage.tiles) targetPage.tiles = [];
            tile.position = targetPage.tiles.length;
            targetPage.tiles.push(tile);
            pageManager.save(this.pagesData);
            ns.renderTiles();
            return true;
        },

        /* 将指定磁贴复制到目标分类（不删除原分类中的磁贴） */
        copyTileToPage: function (tileId, targetPageIndex) {
            if (targetPageIndex === state.currentPage) return false;
            const tile = this.currentTiles.find(function (t) { return t.id === tileId; });
            if (!tile) return false;
            const targetPage = this.pagesData[targetPageIndex];
            if (!targetPage) return false;
            // 创建副本，生成新 ID
            const copy = Object.assign({}, tile, {
                id: 'tile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
                position: (targetPage.tiles || []).length
            });
            if (!targetPage.tiles) targetPage.tiles = [];
            targetPage.tiles.push(copy);
            pageManager.save(this.pagesData);
            return true;
        }
    };

    /* ===== 磁贴 DOM 渲染 ===== */
    ns.renderTiles = function () {
        dom.tilesContainer.innerHTML = '';
        const frag = document.createDocumentFragment();
        ns.tileManager.currentTiles.forEach(function (tile, index) {
            const a = document.createElement('a');
            a.className = 'tile';
            // 磁贴通过点击事件打开链接（新标签页），href 仅用于右键"在新标签页中打开链接"
            a.href = tile.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.title = tile.label;
            a.dataset.tileId = tile.id;
            a.dataset.index = index;
            a.style.gridArea = 'auto';
            a.draggable = false;

            const iconWrap = document.createElement('div');
            iconWrap.className = 'tile-icon-wrap';

            // 统一使用 favicon 加载，支持 imageData 兼容旧数据
            if (tile.type === 'image' && tile.imageData) {
                const img = document.createElement('img');
                img.className = 'tile-img';
                img.src = tile.imageData;
                img.width = 56;    // 显式 intrinsic 尺寸，减少重排
                img.height = 56;
                img.decoding = 'async';  // 异步解码，不阻塞主线程
                iconWrap.appendChild(img);
            } else {
                const img2 = document.createElement('img');
                img2.className = 'tile-img';
                img2.width = 56;
                img2.height = 56;
                img2.decoding = 'async';
                iconWrap.appendChild(img2);
                loadFavicon(tile.url, img2, iconWrap);
            }

            let label = document.createElement('span'); label.className = 'tile-label'; label.textContent = tile.label;
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'tile-delete-btn'; deleteBtn.role = 'button'; deleteBtn.tabIndex = 0;
            deleteBtn.dataset.tileDelete = tile.id;
            deleteBtn.setAttribute('aria-label', '删除 ' + tile.label);
            deleteBtn.innerHTML = ns.icon('x', 'dh-icon--sm');

            a.appendChild(iconWrap); a.appendChild(label); a.appendChild(deleteBtn);
            a.style.setProperty('--tile-color', tile.color || '#4a9eff');
            frag.appendChild(a);
        });
        dom.tilesContainer.appendChild(frag);
        dom.tilesContainer.classList.toggle('tile-edit-mode', state.tileEditMode);
        ns.setupTileDragAndDrop();
    };

    /* ===== 磁贴拖拽系统 ===== */
    ns.setupTileDragAndDrop = function () {
        const tiles = $$('.tile');
        tiles.forEach(function (tile) {
            tile.addEventListener('mousedown', startDrag);
            tile.addEventListener('touchstart', startDragTouch);
            tile.addEventListener('contextmenu', ns.showContextMenu);
            tile.addEventListener('click', function (e) {
                if (state.dragMoved || state.preventNextTileClick || state.tileEditMode) {
                    e.preventDefault(); state.dragMoved = false; state.preventNextTileClick = false;
                }
            });
        });
    };

    ns.setTileEditMode = function (enabled) {
        state.tileEditMode = enabled;
        if (dom.tilesContainer) dom.tilesContainer.classList.toggle('tile-edit-mode', enabled);
    };

    function clearLongPressTimer() {
        if (state.dragLongPressTimer) { clearTimeout(state.dragLongPressTimer); state.dragLongPressTimer = null; }
    }

    function prepareTilePointer(tile, clientX, clientY) {
        clearLongPressTimer();
        state.dragMoved = false; state.dragReady = false; state.dragging = tile;
        state.dragStartX = clientX; state.dragStartY = clientY;
        const rect = tile.getBoundingClientRect();
        state.dragOffsetX = clientX - rect.left; state.dragOffsetY = clientY - rect.top;
        // 长按期间添加视觉反馈：磁贴微微缩放提示即将进入拖拽状态
        tile.classList.add('long-pressing');
        state.dragLongPressTimer = setTimeout(function () {
            if (state.dragging === tile && !state.dragMoved) {
                state.dragReady = true; state.preventNextTileClick = true; ns.setTileEditMode(true);
                tile.classList.remove('long-pressing');
            }
        }, TILE_LONG_PRESS_MS);
    }

    function activateTileDrag(clientX, clientY) {
        if (!state.dragging || state.dragMoved) return;
        state.dragMoved = true; state.preventNextTileClick = true;
        if (dom.tilesContainer) dom.tilesContainer.classList.add('tile-drag-active');
        const tile = state.dragging;
        const rect = tile.getBoundingClientRect();
        tile.style.width = rect.width + 'px'; tile.style.height = rect.height + 'px';
        tile.style.minHeight = rect.height + 'px';
        tile.style.left = rect.left + 'px'; tile.style.top = rect.top + 'px';
        tile.classList.add('dragging'); tile.style.position = 'fixed';
        tile.style.zIndex = '1000'; tile.style.pointerEvents = 'none';
        moveDraggingTile(clientX, clientY);
    }

    function moveDraggingTile(clientX, clientY) {
        const tile = state.dragging; if (!tile) return;
        tile.style.left = (clientX - state.dragOffsetX) + 'px';
        tile.style.top = (clientY - state.dragOffsetY) + 'px';
    }

    function resetDraggingTile(tile) {
        tile.classList.remove('dragging'); tile.style.position = ''; tile.style.zIndex = '';
        tile.style.left = ''; tile.style.top = ''; tile.style.width = ''; tile.style.height = '';
        tile.style.minHeight = ''; tile.style.pointerEvents = '';
    }

    function resetDragState() {
        clearLongPressTimer();
        if (state.dragging) state.dragging.classList.remove('long-pressing');
        state.dragging = null; state.dragOver = null; state.dragReady = false;
        if (dom.tilesContainer) dom.tilesContainer.classList.remove('tile-drag-active');
    }

    function deleteTileById(tileId, label) {
        if (!tileId) return;
        const msg = label ? '确定要删除磁贴 "' + label + '" 吗？' : '确定要删除这个磁贴吗？';
        ns.showConfirm(msg, { title: '删除磁贴' }).then(function (ok) {
            if (ok) { ns.tileManager.remove(tileId); ns.renderTiles(); }
        });
    }

    function startDrag(e) {
        state.dragMoved = false;
        if (e.target.closest('.tile-delete-btn')) return;
        if (e.button !== 0) return;
        const tile = e.currentTarget;
        prepareTilePointer(tile, e.clientX, e.clientY);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }

    function startDragTouch(e) {
        state.dragMoved = false;
        if (e.target.closest('.tile-delete-btn')) return;
        const touch = e.touches[0], tile = e.currentTarget;
        prepareTilePointer(tile, touch.clientX, touch.clientY);
        document.addEventListener('touchmove', doDragTouch, { passive: false });
        document.addEventListener('touchend', stopDragTouch);
    }

    function doDrag(e) {
        if (!state.dragging) return;
        if (!state.dragMoved) {
            const mx = Math.abs(e.clientX - state.dragStartX), my = Math.abs(e.clientY - state.dragStartY);
            if (mx < 5 && my < 5) return;
            // 长按未完成且非编辑模式时，允许最大 10px 的轻微移动不取消拖拽，避免手指微抖导致中断
            if (!state.dragReady && !state.tileEditMode) {
                if (mx < 10 && my < 10) return;
                state.dragging.classList.remove('long-pressing');
                clearLongPressTimer(); state.preventNextTileClick = true; return;
            }
            state.dragging.classList.remove('long-pressing');
            clearLongPressTimer(); activateTileDrag(e.clientX, e.clientY);
        }
        moveDraggingTile(e.clientX, e.clientY);
        // 使用最近磁贴算法替代精确命中检测：即使光标在磁贴间隙也能高亮最近目标
        const tiles = $$('.tile:not(.dragging)'); let bestTile = null, bestDist = Infinity;
        tiles.forEach(function (ot) {
            const r = ot.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const dx = e.clientX - cx, dy = e.clientY - cy;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; bestTile = ot; }
        });
        tiles.forEach(function (ot) { ot.classList.toggle('drag-over', ot === bestTile); });
        state.dragOver = bestTile;
    }

    function doDragTouch(e) {
        if (!state.dragging) return;
        const touch = e.touches[0];
        if (!state.dragMoved) {
            const mx = Math.abs(touch.clientX - state.dragStartX), my = Math.abs(touch.clientY - state.dragStartY);
            if (mx < 5 && my < 5) return;
            // 长按未完成且非编辑模式时，允许最大 10px 的轻微移动不取消拖拽，避免手指微抖导致中断
            if (!state.dragReady && !state.tileEditMode) {
                if (mx < 10 && my < 10) return;
                state.dragging.classList.remove('long-pressing');
                clearLongPressTimer(); state.preventNextTileClick = true; return;
            }
            state.dragging.classList.remove('long-pressing');
            clearLongPressTimer(); activateTileDrag(touch.clientX, touch.clientY);
        }
        e.preventDefault();
        moveDraggingTile(touch.clientX, touch.clientY);
        // 使用最近磁贴算法替代精确命中检测
        let el = document.elementFromPoint(touch.clientX, touch.clientY);
        let dragOverTile = el ? el.closest('.tile:not(.dragging)') : null;
        // 如果 elementFromPoint 命中在磁贴间隙（返回 null），用最近距离算法兜底
        if (!dragOverTile) {
            const tiles = $$('.tile:not(.dragging)'); let bestTile = null, bestDist = Infinity;
            tiles.forEach(function (ot) {
                const r = ot.getBoundingClientRect();
                const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                const dx = touch.clientX - cx, dy = touch.clientY - cy;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) { bestDist = dist; bestTile = ot; }
            });
            dragOverTile = bestTile;
        }
        $$('.tile').forEach(function (t) { t.classList.toggle('drag-over', t === dragOverTile); });
        state.dragOver = dragOverTile;
    }

    function stopDrag() {
        if (!state.dragging) return;
        const tile = state.dragging;
        if (state.dragMoved) {
            resetDraggingTile(tile);
            $$('.tile').forEach(function (t) { t.classList.remove('drag-over'); });
            if (state.dragOver) {
                ns.tileManager.reorder(parseInt(tile.dataset.index), parseInt(state.dragOver.dataset.index));
                ns.renderTiles();
            }
        }
        resetDragState();
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    function stopDragTouch(e) {
        if (!state.dragging) return;
        const tile = state.dragging;
        if (state.dragMoved) {
            resetDraggingTile(tile);
            $$('.tile').forEach(function (t) { t.classList.remove('drag-over'); });
            const ct = e.changedTouches[0];
            if (ct && state.dragOver) {
                ns.tileManager.reorder(parseInt(tile.dataset.index), parseInt(state.dragOver.dataset.index));
                ns.renderTiles();
            }
        }
        resetDragState();
        document.removeEventListener('touchmove', doDragTouch);
        document.removeEventListener('touchend', stopDragTouch);
    }

    ns.handleTileDeleteClick = function (e) {
        const btn = e.target.closest('.tile-delete-btn');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        const tileId = btn.dataset.tileDelete;
        const tile = ns.tileManager.currentTiles.find(function (t) { return t.id === tileId; });
        deleteTileById(tileId, tile && tile.label);
    };

    ns.handleTileDeleteKeydown = function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const btn = e.target.closest('.tile-delete-btn');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        const tileId = btn.dataset.tileDelete;
        const tile = ns.tileManager.currentTiles.find(function (t) { return t.id === tileId; });
        deleteTileById(tileId, tile && tile.label);
    };

})(window.DevHome);
