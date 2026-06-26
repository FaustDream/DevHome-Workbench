# 专注模式记录功能 ProseMirror 迁移 实现计划

**Goal:** 将专注模式下笔记编辑器从 contenteditable+execCommand 迁移到 ProseMirror 内核，重写代码块为可交互 NodeView（语法高亮+内嵌工具栏），工具栏改为气泡式选中浮现，右键菜单精简，加入 Markdown 快捷键和字数统计。

**Architecture:** 先用 esbuild 打包 ProseMirror+highlight.js 为独立 bundle 文件，再在 notes.js 中用 DOMParser 全量迁移旧 HTML 为 ProseMirror JSON。新建 `js/proseMirrorEditor.js` 封装编辑器生命周期，渐进替换 notes.js/events.js/ui.js 中的旧代码。

**Tech Stack:** ProseMirror (model, state, view, schema-basic, inputrules, keymap, commands, history), highlight.js, esbuild (仅构建时)

---

## 决策汇总（来自 grill-me）

| 决策维度 | 方案 |
|---------|------|
| 编辑引擎 | ProseMirror 替换 contenteditable+execCommand |
| 依赖加载 | esbuild 打包为 `js/lib/pm.bundle.js` + `js/lib/hljs.bundle.js` |
| 代码块 | NodeView + highlight.js 语法高亮 + 内嵌工具栏（语言下拉+复制按钮） |
| 标题字段 | 保留独立 `<input>` |
| 格式工具栏 | 气泡式（选中文字时浮现），替换常驻顶部工具栏 |
| 右键菜单 | 精简保留（代码块+引用块+复制粘贴），去掉 B/I/U/颜色 |
| Markdown 快捷键 | 启用（`#`标题、` ``` `代码块、`-`列表、`>`引用等） |
| 存储格式 | 全量迁移 HTML→ProseMirror JSON（`doc` 字段），旧 HTML 通过 DOMParser 转换 |
| 列表预览 | 纯标题+标签+时间，不显示内容摘要 |
| 字数统计 | 保存时自动计算存入 `wordCount` 字段 |
| 文档组织 | 笔记列表+类型标签+日期分组，不需要目录 |

---

## Testing Plan

### 单元测试（js 逻辑验证，使用 ESM mock 模块）

**1. 数据迁移正确性**
- 创建 5 条测试笔记：纯文本、带标题+段落、带代码块 `<pre data-lang="javascript">`、带列表 `<ul><li>`、空内容
- 执行 `migrateAllNotes()` → 验证每条笔记新增 `doc` 字段为合法 ProseMirror JSON（`type: "doc"` 存在且有 `content` 数组）
- 验证 `wordCount` 字段正确（纯文本去 HTML 标签后的中文字数+英文词数）
- 验证迁移后 `content` 字段（HTML）仍保留不变（向后兼容）

**2. ProseMirror schema 文档生成正确性**
- 用 `DOMParser.fromSchema(schema).parse(html)` 解析已知 HTML
- 验证段落→`paragraph` 节点、`<h2>`→`heading {level:2}`、`<pre data-lang="javascript"><code>console.log(1)</code></pre>`→`code_block {language:"javascript"}`
- 解析 HTML `<blockquote><p>quote</p></blockquote>` → 验证 schema 正确处理（需自定义解析规则）

**3. 编辑器生命周期**
- 调用 `openProseMirrorEditor(note)` → 验证 DOM 中挂载了 `.ProseMirror` 容器（替换旧 contenteditable div）
- 输入文字 → 等待 800ms → 验证 `chrome.storage.local.set` 被调用，传入 `doc` JSON 非空
- 调用 `closeProseMirrorEditor()` → 验证 `editorView.destroy()` 被调用，状态清理

**4. 代码块 NodeView**
- schema 允许 `code_block` 类型的 block 节点
- 创建 `code_block` 节点 → 验证 DOM 中渲染了 `.wb-codeblock-toolbar`（语言标签+复制按钮）
- 点击复制按钮 → 验证 `navigator.clipboard.writeText` 被调用
- 语言下拉切换 → 验证节点 `language` 属性更新，highlight.js 重新高亮

**5. 气泡工具栏**
- 在编辑器中选中文字 → 验证气泡工具栏 `.wb-bubble-toolbar` 可见，定位在选区上方
- 点击气泡中的 B 按钮 → 验证 ProseMirror `toggleMark('strong')` 执行
- 点击其他地方取消选中 → 验证气泡工具栏隐藏

**6. Markdown 输入规则**
- 在空段落开头输入 `#` + 空格 → 验证段落变为 `heading {level:1}`
- 输入 `-` + 空格 → 验证变为 `bullet_list`
- 输入 `` ``` `` + 空格 → 验证变为 `code_block`
- 输入 `>` + 空格 → 验证变为 `blockquote`

**7. 字数统计**
- 编辑笔记保存后 → 验证 `note.wordCount` 字段被更新
- 中文 "你好世界" → 4 字
- 英文 "hello world" → 2 词
- 混合 "你好 world" → 4（2 字 + 2 词）
- 编辑器底部显示字数

NOTE: I will write *all* tests before I add any implementation behavior.

### 集成测试（浏览器中验证）

**8. 端到端编辑流程**
- 进入专注模式 → 新建笔记 → 标题输入"测试" → 正文写 "这是一段文字" → 按 Ctrl+B 加粗部分文字 → 等待 2 秒 → 退出专注模式 → 重新进入 → 打开笔记 → 验证内容完整且格式正确

**9. 旧数据兼容**
- 在迁移前手动创建 10 条旧 HTML 格式笔记 → 首次打开记录 Tab → 验证所有笔记正常显示在列表中 → 打开任一条 → 验证编辑器正确渲染 → 编辑保存 → 验证数据持久化

---

## 实现任务

### Phase 0: 构建依赖包

#### Task 0.1: 创建构建脚本

**文件:** `build.sh` (新增)

**目标:** 一次性将 ProseMirror 8 个模块 + highlight.js 打包为独立 UMD bundle

**步骤:**
1. 创建空的 `js/lib/` 目录（如不存在）
2. 安装 esbuild（或使用 npx 免安装）
3. 打包 ProseMirror：

入口文件内容（新建 `js/lib/pm-entry.js`，打包后可删除）：
- 导入并 re-export: `prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-schema-basic`, `prosemirror-inputrules`, `prosemirror-keymap`, `prosemirror-commands`, `prosemirror-history`
- 注意 `prosemirror-view` 包含运行时 DOM 操作，需标记 `--external:prosemirror-model` 避免重复打包

4. 打包 highlight.js（仅 20 种语言）：

打包入口文件（新建 `js/lib/hljs-entry.js`，打包后可删除）：
- 导入 `highlight.js/lib/core`
- 注册：javascript, typescript, python, java, cpp, csharp, go, rust, ruby, php, swift, kotlin, sql, xml (html), css, json, yaml, bash, markdown, plaintext

5. 验证：`js/lib/pm.bundle.js` 和 `js/lib/hljs.bundle.js` 文件存在且 `window.PM` 和 `window.hljs` 全局可用

**涉及文件:**
- 新建 `build.sh`
- 新建 `js/lib/pm-entry.js` (临时)
- 新建 `js/lib/hljs-entry.js` (临时)
- 新增 (忽略) `js/lib/pm.bundle.js`
- 新增 (忽略) `js/lib/hljs.bundle.js`

#### Task 0.2: 引入依赖到 index.html

**文件:** `index.html`

**步骤:**
1. 在 `</body>` 前、现有 `<script>` 标签之前添加两个 bundle：

```html
<script src="js/lib/pm.bundle.js"></script>
<script src="js/lib/hljs.bundle.js"></script>
```

2. 添加 highlight.js 主题 CSS — 在 `<head>` 中添加：

```html
<link rel="stylesheet" href="css/hljs-theme.css">
```

3. 新建 `css/hljs-theme.css`（从 `highlight.js/styles/github-dark.css` 复制，适配暖纸主题背景）

**涉及文件:**
- 修改 `index.html`（添加 `<script>` 标签引入 bundle + `<link>` 引入 hljs 主题）
- 新建 `css/hljs-theme.css`

---

### Phase 1: 数据模型升级与迁移

#### Task 1.1: 新增 `doc` 和 `wordCount` 字段到 createNote

**文件:** `js/notes.js` — `createNote()` 函数 (约第 50-73 行)

**步骤:**
1. 在 `createNote()` 的 note 对象中新增两个字段：
   - `doc: null` — 初始为 null，首次编辑时通过 DOMParser 从 content HTML 生成
   - `wordCount: 0` — 初始为 0

2. 修改 `updateNote()` — 确保 `Object.assign` 不会覆盖新增字段（它自然不会，assign 只覆盖传入的 updates）

#### Task 1.2: 实现 HTML → ProseMirror JSON 迁移函数

**文件:** `js/notes.js` — 新增函数（放在文件末尾 IIFE 内，约第 597 行之前）

**函数签名:** `ns.migrateNoteDoc(note)` — 静默给单条笔记补 `doc` 字段

**步骤:**
1. 如果 `note.doc` 已存在且 `note.doc.type === 'doc'`，直接返回（已完成迁移）
2. 如果 `note.content` 为空或无 HTML 标签，创建空文档：
   - `note.doc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }`
3. 否则，用 ProseMirror `DOMParser.fromSchema(schema).parse(htmlDiv)` 解析 HTML 内容
   - 将 `note.content` HTML 包装在 `<div>` 中
   - 直接解析为 ProseMirror 文档节点
   - 存储为 `note.doc = doc.toJSON()`
4. 更新 `note.wordCount` — 调用 `countWords(note.content)`（从 HTML 提取纯文本计算）
5. 静默保存到 storage（仅首次迁移时调用 `saveNotes()`，不要在编辑中频繁触发）

**涉及文件:**
- 修改 `js/notes.js` — 新增 `migrateNoteDoc()` 函数

#### Task 1.3: 实现全量迁移启动逻辑

**文件:** `js/notes.js` — `loadNotes()` 函数 (约第 40-42 行)

**步骤:**
1. 在 `loadNotes()` 完成后调用 `migrateAllNotes()`
2. 遍历 `state.notes`，对每条无 `doc` 的笔记调用 `migrateNoteDoc()`
3. 遍历 `state.captures`，为每条捕获添加 `doc: null, wordCount: 0`（捕获不需要迁移，但保持数据结构一致）
4. 如果有迁移发生，调用 `saveNotes()` 一次
5. 添加日志：`console.log('[迁移] 全量迁移完成，迁移了 X 条笔记')`

#### Task 1.4: 实现字数统计函数

**文件:** `js/notes.js` — 新增函数

**函数签名:** `function countWords(text)` → `number`

**步骤:**
1. 从 HTML 或纯文本提取文字内容
2. 中文：匹配 `[\u4e00-\u9fff\u3400-\u4dbf]` 范围的字符，每个字符计 1 字
3. 英文/数字：匹配 `[a-zA-Z0-9]+` 词块，每个词块计 1 词
4. 返回中文字数 + 英文词数的总和
5. 示例：`"你好 world 123"` → 2（你,好） + 1（world） + 1（123） = 4

**涉及文件:**
- 修改 `js/notes.js` — 新增 `countWords()` 函数

---

### Phase 2: ProseMirror 编辑器模块

#### Task 2.1: 创建编辑器模块文件

**文件:** `js/proseMirrorEditor.js` (新建)

**职责:** 封装 ProseMirror 编辑器创建、销毁、状态同步全生命周期

**暴露 API（挂载到 `ns` 上）:**
- `ns.pmCreateEditor(domParent, note, callbacks)` → 创建编辑器实例
- `ns.pmDestroyEditor()` → 销毁当前编辑器
- `ns.pmGetDocJSON()` → 获取文档 JSON
- `ns.pmGetDocHTML()` → 获取文档 HTML（向后兼容列表预览）
- `ns.pmGetWordCount()` → 获取字数
- `ns.pmSetContent(docJSON)` → 设置文档内容

#### Task 2.2: 定义 ProseMirror Schema

**文件:** `js/proseMirrorEditor.js` — `buildSchema()` 函数

**Schema 节点类型:**
| 节点 | spec | 说明 |
|------|------|------|
| `doc` | `content: "block+"` | 顶层文档，至少一个 block |
| `paragraph` | `group: "block", content: "inline*"` | 段落 |
| `heading` | `group: "block", content: "inline*", attrs: {level: {default: 1}}` | 标题 h1-h6 |
| `code_block` | `group: "block", content: "text*", attrs: {language: {default: ""}}, isolating: true` | 代码块，原子文本 |
| `bullet_list` | `group: "block", content: "list_item+"` | 无序列表 |
| `ordered_list` | `group: "block", content: "list_item+", attrs: {order: {default: 1}}` | 有序列表 |
| `list_item` | `content: "paragraph+"` | 列表项 |
| `blockquote` | `group: "block", content: "block+"` | 引用块 |
| `horizontal_rule` | `group: "block"` | 分割线 |
| `text` | `group: "inline"` | 行内文本 |

**Marks:**
- `em` — 斜体
- `strong` — 加粗
- `underline` — 下划线
- `link` — 超链接 `attrs: {href: {default: ""}}`
- `code` — 行内代码
- `textColor` — 文字颜色 `attrs: {color: {default: ""}}`

**关键细节:**
- `code_block` 的 `content` 必须是 `"text*"`（纯文本，不允许行内 marks），因为 syntax highlighting 作用于整个文本 node
- `blockquote` 的 content 是 `"block+"`，允许嵌套段落/列表

#### Task 2.3: 配置 EditorState 插件

**文件:** `js/proseMirrorEditor.js` — `createPlugins()` 函数

**插件清单:**
1. `keymap(baseKeymap)` — 基础键盘映射（Enter 分段落、Backspace 删除等）
2. `keymap(customKeymap)` — 自定义快捷键
   - `Mod-b`: `toggleMark(strong)`
   - `Mod-i`: `toggleMark(em)`
   - `Mod-u`: `toggleMark(underline)`
3. `inputRules({rules: buildInputRules()})` — Markdown 输入规则（见 Task 2.4）
4. `history()` — 撤销/重做
5. `dropCursor()` — 拖拽光标
6. `gapCursor()` — 块间光标

#### Task 2.4: 配置 Markdown 输入规则

**文件:** `js/proseMirrorEditor.js` — `buildInputRules()` 函数

**规则清单（基于 `prosemirror-inputrules` 包）:**

| 输入模式 | 触发条件 | 效果 |
|---------|---------|------|
| `# ` | 行首输入 `#` + 空格 | 变为 `heading {level:1}` |
| `## ` | 行首输入 `##` + 空格 | 变为 `heading {level:2}` |
| `### ` | 行首输入 `###` + 空格 | 变为 `heading {level:3}` |
| `- ` 或 `* ` | 行首输入 `-` 或 `*` + 空格 | 变为 `bullet_list` |
| `1. ` | 行首输入 `1.` + 空格 | 变为 `ordered_list` |
| `> ` | 行首输入 `>` + 空格 | 变为 `blockquote` |
| ` ``` ` | 行首输入三个反引号 + 空格 | 变为 `code_block` |
| `**text**` | 包围文字 | `toggleMark(strong)` |
| `*text*` | 包围文字 | `toggleMark(em)` |
| `` `text` `` | 包围文字 | `toggleMark(code)` |

**注意:**
- 代码块语言选择不在输入规则中处理（MD 快捷键 ` ```js` → 自动设置 language="javascript"，否则留空由工具栏选择）
- `textInputRule` 仅在行首触发，`markInputRule` 在任意位置触发

