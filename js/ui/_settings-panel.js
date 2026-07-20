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

        // 链接打开方式：默认全部新标签页打开
        let newTabTiles = true;
        let newTabSearch = true;
        try {
            var rawTiles = localStorage.getItem('linkNewTab_tiles');
            if (rawTiles !== null) newTabTiles = rawTiles === 'true';
            var rawSearch = localStorage.getItem('linkNewTab_search');
            if (rawSearch !== null) newTabSearch = rawSearch === 'true';
        } catch (_) {}
        setToggle('sToggleNewTabTiles', newTabTiles);
        setToggle('sToggleNewTabSearch', newTabSearch);

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

        // 代理配置同步
        _syncProxyControls();

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
            case 'proxyRetest':
            case 'proxySaveManual':
                _handleProxyAction(action);
                break;
        }
        ns.syncSettingsControls();
    };

    /* ===== 代理配置同步 ===== */
    /**
     * 将代理管理器的状态同步到设置面板控件
     */
    function _syncProxyControls() {
        const dom = ns.dom;
        if (!dom.proxyEnabledToggle) return;
        if (!ns.proxyManager) return;
        const config = ns.proxyManager.getConfig();

        // 代理开关
        dom.proxyEnabledToggle.checked = config.enabled;
        dom.proxyConfigSection.style.display = config.enabled ? '' : 'none';

        // 代理模式分段按钮
        const modeBtns = document.querySelectorAll('#proxyModeSeg .s-seg-btn');
        modeBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.proxyMode === config.mode);
        });
        dom.proxyManualConfig.style.display = config.mode === 'manual' ? '' : 'none';

        // 手动代理输入
        if (dom.proxyHostInput) dom.proxyHostInput.value = config.host || '127.0.0.1';
        if (dom.proxyPortInput) dom.proxyPortInput.value = config.port || 7890;

        // 系统代理状态徽章
        if (dom.proxyStatusBadge) {
            if (config.lastChecked === 0) {
                dom.proxyStatusBadge.textContent = '检测中...';
                dom.proxyStatusBadge.style.background = 'var(--color-bg-secondary)';
            } else if (config.systemProxyDetected) {
                dom.proxyStatusBadge.textContent = '已检测到';
                dom.proxyStatusBadge.style.background = '#27ae60';
                dom.proxyStatusBadge.style.color = '#fff';
            } else {
                dom.proxyStatusBadge.textContent = '未检测到';
                dom.proxyStatusBadge.style.background = '#e67e22';
                dom.proxyStatusBadge.style.color = '#fff';
            }
        }

        // Google 连通性徽章
        if (dom.googleStatusBadge) {
            if (config.lastChecked === 0) {
                dom.googleStatusBadge.textContent = '检测中...';
                dom.googleStatusBadge.style.background = 'var(--color-bg-secondary)';
            } else if (config.googleReachable) {
                dom.googleStatusBadge.textContent = '可访问';
                dom.googleStatusBadge.style.background = '#27ae60';
                dom.googleStatusBadge.style.color = '#fff';
            } else {
                dom.googleStatusBadge.textContent = '不可达';
                dom.googleStatusBadge.style.background = '#d94a3a';
                dom.googleStatusBadge.style.color = '#fff';
            }
        }
    }
    // 将同步函数暴露到 ns 上，供代理回调使用
    ns._syncProxyControls = _syncProxyControls;

    /**
     * 处理代理相关设置动作
     * @param {string} action
     */
    function _handleProxyAction(action) {
        if (!ns.proxyManager) return;
        switch (action) {
            case 'proxyRetest':
                ns.proxyManager.refreshGoogleReachability().then(function () {
                    _syncProxyControls();
                    ns.showToast('代理检测完成', 'info');
                });
                break;
            case 'proxySaveManual':
                const host = (dom.proxyHostInput && dom.proxyHostInput.value.trim()) || '127.0.0.1';
                const port = parseInt((dom.proxyPortInput && dom.proxyPortInput.value) || '7890');
                if (isNaN(port) || port < 1 || port > 65535) {
                    ns.showToast('端口号无效，请输入 1-65535 之间的数字', 'error');
                    return;
                }
                ns.proxyManager.updateConfig({ host: host, port: port });
                _syncProxyControls();
                ns.showToast('代理配置已保存', 'success');
                break;
        }
    }

    /* ===== 数据导出（完整快照备份） ===== */
    /**
     * 导出专注模式下所有数据为 JSON 文件
     * 包含：笔记、快速捕获、四象限任务、笔记本、磁贴页面、应用配置
     */
    ns.exportBackupData = async function () {
        try {
            if (!ns.dataService || !ns.dataService.exportAll) {
                ns.showToast('导出功能暂不可用，请刷新页面后重试', 'error');
                return;
            }
            console.log('[数据] 开始导出完整备份...');
            // 从统一数据服务获取完整快照
            const snapshot = await ns.dataService.exportAll();
            // 生成 JSON Blob 并触发下载
            const json = JSON.stringify(snapshot, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const filename = 'devhome-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            // 延迟释放 Blob URL
            setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
            const noteCount = (snapshot.notes || []).length;
            const taskCount = (snapshot.tasks || []).length;
            const captureCount = (snapshot.captures || []).length;
            console.log('[数据] 导出完成 笔记' + noteCount + ' 任务' + taskCount + ' 捕获' + captureCount);
            ns.showToast('数据导出成功！笔记' + noteCount + '篇, 任务' + taskCount + '个, 捕获' + captureCount + '条', 'success');
        } catch (err) {
            console.error('[数据] 导出失败', err);
            ns.showToast('导出失败：' + (err.message || '未知错误'), 'error');
        }
    };

    /* ===== 数据导入（完整快照恢复） ===== */
    /**
     * 从 JSON 文件导入专注模式下所有数据
     * 支持 v3.0 完整快照格式和旧版磁贴备份格式
     * @param {Object} snapshot - 解析后的 JSON 数据
     * @returns {string} 'full' | 'tiles_only' | null
     */
    ns._importBackupData = async function (snapshot) {
        // 新版 v3.0 完整快照（包含所有数据）
        if (snapshot && snapshot.version === '3.0') {
            const noteCount = (snapshot.notes || []).length;
            const taskCount = (snapshot.tasks || []).length;
            const captureCount = (snapshot.captures || []).length;
            const confirmMsg = '导入将覆盖当前所有专注模式数据（笔记' + noteCount + '篇、任务' + taskCount + '个、捕获' + captureCount + '条、磁贴和配置），确定继续吗？';
            const ok = await ns.showConfirm(confirmMsg, { title: '导入完整备份' });
            if (!ok) return null;
            console.log('[数据] 开始导入完整备份 v3.0...');
            // 写入 chrome.storage.local (v2/tasks, v2/notes 等)
            await ns.dataService.importAll(snapshot);
            // 同步四象限任务到 localStorage (devhome_workbench)，确保 getWorkbenchState() 可读取
            if (snapshot.tasks && snapshot.tasks.length > 0) {
                _syncTasksToWorkbench(snapshot.tasks);
            }
            console.log('[数据] 导入完成 笔记' + noteCount + ' 任务' + taskCount + ' 捕获' + captureCount);
            return 'full';
        }
        // 旧版备份格式（仅磁贴和页面配置）
        if (snapshot && snapshot.pages && Array.isArray(snapshot.pages)) {
            const ok = await ns.showConfirm('导入备份将覆盖当前所有的磁贴和页面配置，确定继续吗？', { title: '导入备份' });
            if (!ok) return null;
            ns.storage.set('pages', snapshot.pages);
            ns.storage.set('page_names', snapshot.pageNames || ['第1页']);
            if (snapshot.devhome) ns.devhomeStorage.set('workbench', snapshot.devhome);
            return 'tiles_only';
        }
        return null;
    };

    /**
     * 将 v2 扁平任务数组同步到 localStorage devhome_workbench（四象限格式）
     * v2 格式：[{id, title, quadrant, status, ...}]
     * workbench 格式：{quadrants: {q1: {tasks: [...]}, q2: {...}, ...}}
     * @param {Array} v2Tasks - v2 扁平任务数组
     */
    function _syncTasksToWorkbench(v2Tasks) {
        if (!ns.defaultWorkbenchState) return;
        // 克隆默认工作台状态作为基础结构
        const workbench = JSON.parse(JSON.stringify(ns.defaultWorkbenchState));
        // 按象限分组任务，剥离 quadrant 字段
        v2Tasks.forEach(function (t) {
            const q = t.quadrant || 'q1';
            if (workbench.quadrants[q]) {
                const taskCopy = Object.assign({}, t);
                delete taskCopy.quadrant; // 四象限格式不需要 quadrant 字段（由外层 key 决定）
                workbench.quadrants[q].tasks.push(taskCopy);
            }
        });
        // 写入 localStorage devhome_workbench
        ns.devhomeStorage.set('workbench', workbench);
        console.log('[数据] 已同步四象限任务到 localStorage devhome_workbench');
    }

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
