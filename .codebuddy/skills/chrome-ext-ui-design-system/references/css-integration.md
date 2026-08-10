# CSS 接入指南（原生 CSS · 无构建）

本项目样式为**原生 CSS 文件**，直接经 `<link>` 引入，无构建步骤、无 vanilla-extract / Tailwind。

## 1. 文件层次与引入顺序

`index.html`（或 popup/sidepanel）`<head>` 中按此顺序引入：

```html
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/base.css">       <!-- 结构令牌 + Reset + 断点 -->
<link rel="stylesheet" href="css/tokens.css">     <!-- 语义 Token 声明（含降级默认） -->
<link rel="stylesheet" href="css/icons.css">
<link rel="stylesheet" href="css/ui-components.css"> <!-- 统一 UI 组件基础层 -->
<!-- 其余模块 CSS：tiles / overlays / workbench-* ... -->
<link rel="stylesheet" href="css/themes/default.css"> <!-- 主题层（最后，覆盖 Token 值） -->
```

> **顺序关键**：`tokens.css` 必须在业务模块 CSS 之前（声明变量）；`themes/default.css` 必须在最后（覆盖变量值，使其对已声明的引用生效）。

## 2. 新页面引入

若新页面仅需组件库（本技能 `references/components.css`），可按需精简引入：

```html
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/themes/default.css">
<!-- 组件库（复制自 references/components.css 或直接引用） -->
<link rel="stylesheet" href="css/components.css">
```

## 3. 深色模式

主题切换由 JS 在 `<html>`/`<body>` 上设置 `data-color-scheme="dark"`，`themes/default.css` 中 `[data-color-scheme="dark"]` 覆盖全部 Semantic Token。
**组件/页面无需额外适配暗色**；唯一例外是原生控件（`<input type="date">` 等），用 `color-scheme` 跟随：

```css
.ui-time-input { color-scheme: light; }
[data-color-scheme="dark"] .ui-time-input { color-scheme: dark; }
```

## 4. 修改生效方式

- 无构建：改 CSS → 浏览器刷新即生效（开发调试友好）。
- MV3 CSP 友好：纯静态 `<link>`，无运行时注入 `<style>`，不受扩展 CSP 限制。

## 5. 新增组件文件后的接入步骤

1. 新建 `css/xxx.css`，全部引用 Token 变量。
2. 在 `index.html` 按依赖顺序补 `<link>`（组件文件放 `tokens.css` 之后、`themes/default.css` 之前）。
3. 若引用了新 Token 变量，先在 `tokens.css`/`base.css` 补充声明，再在 `themes/default.css` 提供浅/深色两套值。
