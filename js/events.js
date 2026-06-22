/**
 * DevHome Workbench - 事件绑定
 * 集中管理所有 DOM 事件监听，是整个应用的事件中枢。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var storage = ns.storage;
    var $$ = ns.$$;
    var engines = ns.engines;
    var escapeHtml = ns.escapeHtml;

    ns.bindEvents = function () {
        // ===== 分类按钮行事件 =====
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

        // ===== 分类浮窗事件 =====
        if (dom.categoryPopover) {
            // 移除 hover 触发，改为纯 click 切换
            // mousedown/mouseup 标记：防止点击期间 renderCategoryPopover 销毁按钮
            dom.categoryPopover.addEventListener('mousedown', function () { ns._setPopoverMouseDown(true); });
            dom.categoryPopover.addEventListener('mouseup', function () { ns._setPopoverMouseDown(false); });
            document.addEventListener('mouseup', function () { ns._setPopoverMouseDown(false); }); // 兜底
            dom.categoryPopover.addEventListener('click', function (e) {
                var renameBtn = e.target.closest('.category-popover-rename-btn');
                if (renameBtn) {
                    e.preventDefault(); e.stopPropagation();
                    var item = renameBtn.closest('.category-popover-item');
                    if (item) {
                        var pageIdx = parseInt(item.dataset.page, 10);
                        if (!isNaN(pageIdx)) ns._renameCategoryFromPopover(pageIdx);
                    }
                    return;
                }
                var deleteBtn = e.target.closest('.category-popover-delete-btn');
                if (deleteBtn) {
                    e.preventDefault(); e.stopPropagation();
                    var item2 = deleteBtn.closest('.category-popover-item');
                    if (item2) {
                        var pageIdx2 = parseInt(item2.dataset.page, 10);
                        if (!isNaN(pageIdx2)) ns.deleteCategoryByIndex(pageIdx2);
                    }
                    return;
                }
                var btn = e.target.closest('.category-popover-item');
                if (!btn) return;
                e.preventDefault(); e.stopPropagation();
                var pageIdx = parseInt(btn.dataset.page, 10);
                if (!isNaN(pageIdx)) {
                    var name = (btn.querySelector('.category-popover-name') || {}).textContent || '';
                    var t0 = performance.now();
                    console.log('[分类点击] 目标:', name, '(pageIdx:', pageIdx, ') 当前页:', ns.state.currentPage);
                    ns.changePageWithAnimation(pageIdx, t0, name);
                    ns.renderCategoryPopover();
                }
            });
        }
        // ===== 分类浮窗：点击分类名称打开/关闭浮窗 =====
        if (dom.pageName) {
            dom.pageName.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof ns._toggleCategoryPopover === 'function') {
                    ns._toggleCategoryPopover();
                }
            });
        } else if (dom.pageInfo) {
            // 兜底：如果 pageName 不可用，绑定 pageInfo
            dom.pageInfo.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof ns._toggleCategoryPopover === 'function') {
                    ns._toggleCategoryPopover();
                }
            });
        }

        // ===== 模式切换 =====
        if (dom.devhomeBackHome) dom.devhomeBackHome.addEventListener('click', ns.showDailyMode);
        if (dom.devhomeClearDone) dom.devhomeClearDone.addEventListener('click', ns.clearCompletedTasks);
        if (dom.quadrantFilterBtn) dom.quadrantFilterBtn.addEventListener('click', ns.toggleQuadrantFilter);

        // ===== 四象限工作台事件 =====
        if (dom.quadrantGrid) {
            // 点击事件：复选框、取消按钮、添加按钮
            dom.quadrantGrid.addEventListener('click', function (e) {
                // 任务复选框 → 标记完成（软删除，隐藏但不销毁）
                var check = e.target.closest('.quadrant-task-check');
                if (check) {
                    e.stopPropagation();
                    ns.completeQuadrantTask(check.dataset.quadrant, check.dataset.taskId);
                    return;
                }
                // 取消按钮 → 标记取消（软删除，隐藏但不销毁）
                var del = e.target.closest('.quadrant-task-del');
                if (del) {
                    e.stopPropagation();
                    ns.cancelQuadrantTask(del.dataset.quadrant, del.dataset.taskId);
                    return;
                }
                // 添加按钮
                var addBtn = e.target.closest('.quadrant-add-btn');
                if (addBtn) {
                    e.stopPropagation();
                    var quadrant = addBtn.dataset.quadrant;
                    var card = addBtn.closest('.quadrant-card');
                    if (card && !card.querySelector('.quadrant-input-row')) {
                        ns.showQuadrantInput(card, quadrant);
                    }
                    return;
                }
            });

            // 拖拽事件
            dom.quadrantGrid.addEventListener('dragstart', function (e) {
                var task = e.target.closest('.quadrant-task');
                if (!task) return;
                state._dragTaskId = task.dataset.taskId;
                state._dragFromQuadrant = task.dataset.quadrant;
                task.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.dataset.taskId);
            });

            dom.quadrantGrid.addEventListener('dragend', function (e) {
                var task = e.target.closest('.quadrant-task');
                if (task) task.classList.remove('dragging');
                // 移除所有拖拽高亮
                var cards = dom.quadrantGrid.querySelectorAll('.quadrant-card');
                cards.forEach(function (c) { c.classList.remove('drag-over'); });
                state._dragTaskId = null;
                state._dragFromQuadrant = null;
            });

            dom.quadrantGrid.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                var card = e.target.closest('.quadrant-card');
                if (card) {
                    // 移除所有高亮，仅高亮当前悬停的象限
                    var allCards = dom.quadrantGrid.querySelectorAll('.quadrant-card');
                    allCards.forEach(function (c) { c.classList.remove('drag-over'); });
                    card.classList.add('drag-over');
                }
            });

            dom.quadrantGrid.addEventListener('dragleave', function (e) {
                var card = e.target.closest('.quadrant-card');
                // 仅在真正离开象限卡片时移除高亮
                if (card && !card.contains(e.relatedTarget)) {
                    card.classList.remove('drag-over');
                }
            });

            dom.quadrantGrid.addEventListener('drop', function (e) {
                e.preventDefault();
                var card = e.target.closest('.quadrant-card');
                if (!card) return;
                card.classList.remove('drag-over');
                var toQuadrant = card.dataset.quadrant;
                if (state._dragTaskId && state._dragFromQuadrant && toQuadrant) {
                    ns.moveQuadrantTask(state._dragTaskId, state._dragFromQuadrant, toQuadrant);
                }
                state._dragTaskId = null;
                state._dragFromQuadrant = null;
            });
        }

        // ===== 页面切换 =====
        dom.prevPage.addEventListener('click', function () { ns.changePageWithAnimation(state.currentPage - 1); });
        dom.nextPage.addEventListener('click', function () { ns.changePageWithAnimation(state.currentPage + 1); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dom.pageIndicator) dom.pageIndicator.classList.remove('category-menu-open'); });
        dom.tilesContainer.addEventListener('wheel', ns.handleWheelScroll, { passive: false });
        dom.tilesContainer.addEventListener('click', ns.handleTileDeleteClick);
        dom.tilesContainer.addEventListener('keydown', ns.handleTileDeleteKeydown);

        // ===== 空白区域右键菜单 =====
        dom.blankContextMenu.addEventListener('click', function (e) { var item = e.target.closest('.context-menu-item'); if (item && item.dataset.action) ns.handleBlankMenuAction(item.dataset.action); });

        // ===== 设置面板 =====
        if (dom.settingsGearBtn) dom.settingsGearBtn.addEventListener('click', ns.openSettingsPanel);
        if (dom.settingsCloseBtn) dom.settingsCloseBtn.addEventListener('click', ns.closeSettingsPanel);
        if (dom.settingsOverlay) dom.settingsOverlay.addEventListener('click', function (e) { if (e.target === dom.settingsOverlay) ns.closeSettingsPanel(); });
        if (dom.changelogBtn) dom.changelogBtn.addEventListener('click', function () { ns.closeSettingsPanel(); ns.openChangelog(); });
        // ===== 更新说明弹窗 =====
        if (dom.changelogCloseBtn) dom.changelogCloseBtn.addEventListener('click', ns.closeChangelog);
        if (dom.changelogOverlay) dom.changelogOverlay.addEventListener('click', function (e) { if (e.target === dom.changelogOverlay) ns.closeChangelog(); });
        if (dom.settingsPanel) {
            dom.settingsPanel.addEventListener('click', function (e) {
                var sizeBtn = e.target.closest('.shortcut-size-btn');
                if (sizeBtn) { e.preventDefault(); applyShortcutSizeFn(sizeBtn.dataset.shortcutSize); ns.syncSettingsControls(); return; }
                var colsBtn = e.target.closest('.shortcut-columns-btn');
                if (colsBtn) { e.preventDefault(); applyShortcutColumnsFn(colsBtn.dataset.shortcutColumns); ns.syncSettingsControls(); return; }
                var settingBtn = e.target.closest('[data-setting-action]');
                if (settingBtn) { e.preventDefault(); ns.handleSettingsAction(settingBtn.dataset.settingAction); }
            });
            dom.settingsPanel.addEventListener('change', function (_e) { /* 设置面板已移除专注模式选项，保留 change 监听器骨架供日后扩展 */ });
        }

        // ===== 搜索引擎 =====
        dom.engineSelector.addEventListener('click', function (e) { e.stopPropagation(); ns.toggleEngineDropdown(); });
        dom.engineDropdown.addEventListener('click', function (e) { var opt = e.target.closest('.engine-option'); if (opt) { ns.setEngine(opt.dataset.engine); ns.hideEngineDropdown(); } });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.search-engine-selector') && !e.target.closest('.engine-dropdown')) ns.hideEngineDropdown();
            if (state.tileEditMode && !e.target.closest('.tile') && !e.target.closest('.tile-delete-btn')) ns.setTileEditMode(false);
            if (state.categoryEditMode && !e.target.closest('.cat-row')) { state.categoryEditMode = false; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', false); }
            // 点击分类浮窗和 pageIndicator 之外的区域时关闭浮窗
            if (dom.pageIndicator && dom.pageIndicator.classList.contains('category-menu-open') &&
                !e.target.closest('.category-popover') && !e.target.closest('.page-indicator')) {
                dom.pageIndicator.classList.remove('category-menu-open');
            }
            if (!e.target.closest('.search-container')) ns.hideSuggestions();
        });
        document.addEventListener('mouseup', clearLongPressTimer);
        document.addEventListener('mouseup', clearCatLongPressTimer);
        document.addEventListener('touchend', clearLongPressTimer);
        function clearLongPressTimer() { if (state.dragLongPressTimer) { clearTimeout(state.dragLongPressTimer); state.dragLongPressTimer = null; } }
        function clearCatLongPressTimer() { if (state.categoryLongPressTimer) { clearTimeout(state.categoryLongPressTimer); state.categoryLongPressTimer = null; } }

        // ===== 搜索 =====
        dom.searchButton.addEventListener('click', ns.doSearch);
        dom.searchInput.addEventListener('keydown', ns.handleSearchKeydown);
        dom.searchInput.addEventListener('input', ns.handleSearchInput);
        dom.searchInput.addEventListener('focus', ns.handleSearchFocus);
        dom.searchInput.addEventListener('blur', ns.handleSearchBlur);

        // ===== 键盘快捷键 =====
        document.addEventListener('keydown', function (e) {
            if (e.key === '/' && document.activeElement !== dom.searchInput) { e.preventDefault(); dom.searchInput.focus(); }
            if (e.key === 'Escape') {
                // 判断是否需要拦截 ESC 行为
                var hasChangelogOpen = dom.changelogOverlay && dom.changelogOverlay.classList.contains('visible');
                var isFocusMode = state.currentDevhomeMode !== 'daily';
                var hasEngineDropdown = dom.engineDropdown && dom.engineDropdown.classList.contains('visible');
                var hasSuggestions = state.suggestionsVisible;
                var isSearchFocused = document.activeElement === dom.searchInput;
                var hasSettingsOpen = dom.settingsOverlay && dom.settingsOverlay.classList.contains('visible');

                // 仅在确实需要拦截时才阻止默认行为
                if (hasChangelogOpen || isFocusMode || hasEngineDropdown || hasSuggestions || isSearchFocused || hasSettingsOpen) {
                    e.preventDefault();
                }
                if (hasChangelogOpen) { ns.closeChangelog(); }
                if (isFocusMode) { ns.exitFocusMode(); }
                ns.hideEngineDropdown(); ns.hideSuggestions(); ns.closeSettingsPanel();
                if (isSearchFocused) dom.searchInput.blur();
            }
            // 可配置的专注模式快捷键
            if (ns.isFocusModeShortcut(e)) { e.preventDefault(); ns.toggleFocusMode(); }
            if (document.activeElement !== dom.searchInput) {
                var num = parseInt(e.key), engineKeys = Object.keys(engines);
                if (num >= 1 && num <= engineKeys.length) { e.preventDefault(); ns.setEngine(engineKeys[num - 1]); dom.searchInput.focus(); }
            }
            if (e.altKey && e.key >= '1' && e.key <= '5') {
                e.preventDefault(); var num2 = parseInt(e.key), ek2 = Object.keys(engines);
                if (num2 >= 1 && num2 <= ek2.length) { ns.setEngine(ek2[num2 - 1]); dom.searchInput.focus(); }
            }
        });

        // ===== 右键菜单 (磁贴) =====
        dom.contextMenu.addEventListener('click', function (e) {
            // 子菜单项（移动到/复制到）不在此处理，由子菜单独立处理
            if (e.target.closest('.ctx-has-submenu')) return;
            var item = e.target.closest('.context-menu-item');
            if (item && item.dataset.action) ns.handleContextMenuAction(item.dataset.action);
        });

        // ===== 分类子菜单事件 =====
        var ctxSubMenu = document.getElementById('ctxCategorySubMenu');
        if (ctxSubMenu) {
            ctxSubMenu.addEventListener('mouseenter', function () {
                // 鼠标进入子菜单时取消主菜单的 leave 关闭计时器
                if (ns.cancelSubMenuTimer) ns.cancelSubMenuTimer();
                clearTimeout(ctxSubMenu._hideTimer);
            });
            ctxSubMenu.addEventListener('mouseleave', function () {
                // 鼠标离开子菜单时延迟关闭
                ctxSubMenu._hideTimer = setTimeout(function () {
                    ctxSubMenu.classList.remove('visible');
                }, 200);
            });
            ctxSubMenu.addEventListener('click', function (e) {
                var item = e.target.closest('.context-menu-item');
                if (!item) return;
                var pageIdx = parseInt(item.dataset.page, 10);
                if (!isNaN(pageIdx)) ns.handleSubMenuClick(pageIdx);
            });
        }

        // ===== 弹窗 =====
        dom.modalClose.addEventListener('click', ns.closeModal);
        dom.modalCancel.addEventListener('click', ns.closeModal);
        dom.modalSave.addEventListener('click', ns.saveTile);
        $$('.icon-type-tab').forEach(function (tab) { tab.addEventListener('click', function () { updateIconType(tab.dataset.type); if (tab.dataset.type === 'fa') updateFaPreview(); }); });
        dom.faInput.addEventListener('input', updateFaPreview);
        dom.imageUploadArea.addEventListener('click', function () { dom.imageInput.click(); });
        dom.imageInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (file && file.type.startsWith('image/')) { state.imageFile = file; var r = new FileReader(); r.onload = function (ev) { dom.imagePreview.src = ev.target.result; dom.imagePreview.classList.remove('hidden'); }; r.readAsDataURL(file); }
        });
        function updateIconType(type) {
            state.iconType = type;
            $$('.icon-type-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.type === type); });
            dom.faGroup.classList.toggle('hidden', type !== 'fa');
            dom.imageGroup.classList.toggle('hidden', type !== 'image');
            dom.emojiGroup.classList.toggle('hidden', type !== 'emoji');
        }
        function updateFaPreview() {
            var ic = dom.faInput.value.trim();
            dom.faPreview.innerHTML = ic ? '<i class="' + ic + '"></i>' : '<span style="font-size:12px;color:var(--text-secondary)">自动获取网站图标</span>';
        }

        // ===== 右键菜单全局 =====
        document.addEventListener('contextmenu', function (e) {
            if (e.target.closest('.tile')) { e.preventDefault(); }
            else if (!e.target.closest('.search-container') && !e.target.closest('.engine-selector') && !e.target.closest('.engine-dropdown') && !e.target.closest('.modal')) {
                e.preventDefault(); ns.showBlankContextMenu(e);
            }
        });

        // ===== 背景上传 =====
        dom.bgInput.addEventListener('change', function (e) {
            var file = e.target.files[0]; if (!file) return;
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) ns.bgManager.upload(file);
            else alert('请选择图片或视频文件');
            dom.bgInput.value = '';
        });

        // ===== 背景参数 =====
        var charSizeSlider = document.getElementById('charSizeSlider');
        var charSizeValue = document.getElementById('charSizeValue');
        if (charSizeSlider) {
            charSizeSlider.value = storage.get('char_size', 8);
            if (charSizeValue) charSizeValue.textContent = charSizeSlider.value + 'px';
            charSizeSlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_char_size', this.value);
                if (charSizeValue) charSizeValue.textContent = this.value + 'px';
                window.dispatchEvent(new Event('resize'));
            });
        }
        var flowSpeedSlider = document.getElementById('flowSpeedSlider');
        var flowSpeedValue = document.getElementById('flowSpeedValue');
        if (flowSpeedSlider) {
            flowSpeedSlider.value = storage.get('flow_speed', 2);
            if (flowSpeedValue) flowSpeedValue.textContent = flowSpeedSlider.value + '×';
            flowSpeedSlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_flow_speed', this.value);
                if (flowSpeedValue) flowSpeedValue.textContent = this.value + '×';
                window.dispatchEvent(new Event('resize'));
            });
        }
        var charDensitySlider = document.getElementById('charDensitySlider');
        var charDensityValue = document.getElementById('charDensityValue');
        if (charDensitySlider) {
            charDensitySlider.value = storage.get('char_density', 3);
            if (charDensityValue) charDensityValue.textContent = Math.round(charDensitySlider.value / 5 * 100) + '%';
            charDensitySlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_char_density', this.value);
                if (charDensityValue) charDensityValue.textContent = Math.round(this.value / 5 * 100) + '%';
            });
        }

        // ===== 数据导入 =====
        if (dom.importInput) {
            dom.importInput.addEventListener('change', function (e) {
                var file = e.target.files[0]; if (!file) return;
                var reader = new FileReader();
                reader.onload = async function (event) {
                    try {
                        var data = JSON.parse(event.target.result);
                        if (data && data.pages && Array.isArray(data.pages)) {
                            var importOk = await ns.showConfirm('导入备份将覆盖当前所有的磁贴和页面配置，确定继续吗？', { title: '导入备份' });
                            if (importOk) {
                                storage.set('pages', data.pages);
                                storage.set('page_names', data.pageNames || ['第1页']);
                                if (data.devhome) ns.devhomeStorage.set('workbench', data.devhome);
                                await ns.tileManager.load();
                                ns.renderTiles(); ns.updatePageIndicator();
                                alert('备份导入成功！');
                            }
                        } else alert('无效的备份文件格式！');
                    } catch (err) { alert('读取文件失败，请确保选择的是有效的 JSON 配置文件！'); }
                    dom.importInput.value = '';
                };
                reader.readAsText(file);
            });
        }

        // ===== 文件配置目录选择 =====
        if (dom.configSelectDirBtn) {
            dom.configSelectDirBtn.addEventListener('click', async function () {
                if (!ns.fileConfig) return;
                // 如果 write 权限待授权（dirHandle 已存在），先尝试仅恢复 write 权限
                // 这样避免弹出完整的目录选择器
                if (ns.fileConfig._tryRecoverWrite && typeof ns.fileConfig._tryRecoverWrite === 'function') {
                    var recovered = await ns.fileConfig._tryRecoverWrite();
                    if (recovered) {
                        // write 权限恢复成功 → 立即同步数据并刷新页面
                        ns.fileConfig.hideWarningBar();
                        ns.fileConfig.updateBadge('', '#e74c3c');
                        try { await ns.fileConfig.syncToFile(); } catch (_) { /* 同步失败不阻塞 */ }
                        ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
                        ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
                        ns.openFaviconDB();
                        await ns.tileManager.load();
                        ns.loadSearchHistory();
                        ns.renderTiles();
                        ns.updatePageIndicator();
                        ns.renderCategoryPopover();
                        ns.syncSettingsControls();
                        return;
                    }
                }
                // 恢复失败或 handle 完全不可用 → 弹出目录选择器
                var success = await ns.fileConfig.pickDir();
                if (success) {
                    state.configReady = true;
                    // 重新执行完整启动流程
                    ns.fileConfig.hideWarningBar();
                    ns.fileConfig.updateBadge('', '#e74c3c');
                    ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
                    ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
                    ns.openFaviconDB();
                    await ns.tileManager.load();
                    ns.loadSearchHistory();
                    ns.renderTiles();
                    ns.updatePageIndicator();
                    ns.renderCategoryPopover();
                    ns.syncSettingsControls();
                    ns.bindEvents();
                }
            });
        }

        // ===== v2 工作台 Tab 切换 =====
        if (dom.wbNav) {
            dom.wbNav.addEventListener('click', function (e) {
                var tab = e.target.closest('.wb-nav-tab');
                if (!tab) return;
                var tabName = tab.dataset.tab;
                if (tabName) ns.switchWbTab(tabName);
            });
        }

        // ===== v2 快速捕获 =====
        if (dom.wbCaptureInput) {
            dom.wbCaptureInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var val = dom.wbCaptureInput.value.trim();
                    if (!val) return;
                    ns.addCapture(val).then(function () {
                        ns.renderCaptures();
                        dom.wbCaptureInput.value = '';
                    });
                }
            });
        }

        // ===== v2 笔记面板事件 =====
        if (dom.wbNotesList) {
            dom.wbNotesList.addEventListener('click', function (e) {
                // 删除按钮点击
                var delBtn = e.target.closest('.wb-note-list-del');
                if (delBtn) {
                    e.stopPropagation();
                    var delId = delBtn.dataset.delId;
                    var delKind = delBtn.dataset.delKind;
                    var label = delKind === 'capture'
                        ? (state.captures.find(function(c){return c.id===delId;}) || {}).content || ''
                        : (state.notes.find(function(n){return n.id===delId;}) || {}).title || '';
                    ns.showConfirm('确定删除 "' + label.slice(0, 30) + '" 吗？', { title: '删除' + (delKind === 'capture' ? '捕获' : '笔记') }).then(function (ok) {
                        if (!ok) return;
                        var delPromise = delKind === 'capture' ? ns.deleteCapture(delId) : ns.deleteNote(delId);
                        delPromise.then(function () {
                            if (state.currentNote && state.currentNote.id === delId) ns.closeNoteEditor();
                            ns.renderNotesList(state._notesFilter, state._notesSearch);
                            if (delKind === 'capture') ns.renderCaptures();
                        });
                    });
                }
                // 列表项点击 - 打开编辑
                var item = e.target.closest('.wb-note-list-item');
                if (!item) return;
                var noteId = item.dataset.noteId;
                var kind = item.dataset.kind;
                var target;
                if (kind === 'capture') {
                    target = state.captures.find(function (c) { return c.id === noteId; });
                    if (target) target = Object.assign({ _kind: 'capture' }, target);
                } else {
                    target = state.notes.find(function (n) { return n.id === noteId; });
                }
                if (target) ns.openNoteEditor(target);
            });
        }
        if (dom.wbNotesSearch) {
            dom.wbNotesSearch.addEventListener('input', function () {
                state._notesSearch = dom.wbNotesSearch.value;
                ns.renderNotesList(state._notesFilter, state._notesSearch);
            });
        }
        // ===== 侧边栏筛选标签 — 长按进入删除模式 =====
        var filterLongPressTimer = null;
        var filterDeleteMode = false;
        var filterLongPressTarget = null;
        var filterSuppressNextClick = false; // 长按触发后跳过紧接着的 click

        function exitFilterDeleteMode() {
            filterDeleteMode = false;
            filterSuppressNextClick = false;
            if (dom.wbNotesFilters) dom.wbNotesFilters.classList.remove('delete-mode');
            if (dom.wbNotesFilters) {
                var dels = dom.wbNotesFilters.querySelectorAll('.filter-del');
                dels.forEach(function (d) { d.remove(); });
            }
        }

        function enterFilterDeleteMode() {
            filterDeleteMode = true;
            filterSuppressNextClick = true; // 长按触发，跳过紧接着的 click
            if (dom.wbNotesFilters) dom.wbNotesFilters.classList.add('delete-mode');
            if (dom.wbNotesFilters) {
                var chips = dom.wbNotesFilters.querySelectorAll('.wb-filter-chip:not(.always)');
                chips.forEach(function (c) {
                    if (!c.querySelector('.filter-del')) {
                        var span = document.createElement('span');
                        span.className = 'filter-del';
                        span.textContent = '×';
                        c.appendChild(span);
                    }
                });
            }
        }

        function cancelFilterLongPress() {
            if (filterLongPressTimer) {
                clearTimeout(filterLongPressTimer);
                filterLongPressTimer = null;
            }
            filterLongPressTarget = null;
        }

        if (dom.wbNotesFilters) {
            // pointerdown：长按检测（支持鼠标 + 触摸）
            dom.wbNotesFilters.addEventListener('pointerdown', function (e) {
                var chip = e.target.closest('.wb-filter-chip:not(.always)');
                if (!chip) return;
                filterLongPressTarget = chip;
                // 视觉反馈：轻微变暗提示正在长按
                chip.style.opacity = '0.7';
                filterLongPressTimer = setTimeout(function () {
                    chip.style.opacity = '';  // 恢复
                    enterFilterDeleteMode();
                    filterLongPressTarget = null;
                }, 800);
            });

            // pointerup：取消长按
            dom.wbNotesFilters.addEventListener('pointerup', function (e) {
                if (filterLongPressTarget) {
                    filterLongPressTarget.style.opacity = '';
                }
                cancelFilterLongPress();
            });

            // pointerleave：取消长按（鼠标离开容器）
            dom.wbNotesFilters.addEventListener('pointerleave', function () {
                if (filterLongPressTarget) {
                    filterLongPressTarget.style.opacity = '';
                }
                cancelFilterLongPress();
            });

            // pointermove：移动超过阈值则取消（防误触拖拽）
            dom.wbNotesFilters.addEventListener('pointermove', function (e) {
                if (!filterLongPressTimer || !filterLongPressTarget) return;
                // 计算移动距离，超过 5px 则取消
                var dx = e.clientX - (filterLongPressTarget.getBoundingClientRect().left + filterLongPressTarget.offsetWidth / 2);
                var dy = e.clientY - (filterLongPressTarget.getBoundingClientRect().top + filterLongPressTarget.offsetHeight / 2);
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    filterLongPressTarget.style.opacity = '';
                    cancelFilterLongPress();
                }
            });

            dom.wbNotesFilters.addEventListener('click', function (e) {
                // 长按刚触发删除模式：跳过紧接着的 click（按钮释放触发），只清除标记
                if (filterSuppressNextClick) {
                    filterSuppressNextClick = false;
                    return;
                }
                // 删除模式：点击 ×
                var delBtn = e.target.closest('.filter-del');
                if (delBtn && filterDeleteMode) {
                    e.preventDefault(); e.stopPropagation();
                    var chip = delBtn.closest('.wb-filter-chip');
                    if (!chip || chip.classList.contains('always')) return;
                    var filter = chip.dataset.filter;
                    var name = chip.textContent.replace('×', '').trim();
                    ns.showConfirm('将"' + name + '"类型的全部笔记变为未分类，标签本身也会移除。确定继续？', { title: '删除标签' }).then(function (ok) {
                        if (ok) {
                            ns.removeFilter(filter);
                            exitFilterDeleteMode();
                        }
                    });
                    return;
                }
                // 删除模式：点击 chip 本身 → 重命名（自定义标签）/ 退出（内置标签）
                if (filterDeleteMode) {
                    var chipClicked = e.target.closest('.wb-filter-chip');
                    if (chipClicked && chipClicked.classList.contains('custom')) {
                        var filterKey = chipClicked.dataset.filter;
                        var oldText = chipClicked.textContent.replace('×', '').trim();
                        var newVal = prompt('重命名标签（可用 "emoji 名称" 格式）：', oldText);
                        if (newVal && newVal.trim()) {
                            var parsed = (function (input) {
                                var m = input.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
                                if (m) return { icon: m[1], name: input.slice(m[0].length).trim() || input };
                                return { icon: '', name: input.trim() };
                            })(newVal.trim());
                            ns.renameFilter(filterKey, parsed.icon || '', parsed.name);
                        }
                    }
                    exitFilterDeleteMode();
                    return;
                }
                // 普通筛选点击
                var chip = e.target.closest('.wb-filter-chip');
                if (!chip) return;
                var filter = chip.dataset.filter;
                state._notesFilter = filter;
                dom.wbNotesFilters.querySelectorAll('.wb-filter-chip').forEach(function (c) {
                    c.classList.toggle('active', c.dataset.filter === filter);
                });
                ns.renderNotesList(filter, state._notesSearch);
            });
        }

        // Escape 退出删除模式
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && filterDeleteMode) {
                exitFilterDeleteMode();
            }
        });

        // 新增自定义标签分类
        if (dom.wbFilterAddBtn) {
            dom.wbFilterAddBtn.addEventListener('click', function () {
                var name = prompt('输入新标签名称，支持 emoji 开头（如"🎨 设计" 或 "设计"）：');
                if (!name || !name.trim()) return;
                ns.addCustomFilter(name.trim());
            });
        }
        if (dom.wbNotesAddBtn) {
            dom.wbNotesAddBtn.addEventListener('click', function () {
                ns.createNote({ title: '新笔记', content: '', type: 'note', tags: [] }).then(function (note) {
                    ns.openNoteEditor(note);
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                });
            });
        }
        // 编辑器类型徽章 × 点击 → 恢复默认"笔记"
        if (dom.wbNoteTypeBadge) {
            dom.wbNoteTypeBadge.addEventListener('click', function (e) {
                if (!e.target.closest('.badge-remove')) return;
                e.preventDefault(); e.stopPropagation();
                state._currentNoteType = 'note';
                ns.renderNoteTypeBadge('note');
                // 触发自动保存
                if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
                noteAutoSaveTimer = setTimeout(function () {
                    if (state.currentNote) {
                        ns.saveCurrentNote().then(function () {
                            ns.renderNotesList(state._notesFilter, state._notesSearch);
                        });
                    }
                }, 400);
            });
        }
        // 笔记标题/内容变更时自动保存
        var noteAutoSaveTimer = null;
        function autoSaveNote() {
            if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
            noteAutoSaveTimer = setTimeout(function () {
                if (state.currentNote) {
                    ns.saveCurrentNote().then(function () {
                        ns.renderNotesList(state._notesFilter, state._notesSearch);
                    });
                }
            }, 800);
        }
        if (dom.wbNoteTitle) dom.wbNoteTitle.addEventListener('input', autoSaveNote);
        if (dom.wbNoteContent) dom.wbNoteContent.addEventListener('input', autoSaveNote);

        // ===== v2 日历事件 =====
        var calPrev = document.getElementById('wbCalendarPrev');
        var calNext = document.getElementById('wbCalendarNext');
        var calToday = document.getElementById('wbCalendarToday');
        if (calPrev) calPrev.addEventListener('click', function () { ns.navigateCalendar(-1); });
        if (calNext) calNext.addEventListener('click', function () { ns.navigateCalendar(1); });
        if (calToday) calToday.addEventListener('click', function () { ns.renderCalendar(new Date()); });

        // ===== v2 番茄钟事件 =====
        var pomoStart = document.getElementById('wbPomodoroStart');
        var pomoPause = document.getElementById('wbPomodoroPause');
        var pomoReset = document.getElementById('wbPomodoroReset');
        if (pomoStart) pomoStart.addEventListener('click', ns.startPomodoro);
        if (pomoPause) pomoPause.addEventListener('click', ns.pausePomodoro);
        if (pomoReset) pomoReset.addEventListener('click', ns.resetPomodoro);
        // 预设时长按钮
        var pomoPresets = document.querySelectorAll('.wb-pomodoro-preset');
        pomoPresets.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var duration = parseInt(btn.dataset.duration, 10);
                if (!isNaN(duration)) ns.setPomodoroDuration(duration);
            });
        });
        // 自定义时长
        var pomoCustom = document.getElementById('wbPomodoroCustom');
        if (pomoCustom) {
            pomoCustom.addEventListener('change', function () {
                var val = parseInt(pomoCustom.value, 10);
                if (val > 0 && val <= 180) ns.setPomodoroDuration(val);
            });
        }
        // 模式切换
        var modeDefault = document.getElementById('wbPomodoroModeDefault');
        var modeFocus = document.getElementById('wbPomodoroModeFocus');
        if (modeDefault) modeDefault.addEventListener('click', function () { ns.setPomodoroMode('default'); });
        if (modeFocus) modeFocus.addEventListener('click', function () { ns.setPomodoroMode('focus'); });
        // 休息时长
        var restBtns = document.querySelectorAll('.wb-pomodoro-rest-btn');
        restBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var rest = parseInt(btn.dataset.rest, 10);
                if (!isNaN(rest)) {
                    state.pomodoroRestDuration = rest;
                    restBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
                }
            });
        });

        // ===== v2 我 Tab 事件 =====
        // AI Key 保存
        var aiSaveKey = document.getElementById('wbMeAiSaveKey');
        if (aiSaveKey) {
            aiSaveKey.addEventListener('click', async function () {
                var apiKey = dom.wbMeAiApiKey ? dom.wbMeAiApiKey.value.trim() : '';
                var endpoint = dom.wbMeAiEndpoint ? dom.wbMeAiEndpoint.value.trim() : '';
                var model = dom.wbMeAiModel ? dom.wbMeAiModel.value.trim() : '';
                if (!apiKey) { alert('请填写 API Key'); return; }
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.aiApi.apiKey = apiKey;
                config.aiApi.endpoint = endpoint || ns.DEFAULT_V2_CONFIG.aiApi.endpoint;
                config.aiApi.model = model || ns.DEFAULT_V2_CONFIG.aiApi.model;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast('API 配置已保存', 'success');
            });
        }
        // AI 生成总结
        var aiGenerate = document.getElementById('wbMeAiGenerate');
        if (aiGenerate) aiGenerate.addEventListener('click', ns.generateAISummary);
        // AI 保存为笔记
        var aiSaveNote = document.getElementById('wbMeAiSaveNote');
        if (aiSaveNote) {
            aiSaveNote.addEventListener('click', function () {
                if (!dom.wbMeAiContent) return;
                var content = dom.wbMeAiContent.textContent || dom.wbMeAiContent.innerText || '';
                ns.createNote({ title: 'AI 每日总结 - ' + new Date().toLocaleDateString('zh-CN'), content: content, type: 'note', tags: ['AI总结'] }).then(function () {
                    ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast('已保存为笔记', 'success');
                });
            });
        }
        // 导出筛选（设置面板中）
        var exportFilters = document.querySelectorAll('#wbSettingsExportFilters [data-export-filter]');
        exportFilters.forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.exportFilter = btn.dataset.exportFilter;
                exportFilters.forEach(function (b) { b.classList.toggle('active', b === btn); });
                ns.renderExportList(state.exportFilter);
            });
        });
        // 全选
        var selectAllBtn = document.getElementById('wbMeSelectAll');
        if (selectAllBtn) selectAllBtn.addEventListener('click', ns.toggleSelectAllExport);
        // 导出选中
        var exportBtn = document.getElementById('wbMeExportSelected');
        if (exportBtn) exportBtn.addEventListener('click', ns.exportSelected);
        // 设置开关
        if (dom.wbMeToggleStrict) {
            dom.wbMeToggleStrict.addEventListener('change', async function () {
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.behavior.strictMode = dom.wbMeToggleStrict.checked;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
            });
        }
        if (dom.wbMeToggleFileSync) {
            dom.wbMeToggleFileSync.addEventListener('change', async function () {
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.fileSync.enabled = dom.wbMeToggleFileSync.checked;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast(
                    config.fileSync.enabled ? '文件自动同步已开启' : '文件自动同步已关闭', 'success'
                );
            });
        }
        // 专注模式快捷键保存
        if (dom.wbMeShortcutSave) {
            dom.wbMeShortcutSave.addEventListener('click', async function () {
                var sc = {
                    ctrl: dom.wbMeShortcutCtrl ? dom.wbMeShortcutCtrl.checked : true,
                    shift: dom.wbMeShortcutShift ? dom.wbMeShortcutShift.checked : false,
                    alt: dom.wbMeShortcutAlt ? dom.wbMeShortcutAlt.checked : false,
                    key: dom.wbMeShortcutKey ? dom.wbMeShortcutKey.value.trim().toLowerCase() : 'k'
                };
                if (!sc.key) { alert('请输入快捷键字母'); return; }
                state._focusShortcut = sc;
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.focusShortcut = sc;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.updateContextMenuLabel();
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast('快捷键已保存', 'success');
            });
        }

        // ===== 快捷方式大小/列数 =====
        function applyShortcutSizeFn(size) { ns.applyShortcutSize(size); }
        function applyShortcutColumnsFn(cols) { ns.applyShortcutColumns(cols); }
    };

})(window.DevHome);
