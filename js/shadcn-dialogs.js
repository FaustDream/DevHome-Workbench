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

    // ========== Prompt 弹窗（内联实现） ==========

    function showPrompt(message, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            var h = React.createElement;
            var defVal = opts.defaultValue || '';
            var title = opts.title || '请输入';

            // 内联函数组件，捕获输入
            function PromptInner() {
                // 检测 React 环境
                if (typeof React.useState !== 'function') {
                    console.error('[Shadcn弹窗] React.useState 不可用! React:', typeof React);
                    return h('div', { style: { position:'fixed',top:'50%',left:'50%',zIndex:9999,background:'white',padding:40 } }, 'React hooks 不可用');
                }
                var sv;
                try {
                    sv = React.useState(defVal);
                } catch (e) {
                    console.error('[Shadcn弹窗] useState 报错:', e);
                    return h('div', { style: { position:'fixed',top:'50%',left:'50%',zIndex:9999,background:'white',padding:40 } }, 'useState error: ' + e.message);
                }
                var value = sv[0];
                var setValue = sv[1];

                var handleOk = function () { unmountAll(); resolve(value.trim() || null); };
                var handleCancel = function () { unmountAll(); resolve(null); };

                return h(window.ShadcnDialog.Dialog, { open: true },
                    h(window.ShadcnDialog.DialogOverlay, { onClick: handleCancel }),
                    h(window.ShadcnDialog.DialogContent, null,
                        h(window.ShadcnDialog.DialogHeader, null,
                            h(window.ShadcnDialog.DialogTitle, null, title)
                        ),
                        h('input', {
                            type: 'text', defaultValue: defVal,
                            placeholder: message || '',
                            autoComplete: 'off',
                            onKeyDown: function (e) {
                                if (e.key === 'Enter') { handleOk(); }
                                if (e.key === 'Escape') { handleCancel(); }
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
                        h(window.ShadcnDialog.DialogFooter, null,
                            h(window.ShadcnButton, { variant: 'outline', onClick: handleCancel }, '取消'),
                            h(window.ShadcnButton, { variant: 'default', onClick: handleOk }, '确定')
                        )
                    )
                );
            }

            console.log('[Shadcn弹窗] prompt 开始渲染:', title, message);
            try {
                reactRoot().render(h(PromptInner));
                console.log('[Shadcn弹窗] prompt render() 调用完成');
            } catch (e) {
                console.error('[Shadcn弹窗] prompt render 失败:', e.message, e.stack);
                unmountAll(); resolve(null);
            }
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
