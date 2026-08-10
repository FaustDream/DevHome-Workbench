---
name: chrome-ext-ui-design-system
description: Thrilled Chrome 扩展（MV3）的 UI 设计系统与组件库规范。当用户需要新增/修改弹窗、单行文本、多行文本、富文本、气泡、导航、折叠栏、选项框、时间选择器、按钮、Toast、Toggle、下拉菜单等界面组件，或需要了解本项目的配色 Token、间距、字号、圆角、阴影、命名约定时加载本 Skill。基于原生 CSS + Semantic Token 体系（--color-* / --spacing-* / --radius-* / --shadow-*），不引入任何运行时 CSS 框架（无 vanilla-extract / Tailwind / Emotion）。
---

# Thrilled UI 设计系统（原生 CSS + Semantic Token）

本项目是 Chrome 扩展（Manifest V3）新标签页「Thrilled」，界面为整页应用 + 弹窗浮层。
样式采用**原生 CSS + 分层 Token 架构**，无构建步骤、无运行时 CSS 框架：

```
css/
├── tokens.css              语义 Token 声明层（变量名 + 降级默认值）
├── base.css                结构令牌（间距/圆角/过渡/字号/Z层级）+ Reset + 断点系统
├── themes/default.css      主题层（Primitive → Semantic 覆盖，Apple Light / Dark）
├── ui-components.css       统一 UI 组件基础层（弹窗/输入/按钮/下拉/Toast）
├── overlays.css            浮层组件（右键菜单/设置侧栏/导航 Tab）
├── workbench-components.css 任务/番茄钟/日历/仪表盘等业务组件
└── ...                     其余模块 CSS
```

设计语言：**Apple Light 极简风格**，主色 Ant Design 蓝 `#1677ff`，大圆角（8/12/20/28px）、胶囊标签、毛玻璃（backdrop-filter）、柔和阴影。

## 何时加载本 Skill

- 新增/修改弹窗、单行文本、多行文本、富文本、气泡（tooltip/popover）、导航、折叠栏、选项框、时间选择器等界面组件。
- 调整配色、间距、字号、圆角、阴影等视觉规范，或需要确认某个 Token 的确切取值。
- 不清楚类名命名约定、状态修饰类写法、内联 SVG 图标规范、可访问性写法、响应式断点、减弱动效时。

## 核心约束（必须遵守）

1. **原生 CSS，禁止运行时 CSS 框架**：样式直接写在 `css/*.css` 中，不引入 vanilla-extract / Tailwind / Emotion / Styled Components。
2. **只引用 Token 变量**：组件中每一个颜色、间距、字号、圆角、阴影、动画时长都必须引用 `tokens.css` / `base.css` / `themes/default.css` 定义的 `var(--...)`，禁止直接写死 `#1677FF`、`8px` 之类字面量（圆角/间距如未在 Token 中定义，需先在 `base.css` 的 `:root` 补充，不允许裸写）。
3. **Token 分层引用**：主题文件定义 Primitive → Semantic 映射；模块 CSS 只读 Semantic Token（`--color-*`、`--spacing-*`、`--radius-*`、`--transition-*`、`--shadow-*`、`--z-*`）。组件代码与主题色值完全解耦。
4. **复用而非重写**：新增组件前，先确认 `css/ui-components.css`、`css/overlays.css` 与本技能 `references/components.css` 是否已有对应模式；优先复用，不重复造轮子。
5. **内联 SVG 图标**：图标用内联 SVG（Lucide 风格，`stroke="currentColor"`），或使用项目图标 Sprite（`index.html` 中 `#dhIconSprite` 的 `<symbol id="dh-icon-*">`），不引用外部图标字体或图片文件。
6. **无需构建**：原生 CSS 直接经 `<link>` 引入（顺序见 `references/css-integration.md`），修改后刷新即生效。
7. **框架使用遵循策略**：项目样式纯原生 CSS；Tiptap（富文本）/ marked（Markdown）为必要的能力型依赖；React/Shadcn 是**遗留组件、逐步替换**，新 UI 禁止再引入（见 `references/framework-strategy.md` 的 Shadcn → 原生对照表）。
8. **禁止浏览器原生弹窗**：业务代码一律禁止 `alert()` / `confirm()` / `prompt()`，必须使用符合项目样式的自定义弹窗：`ns.showConfirm` / `ns.showPrompt` / `ns.showToast` / `ns.createModal`，或 `.ui-overlay` + `.ui-dialog` 结构（见 `references/component-patterns.md` 第 4 节）。

