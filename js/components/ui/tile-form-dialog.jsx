/**
 * DevHome Workbench - Shadcn 磁贴编辑弹窗组件
 * 替代原有 #modalOverlay，使用 Shadcn Dialog + Button 组件。
 *
 * 由 shadcn-dialogs.js 管理器调用，不直接使用。
 */
const { createElement: h, useState, useEffect, useRef } = React;

function TileFormDialog({ open, title, initialName, initialUrl, onSave, onClose }) {
    const [name, setName] = useState(initialName || '');
    const [url, setUrl] = useState(initialUrl || 'https://');
    const [error, setError] = useState('');
    const nameRef = useRef(null);

    useEffect(() => {
        if (open) {
            setName(initialName || '');
            setUrl(initialUrl || 'https://');
            setError('');
            // 聚焦名称输入框
            setTimeout(() => {
                if (nameRef.current) nameRef.current.focus();
            }, 100);
        }
    }, [open]);

    if (!open) return null;

    /** 保存校验 */
    const handleSave = () => {
        var trimmedName = name.trim();
        var trimmedUrl = url.trim();
        if (!trimmedName) { setError('请填写名称'); return; }
        if (!trimmedUrl) { setError('请填写网址'); return; }
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            setError('网址必须以 http:// 或 https:// 开头');
            return;
        }
        setError('');
        onSave(trimmedName, trimmedUrl);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    const labelStyle = {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        display: 'block',
        marginBottom: '4px',
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        border: error ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
        borderRadius: '10px',
        background: 'var(--color-input-bg)',
        color: 'var(--color-text)',
        fontSize: '14px',
        fontFamily: 'var(--font-sans)',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const hintStyle = {
        fontSize: '11px',
        color: 'var(--color-text-tertiary)',
        margin: 0,
        textAlign: 'center',
        paddingTop: '4px',
    };

    const errorStyle = {
        fontSize: '12px',
        color: 'var(--color-danger)',
        margin: '4px 0 0',
        padding: 0,
        minHeight: '18px',
    };

    return h(ShadcnDialog.Dialog, { open: true },
        h(ShadcnDialog.DialogOverlay, { onClick: onClose }),
        h(ShadcnDialog.DialogContent, null,
            h(ShadcnDialog.DialogHeader, null,
                h(ShadcnDialog.DialogTitle, null, title || '添加磁贴')
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
                h('div', null,
                    h('label', { style: labelStyle }, '名称'),
                    h('input', {
                        ref: nameRef,
                        type: 'text',
                        value: name,
                        onChange: (e) => { setName(e.target.value); setError(''); },
                        onKeyDown: handleKeyDown,
                        placeholder: '磁贴名称',
                        maxLength: 20,
                        style: inputStyle,
                    })
                ),
                h('div', null,
                    h('label', { style: labelStyle }, '网址'),
                    h('input', {
                        type: 'text',
                        value: url,
                        onChange: (e) => { setUrl(e.target.value); setError(''); },
                        onKeyDown: handleKeyDown,
                        placeholder: 'https://...',
                        style: inputStyle,
                    })
                ),
                h('p', { style: hintStyle }, '图标将自动从网站获取'),
                h('p', { style: errorStyle }, error || '')
            ),
            h(ShadcnDialog.DialogFooter, null,
                h(ShadcnButton, { variant: 'outline', onClick: onClose }, '取消'),
                h(ShadcnButton, { variant: 'default', onClick: handleSave }, '保存')
            )
        )
    );
}

window.ShadcnTileFormDialog = TileFormDialog;
