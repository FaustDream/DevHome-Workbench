# 项目框架使用策略（写清楚「用了什么框架、哪些场景该用、哪些不该用」）

> 依据 2026-08 对全项目控件实现方式的盘点结论。新增 UI 前必须先读本文档，按此决策，避免引入多余框架。

---

## 1. 结论速览

| 框架/库 | 类别 | 判定 | 使用场景 |
|---------|------|------|---------|
| **Tiptap**（`@tiptap/*` + `@tiptap/pm`） | 能力型框架 | ✅ **保留（必要）** | 笔记富文本编辑器（`ns.tiptapEditor`，打包为 `js/tiptap-bundle.js`） |
| **marked** | 能力型工具 | ✅ **保留（必要）** | AI 回复 Markdown 渲染（`js/lib/marked.min.js`，本地化） |
| **dayjs** | 能力型工具 | ✅ 保留（轻量，可留可去） | 相对时间/日期格式化（`js/lib/dayjs.min.js`，本地化） |
| **React 18 + react-dom** | 运行时框架 | ⚠️ **遗留，逐步替换** | 仅为 `js/ui-components/*`（Shadcn 弹窗）+ 仪表盘服务；新 UI 禁止再引入 |
| **Shadcn 组件**（Button/Dialog/Toast…） | 组件库 | ⚠️ **遗留，逐步替换** | 见下节「Shadcn → 原生对照表」 |
| **Tailwind** | 样式框架 | ❌ **未启用** | 仅 `tailwind-base.css` 做变量桥接，无工具类运行时、无构建链 |
| **vanilla-extract / Emotion / styled-components** | 样式框架 | ❌ **禁止引入** | MV3 CSP 禁止运行时注入样式；项目无对应构建链 |

## 2. Shadcn → 原生组件对照表

所有 React/Shadcn 遗留组件均已有**原生等价实现**，替换时对照下表，用原生类 + 现有 `ns.showConfirm` / `ns.showPrompt` API：

| Shadcn/React 组件 | 对应原生实现 | 说明 |
|-------------------|-------------|------|
| `ShadcnButton` | `.ui-btn` + `.ui-btn-primary/outline/ghost/danger` + `.ui-btn-sm/icon` + `.ui-btn-loading` | 5 种语义 + 尺寸 + 加载态全覆盖 |
| `ShadcnDialog` | `.ui-overlay` + `.ui-dialog` + `.ui-dialog-header/body/footer/close` | 居中弹窗骨架 |
| `ShadcnConfirmDialog` | `ns.showConfirm()` + `.ui-dialog--confirm` | 确认弹窗（原生 17 处调用仍为主力） |
| `ShadcnPromptDialog` | `ns.showPrompt()` + `.ui-dialog--confirm` + `.ui-input` | 输入弹窗 |
| `ShadcnTileFormDialog` | `.ui-overlay` + `.ui-dialog` + `.ui-input`/`.ui-select` 表单 | 磁贴编辑表单 |
| `ShadcnChangelogDialog` | `.ui-overlay` + `.ui-dialog` + 静态 `.changelog-*` | 纯静态内容 |
| `ShadcnToast` | `.ui-toast` + `.ui-toast-container`（或 `.wb-toast`） | Toast 通知 |
| `ShadcnSwitch` | `.ui-switch` + `.ui-switch-track` | Toggle 开关 |
| `ShadcnTextarea` | `.ui-textarea` | 多行文本 |
| `DashboardApp`（React） | 原生模板渲染 + `.db-*` 样式（样式本就是原生 CSS） | 行为仪表盘，无需 React 状态管理 |

> 替换收益：减约 130KB（React runtime）+ 删除 JSX 编译链（`build.mjs` 第一段）+ 消除两套 UI 风格并存。
> 替换成本：改写 5 处 `ShadcnDialogs.*` 调用点（`utils.js`×2、`_tile-editor.js`×2、`_settings-panel.js`×1）+ 仪表盘模板化。

## 3. 新 UI 开发决策规则

1. **样式**：一律原生 CSS + Semantic Token，使用 `references/components.css` 的 `.ui-*` 组件，禁止引入任何样式框架。
2. **能力型需求**（富文本 / Markdown / 复杂算法）才考虑第三方库：先评估自研成本，确属数量级差异再引入，且必须本地 vendored + 静态打包（符合 MV3 CSP）。
3. **弹窗/表单/交互**：优先原生 `ns.showConfirm` / `ns.showPrompt` 或 `.ui-dialog`，禁止新增 React/Shadcn 弹窗。
4. **禁止**：新增 React 组件、新开 `js/components/ui/*.jsx`、在 `tailwind-base.css` 追加样式。

## 4. 配套文件

- 框架使用声明已写入 `css/ui-components.css` 头部注释与 `css/tailwind-base.css` 头部注释。
- 组件库（含 Shadcn 对照标注）见 `references/components.css`。
- Token 参考见 `references/design-tokens.md`。
