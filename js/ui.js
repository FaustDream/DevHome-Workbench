/**
 * DevHome Workbench - 右键菜单、设置面板与磁贴编辑弹窗
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
    var devhomeStorage = ns.devhomeStorage;
    var bgManager = ns.bgManager;
    var defaultWorkbenchState = ns.defaultWorkbenchState;

    /* ===== 右键菜单 ===== */
    var submenuTimer = null;
    var submenuMode = ''; // 'move' 或 'copy'

    function populateSubMenu(container, pageNames, excludeIndex) {
        container.innerHTML = '';
        pageNames.forEach(function (name, idx) {
            if (idx === excludeIndex) return;
            var item = document.createElement('div');
            item.className = 'context-menu-item';
            item.setAttribute('data-page', idx);
            var arrowSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="opacity:0.5"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            item.innerHTML = arrowSvg + '<span>' + escapeHtml(name) + '</span>';
            container.appendChild(item);
        });
    }

    function showCategorySubMenu(parentItem) {
        clearTimeout(submenuTimer);
        var subMenu = document.getElementById('ctxCategorySubMenu');
        if (!subMenu) return;
        submenuMode = parentItem.dataset.submenu;
        populateSubMenu(subMenu, state.pageNames, state.currentPage);
        if (!subMenu.children.length) { hideCategorySubMenu(); return; }

        var parentRect = parentItem.getBoundingClientRect();
        var ctxRect = dom.contextMenu.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var margin = 4;
        // 先显示才能获取子菜单实际尺寸
        subMenu.classList.add('visible');
        var subRect = subMenu.getBoundingClientRect();

        // ===== 水平判定：优先右侧，空间不足则左侧 =====
        var rightSpace = vw - ctxRect.right - margin;
        var leftSpace = ctxRect.left - margin;
        if (rightSpace >= subRect.width) {
            subMenu.style.left = (ctxRect.right + margin) + 'px';
        } else if (leftSpace >= subRect.width) {
            subMenu.style.left = (ctxRect.left - subRect.width - margin) + 'px';
        } else {
            // 两边都不够，贴边放
            subMenu.style.left = Math.max(margin, vw - subRect.width - margin) + 'px';
        }

        // ===== 垂直判定：对齐主菜单项顶部，确保不超出屏幕底部 =====
        var topPos = parentRect.top;
        if (topPos + subRect.height > vh - margin) {
            // 底部溢出 → 向上推，子菜单底部对齐视口底部
            topPos = Math.max(margin, vh - subRect.height - margin);
        }
        subMenu.style.top = topPos + 'px';
    }

    function hideCategorySubMenu() {
        clearTimeout(submenuTimer);
        submenuTimer = setTimeout(function () {
            var sub = document.getElementById('ctxCategorySubMenu');
            if (sub) sub.classList.remove('visible');
            submenuMode = '';
        }, 150);
    }

    ns.cancelSubMenuTimer = function () { clearTimeout(submenuTimer); };

    ns.showContextMenu = function (e) {
        e.preventDefault(); e.stopPropagation();
        var tile = e.currentTarget;
        state.contextMenuTarget = tile;
        dom.contextMenu.style.left = e.clientX + 'px';
        dom.contextMenu.style.top = e.clientY + 'px';
        // 显示/隐藏移动/复制分类项（至少 2 个分类时才显示）
        var hasMulti = state.totalPages > 1;
        var ctxDivider = document.getElementById('ctxMoveDivider');
        var ctxMoveItem = document.getElementById('ctxMoveToItem');
        var ctxCopyItem = document.getElementById('ctxCopyToItem');
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

    ns.showBlankContextMenu = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (e.target.closest('.tile')) return;
        // 根据当前模式动态更新菜单项文案和图标
        var wbItem = dom.blankContextMenu.querySelector('[data-action="openWorkbench"]');
        if (wbItem) {
            var isDaily = state.currentDevhomeMode === 'daily';
            wbItem.querySelector('span').textContent = isDaily ? '进入专注模式' : '退出专注模式';
            var wbIcon = wbItem.querySelector('svg');
            if (wbIcon) {
                wbIcon.innerHTML = isDaily
                    ? '<rect x="1.5" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 13V10.5h4V13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
                    : '<path d="M2 7h10M7 2l-5 5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
            }
        }
        dom.blankContextMenu.classList.add('visible');
        var menuRect = dom.blankContextMenu.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        var posX = e.clientX + 8, posY = e.clientY + 8;
        if (posX + menuRect.width > vw - 8) posX = e.clientX - menuRect.width - 8;
        if (posY + menuRect.height > vh - 8) posY = e.clientY - menuRect.height - 8;
        posX = Math.max(8, posX); posY = Math.max(8, posY);
        dom.blankContextMenu.style.left = posX + 'px';
        dom.blankContextMenu.style.top = posY + 'px';
        setTimeout(function () { document.addEventListener('click', ns.hideBlankContextMenu, { once: true }); }, 0);
    };

    function hideContextMenu() {
        dom.contextMenu.classList.remove('visible');
        state.contextMenuTarget = null;
        var sub = document.getElementById('ctxCategorySubMenu');
        if (sub) sub.classList.remove('visible');
        submenuMode = '';
    }
    ns.hideBlankContextMenu = function () { dom.blankContextMenu.classList.remove('visible'); };

    ns.handleContextMenuAction = function (action) {
        if (!state.contextMenuTarget) return;
        var tileId = state.contextMenuTarget.dataset.tileId;
        var tile = tileManager.currentTiles.find(function (t) { return t.id === tileId; });
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

    /* 处理分类子菜单点击（移动或复制磁贴到目标分类） */
    ns.handleSubMenuClick = function (targetPageIdx) {
        if (!state.contextMenuTarget) return;
        if (isNaN(targetPageIdx) || targetPageIdx === state.currentPage) { hideContextMenu(); return; }
        var tileId = state.contextMenuTarget.dataset.tileId;
        var tile = tileManager.currentTiles.find(function (t) { return t.id === tileId; });
        if (!tile) { hideContextMenu(); return; }
        if (submenuMode === 'copy') {
            tileManager.copyTileToPage(tileId, targetPageIdx);
        } else {
            tileManager.moveTileToPage(tileId, targetPageIdx);
        }
        hideContextMenu();
    };

    ns.handleBlankMenuAction = function (action) {
        switch (action) {
            case 'refresh':
                // 保存当前模式，刷新后恢复
                if (state.currentDevhomeMode !== 'daily') {
                    localStorage.setItem('_devhome_last_mode', state.currentDevhomeMode);
                }
                location.reload();
                break;
            case 'addTile': ns.openUploadModal(); break;
            case 'openWorkbench':
                ns.toggleFocusMode();
                break;
            case 'addPage': ns.addNewPage(); break;
            case 'removePage': ns.removeCurrentPage(); break;
        }
        ns.hideBlankContextMenu();
    };

    /* ===== 设置面板 ===== */
    ns.openSettingsPanel = function () {
        // 根据模式显隐工作台专属内容
        var isWB = state.currentDevhomeMode === 'workbench';
        document.querySelectorAll('#settingsPanel [data-mode="workbench"]').forEach(function (el) {
            el.style.display = isWB ? '' : 'none';
        });
        // 加载 AI 配置到 UI（两种模式均需要）
        if (typeof ns.loadMeConfig === 'function') ns.loadMeConfig();
        // 工作台模式下渲染行为数据和导出列表
        if (isWB) {
            if (typeof ns.renderBehaviorDashboard === 'function') ns.renderBehaviorDashboard();
            if (typeof ns.renderExportList === 'function') ns.renderExportList(state.exportFilter || 'all');
        }
        // 默认切换到第一个 tab
        if (!state._activeSettingsTab) state._activeSettingsTab = 'general';
        ns.switchSettingsTab(state._activeSettingsTab);
        ns.syncSettingsControls();
        dom.settingsOverlay.classList.add('visible');
        ns.hideBlankContextMenu();
        console.log('[面板] 打开设置面板');
    };

    ns.closeSettingsPanel = function () {
        dom.settingsOverlay.classList.remove('visible');
        console.log('[面板] 关闭设置面板');
    };

    /* ===== 更新说明弹窗 ===== */
    ns.openChangelog = function () { dom.changelogOverlay.classList.add('visible'); };
    ns.closeChangelog = function () { dom.changelogOverlay.classList.remove('visible'); };

    /* ===== 设置 Tab 切换 ===== */
    ns.switchSettingsTab = function (tabName) {
        state._activeSettingsTab = tabName;
        // 更新导航 active
        document.querySelectorAll('.s-nav-item').forEach(function (item) {
            item.classList.toggle('active', item.dataset.sTab === tabName);
        });
        // 切换 tab 内容
        document.querySelectorAll('.s-tab').forEach(function (tab) {
            tab.classList.toggle('active', tab.dataset.sTab === tabName);
        });
    };

    ns.syncSettingsControls = function () {
        if (!dom.settingsPanel) return;

        // Toggle 状态
        var setToggle = function (id, state) {
            var el = document.getElementById(id);
            if (!el) { el = document.getElementById(id + 'Toggle'); }
            if (el) {
                var cb = el.querySelector('input[type="checkbox"]') || el;
                if (cb && cb.type === 'checkbox') cb.checked = state;
            }
        };
        setToggle('sToggleCatRow', storage.get('cat_row', false));
        setToggle('sToggleAutoFocus', storage.get('auto_focus', false));
        setToggle('sToggleCategoryMemory', storage.get('category_memory', false));
        setToggle('sToggleStrict', storage.get('strict_mode', false));
        setToggle('sToggleFileSync', storage.get('file_sync', false));

        // 分段选择器
        var sizeKey = ns.normalizeShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE));
        document.querySelectorAll('[data-shortcut-size]').forEach(function (b) { b.classList.toggle('active', b.dataset.shortcutSize === sizeKey); });
        var colsKey = ns.normalizeShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS));
        document.querySelectorAll('[data-shortcut-columns]').forEach(function (b) { b.classList.toggle('active', b.dataset.shortcutColumns === colsKey); });

        // 主题卡片 active 态
        if (ns.theme) {
            var s = ns.theme.getState();
            document.querySelectorAll('.s-theme-card').forEach(function (c) { c.classList.toggle('active', c.dataset.theme === s.themeId); });
        }

        // 数字雨开关 + 参数显隐
        var mrToggle = document.getElementById('matrixRainToggle');
        var mrParams = document.getElementById('matrixRainParams');
        if (mrToggle && ns.matrixRain) {
            var isOn = ns.matrixRain.isRunning();
            mrToggle.checked = isOn;
            if (mrParams) mrParams.style.display = isOn ? '' : 'none';
        }

        // 快捷键显示
        var shortcutKeys = document.getElementById('sShortcutKeys');
        if (shortcutKeys) {
            var ctrlEl = document.getElementById('wbMeShortcutCtrl');
            var shiftEl = document.getElementById('wbMeShortcutShift');
            var altEl = document.getElementById('wbMeShortcutAlt');
            var keyEl = document.getElementById('wbMeShortcutKey');
            var parts = [];
            if (ctrlEl && ctrlEl.value === '1') parts.push('Ctrl');
            if (shiftEl && shiftEl.value === '1') parts.push('Shift');
            if (altEl && altEl.value === '1') parts.push('Alt');
            parts.push((keyEl && keyEl.value || 'K').toUpperCase());
            shortcutKeys.textContent = parts.join(' + ');
        }

        // 文件配置同步状态
        if (ns.fileConfig && ns.fileConfig.isSupported()) {
            var syncInfo = ns.fileConfig.getSyncInfo();
            var hasDir = !!syncInfo.dirName;
            if (dom.configChangeDirBtn) dom.configChangeDirBtn.style.display = '';
            if (dom.configDirLabel) dom.configDirLabel.textContent = hasDir ? '切换配置目录' : '选择配置目录';
            if (dom.configSyncBtn) dom.configSyncBtn.style.display = hasDir ? '' : 'none';
            if (dom.configSyncStatus) {
                dom.configSyncStatus.style.display = '';
                if (hasDir) {
                    var timeStr = syncInfo.lastSyncTime ? new Date(syncInfo.lastSyncTime).toLocaleTimeString('zh-CN') : '未同步';
                    dom.configSyncStatus.textContent = '配置目录：' + syncInfo.dirName + ' | 上次同步：' + timeStr;
                } else {
                    dom.configSyncStatus.textContent = '未选择配置目录';
                }
            }
        }
    };

    ns.handleSettingsAction = function (action) {
        switch (action) {
            case 'uploadBg': dom.bgInput.click(); break;
            case 'resetBg': bgManager.reset(); break;
            case 'toggleAutoFocus': var af = storage.get('auto_focus', false); storage.set('auto_focus', !af); break;
            case 'toggleCategoryMemory':
                var cm = storage.get('category_memory', false);
                storage.set('category_memory', !cm);
                if (!cm) storage.set('last_page', state.currentPage);
                break;
            case 'toggleCatRow':
                ns.applyCategoryButtonMode(!storage.get('cat_row', false));
                break;
            case 'exportData': ns.exportBackupData(); break;
            case 'importData': dom.importInput.click(); break;
            // [v1.3.0] 文件配置操作
            case 'syncToFile':
                if (ns.fileConfig && ns.fileConfig.isReady()) {
                    ns.fileConfig.syncToFile().then(function () {
                        ns.fileConfig.showToast('配置已同步到文件', 'success');
                        ns.syncSettingsControls();
                    }).catch(function (e) {
                        ns.fileConfig.showToast('同步失败：' + (e.message || '未知错误'), 'error');
                    });
                }
                break;
            case 'changeConfigDir':
                if (ns.fileConfig) {
                    ns.fileConfig.pickDir().then(function (success) {
                        if (success) {
                            ns.syncSettingsControls();
                            // 重新加载磁贴数据
                            ns.tileManager.load().then(function () {
                                ns.renderTiles();
                                ns.updatePageIndicator();
                                ns.renderCategoryPopover();
                            });
                            // 重新渲染工作台
                            if (state.workbenchVisible) {
                                state.workbench = ns.getWorkbenchState();
                                ns.renderQuadrantBoard();
                            }
                        }
                    });
                }
                break;
            case 'resetSettings':
                ns.showConfirm('确定要重置所有设置为默认值吗？磁贴数据和页面分类不受影响。', { title: '重置设置' }).then(function (ok) {
                    if (!ok) return;
                    // 清除所有 tabpage_ 设置（排除 pages 备份数据）
                    var keepKeys = ['tabpage_pages', 'tabpage_pageNames', 'tabpage_page_backups'];
                    Object.keys(localStorage).forEach(function (k) {
                        if (k.startsWith('tabpage_') && keepKeys.indexOf(k) === -1) {
                            localStorage.removeItem(k);
                        }
                    });
                    // 保留 devhome_ 工作台数据
                    location.reload();
                });
                break;
        }
        ns.syncSettingsControls();
    };

    /* ===== 磁贴编辑弹窗 ===== */
    ns.openUploadModal = function () {
        state.editingTile = null;
        dom.modalTitle.textContent = '上传磁贴';
        dom.faInput.value = ''; dom.labelInput.value = ''; dom.urlInput.value = 'https://';
        dom.colorInput.value = '#4a9eff'; dom.emojiInput.value = '🚀';
        dom.imagePreview.classList.add('hidden'); state.imageFile = null;
        updateIconType('fa'); updateFaPreview();
        dom.modalOverlay.classList.add('visible');
    };

    ns.openEditModal = function (tile) {
        state.editingTile = tile;
        dom.modalTitle.textContent = '编辑磁贴';
        dom.labelInput.value = tile.label; dom.urlInput.value = tile.url; dom.colorInput.value = tile.color || '#4a9eff';
        if (tile.type === 'fa') { dom.faInput.value = tile.icon; updateIconType('fa'); updateFaPreview(); }
        else if (tile.type === 'image' && tile.imageData) { dom.imagePreview.src = tile.imageData; dom.imagePreview.classList.remove('hidden'); updateIconType('image'); }
        else if (tile.type === 'emoji') { dom.emojiInput.value = tile.icon; updateIconType('emoji'); }
        else { dom.faInput.value = ''; updateIconType('fa'); updateFaPreview(); }
        dom.modalOverlay.classList.add('visible');
    };

    ns.closeModal = function () { dom.modalOverlay.classList.remove('visible'); state.editingTile = null; state.imageFile = null; };

    function updateIconType(type) {
        state.iconType = type;
        $$('.icon-type-tab').forEach(function (tab) { tab.classList.toggle('active', tab.dataset.type === type); });
        dom.faGroup.classList.toggle('hidden', type !== 'fa');
        dom.imageGroup.classList.toggle('hidden', type !== 'image');
        dom.emojiGroup.classList.toggle('hidden', type !== 'emoji');
    }

    function updateFaPreview() {
        var iconClass = dom.faInput.value.trim();
        dom.faPreview.innerHTML = iconClass ? '<i class="' + iconClass + '"></i>' : '<span style="font-size:12px;color:var(--color-text-secondary)">自动获取网站图标</span>';
    }

    ns.saveTile = function () {
        var label = dom.labelInput.value.trim(), url = dom.urlInput.value.trim(), color = dom.colorInput.value;
        if (!label || !url) { ns.showToast('请填写名称和网址', 'error'); return; }
        if (!url.startsWith('http://') && !url.startsWith('https://')) { ns.showToast('网址必须以 http:// 或 https:// 开头', 'error'); return; }
        var tileData = { label: label, url: url, color: color, type: state.iconType };
        if (state.iconType === 'fa') {
            var iconVal = dom.faInput.value.trim();
            if (iconVal) tileData.icon = iconVal;
            else { tileData.type = 'favicon'; tileData.icon = ''; }
        } else if (state.iconType === 'emoji') { tileData.icon = dom.emojiInput.value.trim() || '📌'; }
        else if (state.iconType === 'image' && state.imageFile) {
            var reader = new FileReader();
            reader.onload = function (e) { tileData.imageData = e.target.result; tileData.icon = ''; completeSave(tileData); };
            reader.readAsDataURL(state.imageFile);
            return;
        } else if (state.iconType === 'image' && state.editingTile && state.editingTile.imageData) {
            tileData.imageData = state.editingTile.imageData; tileData.icon = '';
        } else { tileData.icon = 'fas fa-question'; }
        completeSave(tileData);
    };

    function completeSave(tileData) {
        if (state.editingTile) tileManager.update(state.editingTile.id, tileData);
        else tileManager.add(tileData);
        ns.renderTiles(); ns.closeModal();
    }

    /* ===== 20 种预定义颜色 ===== */
    var PRESET_COLORS = [
        '#1a1410', '#2d2820', '#4a443e', '#6e6860', '#8e8880',
        '#c0692a', '#d94a3a', '#e74c3c', '#e67e22', '#f39c12',
        '#27ae60', '#2ecc71', '#1abc9c', '#16a085', '#2980b9',
        '#3498db', '#8e44ad', '#9b59b6', '#2c3e50', '#7f8c8d'
    ];

    /** 渲染颜色面板（工具栏和右键菜单共用） */
    function renderColorPalette(container) {
        if (!container) return;
        container.innerHTML = PRESET_COLORS.map(function (hex) {
            return '<div class="wb-color-swatch" data-hex="' + hex + '" style="background:' + hex + ';" title="' + hex + '"></div>';
        }).join('');
    }

    /** 应用颜色到选中的 contenteditable 文本 */
    function applyColorToSelection(hex) {
        var sel = window.getSelection();
        if (!sel.rangeCount) return;
        // 确保 focus 在 contenteditable 上
        var contentEl = dom.wbNoteContent;
        if (!contentEl || !contentEl.contains(sel.anchorNode)) {
            contentEl.focus();
            return;
        }
        document.execCommand('foreColor', false, hex);
    }

    /* ===== 编辑器右键菜单 ===== */
    ns.showEditorContextMenu = function (e) {
        e.preventDefault(); e.stopPropagation();
        var menu = document.getElementById('editorContextMenu');
        if (!menu) { console.warn('[警告] editorContextMenu DOM 未找到'); return; }
        console.log('[面板] 打开编辑器右键菜单 坐标(' + e.clientX + ',' + e.clientY + ')');
        menu.classList.add('visible');
        var menuRect = menu.getBoundingClientRect();
        var posX = e.clientX + 8, posY = e.clientY + 8;
        if (posX + menuRect.width > window.innerWidth - 8) posX = e.clientX - menuRect.width - 8;
        if (posY + menuRect.height > window.innerHeight - 8) posY = e.clientY - menuRect.height - 8;
        posX = Math.max(8, posX); posY = Math.max(8, posY);
        menu.style.left = posX + 'px';
        menu.style.top = posY + 'px';
        setTimeout(function () { document.addEventListener('click', hideEditorMenu, { once: true }); }, 0);
    };

    function hideEditorMenu() {
        var menu = document.getElementById('editorContextMenu');
        if (menu) menu.classList.remove('visible');
        ns.hideCodeLangMenu();
    }

    /** 编辑器右键菜单项处理（contenteditable 精简版：copy/paste） */
    ns.handleEditorMenuAction = function (action) {
        if (action === 'copy') {
            document.execCommand('copy');
        } else if (action === 'paste') {
            document.execCommand('paste');
        }
        hideEditorMenu();
    };



    /* ===== 代码语言子菜单 ===== */
    var CODE_LANGUAGES = [
        { key: '', label: '纯文本' },
        { key: 'javascript', label: 'JavaScript' },
        { key: 'typescript', label: 'TypeScript' },
        { key: 'python', label: 'Python' },
        { key: 'java', label: 'Java' },
        { key: 'cpp', label: 'C++' },
        { key: 'csharp', label: 'C#' },
        { key: 'go', label: 'Go' },
        { key: 'rust', label: 'Rust' },
        { key: 'ruby', label: 'Ruby' },
        { key: 'php', label: 'PHP' },
        { key: 'swift', label: 'Swift' },
        { key: 'kotlin', label: 'Kotlin' },
        { key: 'sql', label: 'SQL' },
        { key: 'html', label: 'HTML' },
        { key: 'css', label: 'CSS' },
        { key: 'json', label: 'JSON' },
        { key: 'yaml', label: 'YAML' },
        { key: 'bash', label: 'Bash' },
        { key: 'markdown', label: 'Markdown' }
    ];

    ns.showCodeLangMenu = function (anchorItem) {
        var menu = document.getElementById('ctxCodeLangMenu');
        if (!menu) return;
        menu.innerHTML = CODE_LANGUAGES.map(function (l) {
            return '<div class="ctx-code-lang-item" data-lang="' + l.key + '">' + l.label + '</div>';
        }).join('');
        menu.classList.add('visible');
        var anchorRect = anchorItem.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = (anchorRect.right + 4) + 'px';
        menu.style.top = anchorRect.top + 'px';
        menu.style.zIndex = '2830';
        var menuRect = menu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth - 8) {
            menu.style.left = (anchorRect.left - menuRect.width - 4) + 'px';
        }
        if (menuRect.bottom > window.innerHeight - 8) {
            menu.style.top = (anchorRect.bottom - menuRect.height) + 'px';
        }
    };

    ns.hideCodeLangMenu = function () {
        var menu = document.getElementById('ctxCodeLangMenu');
        if (menu) menu.classList.remove('visible');
    };

    /* ===== 设置面板保存辅助 ===== */
    ns._saveStrictMode = function (on) {
        ns.storage.set('strict_mode', on);
        ns.showToast(on ? '严厉鞭策模式已开启' : '严厉鞭策模式已关闭', 'info');
    };
    ns._saveFileSync = function (on) {
        ns.storage.set('file_sync', on);
        ns.showToast(on ? '文件自动同步已开启' : '文件自动同步已关闭', 'info');
    };
    ns._saveShortcut = function () {
        var ctrlEl = document.getElementById('wbMeShortcutCtrl');
        var shiftEl = document.getElementById('wbMeShortcutShift');
        var altEl = document.getElementById('wbMeShortcutAlt');
        var keyEl = document.getElementById('wbMeShortcutKey');
        if (!keyEl) return;
        var sc = {
            ctrl: ctrlEl && ctrlEl.value === '1',
            shift: shiftEl && shiftEl.value === '1',
            alt: altEl && altEl.value === '1',
            key: keyEl.value.toLowerCase() || 'k'
        };
        ns.state._focusShortcut = sc;
        if (ns.storageV2) {
            ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG).then(function (cfg) {
                cfg.focusShortcut = sc;
                ns.storageV2.set(ns.storageV2.KEYS.CONFIG, cfg);
            });
        }
        ns.showToast('快捷键已保存', 'success');
    };
    // 注意：ns.loadMeConfig 在 workbench.js 中定义（加载 AI + 快捷键配置到 UI）
    // 这里不再重复定义，避免覆盖

})(window.DevHome);