#### Task 2.5: 替换 openNoteEditor

**文件:** `js/notes.js` — `openNoteEditor()` (约第 291-323 行)

**改动:**
1. 保留现有逻辑：显示编辑器面板、设置标题值、渲染类型徽章
2. 移除旧的 contenteditable 设值逻辑（第 313-321 行）
3. 调用新的 `ns.pmCreateEditor(dom.wbNoteContent.parentElement, note, callbacks)`
4. `callbacks` 包含：
   - `onChange: () => ns._triggerAutoSave()` — 触发 400ms 延迟自动保存
   - `onFocus: () => {}` — 预留
5. 如果是纯文本内容且无 `doc` 字段，先调用 `migrateNoteDoc(note)` 生成 doc
6. 日志：`console.log('[编辑] 打开 ProseMirror 编辑器 id=' + note.id)`

**关键:**
- `dom.wbNoteContent`（旧 contenteditable div）的 contenteditable 属性被移除，替换为 ProseMirror EditorView 挂载点
- 确保 `createEditor` 前销毁旧实例（幂等）

#### Task 2.6: 替换 saveCurrentNote

**文件:** `js/notes.js` — `saveCurrentNote()` (约第 334-369 行)

**改动:**
1. 用 `ns.pmGetDocJSON()` 替换 `dom.wbNoteContent.innerHTML`
2. 用 `ns.pmGetDocHTML()` 生成 HTML 用于 `content` 字段（向后兼容列表搜索）
3. 计算 `wordCount = ns.pmGetWordCount()` 存入更新数据
4. 保留标题、类型、标签的现有逻辑不变

