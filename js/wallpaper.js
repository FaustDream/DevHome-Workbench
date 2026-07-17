/**
 * DevHome Workbench - 壁纸功能
 * 左下角壁纸按钮 → 控制面板（上传壁纸 + 模糊度 + 遮罩度 + 重置）
 *
 * 存储：
 *   - localStorage('wallpaperImage') → Base64 压缩后的壁纸图片
 *   - localStorage('wallpaperSettings') → { blur: number, overlay: number }
 *
 * 图片处理：上传后用 Canvas 压缩到 1920px 宽，避免 localStorage 超配额。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const SETTINGS_KEY = 'wallpaperSettings';
    const IMAGE_KEY = 'wallpaperImage';

    /* ===== 初始化 DOM 引用 ===== */
let wallpaperBtn, wallpaperPanel, wallpaperUpload, wallpaperFileInput;
let wallpaperBlurSlider, wallpaperOverlaySlider, wallpaperReset;

    /**
     * 初始化壁纸功能：绑定事件 + 加载已保存设置
     */
    ns.initWallpaper = function () {
        wallpaperBtn = document.getElementById('wallpaperBtn');
        wallpaperPanel = document.getElementById('wallpaperPanel');
        wallpaperUpload = document.getElementById('wallpaperUpload');
        wallpaperFileInput = document.getElementById('wallpaperFileInput');
        wallpaperBlurSlider = document.getElementById('wallpaperBlur');
        wallpaperOverlaySlider = document.getElementById('wallpaperOverlay');
        wallpaperReset = document.getElementById('wallpaperReset');

        if (!wallpaperBtn || !wallpaperPanel) {
            console.warn('[警告] 壁纸功能 DOM 缺失，跳过初始化');
            return;
        }

        // 加载已保存的壁纸设置
        loadSavedSettings();

        // 绑定事件
        wallpaperBtn.addEventListener('click', togglePanel);
        wallpaperUpload.addEventListener('click', function () { wallpaperFileInput.click(); });
        wallpaperFileInput.addEventListener('change', handleFileUpload);
        wallpaperBlurSlider.addEventListener('input', handleBlurChange);
        wallpaperOverlaySlider.addEventListener('input', handleOverlayChange);
        wallpaperReset.addEventListener('click', handleReset);

        // 点击面板外部关闭
        document.addEventListener('click', function (e) {
            if (wallpaperPanel.classList.contains('visible') &&
                !wallpaperPanel.contains(e.target) &&
                e.target !== wallpaperBtn) {
                wallpaperPanel.classList.remove('visible');
                console.log('[面板] 壁纸面板关闭（点击外部）');
            }
        });

        console.log('[壁纸] 初始化完成');
    };

    /* ===== 面板开关 ===== */
    function togglePanel(e) {
        e.stopPropagation();
        const isOpen = wallpaperPanel.classList.toggle('visible');
        console.log('[面板] 壁纸面板 ' + (isOpen ? '打开' : '关闭'));
    }

    /* ===== 加载已保存设置 ===== */
    function loadSavedSettings() {
        try {
            // 恢复壁纸图片
            const savedImage = localStorage.getItem(IMAGE_KEY);
            if (savedImage) {
                const bgImage = document.getElementById('bgImage');
                if (bgImage) {
                    bgImage.src = savedImage;
                    bgImage.style.display = 'block';
                }
            }

            // 恢复模糊度和遮罩度
            let settings = getSettings();
            if (wallpaperBlurSlider) wallpaperBlurSlider.value = settings.blur;
            if (wallpaperOverlaySlider) wallpaperOverlaySlider.value = settings.overlay;

            // 应用 CSS 变量
            applyBlur(settings.blur);
            applyOverlay(settings.overlay);
        } catch (e) {
            console.warn('[壁纸] 加载已保存设置失败:', e);
        }
    }

    /* ===== 读取/保存设置 ===== */
    function getSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return { blur: 0, overlay: 30 };
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (_) {}
    }

    /* ===== 应用视觉效果 ===== */
    function applyBlur(blurValue) {
        document.documentElement.style.setProperty('--bg-blur', blurValue + 'px');
        const bgImage = document.getElementById('bgImage');
        if (bgImage) {
            bgImage.style.filter = 'blur(var(--bg-blur))';
        }
    }

    function applyOverlay(overlayValue) {
        const bgOverlay = document.getElementById('bgOverlay');
        if (bgOverlay) {
            bgOverlay.style.opacity = overlayValue / 100;
        }
    }

    /* ===== 事件处理 ===== */

    /** 处理壁纸图片上传 */
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            ns.showToast && ns.showToast('请选择图片文件', 'error');
            wallpaperFileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (ev) {
            compressImage(ev.target.result, function (compressedBase64) {
                try {
                    localStorage.setItem(IMAGE_KEY, compressedBase64);
                } catch (e) {
                    // localStorage 满了
                    ns.showToast && ns.showToast('壁纸图片过大，请使用较小的图片', 'error');
                    console.error('[错误] 壁纸保存失败:', e);
                    wallpaperFileInput.value = '';
                    return;
                }

                // 应用到背景
                const bgImage = document.getElementById('bgImage');
                if (bgImage) {
                    bgImage.src = compressedBase64;
                    bgImage.style.display = 'block';
                }

                console.log('[壁纸] 图片已上传并保存');
            });
        };
        reader.readAsDataURL(file);
        wallpaperFileInput.value = '';
    }

    /** Canvas 压缩图片到 1920px 宽 */
    function compressImage(dataUrl, callback) {
        const img = new Image();
        img.onload = function () {
            const maxWidth = 1920;
            const width = img.naturalWidth;
            const height = img.naturalHeight;

            if (width <= maxWidth) {
                // 无需压缩
                callback(dataUrl);
                return;
            }

            const ratio = maxWidth / width;
            const newWidth = maxWidth;
            const newHeight = Math.round(height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // 使用 JPEG 格式进一步压缩（质量 0.85）
let compressed = canvas.toDataURL('image/jpeg', 0.85);
            console.log('[壁纸] 图片已压缩: ' + width + 'x' + height + ' → ' + newWidth + 'x' + newHeight);
            callback(compressed);
        };
        img.onerror = function () {
            callback(dataUrl); // 降级：原图
        };
        img.src = dataUrl;
    }

    /** 模糊度滑块变化 */
    function handleBlurChange() {
        const value = parseInt(wallpaperBlurSlider.value) || 0;
        applyBlur(value);

        let settings = getSettings();
        settings.blur = value;
        saveSettings(settings);
    }

    /** 遮罩度滑块变化 */
    function handleOverlayChange() {
        const value = parseInt(wallpaperOverlaySlider.value) || 30;
        applyOverlay(value);

        let settings = getSettings();
        settings.overlay = value;
        saveSettings(settings);
    }

    /** 重置壁纸：清除图片和设置 */
    function handleReset() {
        const bgImage = document.getElementById('bgImage');
        if (bgImage) {
            bgImage.src = '';
            bgImage.style.display = 'none';
            bgImage.style.filter = '';
        }
        const bgOverlay = document.getElementById('bgOverlay');
        if (bgOverlay) {
            bgOverlay.style.opacity = '';
        }

        localStorage.removeItem(IMAGE_KEY);
        localStorage.removeItem(SETTINGS_KEY);

        // 重置滑块
        if (wallpaperBlurSlider) wallpaperBlurSlider.value = 0;
        if (wallpaperOverlaySlider) wallpaperOverlaySlider.value = 30;

        // 重置 CSS 变量
        document.documentElement.style.setProperty('--bg-blur', '0px');

        // 关闭面板
        if (wallpaperPanel) wallpaperPanel.classList.remove('visible');

        console.log('[壁纸] 已重置');
    }

})(window.DevHome);
