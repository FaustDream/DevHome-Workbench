/**
 * DevHome Workbench - React 通知系统组件
 *
 * 替代原生 DOM 创建的 Toast，支持：
 * - 多通知堆叠（最多 5 条同时可见）
 * - 四种类型: success / error / warning / info
 * - 自动消失（3s）+ 进度条视觉反馈
 * - 可操作通知（带按钮如"撤销"、"查看"）
 * - 通知队列（超上限时新通知排队）
 *
 * 编译: node build.mjs → js/ui-components/toast.js
 * 引入: <script src="js/ui-components/toast.js"></script>
 *
 * 用法:
 *   window.Toast.success('保存成功');
 *   window.Toast.error('网络错误，请重试');
 *   window.Toast.action('笔记已删除', '撤销', () => { ... });
 */
const { useState, useEffect, useCallback, useRef } = React;

// 全局通知队列管理
let toastId = 0;
let pendingQueue = [];
let activeToasts = [];
const MAX_VISIBLE = 5;
let notifyListeners = null;

function addToast(type, message, actionLabel, actionFn, duration) {
    const id = ++toastId;
    const toast = { id, type, message, actionLabel, actionFn, duration: duration || 3000, createdAt: Date.now() };

    if (activeToasts.length >= MAX_VISIBLE) {
        pendingQueue.push(toast);
    } else {
        activeToasts.push(toast);
        if (notifyListeners) notifyListeners();
    }

    // 定时移除
    setTimeout(() => {
        removeToast(id);
    }, toast.duration + 300);

    return id;
}

function removeToast(id) {
    activeToasts = activeToasts.filter(t => t.id !== id);
    // 从等待队列中补充
    if (pendingQueue.length > 0 && activeToasts.length < MAX_VISIBLE) {
        activeToasts.push(pendingQueue.shift());
    }
    if (notifyListeners) notifyListeners();
}

/* ===== 单个通知条组件 ===== */
function ToastItem({ toast, onRemove }) {
    const [progress, setProgress] = useState(100);
    const startRef = useRef(toast.createdAt);

    useEffect(() => {
        const timer = setInterval(() => {
            const elapsed = Date.now() - startRef.current;
            const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100);
            setProgress(pct);
            if (pct <= 0) clearInterval(timer);
        }, 30);
        return () => clearInterval(timer);
    }, [toast.duration]);

    const iconMap = {
        success: '✓', error: '✕', warning: '⚠', info: 'ℹ'
    };

    return React.createElement('div', {
        className: 'rt-toast-item' + (progress <= 0 ? ' rt-toast-exit' : ''),
        style: { '--progress': progress + '%', '--accent': iconMap[toast.type] === '✕' ? 'var(--color-danger)' : 'var(--color-accent)' }
    },
        React.createElement('div', { className: 'rt-toast-body' },
            React.createElement('span', { className: 'rt-toast-icon rt-toast-' + toast.type }, iconMap[toast.type] || 'ℹ'),
            React.createElement('span', { className: 'rt-toast-msg' }, toast.message),
            toast.actionLabel && React.createElement('button', {
                className: 'rt-toast-action',
                onClick: (e) => { e.stopPropagation(); if (toast.actionFn) toast.actionFn(); onRemove(toast.id); }
            }, toast.actionLabel),
            React.createElement('button', {
                className: 'rt-toast-close',
                onClick: () => onRemove(toast.id),
                title: '关闭'
            }, '×')
        ),
        React.createElement('div', { className: 'rt-toast-progress' },
            React.createElement('div', {
                className: 'rt-toast-progress-bar',
                style: { width: progress + '%' }
            })
        )
    );
}

/* ===== 通知容器组件 ===== */
function ToastContainer() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        notifyListeners = () => setToasts([...activeToasts]);
        return () => { notifyListeners = null; };
    }, []);

    const handleRemove = useCallback((id) => {
        removeToast(id);
    }, []);

    return React.createElement('div', { className: 'rt-toast-container' },
        toasts.map(t => React.createElement(ToastItem, { key: t.id, toast: t, onRemove: handleRemove }))
    );
}

// 暴露 API
window.Toast = {
    Container: ToastContainer,
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error', msg, null, null, 5000),
    warning: (msg) => addToast('warning', msg),
    info:    (msg) => addToast('info', msg),
    action:  (msg, label, fn) => addToast('info', msg, label, fn, 5000)
};

window.ToastApp = { ToastContainer, ToastItem };
