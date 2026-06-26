# DevHome Workbench - 项目记忆

## 项目概述
- Chrome MV3 新标签页扩展，面向独立开发者的个人工作台
- 作者：凌致，当前版本 1.4.1，计划升级到 v2.0.0
- 双模式：日常像素主题 + 专注暖纸主题
- 开发工作台采用艾森豪威尔四象限矩阵

## 2026-06-24 记录功能 ProseMirror 迁移

### 决策汇总
- **编辑引擎**：ProseMirror 替换 contenteditable+execCommand
- **依赖加载**：esbuild 打包 `js/lib/pm.bundle.js` (467KB) + `js/lib/hljs.bundle.js` (245KB)
- **代码块**：ProseMirror NodeView + highlight.js 语法高亮 + 内嵌工具栏（语言下拉+复制按钮+双击编辑）
- **标题**：保留独立输入框
- **工具栏**：气泡式（选中文字时浮现），替换常驻顶部
- **右键菜单**：精简保留（代码块+引用块+复制粘贴），去掉 B/I/U/颜色
- **Markdown 快捷键**：启用（`#`标题、` ``` `代码块、`-`列表、`>`引用、`**`加粗等）
- **存储格式**：全量迁移 HTML→ProseMirror JSON（`doc` 字段），通过 DOMParser 转换旧数据
- **列表预览**：纯标题+标签+时间，不显示内容摘要
- **字数统计**：保存时自动计算存入 `wordCount` 字段（中文每字+英文每词）

### 执行进度
- **Phase 0 完成**：esbuild 构建 `pm.bundle.js` + `hljs.bundle.js`，引入 `index.html`，添加 `css/hljs-theme.css`
- **Phase 1 完成**：数据模型升级——`doc`/`wordCount` 字段、`migrateNoteDoc()`、`migrateAllNotes()`、`countWords()`
- **Phase 2 完成**：`js/proseMirrorEditor.js` 编辑器模块——Schema、插件、输入规则、键盘映射、完整生命周期 API
- **Phase 3 完成**：CodeBlockView NodeView——语言下拉、复制按钮、双击编辑、highlight.js 高亮
- **Phase 4 完成**：气泡工具栏——选中文字浮现、按钮事件、选区同步、颜色面板
- **Phase 5 完成**：右键菜单精简——移除 B/I/U/标题/颜色，保留代码块+引用块+复制粘贴
- **Phase 6 完成**：字数统计 CSS
- **Phase 7 完成**：CSS 清理——删除旧工具栏/旧 pre 样式，新增气泡工具栏+代码块 NodeView+字数统计样式
- **Phase 8 待实现**：Markdown 导出适配
- **Stage 1 持续**：`tests/prosemirror-tests.mjs` 44 条单元测试全部通过（7 组）
- **新增文件**：`package.json`、`build.mjs`、`js/lib/pm.bundle.js`、`js/lib/hljs.bundle.js`、`css/hljs-theme.css`、`tests/prosemirror-tests.mjs`、`js/proseMirrorEditor.js`
- **修改文件**：`index.html`（bundle引入+hljs主题+bubble工具栏+精简右键菜单+字数计数）、`js/notes.js`（数据模型+迁移+编辑器接口）、`js/events.js`（气泡工具栏事件+右键菜单精简）、`js/ui.js`（移除旧菜单项+颜色面板+保留代码子菜单）、`css/themes/warm-paper.css`（删除旧样式+新样式）

### 实现计划
- `docs/prosemirror-migration-plan.md` — 完整实现计划（8 个 Phase，14 个文件涉及，9 组测试）

## 2026-06-23 专注模式全面改造

### 1. 禁止原生弹窗（AGENTS.md §10 + 全量替换）
- 新增 `ns.showPrompt()` 主题化输入弹窗和 `ns.showToast()` 通知
- 所有 `alert()`、`prompt()` 全部替换为自定义弹窗

### 2. 文章标签——多选类型分配
- 类型字段 `type` 改为逗号分隔字符串（`"note,idea"`），向后兼容
- 类型徽章：每个类型显示为独立 chip，带 `×` 移除，末尾 `+` 打开多选面板
- 关键词标签输入框已移除

### 3. 日期标签
- 新建笔记自动追加日期标签（`YYYY-MM-DD`），蓝底徽章
- 侧边栏按日期分组（今天/昨天/周几+月日）

### 5. 数字输入 bug 修复
- `isEditing` 条件检查 contenteditable 和所有 input/textarea/select

### 6. 富文本编辑器
- contenteditable 替代 textarea，工具栏支持标题/加粗/斜体/下划线/列表/颜色/高亮

### 7. 专注模式右键菜单
- 隐藏"新添磁贴""新建分类""删除分类"（`.ctx-daily-only` CSS）
- 编辑器内右键：标题1-6、加粗/斜体/下划线、20色颜色面板（显示色码）、代码块（20种语言）
- 工具栏颜色从浏览器原生选择器改为20色面板

### 改动文件
- `index.html`: `#editorContextMenu`、`#ctxColorPalette`、`#ctxCodeLangMenu`、`#wbColorPalette`；`ctx-daily-only` 类；移除 `#wbNoteTags`；工具栏颜色改按钮
- `css/themes/warm-paper.css`: `.ctx-daily-only` 隐藏、颜色面板、代码块样式
- `js/ui.js`: `showEditorContextMenu`、`handleEditorMenuAction`、颜色/代码语言菜单函数
- `js/events.js`: 编辑器右键菜单、颜色面板、代码语言事件
- `js/notes.js`: 移除标签输入框逻辑
- `js/state.js`: 移除 `wbNoteTags` 引用

## 架构决策
- 使用原生 HTML/CSS/JS，无构建工具，无框架
- `tabpage_*` 存储前缀用于原有磁贴/分类数据，`devhome_*` 用于二开工作台数据
- 主页面模块通过 `window.DevHome` 全局命名空间通信

## 目录结构
```
DevHome Workbench/
├── manifest.json / index.html / popup.html / sidepanel.html
├── defaults.json / AGENTS.md / README.md
├── js/          → 主页 JS 模块
├── css/         → 主页 CSS 模块
├── tests/       → TDD 测试套件
└── icons/       → 扩展图标
```
