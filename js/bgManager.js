/**
 * DevHome Workbench - 背景管理（含图片压缩，从 wallpaper.js 迁移）
 * 自定义背景图片/视频的上传、加载、重置。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const dom = ns.dom;
    const storage = ns.storage;

    /**
     * Canvas 压缩图片到 1920px 宽（避免 base64 过大撑爆 localStorage）
     * @param {string} dataUrl - 原始 data URL
     * @param {function} callback - 接收压缩后的 dataUrl
     */
    function compressImage(dataUrl, callback) {
        const img = new Image();
        img.onload = function () {
            const maxWidth = 1920;
            const width = img.naturalWidth;
            const height = img.naturalHeight;

            if (width <= maxWidth) {
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

            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            console.log('[背景] 图片已压缩: ' + width + 'x' + height + ' → ' + newWidth + 'x' + newHeight);
            callback(compressed);
        };
        img.onerror = function () {
            callback(dataUrl); // 降级：使用原图
        };
        img.src = dataUrl;
    }

    /* ===== 背景管理 ===== */
    ns.bgManager = {
        load: function () {
            const bgData = storage.get('bg', null);
            if (!bgData) return;
            this.apply(bgData);
        },
        apply: function (bgData) {
            dom.bgImage.src = '';
            dom.bgVideo.src = '';
            dom.bgImage.style.display = 'none';
            dom.bgVideo.style.display = 'none';
            if (bgData.type === 'image') { dom.bgImage.src = bgData.data; dom.bgImage.style.display = 'block'; }
            else if (bgData.type === 'video') { dom.bgVideo.src = bgData.data; dom.bgVideo.style.display = 'block'; }
            // 应用已保存的模糊度到 CSS 变量（从原 wallpaper.js 迁移）
            this.applyBlurSettings();
        },
        save: function (bgData) { storage.set('bg', bgData); },
        reset: function () {
            dom.bgImage.src = ''; dom.bgVideo.src = '';
            dom.bgImage.style.display = 'none'; dom.bgVideo.style.display = 'none';
            dom.bgImage.style.filter = '';
            document.getElementById('bgOverlay').style.opacity = '';
            document.documentElement.style.setProperty('--bg-blur', '0px');
            storage.clear('bg');
            localStorage.removeItem('wallpaperSettings');
        },
        /**
         * 上传背景文件（支持图片和视频）
         * 图片自动压缩到 1920px 宽，视频限制在 5MB 以内。
         * @param {File} file
         */
        upload: function (file) {
            const self = this;
            const MAX_SIZE = 5 * 1024 * 1024; // 5MB 上限
            const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                           'video/mp4', 'video/webm'];

            if (file.size > MAX_SIZE) {
                ns.showToast('文件过大（最大 5MB），请压缩后重新上传', 'error');
                console.warn('[背景] 文件大小超限:', (file.size / 1024 / 1024).toFixed(1) + 'MB');
                return;
            }
            if (ALLOWED.indexOf(file.type) === -1) {
                ns.showToast('不支持的文件格式', 'error');
                console.warn('[背景] 不支持的文件类型:', file.type);
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                const isVideo = file.type.startsWith('video/');
                const rawData = e.target.result;

                if (isVideo) {
                    const bgData = { type: 'video', data: rawData };
                    self.save(bgData); self.apply(bgData);
                } else {
                    // 图片：先压缩再保存
                    compressImage(rawData, function (compressed) {
                        const bgData = { type: 'image', data: compressed };
                        self.save(bgData); self.apply(bgData);
                        console.log('[背景] 图片上传并压缩完成');
                    });
                }
            };
            reader.readAsDataURL(file);
        },
        /**
         * 应用已保存的模糊度设置到 CSS 变量（从原 wallpaper.js 迁移）
         */
        applyBlurSettings: function () {
            try {
                let settings;
                const raw = localStorage.getItem('wallpaperSettings');
                if (raw) settings = JSON.parse(raw);
                else settings = { blur: 0, overlay: 30 };

                document.documentElement.style.setProperty('--bg-blur', settings.blur + 'px');
                const bgImage = document.getElementById('bgImage');
                if (bgImage) bgImage.style.filter = 'blur(var(--bg-blur))';

                const bgOverlay = document.getElementById('bgOverlay');
                if (bgOverlay) bgOverlay.style.opacity = settings.overlay / 100;
            } catch (_) {}
        }
    };

})(window.DevHome);