更新调用：
```js
await ns.updateNote(state.currentNote.id, {
    title: title || '无标题',
    content: docHTML,       // 保留 HTML（用于列表搜索）
    doc: docJSON,           // 新增 ProseMirror JSON
    wordCount: wordCount,   // 新增字数
    type: type,
    tags: tags
});
```

#### Task 2.7: 替换 closeNoteEditor

**文件:** `js/notes.js` — `closeNoteEditor()` (约第 326-331 行)

**改动:**
1. 在 `state.currentNote = null` 之前调用 `ns.pmDestroyEditor()`
2. 其余逻辑不变

#### Task 2.8: 更新搜索兼容

**文件:** `js/notes.js` — `renderNotesList()` 中的搜索逻辑 (约第 178-186 行)

**改动:**
1. 搜索时使用 `content` 字段（HTML）去标签匹配 — 现有逻辑不变
2. _未来优化：也可以从 `doc.textContent` 提取，但当前保持搜索用 HTML 字段_

---

### Phase 3: 代码块 NodeView

#### Task 3.1: 创建 CodeBlockView 类

**文件:** `js/proseMirrorEditor.js` — 新增 `CodeBlockView` 类

**步骤:**
1. 实现 ProseMirror NodeView 接口
2. DOM 结构：
   ```html
   <div class="wb-codeblock" contenteditable="false">
     <div class="wb-codeblock-toolbar">
       <select class="wb-codeblock-lang">
         <option value="">纯文本</option>
         <option value="javascript">JavaScript</option>
         <!-- 20 种语言 -->
       </select>
       <button class="wb-codeblock-copy" title="复制代码">📋</button>
     </div>
     <pre class="wb-codeblock-pre"><code class="wb-codeblock-code hljs"></code></pre>
   </div>
   ```
