# HTML 结构 / 内联 SVG 图标 / 可访问性约定

> 这些约定从 `index.html`、`popup.html`、`sidepanel.html` 与各模块 CSS 中提炼，新增页面必须遵循。

---

## 1. 内联 SVG 图标（Lucide 风格 / 项目 Sprite）

- **不使用图标字体、不引用外部图片**，图标一律内联 `<svg>` 或使用项目 Sprite symbol。
- **Lucide 风格**：`viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"`、`stroke-linecap="round"`、`stroke-linejoin="round"`。
- 颜色跟随父元素文字色（`currentColor`），改父级 `color` 即可换色。
- 装饰性图标加 `aria-hidden="true"`；有语义的图标用 `aria-label` 或 `title`。
- 尺寸约定：导航/侧栏图标 16-20px，分区标题图标 16px，按钮内图标 14-15px。

### 方式一：内联 SVG

```html
<!-- 16px 分区图标 -->
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
  <line x1="8" y1="21" x2="16" y2="21"/>
  <line x1="12" y1="17" x2="12" y2="21"/>
</svg>
```

### 方式二：项目 Sprite（推荐，减少 DOM）

项目在 `index.html` 顶部注入 `<svg id="dhIconSprite">`，内置 `dh-icon-*` symbols（search / chevron-down / plus / x / edit / trash / refresh / settings / check / link / copy / upload / download / image / bookmark / info / warning / success / error / send / list-check / folder / note / tag …）。

```html
<!-- Sprite 引用 -->
<svg class="dh-icon" aria-hidden="true"><use href="#dh-icon-search"/></svg>
```

> 新图标可直接从 Lucide（https://lucide.dev）取 `24x24` path 内联，或往 `dhIconSprite` 追加 `<symbol>`。

---

## 2. 页面骨架 / 布局

- **整页应用**（index.html）：`.container` 居中布局，顶部时间区 + 分类行 + 磁贴网格；右侧有设置侧栏（`.settings-panel`）。
- **popup**：`<main class="container">` + 顶栏 `.header` + 卡片 `.card` + 操作区 `.actions`。
- **侧栏/设置**：`.settings-panel`（400px 右侧滑入抽屉）+ `.settings-overlay` + 顶部 `.s-nav`。

### popup 骨架

```html
<main class="container">
  <header class="header">
    <span class="header-title">Thrilled</span>
    <button class="icon-btn" type="button" title="更多" aria-label="更多">…</button>
  </header>
  <section class="card">…</section>
  <div class="actions">…</div>
</main>
```

### 设置页骨架（侧栏 + 内容）

```html
<div class="settings-overlay" id="settingsOverlay">
  <aside class="settings-panel" aria-label="设置">
    <div class="settings-panel-header">
      <h2>设置</h2>
      <button class="settings-close-btn" type="button" aria-label="关闭">✕</button>
    </div>
    <nav class="s-nav" aria-label="设置分类">
      <button class="s-nav-item is-active" type="button">通用</button>
      <button class="s-nav-item" type="button">外观</button>
    </nav>
    <div class="settings-body s-tabs">
      <div class="s-tab active">…</div>
      <div class="s-tab">…</div>
    </div>
  </aside>
</div>
```

---

## 3. 可访问性（A11y）

- 可点击的标题/标签加 `role="button"`、`tabindex="0"`、`aria-expanded`。
- Tab 切换器：`role="tablist"` / `role="tab"` + `aria-selected`，面板切 `[hidden]` 或 `.active`。
- 浮层/菜单键盘：`Escape` 关闭；方向键/`Enter` 选择；`Tab` 失焦关闭。
- `:focus-visible` 必须显示聚焦环（全局 `base.css` 已统一：`outline: 2px solid var(--color-accent)`）。
- 视觉隐藏 checkbox：`position:absolute; width:1px; height:1px; opacity:0; overflow:hidden`（Switch 模式）。
- 颜色对比满足文本三级规范；状态用颜色 + 形状/文字双重表达（如状态点同时配文字）。
- 弹窗需 `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向标题。

---

## 4. 响应式断点

项目采用 **mobile-first 渐进增强**（见 `base.css`）：

| 断点 | 策略 |
|------|------|
| 默认（< 640px） | 移动端：容器边距缩减、分类按钮换行、磁贴网格收紧 |
| ≥ 640px | 平板竖屏 / 小屏笔记本 |
| 1024px - 1439px | 标准桌面（当前默认基准） |
| ≥ 1440px | 宽屏/2K+：`container` 1280px 居中、磁贴间距加大 |

```css
@media (max-width: 639px) {
  .container { padding: 16px 12px; }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .container { padding: 24px 20px; }
}
@media (min-width: 1440px) {
  .container { max-width: 1280px; margin-left: auto; margin-right: auto; }
}
```

---

## 5. 减弱动效（prefers-reduced-motion）

所有动画/过渡在用户开启「减少动态效果」时关闭：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

> 完整组件库已内置此兜底，见 `components.css` 第 16 节。

---

## 6. 浮层定位与点击外部关闭

- 下拉/命令菜单用 `position: fixed`（结合 JS 计算 `getBoundingClientRect` 定位），`z-index: 2700+`（`--z-context-menu` / `--z-modal`）。
- 关闭逻辑：监听 `document` 的 `click`（判断 `event.target.closest(容器)`）、`Escape`、`focusout`（容器外失焦）。隐藏用 `[hidden]` 或 `.visible` 类切换。
- Toast 容器 `z-index: 3500`（最高层，不被遮罩盖住）。

---

## 7. 文件组织约定

- 组件样式统一放 `css/` 下：通用组件 → `ui-components.css`（或本技能 `references/components.css` 复制）；浮层 → `overlays.css`；业务模块 → 对应 `workbench-*.css`。
- HTML 顶部 `<link rel="stylesheet">` 引入，顺序：`fonts.css → base.css → tokens.css → 组件层 → themes/default.css`。
- 脚本用 `<script type="module" src="js/xxx.js">`（项目 JS 在 `js/` 目录）。
- 资源（图标、图片）放 `icons/`、`fonts/`，不内联大图。
