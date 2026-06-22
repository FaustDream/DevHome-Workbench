/**
 * DevHome Workbench - 背景管理
 * 自定义背景图片/视频的上传、加载、重置。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var dom = ns.dom;
    var storage = ns.storage;

    /* ===== 背景管理 ===== */
    ns.bgManager = {
        load: function () {
            var bgData = storage.get('bg', null);
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
            var self = this;
            var reader = new FileReader();
            reader.onload = function (e) {
                var bgData = { type: file.type.startsWith('video/') ? 'video' : 'image', data: e.target.result };
                self.save(bgData); self.apply(bgData);
            };
            reader.readAsDataURL(file);
        }
    };

})(window.DevHome);
