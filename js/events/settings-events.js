/**
 * 设置面板事件模块
 * 负责设置面板打开/关闭/Tab切换、快捷键录制、任务通知、Matrix参数、
 * F4视图缩放、F5布局、F6图标、F8字体、F9动画
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindSettingsEvents = function () {
        const state = ns.state;
        const dom = ns.dom;
        const storage = ns.storage;

        if (dom.settingsGearBtn) dom.settingsGearBtn.addEventListener('click', ns.openSettingsPanel);
        if (dom.settingsCloseBtn) dom.settingsCloseBtn.addEventListener('click', ns.closeSettingsPanel);
        if (dom.settingsOverlay) dom.settingsOverlay.addEventListener('click', function (e) { if (e.target === dom.settingsOverlay) ns.closeSettingsPanel(); });
        if (dom.changelogBtn) dom.changelogBtn.addEventListener('click', function () { ns.closeSettingsPanel(); ns.openChangelog(); });

        if (dom.settingsPanel) {
            dom.settingsPanel.addEventListener('click', function (e) {
                const navItem = e.target.closest('.s-nav-item');
                if (navItem) { ns.switchSettingsTab(navItem.dataset.sTab); return; }
                const segBtn = e.target.closest('.s-seg-btn');
                if (segBtn) {
                    e.preventDefault();
                    if (segBtn.dataset.shortcutSize) ns.applyShortcutSize(segBtn.dataset.shortcutSize);
                    else if (segBtn.dataset.shortcutColumns) ns.applyShortcutColumns(segBtn.dataset.shortcutColumns);
                    ns.syncSettingsControls();
                    return;
                }
                const schemeCard = e.target.closest('.s-theme-card');
                if (schemeCard && schemeCard.dataset.scheme && ns.theme) {
                    ns.theme.setScheme(schemeCard.dataset.scheme);
                    ns.syncSettingsControls();
                    return;
                }
                const settingBtn = e.target.closest('[data-setting-action]');
                if (settingBtn) { e.preventDefault(); ns.handleSettingsAction(settingBtn.dataset.settingAction); return; }
                const exportFilter = e.target.closest('[data-export-filter]');
                if (exportFilter && typeof ns.setExportFilter === 'function') { ns.setExportFilter(exportFilter.dataset.exportFilter); return; }
            });

            dom.settingsPanel.addEventListener('change', function (e) {
                const cb = e.target;
                if (cb.id === 'remindBeforeSelect') { ns._saveTaskNotifySettings(); return; }
                if (!cb || cb.type !== 'checkbox') return;
                if (cb.id === 'matrixRainToggle') {
                    const params = document.getElementById('matrixRainParams');
                    if (cb.checked && ns.matrixRain) { ns.matrixRain.start(); if (params) params.style.display = ''; }
                    else { if (ns.matrixRain) ns.matrixRain.stop(); if (params) params.style.display = 'none'; }
                    return;
                }
                if (cb.closest('#sToggleAutoFocus')) { ns.handleSettingsAction('toggleAutoFocus'); return; }
                if (cb.closest('#sToggleCategoryMemory')) { ns.handleSettingsAction('toggleCategoryMemory'); return; }
                // 链接打开方式
                if (cb.closest('#sToggleNewTabTiles')) {
                    localStorage.setItem('linkNewTab_tiles', String(cb.checked));
                    console.log('[设置] 网站新标签打开: ' + cb.checked);
                    return;
                }
                if (cb.closest('#sToggleNewTabSearch')) {
                    localStorage.setItem('linkNewTab_search', String(cb.checked));
                    console.log('[设置] 搜索结果新标签打开: ' + cb.checked);
                    return;
                }
                const toggleStrict = cb.closest('#sToggleStrict');
                if (toggleStrict) { ns._saveStrictMode(cb.checked); return; }
                const toggleFileSync = cb.closest('#sToggleFileSync');
                if (toggleFileSync) { ns._saveFileSync(cb.checked); return; }
                if (cb.id === 'taskNotifyToggle') { ns._saveTaskNotifySettings(); return; }
            });
        }

        // 快捷键录制
        _bindShortcutRecorder();
        _bindShortcutSave();

        // 导出
        _bindExportSettings();

        // 严格模式/文件同步
        _bindToggleSettings();

        // F4/F5/F6/F8/F9 设置
        _bindMatrixParams();
        _bindWallpaperSliders();
        _bindSearchSettings();
        _bindLayoutSettings();
        _bindViewScale();
        _bindTileSettings();
        _bindFontSettings();
        _bindAnimationSettings();

        // 代理配置事件
        _bindProxySettings();
    };

    /* ===== 快捷键录制 ===== */
    function _bindShortcutRecorder() {
        const shortcutCapture = document.getElementById('sShortcutCapture');
        if (!shortcutCapture) return;

        const dom = ns.dom;
        let _scKeys = [];
        shortcutCapture.addEventListener('keydown', function (e) {
            e.preventDefault();
            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
            if (e.shiftKey) parts.push('Shift');
            if (e.altKey) parts.push('Alt');
            if (e.key && e.key.length === 1 && !['Control','Shift','Alt','Meta'].includes(e.key)) parts.push(e.key.toUpperCase());
            if (parts.length > 0) {
                _scKeys = parts;
                const display = document.getElementById('sShortcutKeys');
                if (display) display.textContent = parts.join(' + ');
                shortcutCapture.classList.add('recording');
            }
        });
        shortcutCapture.addEventListener('blur', function () {
            shortcutCapture.classList.remove('recording');
            if (_scKeys.length > 0) {
                const ctrlEl = document.getElementById('wbMeShortcutCtrl');
                const shiftEl = document.getElementById('wbMeShortcutShift');
                const altEl = document.getElementById('wbMeShortcutAlt');
                const keyEl = document.getElementById('wbMeShortcutKey');
                if (ctrlEl) ctrlEl.value = _scKeys.includes('Ctrl') ? '1' : '0';
                if (shiftEl) shiftEl.value = _scKeys.includes('Shift') ? '1' : '0';
                if (altEl) altEl.value = _scKeys.includes('Alt') ? '1' : '0';
                if (keyEl) keyEl.value = (_scKeys.filter(function(k){return k.length===1;})[0] || 'K').toLowerCase();
            }
        });
        shortcutCapture.addEventListener('click', function () { shortcutCapture.focus(); });
    }

    function _bindShortcutSave() {
        const dom = ns.dom;
        const state = ns.state;
        const shortcutSave = document.getElementById('wbMeShortcutSave');
        if (shortcutSave) {
            shortcutSave.addEventListener('click', async function () {
                const sc = {
                    ctrl: dom.wbMeShortcutCtrl ? dom.wbMeShortcutCtrl.checked : true,
                    shift: dom.wbMeShortcutShift ? dom.wbMeShortcutShift.checked : false,
                    alt: dom.wbMeShortcutAlt ? dom.wbMeShortcutAlt.checked : false,
                    key: dom.wbMeShortcutKey ? dom.wbMeShortcutKey.value.trim().toLowerCase() : 'k'
                };
                if (!sc.key) { ns.showToast('请输入快捷键字母', 'error'); return; }
                state._focusShortcut = sc;
                const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.focusShortcut = sc;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.updateContextMenuLabel();
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast('快捷键已保存', 'success');
            });
        }
    }

    /* ===== 导出设置事件 ===== */
    function _bindExportSettings() {
        const state = ns.state;
        const exportFilters = document.querySelectorAll('#wbSettingsExportFilters [data-export-filter]');
        exportFilters.forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.exportFilter = btn.dataset.exportFilter;
                exportFilters.forEach(function (b) { b.classList.toggle('active', b === btn); });
                ns.renderExportList(state.exportFilter);
            });
        });
        const selectAllBtn = document.getElementById('wbMeSelectAll');
        if (selectAllBtn) selectAllBtn.addEventListener('click', ns.toggleSelectAllExport);
        const exportBtn = document.getElementById('wbMeExportSelected');
        if (exportBtn) exportBtn.addEventListener('click', ns.exportSelected);
    }

    /* ===== 严格模式/文件同步 ===== */
    function _bindToggleSettings() {
        const dom = ns.dom;
        if (dom.wbMeToggleStrict) {
            dom.wbMeToggleStrict.addEventListener('change', async function () {
                const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.behavior.strictMode = dom.wbMeToggleStrict.checked;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
            });
        }
        if (dom.wbMeToggleFileSync) {
            dom.wbMeToggleFileSync.addEventListener('change', async function () {
                const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.fileSync.enabled = dom.wbMeToggleFileSync.checked;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast(
                    config.fileSync.enabled ? '文件自动同步已开启' : '文件自动同步已关闭', 'success'
                );
            });
        }
    }

    /* ===== Matrix 数字雨参数 ===== */
    function _bindMatrixParams() {
        const storage = ns.storage;
        const charSizeSlider = document.getElementById('charSizeSlider');
        const charSizeValue = document.getElementById('charSizeValue');
        if (charSizeSlider) {
            charSizeSlider.value = storage.get('char_size', 8);
            if (charSizeValue) charSizeValue.textContent = charSizeSlider.value + 'px';
            charSizeSlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_char_size', this.value);
                if (charSizeValue) charSizeValue.textContent = this.value + 'px';
                window.dispatchEvent(new Event('resize'));
            });
        }
        const flowSpeedSlider = document.getElementById('flowSpeedSlider');
        const flowSpeedValue = document.getElementById('flowSpeedValue');
        if (flowSpeedSlider) {
            flowSpeedSlider.value = storage.get('flow_speed', 2);
            if (flowSpeedValue) flowSpeedValue.textContent = flowSpeedSlider.value + '\u00D7';
            flowSpeedSlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_flow_speed', this.value);
                if (flowSpeedValue) flowSpeedValue.textContent = this.value + '\u00D7';
                window.dispatchEvent(new Event('resize'));
            });
        }
        const charDensitySlider = document.getElementById('charDensitySlider');
        const charDensityValue = document.getElementById('charDensityValue');
        if (charDensitySlider) {
            charDensitySlider.value = storage.get('char_density', 3);
            if (charDensityValue) charDensityValue.textContent = Math.round(charDensitySlider.value / 5 * 100) + '%';
            charDensitySlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_char_density', this.value);
                if (charDensityValue) charDensityValue.textContent = Math.round(this.value / 5 * 100) + '%';
            });
        }
    }

    /* ===== 壁纸模糊度/遮罩度滑块（从原 wallpaper.js 迁移至设置面板） ===== */
    function _bindWallpaperSliders() {
        const blurSlider = document.getElementById('sBgBlurSlider');
        const blurValue = document.getElementById('sBgBlurValue');
        const overlaySlider = document.getElementById('sBgOverlaySlider');
        const overlayValue = document.getElementById('sBgOverlayValue');

        function getWpSettings() {
            try {
                const raw = localStorage.getItem('wallpaperSettings');
                return raw ? JSON.parse(raw) : { blur: 0, overlay: 30 };
            } catch (_) { return { blur: 0, overlay: 30 }; }
        }

        function saveWpSettings(settings) {
            try { localStorage.setItem('wallpaperSettings', JSON.stringify(settings)); } catch (_) {}
        }

        function applyBlur(value) {
            document.documentElement.style.setProperty('--bg-blur', value + 'px');
            const bgImage = document.getElementById('bgImage');
            if (bgImage) bgImage.style.filter = 'blur(var(--bg-blur))';
        }

        function applyOverlay(value) {
            const bgOverlay = document.getElementById('bgOverlay');
            if (bgOverlay) bgOverlay.style.opacity = value / 100;
        }

        if (blurSlider) {
            const wp = getWpSettings();
            blurSlider.value = wp.blur;
            if (blurValue) blurValue.textContent = wp.blur + 'px';
            blurSlider.addEventListener('input', function () {
                const val = parseInt(this.value) || 0;
                if (blurValue) blurValue.textContent = val + 'px';
                applyBlur(val);
                const s = getWpSettings();
                s.blur = val;
                saveWpSettings(s);
                console.log('[设置] 壁纸模糊度 → ' + val + 'px');
            });
        }

        if (overlaySlider) {
            const wp = getWpSettings();
            overlaySlider.value = wp.overlay;
            if (overlayValue) overlayValue.textContent = wp.overlay + '%';
            overlaySlider.addEventListener('input', function () {
                const val = parseInt(this.value) || 30;
                if (overlayValue) overlayValue.textContent = val + '%';
                applyOverlay(val);
                const s = getWpSettings();
                s.overlay = val;
                saveWpSettings(s);
                console.log('[设置] 壁纸遮罩度 → ' + val + '%');
            });
        }
    }

    /* ===== 搜索框设置 ===== */
    function _bindSearchSettings() {
        const sc = ns.getSearchConfig ? ns.getSearchConfig() : (ns.DEFAULT_SEARCH_CONFIG || {});
        // 防御：applySearchConfig 在 search.js 中定义，测试环境可能不存在
        const applySearch = (typeof ns.applySearchConfig === 'function') ? ns.applySearchConfig : function () {};

        const sst = document.getElementById('searchSuggestionsToggle');
        if (sst) { sst.checked = sc.showSuggestions; sst.addEventListener('change', function () { sc.showSuggestions = this.checked; ns.storage.set('searchConfig', sc); }); }

        const srt = document.getElementById('searchRetainToggle');
        if (srt) { srt.checked = sc.retainContent; srt.addEventListener('change', function () { sc.retainContent = this.checked; ns.storage.set('searchConfig', sc); }); }

        const shb = document.getElementById('searchHideBtnToggle');
        if (shb) { shb.checked = sc.hideSearchButton; shb.addEventListener('change', function () { sc.hideSearchButton = this.checked; ns.storage.set('searchConfig', sc); applySearch(sc); }); }

        _bindSliderSetting('searchWidthSlider', 'searchWidthValue', 'searchWidth', 'px', sc, applySearch);
        _bindSliderSetting('searchRadiusSlider', 'searchRadiusValue', 'searchRadius', 'px', sc, applySearch);
        _bindSliderSetting('searchOpacitySlider', 'searchOpacityValue', 'searchOpacity', '', sc, applySearch, function(v) { return parseInt(v) / 100; });

        applySearch(sc);
    }

    /* ===== 通用滑块绑定 ===== */
    function _bindSliderSetting(sliderId, valueId, configKey, unit, config, applyFn, transform) {
        const slider = document.getElementById(sliderId);
        if (!slider) return;
        const valueEl = document.getElementById(valueId);
        slider.value = config[configKey];
        if (valueEl) valueEl.textContent = slider.value + unit;
        slider.addEventListener('input', function () {
            const val = transform ? transform(this.value) : parseInt(this.value);
            config[configKey] = val;
            if (valueEl) valueEl.textContent = this.value + unit;
            ns.storage.set('searchConfig', config);
            if (applyFn) applyFn(config);
        });
    }

    /* ===== F4 视图缩放 ===== */
    function _bindViewScale() {
        const slider = document.getElementById('viewScaleSlider');
        const valueEl = document.getElementById('viewScaleValue');
        if (!slider) return;
        const savedScale = parseFloat(localStorage.getItem('tabpage_view_scale') || String(ns.DEFAULT_VIEW_SCALE || 1.0));
        slider.value = savedScale;
        if (valueEl) valueEl.textContent = savedScale.toFixed(2);
        document.documentElement.style.setProperty('--view-scale', savedScale);
        slider.addEventListener('input', function () {
            const scale = parseFloat(this.value);
            document.documentElement.style.setProperty('--view-scale', scale);
            localStorage.setItem('tabpage_view_scale', scale);
            if (valueEl) valueEl.textContent = scale.toFixed(2);
        });
    }

    /* ===== F6 图标设置 ===== */
    function _bindTileSettings() {
        let tileSettings = {};
        try { tileSettings = JSON.parse(localStorage.getItem('tabpage_tile_settings') || '{}'); } catch (e) { tileSettings = {}; }
        const defaults = { hideLabel: false, iconShadow: false, enterAnim: false, radius: 0, opacity: 1.0 };
        const ts = Object.assign({}, defaults, tileSettings);
        _applyTileSettings(ts);

        const hideLabelToggle = document.getElementById('tileHideLabelToggle');
        if (hideLabelToggle) { hideLabelToggle.checked = ts.hideLabel; hideLabelToggle.addEventListener('change', function () { ts.hideLabel = this.checked; _applyTileSettings(ts); _saveTileSettings(ts); }); }

        const iconShadowToggle = document.getElementById('tileIconShadowToggle');
        if (iconShadowToggle) { iconShadowToggle.checked = ts.iconShadow; iconShadowToggle.addEventListener('change', function () { ts.iconShadow = this.checked; _applyTileSettings(ts); _saveTileSettings(ts); }); }

        const enterAnimToggle = document.getElementById('tileEnterAnimToggle');
        if (enterAnimToggle) { enterAnimToggle.checked = ts.enterAnim; enterAnimToggle.addEventListener('change', function () { ts.enterAnim = this.checked; _applyTileSettings(ts); _saveTileSettings(ts); if (this.checked) ns._triggerTileEnterAnim(); }); }

        const radiusSlider = document.getElementById('tileRadiusSlider'), radiusValue = document.getElementById('tileRadiusValue');
        if (radiusSlider) { radiusSlider.value = ts.radius; if (radiusValue) radiusValue.textContent = ts.radius === 0 ? 'auto' : ts.radius + 'px'; radiusSlider.addEventListener('input', function () { ts.radius = parseInt(this.value); if (radiusValue) radiusValue.textContent = ts.radius === 0 ? 'auto' : ts.radius + 'px'; _applyTileSettings(ts); _saveTileSettings(ts); }); }

        const opacitySlider = document.getElementById('tileOpacitySlider'), opacityValue = document.getElementById('tileOpacityValue');
        if (opacitySlider) { opacitySlider.value = Math.round(ts.opacity * 100); if (opacityValue) opacityValue.textContent = ts.opacity.toFixed(1); opacitySlider.addEventListener('input', function () { ts.opacity = parseInt(this.value) / 100; if (opacityValue) opacityValue.textContent = ts.opacity.toFixed(1); _applyTileSettings(ts); _saveTileSettings(ts); }); }
    }

    function _applyTileSettings(s) {
        document.documentElement.style.setProperty('--tile-label-display', s.hideLabel ? 'none' : 'block');
        document.documentElement.style.setProperty('--tile-icon-shadow', s.iconShadow ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : 'none');
        document.documentElement.style.setProperty('--tile-radius-override', s.radius > 0 ? s.radius + 'px' : 'auto');
        document.documentElement.style.setProperty('--tile-opacity', s.opacity);
    }
    function _saveTileSettings(s) { localStorage.setItem('tabpage_tile_settings', JSON.stringify(s)); }

    /* ===== F8 字体设置 ===== */
    function _bindFontSettings() {
        let fontSettings = {};
        try { fontSettings = JSON.parse(localStorage.getItem('tabpage_font_settings') || '{}'); } catch (e) { fontSettings = {}; }
        const defaults = { textShadow: false, shadowStrength: 4, fontSize: 1.0, fontColor: 'theme', customColor: '#ffffff' };
        const fs = Object.assign({}, defaults, fontSettings);
        _applyFontSettings(fs);

        const shadowToggle = document.getElementById('fontTextShadowToggle'), shadowRow = document.getElementById('fontShadowStrengthRow');
        if (shadowToggle) { shadowToggle.checked = fs.textShadow; if (shadowRow) shadowRow.style.display = fs.textShadow ? '' : 'none'; shadowToggle.addEventListener('change', function () { fs.textShadow = this.checked; if (shadowRow) shadowRow.style.display = this.checked ? '' : 'none'; _applyFontSettings(fs); _saveFontSettings(fs); }); }

        const shadowSlider = document.getElementById('fontShadowStrengthSlider'), shadowVal = document.getElementById('fontShadowStrengthValue');
        if (shadowSlider) { shadowSlider.value = fs.shadowStrength; if (shadowVal) shadowVal.textContent = fs.shadowStrength + 'px'; shadowSlider.addEventListener('input', function () { fs.shadowStrength = parseInt(this.value); if (shadowVal) shadowVal.textContent = this.value + 'px'; _applyFontSettings(fs); _saveFontSettings(fs); }); }

        const fontSizeSeg = document.getElementById('fontSizePresetSeg');
        if (fontSizeSeg) { fontSizeSeg.querySelectorAll('.s-seg-btn').forEach(function (btn) { if (parseFloat(btn.dataset.fontSize) === fs.fontSize) btn.classList.add('active'); btn.addEventListener('click', function () { fontSizeSeg.querySelectorAll('.s-seg-btn').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); fs.fontSize = parseFloat(btn.dataset.fontSize); _applyFontSettings(fs); _saveFontSettings(fs); }); }); }

        const fontColorSeg = document.getElementById('fontColorPresetSeg'), customRow = document.getElementById('fontCustomColorRow');
        if (fontColorSeg) { fontColorSeg.querySelectorAll('.s-seg-btn').forEach(function (btn) { if (btn.dataset.fontColor === fs.fontColor) btn.classList.add('active'); btn.addEventListener('click', function () { fontColorSeg.querySelectorAll('.s-seg-btn').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); fs.fontColor = btn.dataset.fontColor; if (customRow) customRow.style.display = (fs.fontColor === 'custom') ? '' : 'none'; _applyFontSettings(fs); _saveFontSettings(fs); }); }); }
        if (customRow) customRow.style.display = (fs.fontColor === 'custom') ? '' : 'none';

        const customPicker = document.getElementById('fontCustomColorPicker'), customVal = document.getElementById('fontCustomColorValue');
        if (customPicker) { customPicker.value = fs.customColor; if (customVal) customVal.textContent = fs.customColor; customPicker.addEventListener('input', function () { fs.customColor = this.value; if (customVal) customVal.textContent = this.value; _applyFontSettings(fs); _saveFontSettings(fs); }); }
    }

    function _applyFontSettings(s) {
        document.documentElement.style.setProperty('--text-shadow-strength', s.textShadow ? '0 0 ' + s.shadowStrength + 'px rgba(0,0,0,0.3)' : 'none');
        document.documentElement.style.setProperty('--font-size-multiplier', s.fontSize);
        let tc = ''; switch (s.fontColor) { case 'white': tc = '#ffffff'; break; case 'lightgray': tc = '#d0d0d0'; break; case 'custom': tc = s.customColor; break; }
        document.documentElement.style.setProperty('--font-color-override', tc);
    }
    function _saveFontSettings(s) { localStorage.setItem('tabpage_font_settings', JSON.stringify(s)); }

    /* ===== F9 动画设置 ===== */
    function _bindAnimationSettings() {
        let animSettings = {};
        try { animSettings = JSON.parse(localStorage.getItem('tabpage_anim_settings') || '{}'); } catch (e) { animSettings = {}; }
        const defaults = { animType: 'fade', animSpeed: 1.0, reduceMotion: false };
        const as = Object.assign({}, defaults, animSettings);
        _applyAnimationSettings(as);

        const animTypeSeg = document.getElementById('animTypeSeg');
        if (animTypeSeg) { animTypeSeg.querySelectorAll('.s-seg-btn').forEach(function (btn) { if (btn.dataset.animType === as.animType) btn.classList.add('active'); btn.addEventListener('click', function () { animTypeSeg.querySelectorAll('.s-seg-btn').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); as.animType = btn.dataset.animType; _applyAnimationSettings(as); _saveAnimSettings(as); }); }); }

        const animSlider = document.getElementById('animSpeedSlider'), animVal = document.getElementById('animSpeedValue');
        if (animSlider) { animSlider.value = as.animSpeed; if (animVal) animVal.textContent = as.animSpeed.toFixed(1) + 'x'; animSlider.addEventListener('input', function () { as.animSpeed = parseFloat(this.value); if (animVal) animVal.textContent = as.animSpeed.toFixed(1) + 'x'; _applyAnimationSettings(as); _saveAnimSettings(as); }); }

        const reduceToggle = document.getElementById('animReduceToggle');
        if (reduceToggle) { reduceToggle.checked = as.reduceMotion; reduceToggle.addEventListener('change', function () { as.reduceMotion = this.checked; _applyAnimationSettings(as); _saveAnimSettings(as); }); }
    }

    function _applyAnimationSettings(s) { document.documentElement.style.setProperty('--animation-speed-multiplier', s.animSpeed); document.body.classList.toggle('reduce-motion', s.reduceMotion); }
    function _saveAnimSettings(s) { localStorage.setItem('tabpage_anim_settings', JSON.stringify(s)); }

    /* ===== F5 布局设置 ===== */
    function _bindLayoutSettings() {
        const config = _getLayoutConfig();
        const segBtns = document.querySelectorAll('#layoutModeSeg .s-seg-btn');
        segBtns.forEach(function (btn) { btn.classList.toggle('active', btn.dataset.layoutMode === config.mode); });

        const presetSelect = document.getElementById('layoutPresetSelect');
        if (presetSelect) presetSelect.value = config.preset;

        _initCustomSliders(config.custom);
        _toggleLayoutModeUI(config.mode);
        _applyLayout(config);

        const modeSeg = document.getElementById('layoutModeSeg');
        if (modeSeg) modeSeg.addEventListener('click', function (e) {
            const btn = e.target.closest('.s-seg-btn');
            if (!btn || !btn.dataset.layoutMode) return;
            e.stopPropagation();
            config.mode = btn.dataset.layoutMode;
            segBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.layoutMode === config.mode); });
            _toggleLayoutModeUI(config.mode); _applyLayout(config); _saveLayoutConfig(config);
        });

        if (presetSelect) presetSelect.addEventListener('change', function () { config.preset = this.value; _applyLayout(config); _saveLayoutConfig(config); });

        const customSliders = { cols:{slider:'layoutColsSlider',val:'layoutColsVal',key:'columns',unit:''}, rows:{slider:'layoutRowsSlider',val:'layoutRowsVal',key:'rows',unit:''}, colGap:{slider:'layoutColGapSlider',val:'layoutColGapVal',key:'colGap',unit:'px'}, rowGap:{slider:'layoutRowGapSlider',val:'layoutRowGapVal',key:'rowGap',unit:'px'}, icon:{slider:'layoutIconSlider',val:'layoutIconVal',key:'iconSize',unit:'px'} };
        Object.keys(customSliders).forEach(function (k) {
            let m = customSliders[k], slider = document.getElementById(m.slider);
            if (!slider) return;
            slider.addEventListener('input', function () { const val = parseInt(this.value); config.custom[m.key] = val; const ve = document.getElementById(m.val); if (ve) ve.textContent = val + m.unit; _applyLayout(config); _saveLayoutConfig(config); });
        });
    }

    function _initCustomSliders(c) {
        [['layoutColsSlider','layoutColsVal','columns',''],['layoutRowsSlider','layoutRowsVal','rows',''],['layoutColGapSlider','layoutColGapVal','colGap','px'],['layoutRowGapSlider','layoutRowGapVal','rowGap','px'],['layoutIconSlider','layoutIconVal','iconSize','px']].forEach(function(p){ const s=document.getElementById(p[0]),v=document.getElementById(p[1]); if(s)s.value=c[p[2]]; if(v)v.textContent=c[p[2]]+p[3]; });
    }
    function _toggleLayoutModeUI(m) { const pw=document.getElementById('layoutPresetWrap'),cw=document.getElementById('layoutCustomWrap'); if(pw)pw.style.display=(m==='preset')?'':'none'; if(cw)cw.style.display=(m==='custom')?'':'none'; }
    function _getLayoutConfig() { try{const r=localStorage.getItem('tabpage_layout_config');if(r){const p=JSON.parse(r);return Object.assign({},ns.DEFAULT_LAYOUT_CONFIG,p,{custom:Object.assign({},ns.DEFAULT_LAYOUT_CONFIG.custom,p.custom||{})});}}catch(e){} return Object.assign({},ns.DEFAULT_LAYOUT_CONFIG,{custom:Object.assign({},ns.DEFAULT_LAYOUT_CONFIG.custom)}); }
    function _saveLayoutConfig(c) { localStorage.setItem('tabpage_layout_config',JSON.stringify(c)); }
    function _applyLayout(c) { const r=document.documentElement; if(c.mode==='preset'){const p=ns.LAYOUT_PRESETS[c.preset]||ns.LAYOUT_PRESETS['2x6'];r.style.setProperty('--shortcut-columns',p.columns);r.style.setProperty('--shortcut-rows-mode','auto');r.style.setProperty('--shortcut-max-rows','auto');}else{const cc=c.custom;r.style.setProperty('--shortcut-columns',cc.columns);r.style.setProperty('--shortcut-gap',cc.colGap+'px');r.style.setProperty('--shortcut-row-gap',cc.rowGap+'px');r.style.setProperty('--shortcut-icon',cc.iconSize+'px');r.style.setProperty('--shortcut-rows-mode','manual');} }

    /* ===== 任务通知 ===== */
    ns._saveTaskNotifySettings = function () {
        const toggle = document.getElementById('taskNotifyToggle'), select = document.getElementById('remindBeforeSelect'), remindRow = document.getElementById('taskNotifyRemindRow');
        let settings = { enabled: toggle ? toggle.checked : false, remindBefore: select ? parseInt(select.value) : 15 };
        if (remindRow) remindRow.style.display = settings.enabled ? '' : 'none';
        try { localStorage.setItem('taskNotifySettings', JSON.stringify(settings)); } catch (_) {}
        if (ns.storageV2 && ns.storageV2.isAvailable()) chrome.storage.local.set({ 'v2/taskNotifySettings': settings }).catch(function () {});
        console.log('[设置] 任务通知 ' + (settings.enabled ? '开启' : '关闭') + ' 提前' + settings.remindBefore + '分钟');
    };

    /* ===== 代理配置事件 ===== */
    function _bindProxySettings() {
        const dom = ns.dom;

        // 代理开关
        if (dom.proxyEnabledToggle) {
            dom.proxyEnabledToggle.addEventListener('change', function () {
                if (!ns.proxyManager) return;
                const enabled = this.checked;
                ns.proxyManager.updateConfig({ enabled: enabled });
                if (dom.proxyConfigSection) dom.proxyConfigSection.style.display = enabled ? '' : 'none';
                console.log('[代理] ' + (enabled ? '已启用' : '已禁用'));
            });
        }

        // 代理模式分段按钮
        const modeSeg = document.getElementById('proxyModeSeg');
        if (modeSeg) {
            modeSeg.addEventListener('click', function (e) {
                const btn = e.target.closest('.s-seg-btn');
                if (!btn || !btn.dataset.proxyMode) return;
                e.stopPropagation();
                if (!ns.proxyManager) return;
                const mode = btn.dataset.proxyMode;
                ns.proxyManager.updateConfig({ mode: mode });
                if (dom.proxyManualConfig) dom.proxyManualConfig.style.display = mode === 'manual' ? '' : 'none';
                // 更新按钮 active 状态
                modeSeg.querySelectorAll('.s-seg-btn').forEach(function (b) {
                    b.classList.toggle('active', b.dataset.proxyMode === mode);
                });
            });
        }

        // 重新检测按钮
        if (dom.proxyRetestBtn) {
            dom.proxyRetestBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                ns.handleSettingsAction('proxyRetest');
            });
        }

        // 手动代理输入保存（失焦时自动保存）
        const saveManualProxy = function () {
            ns.handleSettingsAction('proxySaveManual');
        };
        if (dom.proxyHostInput) dom.proxyHostInput.addEventListener('blur', saveManualProxy);
        if (dom.proxyPortInput) dom.proxyPortInput.addEventListener('blur', saveManualProxy);
        // 回车也保存
        if (dom.proxyHostInput) dom.proxyHostInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveManualProxy(); });
        if (dom.proxyPortInput) dom.proxyPortInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveManualProxy(); });
    }

    ns.syncTaskNotifySettings = function () {
        const toggle = document.getElementById('taskNotifyToggle'), select = document.getElementById('remindBeforeSelect'), remindRow = document.getElementById('taskNotifyRemindRow');
        if (!toggle) return;
        let settings = null;
        try { const raw = localStorage.getItem('taskNotifySettings'); if (raw) settings = JSON.parse(raw); } catch (_) {}
        if (!settings) settings = ns.DEFAULT_TASK_NOTIFY_CONFIG || { enabled: false, remindBefore: 15 };
        toggle.checked = settings.enabled;
        if (select) select.value = String(settings.remindBefore || 15);
        if (remindRow) remindRow.style.display = settings.enabled ? '' : 'none';
    };

})(window.DevHome);