3. `update(node)` 中：
   - 如果语言变化 → 更新 `<select>` 值和 `<code>` 的 className
   - 重新调用 `hljs.highlightElement(this._codeEl)` 更新高亮

#### Task 3.2: CodeBlockView 交互逻辑

**步骤:**
1. **语言下拉**：`<select>` change 事件 → dispatch transaction 更新 `node.attrs.language`
2. **复制按钮**：click 事件 → `navigator.clipboard.writeText(node.textContent)`
   - 复制成功后按钮短暂变为 "✅ 已复制"，1.5 秒后恢复 "📋"
3. **编辑**：双击代码块 `<pre>` 区域 → 进入编辑模式：
   - 隐藏 `<pre><code>` 显示区，显示 `<textarea>`
   - 失焦或 Ctrl+Enter → 保存编辑，dispatch transaction 更新文本内容
   - 恢复 `<pre><code>` + highlight.js 高亮

#### Task 3.3: 注册 NodeView 到编辑器

**文件:** `js/proseMirrorEditor.js` — `createEditorView()` 中

在 `EditorView` 构造函数中传入 `nodeViews`:
```js
nodeViews: {
  code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos)
}
```

---

### Phase 4: 气泡工具栏

#### Task 4.1: 创建气泡工具栏 DOM

