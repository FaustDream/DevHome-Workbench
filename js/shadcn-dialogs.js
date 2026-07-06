/**
 * DevHome Workbench - Shadcn 弹窗管理器
 *
 * 职责：在非 React 原生 JS 代码中，以命令式方式调用 Shadcn 弹窗组件。
 * 所有弹窗通过单一 React Root（#shadcnModalRoot）渲染，返回 Promise 以对接现有代码。
 *
 * 使用方式：
 *   ShadcnDialogs.showConfirm('消息', { title: '标题' }).then(function(ok) { ... });
 *   ShadcnDialogs.showPrompt('请输入', { defaultValue: '默认值' }).then(function(val) { ... });
 *   ShadcnDialogs.showTileForm('添加磁贴', '名称', 'https://').then(function(result) { ... });
 *   ShadcnDialogs.showChangelog(); // 显示更新说明弹窗
 */
(function () {
    'use strict';

    // 延迟初始化：只有首次调用时创建 React Root
    var rootInstance = null;

    /** 获取或创建 React Root（挂载到 #shadcnModalRoot） */
    function reactRoot() {
        if (rootInstance) return rootInstance;
        var el = document.getElementById('shadcnModalRoot');
        if (!el) {
            el = document.createElement('div');
            el.id = 'shadcnModalRoot';
            document.body.appendChild(el);
            console.log('[Shadcn弹窗] 创建挂载点 #shadcnModalRoot');
        }
        rootInstance = ReactDOM.createRoot(el);
        return rootInstance;
    }

    /** 卸载当前弹窗，重置渲染 */
    function unmountAll() {
        try { reactRoot().render(null); } catch (_) {}
    }

    // ========== Confirm 弹窗 ==========

    /**
     * 显示确认弹窗（替代原生 confirm）
     * @param {string} message - 提示消息
     * @param {object} [opts] - 可选 { title, okLabel, cancelLabel }
     * @returns {Promise<boolean>}
     */
    function showConfirm(message, opts) {
        opts = opts || {};
        unmountAll();
        return new Promise(function (resolve) {
            console.log('[Shadcn弹窗] confirm:', (opts.title || '确认'), message);
            reactRoot().render(React.createElement(window.ShadcnConfirmDialog, {
                open: true,
                title: opts.title || '确认操作',
                message: message,
                okLabel: opts.okLabel || '确定',
                cancelLabel: opts.cancelLabel || '取消',
                onResolve: function (result) {
                    unmountAll();
                    resolve(result);
                },
            }));
        });
    }

    // ========== Prompt 弹窗 ==========

    /**
     * 显示输入弹窗（替代原生 prompt）
     * @param {string} message - 提示消息
     * @param {object} [opts] - 可选 { title, defaultValue, okLabel, cancelLabel }
     * @returns {Promise<string|null>}
     */
    function showPrompt(message, opts) {
        opts = opts || {};
        unmountAll();
        return new Promise(function (resolve) {
            console.log('[Shadcn弹窗] prompt:', (opts.title || '请输入'), message);
            reactRoot().render(React.createElement(window.ShadcnPromptDialog, {
                open: true,
                title: opts.title || '请输入',
                message: message,
                defaultValue: opts.defaultValue || '',
                okLabel: opts.okLabel || '确定',
                cancelLabel: opts.cancelLabel || '取消',
                onResolve: function (result) {
                    unmountAll();
                    resolve(result);
                },
            }));
        });
    }

    // ========== 磁贴编辑弹窗 ==========

    /**
     * 显示磁贴编辑弹窗
     * @param {string} title - 弹窗标题
     * @param {string} initialName - 初始名称
     * @param {string} initialUrl - 初始网址
     * @returns {Promise<{name:string, url:string}|null>}
     */
    function showTileForm(title, initialName, initialUrl) {
        unmountAll();
        return new Promise(function (resolve) {
            console.log('[Shadcn弹窗] tileForm:', title, 'name=' + initialName);
            reactRoot().render(React.createElement(window.ShadcnTileFormDialog, {
                open: true,
                title: title,
                initialName: initialName,
                initialUrl: initialUrl,
                onSave: function (name, url) {
                    unmountAll();
                    resolve({ name: name, url: url });
                },
                onClose: function () {
                    unmountAll();
                    resolve(null);
                },
            }));
        });
    }

    // ========== 更新说明弹窗 ==========

    /**
     * 显示更新说明弹窗
     */
    function showChangelog() {
        unmountAll();
        console.log('[Shadcn弹窗] changelog');
        reactRoot().render(React.createElement(window.ShadcnChangelogDialog, {
            open: true,
            onClose: function () { unmountAll(); },
        }));
    }

    // 暴露到全局
    window.ShadcnDialogs = {
        showConfirm: showConfirm,
        showPrompt: showPrompt,
        showTileForm: showTileForm,
        showChangelog: showChangelog,
        closeAll: unmountAll,
    };

    console.log('[Shadcn弹窗] 管理器已就绪');
})();
