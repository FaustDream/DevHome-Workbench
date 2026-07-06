# Shadcn/ui 组件目录

本目录存放 Shadcn/ui 风格的 React 组件（JSX 源码），由 `build.mjs` 编译到 `js/ui-components/`。

## 组件清单

| 组件 | 文件 | 用途 |
|------|------|------|
| Button | `ui/button.jsx` | 按钮组件，支持 default/destructive/outline/secondary/ghost/link 6 种风格 |
| Dialog | `ui/dialog.jsx` | 弹窗组件，对标 shadcn Dialog，适配项目主题 |

## 使用方式

1. **安装依赖**:
   ```bash
   npm install
   node scripts/install-react.mjs
   ```

2. **编译组件**:
   ```bash
   npm run build:components
   ```

3. **在页面中引入**:
   ```html
   <link rel="stylesheet" href="css/tailwind-base.css">
   <script src="js/lib/react.production.min.js"></script>
   <script src="js/lib/react-dom.production.min.js"></script>
   <script src="js/ui-components/button.js"></script>
   ```

4. **在 JS 中使用**:
   ```javascript
   const root = ReactDOM.createRoot(document.getElementById('app'));
   root.render(React.createElement(window.ShadcnButton, { variant: 'default', onClick: handler }, '点击'));
   ```

## 添加新组件

1. 将 shadcn 官方组件代码复制到 `js/components/ui/`（`.jsx` 格式）
2. 适配项目 CSS 变量（`var(--color-*)`）
3. 运行 `npm run build:components` 编译
4. 在页面中引入编译产物

## 主题适配

所有 shadcn 组件通过项目 Semantic Token 对接主题系统，无需额外配置。CSS 变量映射见 `css/tailwind-base.css`。