**文件:** `index.html` — 在 `wbNotesEditorActive` 区域内新增

**步骤:**
1. 删除旧工具栏 `#wbNotesToolbar` 及其所有子元素（第 236-257 行）
2. 新增气泡工具栏 HTML，包含：
   - 标题下拉（H1/H2/H3/正文）
   - B/I/U 按钮
   - 列表按钮（无序/有序）
   - 颜色按钮 + 颜色面板
   - 所有按钮带 `data-pm-action` 属性映射 ProseMirror 命令

#### Task 4.2: 气泡工具栏显隐逻辑

**文件:** `js/proseMirrorEditor.js` — 在 `createEditorView()` 中注册插件

**步骤:**
1. 使用 ProseMirror Plugin 监听选区变化
2. 当选区非空时：计算选区绝对位置，显示 `#wbBubbleToolbar`，定位在选区上方
3. 当选区为空时：150ms 延迟隐藏气泡（给按钮点击留时间）
4. 处理视口边界：顶部空间不足时翻转到下方

#### Task 4.3: 气泡工具栏按钮事件

**文件:** `js/events.js` — 新增气泡工具栏事件绑定

**步骤:**
1. 在 `bindEvents()` 末尾新增 `bindBubbleToolbar()` 调用
2. 按钮 `mousedown` 事件（阻止失焦）→ 执行对应 ProseMirror 命令：
   - `toggleStrong`/`toggleEm`/`toggleUnderline` → toggleMark
   - `toggleBulletList`/`toggleOrderedList` → wrapIn
   - 标题下拉 → setBlockType(heading, {level: N})
   - 颜色按钮 → toggleMark(textColor, {color: hex})

