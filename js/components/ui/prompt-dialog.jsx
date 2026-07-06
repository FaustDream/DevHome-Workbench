/**
 * DevHome Workbench - Shadcn Prompt 弹窗组件
 * 用于替代原生 prompt，使用 Shadcn Dialog + Button 组件。
 *
 * 由 shadcn-dialogs.js 管理器调用，不直接使用。
 */
const { createElement: h, useState, useEffect, useRef } = React;

function PromptDialog({ open, title, message, defaultValue, okLabel, cancelLabel, onResolve }) {
    const [value, setValue] = useState(defaultValue || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setValue(defaultValue || '');
            // 聚焦输入框并全选
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.select();
                }
            }, 100);
        }
    }, [open]);

    if (!open) return null;

    const handleOk = () => onResolve(value.trim() || null);
    const handleCancel = () => onResolve(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleOk(); }
        if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        background: 'var(--color-input-bg)',
        color: 'var(--color-text)',
        fontSize: '14px',
        fontFamily: 'var(--font-sans)',
        outline: 'none',
        margin: '8px 0 4px',
        boxSizing: 'border-box',
    };

    const hintStyle = {
        fontSize: '11px',
        color: 'var(--color-text-tertiary)',
        margin: '0 0 4px',
        padding: 0,
    };

    return h(ShadcnDialog.Dialog, { open: true },
        h(ShadcnDialog.DialogOverlay, { onClick: handleCancel }),
        h(ShadcnDialog.DialogContent, null,
            h(ShadcnDialog.DialogHeader, null,
                h(ShadcnDialog.DialogTitle, null, title || '请输入')
            ),
            h('input', {
                ref: inputRef,
                type: 'text',
                value: value,
                onChange: (e) => setValue(e.target.value),
                onKeyDown: handleKeyDown,
                placeholder: message || '',
                autoComplete: 'off',
                style: inputStyle,
            }),
            message ? h('p', { style: hintStyle }, message) : null,
            h(ShadcnDialog.DialogFooter, null,
                h(ShadcnButton, { variant: 'outline', onClick: handleCancel },
                    cancelLabel || '取消'
                ),
                h(ShadcnButton, { variant: 'default', onClick: handleOk },
                    okLabel || '确定'
                )
            )
        )
    );
}

window.ShadcnPromptDialog = PromptDialog;
