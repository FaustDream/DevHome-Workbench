/**
 * ui 子模块 — 设置面板（侧边栏模式）
 * 职责：设置侧边栏的打开/关闭、Tab 切换、控件状态同步、设置动作处理、保存辅助
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const storage = ns.storage;
    const bgManager = ns.bgManager;

    /* ===== 设置面板生命周期 ===== */
    ns.openSettingsPanel = function () {
        const isWB = state.currentDevhomeMode === 'workbench';
        document.querySelectorAll('#settingsPanel [data-mode="workbench"]').forEach(function (el) {
            el.style.display = isWB ? '' : 'none';
        });
        if (typeof ns.loadMeConfig === 'function') ns.loadMeConfig();
        if (isWB) {
            if (typeof ns.renderBehaviorDashboard === 'function') ns.renderBehaviorDashboard();
            if (typeof ns.renderExportList === 'function') ns.renderExportList(state.exportFilter || 'all');
        }
        if (!state._activeSettingsTab) state._activeSettingsTab = 'general';
        ns.switchSettingsTab(state._activeSettingsTab);
        ns.syncSettingsControls();
        dom.settingsOverlay.classList.add('visible');
        ns.hideBlankContextMenu();
        console.log('[面板] 打开设置侧边栏');
    };

    ns.closeSettingsPanel = function () {
        dom.settingsOverlay.classList.remove('visible');
        console.log('[面板] 关闭设置侧边栏');
    };

    /* ===== 更新说明弹窗 ===== */
    ns.openChangelog = function () { window.ShadcnDialogs.showChangelog(); };
    ns.closeChangelog = function () { window.ShadcnDialogs.closeAll(); };

    /* ===== 设置 Tab 切换 ===== */
    ns.switchSettingsTab = function (tabName) {
        state._activeSettingsTab = tabName;
        document.querySelectorAll('.s-nav-item').forEach(function (item) {
            item.classList.toggle('active', item.dataset.sTab === tabName);
        });
        document.querySelectorAll('.s-tab').forEach(function (tab) {
            tab.classList.toggle('active', tab.dataset.sTab === tabName);
        });
    };

    /* ===== 控件状态同步 ===== */
    ns.syncSettingsControls = function () {
        if (!dom.settingsPanel) return;

        const setToggle = function (id, state) {
            let el = document.getElementById(id);
            if (!el) { el = document.getElementById(id + 'Toggle'); }
            if (el) {
                const cb = el.querySelector('input[type="checkbox"]') || el;
                if (cb && cb.type === 'checkbox') cb.checked = state;
            }
        };
        setToggle('sToggleAutoFocus', storage.get('auto_focus', false));
        setToggle('sToggleCategoryMemory', storage.get('category_memory', false));
        setToggle('sToggleStrict', storage.get('strict_mode', false));
        setToggle('sToggleFileSync', storage.get('file_sync', false));

        const sizeKey = ns.normalizeShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE));
        document.querySelectorAll('[data-shortcut-size]').forEach(function (b) { b.classList.toggle('active', b.dataset.shortcutSize === sizeKey); });
        const colsKey = ns.normalizeShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS));
        document.querySelectorAll('[data-shortcut-columns]').forEach(function (b) { b.classList.toggle('active', b.dataset.shortcutColumns === colsKey); });

        if (ns.theme) {
            const s = ns.theme.getState();
            document.querySelectorAll('.s-theme-card').forEach(function (c) { c.classList.toggle('active', c.dataset.scheme === s.colorScheme); });
        }

        const mrToggle = document.getElementById('matrixRainToggle');
        const mrParams = document.getElementById('matrixRainParams');
        if (mrToggle && ns.matrixRain) {
            const isOn = ns.matrixRain.isRunning();
            mrToggle.checked = isOn;
            if (mrParams) mrParams.style.display = isOn ? '' : 'none';
        }

        // 壁纸模糊度/遮罩度滑块同步（迁移自原 wallpaper.js）
        const blurSlider = document.getElementById('sBgBlurSlider');
        const blurValue = document.getElementById('sBgBlurValue');
        const blurRow = document.getElementById('sBgBlurRow');
        const overlaySlider = document.getElementById('sBgOverlaySlider');
        const overlayValue = document.getElementById('sBgOverlayValue');
        const overlayRow = document.getElementById('sBgOverlayRow');

        const hasBgImage = (function () {
            const bgImg = document.getElementById('bgImage');
            return bgImg && bgImg.src && bgImg.style.display !== 'none';
        })();

        // 有背景图片时才显示滑块
        if (blurRow) blurRow.style.display = hasBgImage ? '' : 'none';
        if (overlayRow) overlayRow.style.display = hasBgImage ? '' : 'none';

        // 读取已保存的壁纸设置
        let wpSettings = { blur: 0, overlay: 30 };
        try {
            const raw = localStorage.getItem('wallpaperSettings');
            if (raw) wpSettings = JSON.parse(raw);
        } catch (_) {}

        if (blurSlider) { blurSlider.value = wpSettings.blur; }
        if (blurValue) { blurValue.textContent = wpSettings.blur + 'px'; }
        if (overlaySlider) { overlaySlider.value = wpSettings.overlay; }
        if (overlayValue) { overlayValue.textContent = wpSettings.overlay + '%'; }

        const shortcutKeys = document.getElementById('sShortcutKeys');
        if (shortcutKeys) {
            const ctrlEl = document.getElementById('wbMeShortcutCtrl');
            const shiftEl = document.getElementById('wbMeShortcutShift');
            const altEl = document.getElementById('wbMeShortcutAlt');
            const keyEl = document.getElementById('wbMeShortcutKey');
            const parts = [];
            if (ctrlEl && ctrlEl.value === '1') parts.push('Ctrl');
            if (shiftEl && shiftEl.value === '1') parts.push('Shift');
            if (altEl && altEl.value === '1') parts.push('Alt');
            parts.push((keyEl && keyEl.value || 'K').toUpperCase());
            shortcutKeys.textContent = parts.join(' + ');
        }

        if (ns.fileConfig && ns.fileConfig.isSupported()) {
            const syncInfo = ns.fileConfig.getSyncInfo();
            const hasDir = !!syncInfo.dirName;
            if (dom.configChangeDirBtn) dom.configChangeDirBtn.style.display = '';
            if (dom.configDirLabel) dom.configDirLabel.textContent = hasDir ? '切换配置目录' : '选择配置目录';
            if (dom.configSyncBtn) dom.configSyncBtn.style.display = hasDir ? '' : 'none';
            if (dom.configSyncStatus) {
                dom.configSyncStatus.style.display = '';
                if (hasDir) {
                    const timeStr = syncInfo.lastSyncTime ? new Date(syncInfo.lastSyncTime).toLocaleTimeString('zh-CN') : '未同步';
                    dom.configSyncStatus.textContent = '配置目录：' + syncInfo.dirName + ' | 上次同步：' + timeStr;
                } else {
                    dom.configSyncStatus.textContent = '未选择配置目录';
                }
            }
        }
    };

    /* ===== 设置动作处理 ===== */
    ns.handleSettingsAction = function (action) {
        switch (action) {
            case 'uploadBg': dom.bgInput.click(); break;
            case 'resetBg': bgManager.reset(); break;
            case 'toggleAutoFocus': const af = storage.get('auto_focus', false); storage.set('auto_focus', !af); break;
            case 'toggleCategoryMemory':
                const cm = storage.get('category_memory', false);
                storage.set('category_memory', !cm);
                if (!cm) storage.set('last_page', state.currentPage);
                break;
            case 'exportData': ns.exportBackupData(); break;
            case 'importData': dom.importInput.click(); break;
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
                            ns.tileManager.load().then(function () { ns.renderTiles(); });
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
                    const keepKeys = ['tabpage_pages', 'tabpage_pageNames', 'tabpage_page_backups'];
                    Object.keys(localStorage).forEach(function (k) {
                        if (k.startsWith('tabpage_') && keepKeys.indexOf(k) === -1) { localStorage.removeItem(k); }
                    });
                    location.reload();
                });
                break;
        }
        ns.syncSettingsControls();
    };

    /* ===== 设置保存辅助 ===== */
    ns._saveStrictMode = function (on) {
        ns.storage.set('strict_mode', on);
        ns.showToast(on ? '严厉鞭策模式已开启' : '严厉鞭策模式已关闭', 'info');
    };
    ns._saveFileSync = function (on) {
        ns.storage.set('file_sync', on);
        ns.showToast(on ? '文件自动同步已开启' : '文件自动同步已关闭', 'info');
    };
    ns._saveShortcut = function () {
        const ctrlEl = document.getElementById('wbMeShortcutCtrl');
        const shiftEl = document.getElementById('wbMeShortcutShift');
        const altEl = document.getElementById('wbMeShortcutAlt');
        const keyEl = document.getElementById('wbMeShortcutKey');
        if (!keyEl) return;
        const sc = {
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

})(window.DevHome);
