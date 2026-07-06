/**
 * DevHome Workbench - Shadcn 更新说明弹窗组件
 * 替代原有 #changelogOverlay，使用 Shadcn Dialog + Button 组件。
 * 内容取自 index.html 中的 #changelogBody 节点 innerHTML。
 *
 * 由 shadcn-dialogs.js 管理器调用，不直接使用。
 */
const { createElement: h, useEffect, useRef } = React;

function ChangelogDialog({ open, onClose }) {
    const bodyRef = useRef(null);

    useEffect(() => {
        if (open && bodyRef.current) {
            // 从隐藏的静态模板复制内容
            var source = document.getElementById('changelogBody');
            if (source) {
                bodyRef.current.innerHTML = source.innerHTML;
            }
        }
    }, [open]);

    if (!open) return null;

    const eyebrowStyle = {
        display: 'block',
        color: 'var(--color-accent)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: '2px',
    };

    const contentStyle = {
        width: 'min(90vw, 640px)',
        maxHeight: '80vh',
        padding: '24px',
    };

    const bodyStyle = {
        maxHeight: '55vh',
        overflowY: 'auto',
        padding: '0',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-border) transparent',
    };

    return h(ShadcnDialog.Dialog, { open: true },
        h(ShadcnDialog.DialogOverlay, { onClick: onClose }),
        h('div', {
            style: {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2810,
                ...contentStyle,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-active)',
                borderRadius: '24px',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
            }
        },
            h(ShadcnDialog.DialogHeader, null,
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' } },
                    h('div', null,
                        h('span', { style: eyebrowStyle }, 'Release Notes'),
                        h(ShadcnDialog.DialogTitle, null, '更新说明')
                    ),
                    h(ShadcnButton, {
                        variant: 'outline',
                        size: 'sm',
                        onClick: onClose,
                        style: { flexShrink: 0 }
                    }, '关闭')
                )
            ),
            h('div', { ref: bodyRef, style: bodyStyle })
        )
    );
}

window.ShadcnChangelogDialog = ChangelogDialog;
