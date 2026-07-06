/**
 * DevHome Workbench - Shadcn Confirm 弹窗组件
 * 用于替代原生 confirm，使用 Shadcn Dialog + Button 组件。
 *
 * 由 shadcn-dialogs.js 管理器调用，不直接使用。
 */
const { createElement: h } = React;

function ConfirmDialog({ open, title, message, okLabel, cancelLabel, onResolve }) {
    if (!open) return null;

    const handleOk = () => onResolve(true);
    const handleCancel = () => onResolve(false);

    const descStyle = {
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.6,
        margin: '8px 0 0',
        padding: '0',
        whiteSpace: 'pre-wrap',
    };

    return h(ShadcnDialog.Dialog, { open: true },
        h(ShadcnDialog.DialogOverlay, { onClick: handleCancel }),
        h(ShadcnDialog.DialogContent, null,
            h(ShadcnDialog.DialogHeader, null,
                h(ShadcnDialog.DialogTitle, null, title || '确认操作')
            ),
            h('p', { style: descStyle }, message),
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

window.ShadcnConfirmDialog = ConfirmDialog;
