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

    /** 卸载当前弹窗 */
    function unmountAll() {
        try { reactRoot().render(null); } catch (_) {}
    }

    // ========== Confirm 弹窗 ==========

    function showConfirm(message, opts) {
        opts = opts || {};
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
     * 注册内联 Prompt 组件（非 hooks 实现，确保与 showConfirm 一致的渲染路径）
     */
    var PromptDialogImpl = function (props) {
        // 函数组件：用 ref 在 DOM 层管理输入值（绕开 hooks）
        var inputRef = null;
        var value = props.defaultValue || '';

        function setRef(el) { inputRef = el; }
        function handleOk() {
            if (inputRef) value = inputRef.value;
            unmountAll();
            props.onResolve(value.trim() || null);
        }
        function handleCancel() {
            unmountAll();
            props.onResolve(null);
        }

        // auto-focus after mount
        setTimeout(function () {
            if (inputRef) { inputRef.focus(); inputRef.select(); }
        }, 100);

        return React.createElement(window.ShadcnDialog.Dialog, { open: true },
            React.createElement(window.ShadcnDialog.DialogOverlay, { onClick: handleCancel }),
            React.createElement(window.ShadcnDialog.DialogContent, null,
                React.createElement(window.ShadcnDialog.DialogHeader, null,
                    React.createElement(window.ShadcnDialog.DialogTitle, null, props.title || '请输入')
                ),
                React.createElement('input', {
                    ref: setRef,
                    type: 'text',
                    defaultValue: props.defaultValue || '',
                    placeholder: props.message || '',
                    autoComplete: 'off',
                    onKeyDown: function (e) {
                        if (e.key === 'Enter') { e.preventDefault(); handleOk(); }
                        if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
                    },
                    style: {
                        width: '100%', padding: '10px 14px',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px', background: 'var(--color-input-bg)',
                        color: 'var(--color-text)', fontSize: '14px',
                        fontFamily: 'var(--font-sans)', outline: 'none',
                        margin: '8px 0 4px', boxSizing: 'border-box'
                    }
                }),
                React.createElement(window.ShadcnDialog.DialogFooter, null,
                    React.createElement(window.ShadcnButton,
                        { variant: 'outline', onClick: handleCancel },
                        props.cancelLabel || '取消'
                    ),
                    React.createElement(window.ShadcnButton,
                        { variant: 'default', onClick: handleOk },
                        props.okLabel || '确定'
                    )
                )
            )
        );
    };

    function showPrompt(message, opts) {
        opts = opts || {};
        console.log('[Shadcn弹窗] prompt:', (opts.title || '请输入'), message);
        return new Promise(function (resolve) {
            reactRoot().render(React.createElement(PromptDialogImpl, {
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

    function showTileForm(title, initialName, initialUrl) {
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

    function showChangelog() {
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
