# DevHome Workbench - 项目记忆

## 项目概述
- Chrome MV3 新标签页扩展，面向独立开发者的个人工作台
- 作者：凌致，当前版本 1.4.1，计划升级到 v2.0.0
- 双模式：日常像素主题 + 专注暖纸主题
- 开发工作台采用艾森豪威尔四象限矩阵

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
