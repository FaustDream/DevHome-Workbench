# 项目约定与长期记忆

## 技术栈
- Chrome 扩展 (Manifest V3)，新标签页工作台
- 双模式架构：日常像素主题 + 专注暖纸主题，通过 CSS `<link>` media 属性互斥切换
- 笔记使用 chrome.storage.local (v2/ 前缀) + localStorage 缓存
- 富文本编辑器：ProseMirror 引擎 (js/lib/pm.bundle.js)
- 文件持久化：分类目录结构 (v2.2.0)，每个数据类别独立子目录，通过 manifest.json 识别版本
- 版本管理：小版本 +0.0.1（bug修复），中版本 +0.1.0（功能更新）

## 关键代码位置
- 专注模式入口：js/workbench.js → enterFocusMode/exitFocusMode
- 笔记 CRUD：js/notes.js → 完整笔记生命周期
- 笔记编辑器：js/proseMirrorEditor.js → PM 编辑器封装
- 存储层：js/storageV2.js → chrome.storage.local + localStorage 缓存
- 事件中枢：js/events.js → 所有 DOM 事件绑定

## 已知修复 (2026-06-29)
- **修复笔记/捕获数据不纳入 devhome-config.json 文件同步**：卸载扩展后重新配置目录时笔记丢失
  - 根因：fileConfig.js 的 collectAllData() 未收集 notes/captures，restoreAllData() 也未恢复它们
  - 修复：collectAllData() 从 localStorage 缓存中收集 notes/captures 并写入 JSON
  - 修复：restoreAllData() 改为 async，通过 storageV2.set() 将 notes/captures 写入 chrome.storage.local
  - 修复：storageV2.set() 增加 markDirty() 调用，笔记/捕获/任务变更时自动触发 3 秒防抖写盘
  - 版本：2.1.2 → 2.1.3
- 修复专注模式下笔记数据丢失和无法编写内容的问题
- 根因：openNoteEditor() 在 window.PM 不可用时无回退逻辑，导致编辑器未初始化且自动保存覆盖有效数据
- 根因：saveCurrentNote() 无空内容安全保护
- 根因：closeNoteEditor() 关闭前不保存，依赖 400ms 防抖存在竞态风险
- 修复气泡工具栏选中文字不显示：bubbleToolbarPlugin 的 view prop 函数签名修正
- 修复字数统计不自动更新：updateWordCountUI 增加 DOM 元素回退获取逻辑
- 修复右键引用块/代码块插入无默认文本：codeBlock 插入"在此输入代码..."占位文本
- 新增右键菜单"粘贴纯文本"和"粘贴（含格式）"两个选项，使用 PM pasteText/pasteHTML API
- manifest.json 新增 clipboardRead 权限

## ProseMirror 迁移完成 (2026-06-24 ~ 06-29)
- **8/8 Phase 全部完成**，44 条单元测试通过，0 lint 错误
- 编辑引擎：ProseMirror 替换 contenteditable+execCommand
- 依赖：`js/lib/pm.bundle.js` + `js/lib/hljs.bundle.js`
- 代码块：NodeView + highlight.js + 内嵌工具栏
- 工具栏：气泡式选中浮现，B/I/U/标题/列表/颜色
- 右键菜单：精简为代码块+引用块+复制粘贴
- 存储格式：全量迁移 HTML→ProseMirror JSON（`doc` 字段）+ `wordCount`
- Markdown 导出：`docJSONToMarkdown()` 支持所有节点类型 + marks
