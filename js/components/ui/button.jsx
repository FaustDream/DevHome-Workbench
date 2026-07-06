/**
 * DevHome Workbench - Shadcn/ui Button 组件
 * 基于 shadcn/ui 风格，适配项目 Semantic Token 体系。
 * 
 * 使用方式:
 *   <script src="js/lib/react.js"></script>
 *   <script src="js/lib/react-dom.js"></script>
 *   <script src="js/ui-components/button.js"></script>
 *   然后在 React 中使用 <Button variant="default">点击</Button>
 */

const { createElement: h } = React;

/**
 * Shadcn Button 组件
 * @param {'default'|'destructive'|'outline'|'secondary'|'ghost'|'link'} variant - 按钮风格
 * @param {'default'|'sm'|'lg'|'icon'} size - 按钮尺寸
 */
function Button({ className = '', variant = 'default', size = 'default', children, ...props }) {
    const baseStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        border: 'none',
        outline: 'none',
        transition: 'all 0.15s ease',
    };

    const sizeStyles = {
        default: { height: '40px', padding: '8px 16px' },
        sm: { height: '36px', padding: '4px 12px', fontSize: '12px', borderRadius: '8px' },
        lg: { height: '44px', padding: '8px 32px', fontSize: '16px' },
        icon: { height: '40px', width: '40px', padding: 0 },
    };

    const variantStyles = {
        default: {
            background: 'var(--color-accent)',
            color: 'var(--color-text-inverse)',
        },
        destructive: {
            background: 'var(--color-danger)',
            color: '#fff',
        },
        outline: {
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
        },
        secondary: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-secondary)',
        },
        ghost: {
            background: 'transparent',
            color: 'var(--color-text-secondary)',
        },
        link: {
            background: 'transparent',
            color: 'var(--color-accent)',
            textDecoration: 'underline',
        },
    };

    const style = {
        ...baseStyles,
        ...sizeStyles[size] || sizeStyles.default,
        ...variantStyles[variant] || variantStyles.default,
    };

    return h('button', { className, style, ...props }, children);
}

// 暴露到全局
window.ShadcnButton = Button;