## 设计 Token（配色 / 排版 / 间距 / 圆角 / 阴影 / 动效）

完整定义见 `references/design-tokens.md`。要点（均以 `var(--...)` 引用）：

- **背景层级**：`--color-bg` / `--color-bg-secondary` / `--color-bg-elevated` / `--color-surface` / `--color-surface-hover` / `--color-surface-muted` / `--color-overlay`。
- **主色（Ant Design 蓝）**：`--color-accent` (#1677ff) / `--color-accent-hover` (#0958d9) / `--color-accent-active` / `--color-accent-disabled`；交互背景 `--color-accent-bg-04~18`、边框 `--color-accent-border-18~88`。
- **语义色**：`--color-success` / `--color-warning` / `--color-danger` / `--color-info` / `--color-link`，各配 `*-bg-*` / `*-border-*` 派生 Token。
- **文本四级**：`--color-text` / `--color-text-secondary` / `--color-text-tertiary` / `--color-text-inverse`（另见 `--color-text-disabled`）。
- **间距标尺**：`--spacing-xs/sm/md/lg/xl/2xl`（4px 起步 4 倍体系）。
- **圆角**：`--radius-sm`(8) / `--radius-md`(12) / `--radius-lg`(20) / `--radius-xl`(28) / `--radius-full`(9999)。
- **字号**：`--font-size-xs`(11) / `sm`(13) / `md`(15) / `lg`(18) / `xl`(24) / `2xl`(36)。
- **阴影三级**：`--shadow-sm` / `--shadow-md` / `--shadow-lg`；聚焦环 `--color-accent-shadow`。
- **过渡**：`--transition-fast`(0.15s) / `--transition-normal`(0.25s)，均为 ease 曲线。
- **Z 层级**：`--z-trash`(1000) / `--z-floating`(2000) / `--z-context-menu`(2700) / `--z-modal`(3000)。

> 字体栈：`--font-sans`（Inter + 系统中文字体）；代码字体：`--font-mono`（Cascadia/Fira/JetBrains）。
> 深色模式：`[data-color-scheme="dark"]` 选择器在 `themes/default.css` 中覆盖 Semantic Token，组件无需感知。

## 命名约定

- **语义化类名 + `is-` 状态修饰**（非严格 BEM）。基础样式用类名表达，状态用 `.is-active` / `.is-checked` / `.is-collapsed` / `.is-loading` / `.visible` / `.active` 修饰类切换（如 `.ui-btn-primary.is-loading`）。
- **统一前缀**：通用组件用 `ui-` 前缀（与 `css/ui-components.css` 一致）：`.ui-btn` / `.ui-input` / `.ui-dialog` / `.ui-toast`；业务组件用 `wb-` / `s-` / `db-` 前缀（如 `.wb-task-item` / `.s-toggle` / `.db-stat-card`）。
- **按钮语义**：`.ui-btn-primary`（主按钮，accent 底）/ `.ui-btn-outline`（描边）/ `.ui-btn-ghost`（幽灵）/ `.ui-btn-danger`（危险），尺寸修饰 `.ui-btn-sm` / `.ui-btn-icon`。
- **分区卡片**：`.ui-section` + `.ui-section-head`（可折叠，含 `ui-section-icon` / `ui-section-arrow` / `ui-section-title` / `ui-section-desc`）+ `.ui-section-body`。

## 组件库索引

完整可复制样式见 **`references/components.css`**，共 16 类组件：

| # | 组件 | 类名前缀 | 说明 |
|---|------|---------|------|
| 1 | 单行文本 | `.ui-input` | 普通/带图标/清空按钮/紧凑/错误态 |
| 2 | 多行文本 | `.ui-textarea` / `.ui-output` | 可缩放文本域 / 只读输出区 |
| 3 | 富文本 | `.ui-richtext` | contenteditable + 工具栏 + 内容排版样式 |
| 4 | 弹窗 | `.ui-dialog` / `.ui-drawer` | 居中弹窗 / 右侧抽屉 / 确认弹窗 |
| 5 | 气泡 | `.ui-tip` / `.ui-popover` / `.ui-bubble` | 纯 CSS Tooltip / JS Popover / 对话气泡 |
| 6 | 导航 | `.ui-nav` / `.ui-tab` / `.ui-seg` / `.ui-sidenav` | 顶部导航 / 下划线 Tab / 胶囊分段 / 侧栏 |
| 7 | 折叠栏 | `.ui-collapse` / `.ui-group` | 卡片折叠 / 分组折叠 |
| 8 | 选项框 | `.ui-check` / `.ui-circle-check` / `.ui-switch` / `.ui-chip` / `.ui-select` / `.ui-dropdown-menu` | 复选框 / 圆形勾选 / 开关 / 标签多选 / 下拉选择 |
| 9 | 时间 | `.ui-time-input` / `.ui-time-chip` / `.ui-time-picker` / `.ui-time-display` | 原生输入 / 快捷预设 / 选择面板 / 大号显示 |
| 10 | 按钮 | `.ui-btn` | 5 种语义 + 尺寸 + loading 态 |
| 11 | Toast | `.ui-toast` | 4 种状态 + 操作按钮 |
| 12 | Badge/Tag | `.ui-badge` / `.ui-status-dot` | 状态胶囊 / 数字角标 / 状态点 |
| 13 | 右键菜单 | `.ui-context-menu` | 命令菜单 + 快捷键提示 |
| 14 | 卡片分区 | `.ui-section` / `.ui-form-row` | 可折叠分区 / 表单行布局 |
| 15 | 滚动条 | `.ui-scroll` | Webkit 细化滚动条 |
| 16 | 减弱动效 | `prefers-reduced-motion` | 无障碍兜底 |

各组件用法（HTML 结构 + 状态类）与实现说明详见 `references/component-patterns.md`。

## 框架使用策略（必须先读）

项目用到的框架与「哪些控件该用框架、哪些不该用」见 **`references/framework-strategy.md`**。要点：

- **保留（能力型）**：Tiptap 富文本、marked、dayjs。
- **遗留替换（React/Shadcn）**：5 个弹窗 + Toast + Button + 仪表盘，全部有原生 `.ui-*` 等价实现，按对照表逐步替换，新 UI 禁止再引入。
- **禁止**：Tailwind（未启用）、vanilla-extract / Emotion / styled-components（MV3 CSP 限制）。

## HTML / 图标 / 可访问性约定

详见 `references/html-and-icons.md`：
- 内联 SVG（Lucide 风格）或项目 `#dhIconSprite` symbol 引用。
- `role` / `aria-*` 写法、`focus-visible` 聚焦环、键盘导航。
- 响应式断点（`max-width: 640px / 1024px`）与 `prefers-reduced-motion`。

## 构建与接入

本项目**无需构建**。新增组件样式文件后，在 `index.html`（或对应页面）`<head>` 中按顺序引入，详见 `references/css-integration.md`：

```
fonts.css → base.css → tokens.css → 组件库 → themes/default.css
```

## 可直接套用的模板

- `templates/popup.html` + `templates/popup.css`：popup 页面骨架（基础 Token + 按钮 + 弹窗 + Toast）。
- `templates/options.html` + `templates/options.css`：设置页骨架（侧栏导航 + 分区卡片 + Toggle + 折叠栏）。

## 新增组件的标准步骤

1. 确认所需 Token 是否已在 `tokens.css` / `base.css` 中定义；缺失的变量先补充（不要写死字面量）。
2. 优先复用 `references/components.css` 中的组件模式导出（`ui-` 前缀类）。
3. 若确属新组件，用语义化类名 + `is-` 状态修饰编写样式，颜色/间距全部引用 `var(--...)`。
4. 图标用内联 SVG（`currentColor`）或项目 Sprite symbol；交互元素补 `role` / `aria-*` / `:focus-visible`。
5. 在断点下验证布局；动画加 `prefers-reduced-motion` 兜底（可参考组件库第 16 节的全局兜底）。
6. 深色模式无需单独适配：所有颜色走 Semantic Token，`[data-color-scheme="dark"]` 自动生效。