#### Task 4.4: 同步按钮激活状态

**文件:** `js/proseMirrorEditor.js` — 插件 update 回调

**步骤:**
1. 在选区变化的 update 中，检查当前选区所在的 marks/blocks
2. 更新气泡工具栏按钮的 `.active` class
3. 更新标题下拉的值

---

### Phase 5: 右键菜单精简

#### Task 5.1: 精简编辑器右键菜单 HTML

**文件:** `index.html` — `#editorContextMenu` (约第 391-410 行)

**改动:**
1. 删除：标题 H1/H2/H3、加粗/斜体/下划线、文字颜色（这些气泡工具栏覆盖）
2. 保留并重新组织：插入代码块（保留子菜单）、插入引用块、复制、粘贴

#### Task 5.2: 更新右键菜单处理函数

**文件:** `js/events.js` — 编辑器右键菜单事件 (约第 204-330 行)

**改动:**
1. 移除颜色子菜单事件
2. 保留代码子菜单事件
3. `handleEditorMenuAction()` 改为调用 ProseMirror 命令：
   - `blockquote` → `wrapIn(blockquote)`
   - 删除 h1-h6、bold、italic、underline 的 case

#### Task 5.3: 更新 ui.js 相关函数

**文件:** `js/ui.js` — 编辑器右键菜单函数 (约第 416-550 行)

**改动:**
1. 删除 `showColorSubmenu()`、`hideColorSubmenu()`
2. 删除 `handleEditorMenuAction()` 中的 h1-h6/bold/italic/underline case
3. 删除 `insertCodeBlock()` — 改为 ProseMirror 命令
4. 保留 `CODE_LANGUAGES` 数据 和 `showCodeLangMenu()`、`hideCodeLangMenu()`

---

### Phase 6: 字数统计 UI

#### Task 6.1: 编辑器底部字数显示

**文件:** `index.html` — 在 `wbNotesEditorActive` 底部新增

在编辑器 body 下方添加：
```html
<div class="wb-note-word-count" id="wbNoteWordCount">0 字</div>
```

#### Task 6.2: 字数更新逻辑

**文件:** `js/proseMirrorEditor.js` — 在编辑器的 onChange 回调中

**步骤:**
1. 每次文档变化时计算字数
2. 更新 `#wbNoteWordCount` 文本内容
3. 自动保存时一并写入 `note.wordCount`

#### Task 6.3: 字数统计样式

**文件:** `css/themes/warm-paper.css` — 新增样式

轻量样式：右下角灰色小字，上边框分隔

---

### Phase 7: CSS 清理与新增

#### Task 7.1: 删除旧工具栏样式

**文件:** `css/themes/warm-paper.css`

**改动:**
1. 删除 `#wbNotesToolbar`、`#wbToolbarHeading`、`.wb-toolbar-btn`、`.wb-toolbar-select`、`.wb-toolbar-sep` 相关样式（约第 1944-1998 行）
2. 删除 `.wb-color-palette`、`.wb-color-swatch` 旧定位样式

#### Task 7.2: 新增气泡工具栏样式

**文件:** `css/themes/warm-paper.css` — 新增

```css
.wb-bubble-toolbar {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--wb-bg-card);
  border: 1px solid var(--wb-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  z-index: 2900;
  transform: translateX(-50%);
}
/* 底部三角箭头 */
.wb-bubble-toolbar::after { ... }
```

#### Task 7.3: 新增代码块 NodeView 样式

**文件:** `css/themes/warm-paper.css` — 新增

代码块容器、工具栏（flex 两端对齐）、语言下拉、复制按钮、深色底 `<pre>` 区域完整样式

#### Task 7.4: 删除旧代码块样式

**文件:** `css/themes/warm-paper.css`

**改动:**
1. 删除旧 `.wb-note-editable pre` 及 `pre::before` 样式（约第 2043-2064 行）

---

### Phase 8: Markdown 导出适配

