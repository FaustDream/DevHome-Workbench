/**
 * DevHome Workbench - Shadcn/ui Dialog 组件
 * 基于 shadcn/ui 风格，主题化弹窗。
 *
 * 使用方式:
 *   <Dialog open={true} onOpenChange={fn}>
 *     <DialogContent>弹窗内容</DialogContent>
 *   </Dialog>
 */

const { createElement: h, useState, useEffect, useCallback } = React;

/**
 * 弹窗上下文
 */
function Dialog({ open: controlledOpen, onOpenChange, defaultOpen = false, children }) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

    const setOpen = useCallback((value) => {
        if (onOpenChange) onOpenChange(value);
        else setInternalOpen(value);
    }, [onOpenChange]);

    useEffect(() => {
        if (isOpen) {
            const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
            document.addEventListener('keydown', handler);
            return () => document.removeEventListener('keydown', handler);
        }
    }, [isOpen, setOpen]);

    return h('div', { className: 'shadcn-dialog-root' },
        isOpen && h('div', { className: 'shadcn-dialog' }, children)
    );
}

/**
 * 弹窗遮罩层
 */
function DialogOverlay({ onClick }) {
    const style = {
        position: 'fixed',
        inset: 0,
        zIndex: 2800,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
    };
    return h('div', { style, onClick });
}

/**
 * 弹窗内容容器
 */
function DialogContent({ className, children, onClose }) {
    const style = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2810,
        width: 'min(90vw, 420px)',
        maxHeight: '85vh',
        overflowY: 'auto',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-active)',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: 'var(--shadow-lg)',
    };
    return h('div', { className, style }, children);
}

/**
 * 弹窗头部
 */
function DialogHeader({ className, children }) {
    return h('div', { className }, children);
}

/**
 * 弹窗标题
 */
function DialogTitle({ className, children }) {
    const style = {
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--color-text)',
        margin: '0 0 4px',
    };
    return h('h3', { className, style }, children);
}

/**
 * 弹窗描述
 */
function DialogDescription({ className, children }) {
    const style = {
        fontSize: '13px',
        color: 'var(--color-text-secondary)',
        margin: 0,
    };
    return h('p', { className, style }, children);
}

/**
 * 弹窗底部按钮区
 */
function DialogFooter({ className, children }) {
    const style = {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid var(--color-border)',
    };
    return h('div', { className, style }, children);
}

// 暴露到全局
window.ShadcnDialog = {
    Dialog,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
};
