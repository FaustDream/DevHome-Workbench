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

        if (dom.devhomeBackHome) dom.devhomeBackHome.addEventListener('click', ns.showDailyMode);
        // 清空历史按钮
        var taskClearBtn = document.getElementById('wbTaskClearBtn');
        if (taskClearBtn) taskClearBtn.addEventListener('click', function () { ns.clearCompletedTasks(); });
        // 活跃/全部切换
        var taskFilterBtn = document.getElementById('wbTaskFilterBtn');
        if (taskFilterBtn) taskFilterBtn.addEventListener('click', function () {
            ns.toggleQuadrantFilter();
            console.log('[交互] 过滤切换 ' + (state._quadrantFilter || 'active'));
        });
        // 侧边栏折叠/展开按钮
        var quadToggleBtn = document.getElementById('wbQuadrantToggle');
        if (quadToggleBtn) {
            quadToggleBtn.addEventListener('click', function () {
                ns.toggleQuadrantSidebar();
            });
        }
        // 右侧栏折叠/展开按钮
        var rightbarToggleBtn = document.getElementById('wbRightbarToggle');
        if (rightbarToggleBtn) {
            rightbarToggleBtn.addEventListener('click', function () {
                ns.toggleRightSidebar();
            });
        }

        // ===== 象限分组导航事件 =====
        var quadrantNav = document.getElementById('wbQuadrantNav');
        if (quadrantNav) {
            // 点击委托：复选框、更多按钮、添加按钮、菜单操作
            quadrantNav.addEventListener('click', function (e) {
                // 复选框 → 标记完成
                var check = e.target.closest('.wb-task-check');
                if (check) {
                    e.stopPropagation();
                    ns.completeQuadrantTask(check.dataset.quadrant, check.dataset.taskId);
                    return;
                }
                // 更多按钮 → 显示操作菜单
                var moreBtn = e.target.closest('.wb-task-more-btn');
                if (moreBtn) {
                    e.stopPropagation();
                    ns.showTaskContextMenu(moreBtn.dataset.taskId, moreBtn.dataset.quadrant, e);
                    return;
                }
                // 添加按钮 → 显示输入框
                var addBtn = e.target.closest('.wb-quadrant-group-add');
                if (addBtn) {
                    e.stopPropagation();
                    ns.showQuadrantInput(addBtn.dataset.quadrant, addBtn);
                    console.log('[交互] 点击象限添加任务 ' + addBtn.dataset.quadrant);
                    return;
                }
            });
        }

        // ===== 浮动菜单操作（在 document 上委托） =====
        document.addEventListener('click', function (e) {
            var menuItem = e.target.closest('.wb-task-context-menu button');
            if (!menuItem) return;
            e.stopPropagation();
            var action = menuItem.dataset.action;
            var taskId = menuItem.dataset.taskId;
            var quadrant = menuItem.dataset.quadrant;

            if (action === 'move') {
                ns.changeTaskQuadrant(taskId, menuItem.dataset.from, menuItem.dataset.to);
                ns.hideTaskContextMenu();
                console.log('[交互] 任务菜单 移动 ' + taskId);
            } else if (action === 'delete') {
                ns.cancelQuadrantTask(quadrant, taskId);
                ns.hideTaskContextMenu();
                console.log('[交互] 任务菜单 删除 ' + taskId);
            } else if (action === 'link-notes') {
                ns.showTaskLinkNotesPopup(taskId);
                ns.hideTaskContextMenu();
                console.log('[交互] 任务菜单 关联笔记 ' + taskId);
            }
        });

        // ===== 右侧迷你日历导航 =====
        var miniCalPrev = document.getElementById('wbMiniCalPrev');
        var miniCalNext = document.getElementById('wbMiniCalNext');
        if (miniCalPrev) {
            miniCalPrev.addEventListener('click', function () {
                ns.navigateCalendar(-1);
                console.log('[交互] 迷你日历 上一月');
            });
        }
        if (miniCalNext) {
            miniCalNext.addEventListener('click', function () {
                ns.navigateCalendar(1);
                console.log('[交互] 迷你日历 下一月');
            });
        }

        // 日历视图切换按钮
        document.querySelectorAll('.wb-cal-view-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                ns.switchCalendarView(btn.dataset.view);
                console.log('[交互] 日历视图切换 ' + btn.dataset.view);
            });
        });



        // ===== 番茄钟控制 =====
        var pomoSideStart = document.getElementById('wbPomodoroSideStart');
        var pomoSideReset = document.getElementById('wbPomodoroSideReset');
        if (pomoSideStart) {
            pomoSideStart.addEventListener('click', function () {
                // 切换开始/暂停
                if (pomoSideStart.classList.contains('is-running')) {
                    ns.pausePomodoro();
                    console.log('[交互] 番茄钟 暂停');
                } else {
                    ns.startPomodoro();
                    console.log('[交互] 番茄钟 开始');
                }
            });
        }
        if (pomoSideReset) pomoSideReset.addEventListener('click', function () { ns.resetPomodoro(); console.log('[交互] 番茄钟 重置'); });

        // 倒计时/正计时模式切换
        document.querySelectorAll('.wb-pomodoro-mode-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                ns.togglePomodoroMode(btn.dataset.mode);
            });
        });

        // 休息时长输入
        var restInput = document.getElementById('wbPomodoroRestInput');
        if (restInput) {
            restInput.addEventListener('change', function () {
                ns.setPomodoroRestDuration(this.value);
            });
        }

        // 圆形快捷时长按钮 — 仅选中时长，不自动开始
        document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var duration = parseInt(btn.dataset.duration);
                ns.setPomodoroDuration(duration);
                console.log('[交互] 番茄钟选中时长 ' + duration + '分钟');
            });
        });





        // ===== 滚轮翻页 =====
        dom.tilesContainer.addEventListener('wheel', ns.handleWheelScroll, { passive: false });
        dom.tilesContainer.addEventListener('click', ns.handleTileDeleteClick);
        dom.tilesContainer.addEventListener('keydown', ns.handleTileDeleteKeydown);

        // ===== 空白区域右键菜单 =====
        dom.blankContextMenu.addEventListener('click', function (e) { var item = e.target.closest('.context-menu-item'); if (item && item.dataset.action) ns.handleBlankMenuAction(item.dataset.action); });

        // ===== 编辑器右键菜单（contenteditable 精简版：复制粘贴） =====
        var editorMenu = document.getElementById('editorContextMenu');
        if (editorMenu) {
            editorMenu.addEventListener('mousedown', function (e) {
                if (e.target.closest('.ctx-has-submenu')) return;
                var item = e.target.closest('.context-menu-item');
                if (!item || !item.dataset.editorAction) return;
                e.preventDefault();
                console.log('[交互] 右键菜单 ' + item.dataset.editorAction);

                var action = item.dataset.editorAction;
                if (action === 'copy') {
                    document.execCommand('copy');
                } else if (action === 'paste') {
                    document.execCommand('paste');
                }
                var em = document.getElementById('editorContextMenu');
                if (em) em.classList.remove('visible');
            });
        }


        // ===== 设置面板 =====
        if (dom.settingsGearBtn) dom.settingsGearBtn.addEventListener('click', ns.openSettingsPanel);
        if (dom.settingsCloseBtn) dom.settingsCloseBtn.addEventListener('click', ns.closeSettingsPanel);
        if (dom.settingsOverlay) dom.settingsOverlay.addEventListener('click', function (e) { if (e.target === dom.settingsOverlay) ns.closeSettingsPanel(); });
        if (dom.changelogBtn) dom.changelogBtn.addEventListener('click', function () { ns.closeSettingsPanel(); ns.openChangelog(); });
        // ===== 更新说明弹窗（已迁移至 Shadcn Dialog） =====
        if (dom.settingsPanel) {
            // 设置面板点击委托
            dom.settingsPanel.addEventListener('click', function (e) {
                // 左侧导航 Tab
                var navItem = e.target.closest('.s-nav-item');
                if (navItem) {
                    ns.switchSettingsTab(navItem.dataset.sTab);
                    return;
                }
                // 分段选择器（快捷方式大小/列数）
                var segBtn = e.target.closest('.s-seg-btn');
                if (segBtn) {
                    e.preventDefault();
                    if (segBtn.dataset.shortcutSize) {
                        applyShortcutSizeFn(segBtn.dataset.shortcutSize);
                    } else if (segBtn.dataset.shortcutColumns) {
                        applyShortcutColumnsFn(segBtn.dataset.shortcutColumns);
                    }
                    ns.syncSettingsControls();
                    return;
                }
                // 色彩模式按钮
                var schemeCard = e.target.closest('.s-theme-card');
                if (schemeCard && schemeCard.dataset.scheme && ns.theme) {
                    ns.theme.setScheme(schemeCard.dataset.scheme);
                    ns.syncSettingsControls();
                    return;
                }
                // 设置操作按钮
                var settingBtn = e.target.closest('[data-setting-action]');
                if (settingBtn) { e.preventDefault(); ns.handleSettingsAction(settingBtn.dataset.settingAction); return; }
                // 导出过滤按钮
                var exportFilter = e.target.closest('[data-export-filter]');
                if (exportFilter && typeof ns.setExportFilter === 'function') {
                    ns.setExportFilter(exportFilter.dataset.exportFilter);
                    return;
                }
                // AI Key 密码切换
                var aiKeyIcon = e.target.closest('#sToggleAiKey');
                if (aiKeyIcon) {
                    var input = document.getElementById('wbMeAiApiKey');
                    if (input) {
                        var isPass = input.type === 'password';
                        input.type = isPass ? 'text' : 'password';
                        aiKeyIcon.textContent = isPass ? '🙈' : '👁';
                    }
                }
            });

            // 设置面板 change 委托（Toggle 开关 + 快捷键捕获）
            dom.settingsPanel.addEventListener('change', function (e) {
                var cb = e.target;
                if (!cb || cb.type !== 'checkbox') return;
                // Matrix 数字雨
                if (cb.id === 'matrixRainToggle') {
                    var params = document.getElementById('matrixRainParams');
                    if (cb.checked && ns.matrixRain) { ns.matrixRain.start(); if (params) params.style.display = ''; }
                    else { if (ns.matrixRain) ns.matrixRain.stop(); if (params) params.style.display = 'none'; }
                    return;
                }
                // 自动聚焦
                if (cb.closest('#sToggleAutoFocus')) { ns.handleSettingsAction('toggleAutoFocus'); return; }
                // 分类记忆
                if (cb.closest('#sToggleCategoryMemory')) { ns.handleSettingsAction('toggleCategoryMemory'); return; }
                // 严厉模式 / 文件同步
                var toggleStrict = cb.closest('#sToggleStrict');
                if (toggleStrict) { ns._saveStrictMode(cb.checked); return; }
                var toggleFileSync = cb.closest('#sToggleFileSync');
                if (toggleFileSync) { ns._saveFileSync(cb.checked); return; }
            });
        }

        // ===== 快捷键捕获组件 =====
        var shortcutCapture = document.getElementById('sShortcutCapture');
        if (shortcutCapture) {
            var _scKeys = [];
            shortcutCapture.addEventListener('keydown', function (e) {
                e.preventDefault();
                var parts = [];
                if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
                if (e.shiftKey) parts.push('Shift');
                if (e.altKey) parts.push('Alt');
                if (e.key && e.key.length === 1 && !['Control','Shift','Alt','Meta'].includes(e.key)) {
                    parts.push(e.key.toUpperCase());
                }
                if (parts.length > 0) {
                    _scKeys = parts;
                    var display = document.getElementById('sShortcutKeys');
                    if (display) display.textContent = parts.join(' + ');
                    shortcutCapture.classList.add('recording');
                }
            });
            shortcutCapture.addEventListener('blur', function () {
                shortcutCapture.classList.remove('recording');
                // 保存捕获的键
                if (_scKeys.length > 0) {
                    var ctrlEl = document.getElementById('wbMeShortcutCtrl');
                    var shiftEl = document.getElementById('wbMeShortcutShift');
                    var altEl = document.getElementById('wbMeShortcutAlt');
                    var keyEl = document.getElementById('wbMeShortcutKey');
                    if (ctrlEl) ctrlEl.value = _scKeys.includes('Ctrl') ? '1' : '0';
                    if (shiftEl) shiftEl.value = _scKeys.includes('Shift') ? '1' : '0';
                    if (altEl) altEl.value = _scKeys.includes('Alt') ? '1' : '0';
                    if (keyEl) keyEl.value = (_scKeys.filter(function(k){return k.length===1;})[0] || 'K').toLowerCase();
                }
            });
            shortcutCapture.addEventListener('click', function () { shortcutCapture.focus(); });
        }

        // ===== 保存快捷键 =====
        var shortcutSave = document.getElementById('wbMeShortcutSave');
        if (shortcutSave) {
            shortcutSave.addEventListener('click', function () {
                ns._saveShortcut();
            });
        }

        // ===== 搜索引擎 =====
        dom.engineSelector.addEventListener('click', function (e) { e.stopPropagation(); ns.toggleEngineDropdown(); });
        dom.engineDropdown.addEventListener('click', function (e) { var opt = e.target.closest('.engine-option'); if (opt) { ns.setEngine(opt.dataset.engine); ns.hideEngineDropdown(); } });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.search-engine-selector') && !e.target.closest('.engine-dropdown')) ns.hideEngineDropdown();
            if (state.tileEditMode && !e.target.closest('.tile') && !e.target.closest('.tile-delete-btn')) ns.setTileEditMode(false);
            if (state.categoryEditMode && !e.target.closest('.cat-row')) { state.categoryEditMode = false; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', false); }
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
                var isFocusMode = state.currentDevhomeMode !== 'daily';
                var hasEngineDropdown = dom.engineDropdown && dom.engineDropdown.classList.contains('visible');
                var hasSuggestions = state.suggestionsVisible;
                var isSearchFocused = document.activeElement === dom.searchInput;
                var hasSettingsOpen = dom.settingsOverlay && dom.settingsOverlay.classList.contains('visible');

                // 仅在确实需要拦截时才阻止默认行为
                if (isFocusMode || hasEngineDropdown || hasSuggestions || isSearchFocused || hasSettingsOpen) {
                    e.preventDefault();
                }
                if (isFocusMode) { ns.exitFocusMode(); }
                ns.hideEngineDropdown(); ns.hideSuggestions(); ns.closeSettingsPanel();
                if (isSearchFocused) dom.searchInput.blur();
            }
            // 可配置的专注模式快捷键
            if (ns.isFocusModeShortcut(e)) { e.preventDefault(); ns.toggleFocusMode(); }
            // Ctrl+I 打开 AI 对话
            if (e.ctrlKey && e.key === 'i' && !e.shiftKey && !e.altKey && !e.metaKey) {
                if (!isEditing) { e.preventDefault(); if (ns.aiChat) ns.aiChat.open(); }
            }
            // 仅在非编辑状态下拦截数字键切换搜索引擎
            var activeEl = document.activeElement;
            var isEditing = activeEl === dom.wbNoteTitle
                || activeEl === dom.wbNoteContent
                || activeEl === dom.wbNotesSearch
                || activeEl === dom.wbCaptureInput
                || activeEl === dom.wbMeAiApiKey
                || activeEl === dom.wbMeAiEndpoint
                || activeEl === dom.wbMeAiModel
                || activeEl === dom.wbMeShortcutKey
                || (activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT'));
            if (!isEditing && activeEl !== dom.searchInput) {
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
        // 弹窗事件已迁移至 Shadcn Dialog 组件（shadcn-dialogs.js），不再需要原生 DOM 绑定

        // ===== 右键菜单全局 =====
        document.addEventListener('contextmenu', function (e) {
            if (e.target.closest('.tile')) { e.preventDefault(); }
            // 专注模式下的编辑器右键：保存选区后显示编辑器菜单
            else if (dom.wbNoteContent && dom.wbNoteContent.contains(e.target) && state.currentDevhomeMode === 'workbench') {
                // 保存当前选区以便工具栏按钮恢复
                var sel = window.getSelection();
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

        // ===== 背景上传 =====
        dom.bgInput.addEventListener('change', function (e) {
            var file = e.target.files[0]; if (!file) return;
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) ns.bgManager.upload(file);
            else ns.showToast('请选择图片或视频文件', 'error');
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

        // ===== Matrix 数字雨开关 =====
        var matrixRainToggle = document.getElementById('matrixRainToggle');
        var matrixRainParams = document.getElementById('matrixRainParams');
        if (matrixRainToggle && ns.matrixRain) {
            // 同步初始状态
            var isOn = ns.matrixRain.isRunning();
            matrixRainToggle.checked = isOn;
            if (matrixRainParams) matrixRainParams.style.display = isOn ? '' : 'none';

            matrixRainToggle.addEventListener('change', function () {
                var params = document.getElementById('matrixRainParams');
                if (this.checked) {
                    ns.matrixRain.start();
                    if (params) params.style.display = '';
                    console.log('[数字雨] 开启');
                } else {
                    ns.matrixRain.stop();
                    if (params) params.style.display = 'none';
                    console.log('[数字雨] 关闭');
                }
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
                                ns.renderTiles(); ns.refreshCatRowIfVisible();
                                ns.showToast('备份导入成功！', 'success');
                            }
                        } else ns.showToast('无效的备份文件格式！', 'error');
                    } catch (err) { ns.showToast('读取文件失败，请确保选择的是有效的 JSON 配置文件！', 'error'); }
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
                        ns.refreshCatRowIfVisible();
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
                    ns.refreshCatRowIfVisible();
                    ns.syncSettingsControls();
                    ns.bindEvents();
                }
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
                // 删除按钮点击 — Toast + 撤销
                var delBtn = e.target.closest('.wb-note-list-del');
                if (delBtn) {
                    e.stopPropagation();
                    var delId = delBtn.dataset.delId;
                    var delKind = delBtn.dataset.delKind;
                    var item = delKind === 'capture'
                        ? (state.captures.find(function(c){return c.id===delId;}) || null)
                        : (state.notes.find(function(n){return n.id===delId;}) || null);
                    if (!item) return;
                    // 使用 deleteWithUndo 直接删除，弹出撤销 Toast
                    ns.deleteWithUndo(item, delKind);
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
                        ns.showPrompt('重命名标签（可用 "emoji 名称" 格式）：', { title: '重命名标签', defaultValue: oldText }).then(function (newVal) {
                            if (newVal && newVal.trim()) {
                                var parsed = (function (input) {
                                    var m = input.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
                                    if (m) return { icon: m[1], name: input.slice(m[0].length).trim() || input };
                                    return { icon: '', name: input.trim() };
                                })(newVal.trim());
                                ns.renameFilter(filterKey, parsed.icon || '', parsed.name);
                            }
                        });
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

        // 新增自定义标签分类（行内创建，无弹窗）
        if (dom.wbFilterAddBtn) {
            dom.wbFilterAddBtn.addEventListener('click', function () {
                // 防止重复创建行内编辑器
                if (document.querySelector('.wb-filter-chip-editing')) return;
                ns.startInlineCustomFilter();
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
        // 笔记编辑器"转为任务"按钮
        var noteToTaskBtn = document.getElementById('wbNoteToTaskBtn');
        if (noteToTaskBtn) {
            noteToTaskBtn.addEventListener('click', function () {
                if (!state.currentNote) return;
                ns.convertNoteToTask(state.currentNote.id);
                console.log('[交互] 笔记转任务 ' + state.currentNote.id);
            });
        }
        }
        // 编辑器类型徽章点击（支持多选）
        if (dom.wbNoteTypeBadge) {
            dom.wbNoteTypeBadge.addEventListener('click', function (e) {
                // 单个类型 chip 的 × 移除
                var delChip = e.target.closest('.wb-type-chip-del');
                if (delChip) {
                    e.preventDefault(); e.stopPropagation();
                    var typeKey = delChip.dataset.type;
                    if (typeKey) ns.removeNoteType(typeKey);
                    return;
                }
                // + 按钮 → 弹出选择器
                if (e.target.closest('.badge-add')) {
                    e.preventDefault(); e.stopPropagation();
                    ns.toggleTypePicker();
                    return;
                }
                // 徽章其他区域 → 弹出选择器
                e.preventDefault(); e.stopPropagation();
                ns.toggleTypePicker();
            });
        }
        // 类型选择器内点击选项（多选 toggle）
        var typePicker = document.getElementById('wbTypePickerList');
        if (typePicker) {
            typePicker.addEventListener('click', function (e) {
                var item = e.target.closest('.wb-type-picker-item');
                if (!item) return;
                e.preventDefault(); e.stopPropagation();
                var typeKey = item.dataset.type;
                if (typeKey) ns.toggleNoteType(typeKey);
            });
        }
        // 点击编辑器外部关闭类型选择器
        document.addEventListener('click', function (e) {
            var picker = document.getElementById('wbNoteTypePicker');
            if (!picker || picker.style.display === 'none') return;
            if (!e.target.closest('#wbNoteTypeBadge') && !e.target.closest('#wbNoteTypePicker')) {
                ns.hideTypePicker();
            }
        });
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
        // 暴露给外部调用（类型选择器等需要触发保存的场景）
        ns._triggerAutoSave = function () {
            if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
            noteAutoSaveTimer = setTimeout(function () {
                if (state.currentNote) {
                    ns.saveCurrentNote().then(function () {
                        ns.renderNotesList(state._notesFilter, state._notesSearch);
                    });
                }
            }, 400);
        };
        if (dom.wbNoteTitle) dom.wbNoteTitle.addEventListener('input', autoSaveNote);
        if (dom.wbNoteContent) {
            dom.wbNoteContent.addEventListener('input', autoSaveNote);
        }

        // 旧版格式工具栏事件（仅在 contenteditable 回退模式下生效）
        // 当前使用 ProseMirror 气泡工具栏，这些 DOM 元素不存在时为静默跳过
        var toolbarHeading = document.getElementById('wbToolbarHeading');
        var toolbarBold = document.getElementById('wbToolbarBold');
        var toolbarItalic = document.getElementById('wbToolbarItalic');
        var toolbarUnderline = document.getElementById('wbToolbarUnderline');
        var toolbarUl = document.getElementById('wbToolbarUl');
        var toolbarOl = document.getElementById('wbToolbarOl');
        var toolbarColor = document.getElementById('wbToolbarColor');
        var toolbarHighlight = document.getElementById('wbToolbarHighlight');
        var colorPalette = document.getElementById('wbColorPalette');
        // 仅当旧工具栏存在时才绑定事件（ProseMirror 模式下不存在）
        var hasLegacyToolbar = !!toolbarHeading;
        if (hasLegacyToolbar) {
            // 保存/恢复选区辅助函数
            function saveSelection() {
                var sel = window.getSelection();
                if (sel.rangeCount && dom.wbNoteContent && dom.wbNoteContent.contains(sel.anchorNode)) {
                    state._savedSelection = sel.getRangeAt(0).cloneRange();
                }
            }
            function restoreSelection() {
                if (!state._savedSelection) return;
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(state._savedSelection);
            }
            // 监听编辑器内选区变化并保存，同时同步工具栏按钮状态
            if (dom.wbNoteContent) {
                dom.wbNoteContent.addEventListener('mouseup', function () { saveSelection(); syncToolbarState(); });
                dom.wbNoteContent.addEventListener('keyup', syncToolbarState);
            }

            toolbarHeading.addEventListener('mousedown', function (e) {
                var sel = window.getSelection();
                if (sel.rangeCount && dom.wbNoteContent && dom.wbNoteContent.contains(sel.anchorNode)) {
                    state._savedSelection = sel.getRangeAt(0).cloneRange();
                    console.log('[交互] 打开标题下拉 已保存选区');
                }
            });
            toolbarHeading.addEventListener('change', function () {
                var val = toolbarHeading.value;
                if (!val) return;
                console.log('[编辑] 标题下拉 选中 ' + val);
                dom.wbNoteContent.focus();
                if (state._savedSelection) restoreSelection();
                else console.warn('[警告] 标题下拉 restoreSelection 选区为空');
                if (val !== 'p') {
                    document.execCommand('formatBlock', false, '<' + val + '>');
                } else {
                    document.execCommand('formatBlock', false, '<p>');
                }
                toolbarHeading.value = '';
                saveSelection();
                syncToolbarState();
            });

            if (toolbarBold) {
                toolbarBold.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    console.log('[交互] 工具栏 加粗' + (state._savedSelection ? ' 恢复选区' : ''));
                    if (state._savedSelection) restoreSelection();
                    else console.warn('[警告] 加粗 restoreSelection 选区为空');
                    dom.wbNoteContent.focus();
                    document.execCommand('bold', false, null);
                    saveSelection();
                    syncToolbarState();
                });
            }
            if (toolbarItalic) {
                toolbarItalic.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    console.log('[交互] 工具栏 斜体');
                    if (state._savedSelection) restoreSelection();
                    dom.wbNoteContent.focus();
                    document.execCommand('italic', false, null);
                    saveSelection();
                });
            }
            if (toolbarUnderline) {
                toolbarUnderline.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    console.log('[交互] 工具栏 下划线');
                    if (state._savedSelection) restoreSelection();
                    dom.wbNoteContent.focus();
                    document.execCommand('underline', false, null);
                    saveSelection();
                });
            }
            if (toolbarUl) {
                toolbarUl.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    console.log('[交互] 工具栏 无序列表');
                    if (state._savedSelection) restoreSelection();
                    dom.wbNoteContent.focus();
                    document.execCommand('insertUnorderedList', false, null);
                    saveSelection();
                });
            }
            if (toolbarOl) {
                toolbarOl.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    console.log('[交互] 工具栏 有序列表');
                    if (state._savedSelection) restoreSelection();
                    dom.wbNoteContent.focus();
                    document.execCommand('insertOrderedList', false, null);
                    saveSelection();
                });
            }
            // 工具栏颜色按钮 → 弹出颜色面板
            if (toolbarColor && colorPalette) {
                toolbarColor.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    var sel = window.getSelection();
                    if (sel.rangeCount && dom.wbNoteContent && dom.wbNoteContent.contains(sel.anchorNode)) {
                        state._savedSelection = sel.getRangeAt(0).cloneRange();
                    }
                    var isVisible = colorPalette.style.display === 'grid';
                    if (isVisible) {
                        console.log('[面板] 关闭颜色面板');
                        colorPalette.style.display = 'none';
                    } else {
                        var btnRect = toolbarColor.getBoundingClientRect();
                        console.log('[面板] 打开颜色面板 坐标(' + Math.round(btnRect.left) + ',' + Math.round(btnRect.bottom) + ')');
                        var colors = ['#1a1410', '#2d2820', '#4a443e', '#6e6860', '#8e8880',
                            '#c0692a', '#d94a3a', '#e74c3c', '#e67e22', '#f39c12',
                            '#27ae60', '#2ecc71', '#1abc9c', '#16a085', '#2980b9',
                            '#3498db', '#8e44ad', '#9b59b6', '#2c3e50', '#7f8c8d'];
                        colorPalette.innerHTML = colors.map(function (hex) {
                            return '<div class="wb-color-swatch" data-hex="' + hex + '" style="background:' + hex + ';" title="' + hex + '"></div>';
                        }).join('');
                        colorPalette.style.position = 'fixed';
                        colorPalette.style.top = (btnRect.bottom + 4) + 'px';
                        colorPalette.style.left = btnRect.left + 'px';
                        colorPalette.style.zIndex = '2800';
                        colorPalette.style.display = 'grid';
                    }
                });
                // 颜色样本点击——用 mousedown 阻止失焦
                colorPalette.addEventListener('mousedown', function (e) {
                    var swatch = e.target.closest('.wb-color-swatch');
                    if (!swatch || !swatch.dataset.hex) return;
                    e.preventDefault();
                    console.log('[编辑] 应用颜色 ' + swatch.dataset.hex + (state._savedSelection ? '' : ' 选区为空'));
                    if (state._savedSelection) restoreSelection();
                    else console.warn('[警告] 颜色 restoreSelection 选区为空');
                    dom.wbNoteContent.focus();
                    document.execCommand('foreColor', false, swatch.dataset.hex);
                    saveSelection();
                    colorPalette.style.display = 'none';
                    syncToolbarState();
                });
                document.addEventListener('click', function (e) {
                    if (colorPalette.style.display === 'grid' && !e.target.closest('#wbToolbarColor') && !e.target.closest('#wbColorPalette') && !e.target.closest('#wbToolbarHeading')) {
                        colorPalette.style.display = 'none';
                    }
                });
            }
            if (toolbarHighlight) {
                toolbarHighlight.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    console.log('[交互] 工具栏 高亮背景');
                    if (state._savedSelection) restoreSelection();
                    else console.warn('[警告] 高亮 restoreSelection 选区为空');
                    dom.wbNoteContent.focus();
                    document.execCommand('hiliteColor', false, '#fff3cd');
                    saveSelection();
                });
            }

            // 同步工具栏按钮状态
            function syncToolbarState() {
                if (toolbarBold) toolbarBold.classList.toggle('active', document.queryCommandState('bold'));
                if (toolbarItalic) toolbarItalic.classList.toggle('active', document.queryCommandState('italic'));
                if (toolbarUnderline) toolbarUnderline.classList.toggle('active', document.queryCommandState('underline'));
            }
        }

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

        // ===== AI 助手事件 =====
        // 供应商列表点击选择
        if (dom.wbAiProviderList) {
            dom.wbAiProviderList.addEventListener('click', function (e) {
                var item = e.target.closest('.ai-provider-item');
                if (!item) return;
                var delBtn = e.target.closest('.ai-provider-del-btn');
                if (delBtn) {
                    e.stopPropagation();
                    var pid = item.dataset.providerId;
                    ns.deleteAiProvider(pid);
                    return;
                }
                // 选择供应商
                var providerId = item.dataset.providerId;
                ns.selectAiProvider(providerId);
            });
        }
        // 添加供应商
        if (dom.wbAiAddProvider) {
            dom.wbAiAddProvider.addEventListener('click', function () {
                ns.addAiProvider();
            });
        }
        // AI 配置保存
        var aiSaveKey = document.getElementById('wbMeAiSaveKey');
        if (aiSaveKey) {
            aiSaveKey.addEventListener('click', function () {
                ns.saveAiProviderConfig();
            });
        }
        // AI 生成每日总结
        var aiGenerate = document.getElementById('wbMeAiGenerate');
        if (aiGenerate) aiGenerate.addEventListener('click', function () {
            ns.generateAISummary();
            console.log('[交互] AI 生成每日总结');
        });
        // AI 对话面板
        var aiQuickChat = document.getElementById('wbMeAiQuickChat');
        if (aiQuickChat) aiQuickChat.addEventListener('click', function () {
            if (ns.aiChat) ns.aiChat.open();
            console.log('[交互] 打开 AI 对话面板');
        });
        // AI 保存为笔记
        var aiSaveNote = document.getElementById('wbMeAiSaveNote');
        if (aiSaveNote) {
            aiSaveNote.addEventListener('click', function () {
                if (!dom.wbMeAiContent) return;
                var content = dom.wbMeAiContent.textContent || dom.wbMeAiContent.innerText || '';
                var title = 'AI 每日总结 - ' + new Date().toLocaleDateString('zh-CN');
                ns.createNote({ title: title, content: content, type: 'note', tags: ['AI总结'] }).then(function () {
                    ns.showToast('AI 总结已保存为笔记', 'success');
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
                if (!sc.key) { ns.showToast('请输入快捷键字母', 'error'); return; }
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

