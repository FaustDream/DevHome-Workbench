/**
 * DevHome Workbench - 背景管理
 * 自定义背景图片/视频的上传、加载、重置。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const dom = ns.dom;
    const storage = ns.storage;

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
        },
        save: function (bgData) { storage.set('bg', bgData); },
        reset: function () {
            dom.bgImage.src = ''; dom.bgVideo.src = '';
            dom.bgImage.style.display = 'none'; dom.bgVideo.style.display = 'none';
            storage.clear('bg');
        },
        upload: function (file) {
            const self = this;
            const MAX_SIZE = 5 * 1024 * 1024; // 5MB 上限，避免 base64 编码后占据过多内存和 storage 配额
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
                const bgData = { type: file.type.startsWith('video/') ? 'video' : 'image', data: e.target.result };
                self.save(bgData); self.apply(bgData);
            };
            reader.readAsDataURL(file);
        }
    };

})(window.DevHome);