#### Task 8.1: 更新导出逻辑支持 ProseMirror JSON

**文件:** `js/export.js`

**步骤:**
1. 在导出笔记时，优先使用 `note.doc` 字段（ProseMirror JSON）
2. 实现 `docJSONToMarkdown(doc)` 转换函数：
   - `paragraph` → 纯文本行
   - `heading {level:N}` → `#` × N + 文本
   - `code_block {language:L}` → ` ```L\n 代码\n ``` `
   - `bullet_list` → `- 文本`
   - `ordered_list` → `1. 文本`
   - `blockquote` → `> 文本`
3. 如果 `note.doc` 不存在（旧笔记），回退到 HTML→text 的现有逻辑

---

## 涉及文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `build.sh` | **新建** | 一次性构建脚本 |
| `js/lib/pm.bundle.js` | **新建** | ProseMirror 打包产物 |
| `js/lib/hljs.bundle.js` | **新建** | highlight.js 打包产物 |
| `js/lib/pm-entry.js` | **新建(临时)** | PM 打包入口 |
| `js/lib/hljs-entry.js` | **新建(临时)** | hljs 打包入口 |
| `css/hljs-theme.css` | **新建** | highlight.js github-dark 主题 |
| `js/proseMirrorEditor.js` | **新建** | 编辑器模块核心文件 |
| `index.html` | **修改** | 引入 bundle、气泡工具栏 DOM、删除旧工具栏、精简右键菜单、字数显示 |
| `js/notes.js` | **修改** | 数据模型升级、迁移逻辑、编辑器接口替换、字数统计 |
| `js/events.js` | **修改** | 删除旧工具栏事件、新增气泡工具栏事件、精简右键菜单 |
| `js/ui.js` | **修改** | 删除旧格式函数、精简编辑器菜单处理 |
| `js/state.js` | **修改** | 可能新增编辑器状态字段 |
| `css/themes/warm-paper.css` | **修改** | 删除旧样式、新增气泡工具栏/代码块 NodeView/字数统计样式 |
| `js/export.js` | **修改** | Doc JSON→Markdown 转换 |
| `manifest.json` | **不修改** | CSP 不变（bundle 本地加载） |

---

**Testing Details**

所有测试划分为 3 个阶段：

1. **Stage 1 - 单元测试**（共 7 组）：数据迁移、Schema 解析、编辑器生命周期、NodeView、气泡工具栏、Markdown 规则、字数统计。在 `tests/` 目录下实现，用 ESM mock `chrome.storage.local`，不依赖浏览器 DOM。

2. **Stage 2 - 集成测试**（共 2 组）：端到端编辑流程、旧数据兼容。在 Chrome 扩展实际加载后手动验证。

3. **Stage 3 - 回归测试**：确认不影响专注模式切换、四象限任务、日历、番茄钟、剪藏、导出等功能。

ALL tests MUST be written BEFORE implementation code is written.

---

**Implementation Details**

1. ProseMirror 打包使用 `esbuild --bundle --format=iife --global-name=PM`，8 个模块打包为单文件约 120KB gzipped
2. highlight.js 打包仅包含 20 种语言，约 80KB gzipped，两个 bundle 对新标签页首屏影响约 +200ms
3. 全量迁移在 `loadNotes()` 后执行一次，后续笔记全部为 ProseMirror JSON
4. `doc` 字段是纯 JSON，可直接序列化到 chrome.storage.local
5. 气泡工具栏定位用 `getSelection().getRangeAt(0).getBoundingClientRect()`，需处理视口边界翻转
6. 字数统计公式：中文文字数 + 英文单词数，不含标点符号
7. `blockquote` 右键操作用 `wrapIn` 命令
8. 编辑器销毁时调用 `view.destroy()`，同时清理 `state.currentNote` 引用
9. CSP 不需要修改——bundle 是本地文件 `script-src 'self'` 覆盖
10. 构建脚本可多次执行更新 bundle

---

**Questions**

1. highlight.js 主题选择：github-dark 在暖纸浅色背景下是否对比过强？备选：atom-one-dark 或自定义柔和深色主题
2. ProseMirror textColor mark 的 `toDOM` 返回 `['span', {style: 'color:...'}]`，确认内联 style 可接受
3. 图片支持：当前不在 scope，但 ProseMirror schema 是否预留 `image` 节点？建议预留但暂不实现 UI

---
