# 组件模式（HTML 结构 + 使用说明）

> 完整可复制样式见 `components.css`（本技能同目录）。所有组件遵循项目命名约定：`ui-` 通用前缀 + `is-` 状态修饰。
> 本文档说明每个组件的 HTML 结构、状态类、JS 交互要点。样式一律引用 Token 变量（见 `design-tokens.md`）。

---

## 1. 单行文本（Input）

```html
<!-- 普通输入 -->
<input class="ui-input" type="text" placeholder="请输入内容" />

<!-- 带图标输入 -->
<div class="ui-input-wrap is-has-value">
  <span class="ui-input-icon" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  </span>
  <input class="ui-input" type="text" placeholder="搜索…" />
  <button class="ui-input-clear" type="button" aria-label="清空">✕</button>
</div>

<!-- 紧凑 + 错误态 -->
<input class="ui-input ui-input-sm is-invalid" type="text" value="错误示例" aria-invalid="true" />
```

- 状态类：`.is-invalid`（错误态）；容器 `.is-has-value` 时显示清空按钮。
- 交互：清空按钮 click → 清空 value、移除 `.is-has-value`。

## 2. 多行文本（Textarea）

```html
<textarea class="ui-textarea" placeholder="请输入备注…" rows="4"></textarea>

<!-- 只读输出（日志/命令结果） -->
<div class="ui-output">第 1 行输出\n第 2 行输出</div>
```

- `.ui-textarea--mono` 等宽模式；`.ui-textarea` 支持 `resize: vertical`。
- `.ui-output` 只读，`white-space: pre-wrap` 保留换行。

## 3. 富文本编辑器（Rich Text）

```html
<div class="ui-richtext">
  <div class="ui-richtext-toolbar" role="toolbar" aria-label="格式工具栏">
    <button class="ui-richtext-btn" data-cmd="bold" type="button" title="加粗"><b>B</b></button>
    <button class="ui-richtext-btn" data-cmd="italic" type="button" title="斜体"><i>I</i></button>
    <span class="ui-richtext-sep" aria-hidden="true"></span>
    <button class="ui-richtext-btn" data-cmd="insertUnorderedList" type="button" title="列表">•≡</button>
    <button class="ui-richtext-btn" data-cmd="formatBlock" data-value="blockquote" type="button" title="引用">❝</button>
  </div>
  <div class="ui-richtext-body" contenteditable="true" role="textbox" aria-multiline="true"
       data-placeholder="输入内容…"></div>
</div>
```

- JS 交互：工具栏按钮 `execCommand(cmd, false, value)`；body `input` 事件后同步 `data-cmd="bold"` 按钮的 `.is-active` 状态（用 `document.queryCommandState`）。
- `:empty` 时显示 `data-placeholder`。保存时取 `body.innerHTML`。

## 4. 弹窗（Dialog / Drawer / Confirm）

### ⚠️ 禁止浏览器原生弹窗（强制）

**业务代码中一律禁止 `alert()` / `confirm()` / `prompt()`**——原生弹窗阻塞线程、破坏主题视觉一致性、无键盘与可访问性规范。
必须使用符合本样式体系的弹窗，统一走项目既有 API：

| 场景 | 使用 API | 返回 |
|------|---------|------|
| 确认操作 | `ns.showConfirm(message, opts)` | `Promise<boolean>` |
| 输入文本 | `ns.showPrompt(message, opts)` | `Promise<string\|null>` |
| 提示/错误通知 | `ns.showToast(message, type)` / `ns.showActionToast(msg, label, cb)` | 自动消失 |
| 自定义内容 | `ns.createModal(title, bodyHTML, footerHTML, opts)` | — |
| 完全自定义 | 下方 `.ui-overlay` + `.ui-dialog` 结构 + JS 控制 | — |

键盘规范：Enter 确认 / Esc 取消 / Tab 圈闭焦点；`role="dialog"` + `aria-modal="true"` + `aria-labelledby`。
样式位于 `css/ui-components.css` 弹窗区块（含 `.ui-dialog--confirm` 确认形态与 `.ui-dialog-icon` 状态图标）。

```html
<!-- 居中弹窗 -->
<div class="ui-overlay" id="dlg" hidden>
  <div class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <div class="ui-dialog-header">
      <h2 class="ui-dialog-title" id="dlg-title">标题</h2>
      <button class="ui-dialog-close" type="button" aria-label="关闭">✕</button>
    </div>
    <div class="ui-dialog-body">内容区域</div>
    <div class="ui-dialog-footer">
      <button class="ui-btn ui-btn-outline ui-btn-sm" type="button" data-close>取消</button>
      <button class="ui-btn ui-btn-primary ui-btn-sm" type="button">确定</button>
    </div>
  </div>
</div>

<!-- 右侧抽屉 -->
<div class="ui-drawer-overlay" id="drawer">
  <aside class="ui-drawer" role="dialog" aria-modal="true" aria-label="设置">
    <div class="ui-drawer-header">
      <h2 class="ui-drawer-title">设置</h2>
      <button class="ui-dialog-close" type="button" aria-label="关闭">✕</button>
    </div>
    <div class="ui-drawer-body">…</div>
  </aside>
</div>

<!-- 确认弹窗 -->
<div class="ui-overlay" id="confirm" hidden>
  <div class="ui-dialog ui-dialog--confirm" role="alertdialog" aria-modal="true">
    <div class="ui-dialog-icon is-danger" aria-hidden="true"><svg …/></div>
    <h2 class="ui-dialog-title">确定删除？</h2>
    <div class="ui-dialog-body">此操作不可撤销。</div>
    <div class="ui-dialog-footer">
      <button class="ui-btn ui-btn-outline ui-btn-sm" type="button" data-close>取消</button>
      <button class="ui-btn ui-btn-danger ui-btn-sm" type="button">删除</button>
    </div>
  </div>
</div>
```

- 打开/关闭：切 `.ui-overlay` 的 `hidden`、`.ui-drawer-overlay` 的 `.visible`。
- 键盘：Escape 关闭；焦点圈闭（打开时聚焦关闭按钮，关闭后还原）。
- 遮罩点击：`event.target === overlay` 时关闭（确认弹窗可选不关）。

## 5. 气泡（Tooltip / Popover / Bubble）

```html
<!-- 纯 CSS Tooltip（属性驱动，无 JS） -->
<button class="ui-btn ui-btn-ghost ui-tip" data-tooltip="保存成功" type="button">悬停</button>
<!-- 位置修饰：ui-tip--bottom -->

<!-- JS Popover -->
<div class="ui-popover" id="pop" role="dialog" aria-label="说明">
  <span class="ui-popover-arrow" aria-hidden="true"></span>
  <h3 class="ui-popover-title">提示</h3>
  <div class="ui-popover-body">这是气泡内容。</div>
</div>

<!-- 对话气泡 -->
<div class="ui-bubble ui-bubble--left">对方消息</div>
<div class="ui-bubble ui-bubble--right">我的消息</div>
```

- `.ui-popover` 通过 JS 定位（相对触发元素，计算 `getBoundingClientRect`），显隐切 `.visible`。

## 6. 导航（Nav / Tab / Segmented / Sidenav）

```html
<!-- 顶部导航 -->
<nav class="ui-nav" aria-label="主导航">
  <button class="ui-nav-item is-active" type="button">首页</button>
  <button class="ui-nav-item" type="button">工作台</button>
</nav>

<!-- 下划线 Tab -->
<div class="ui-tabs" role="tablist" aria-label="设置分类">
  <button class="ui-tab is-active" role="tab" aria-selected="true" type="button">通用</button>
  <button class="ui-tab" role="tab" aria-selected="false" type="button">外观</button>
</div>

<!-- 胶囊分段 -->
<div class="ui-seg" role="tablist">
  <button class="ui-seg-btn is-active" role="tab" aria-selected="true" type="button">日</button>
  <button class="ui-seg-btn" role="tab" aria-selected="false" type="button">周</button>
  <button class="ui-seg-btn" role="tab" aria-selected="false" type="button">月</button>
</div>

<!-- 侧栏导航 -->
<nav class="ui-sidenav" aria-label="侧栏">
  <button class="ui-sidenav-item is-active" type="button">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    概览
  </button>
</nav>
```

- 面板切换：对应内容区 `hidden` 切换，激活项同步 `.is-active` 与 `aria-selected`。

## 7. 折叠栏（Collapse / Group）

```html
<div class="ui-collapse" data-collapse>
  <div class="ui-collapse-head" role="button" tabindex="0" aria-expanded="true">
    <span class="ui-collapse-icon" aria-hidden="true"><svg …/></span>
    <span class="ui-collapse-title">分类标题</span>
    <span class="ui-collapse-arrow" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
    </span>
  </div>
  <div class="ui-collapse-body">内容…</div>
</div>
```

- 交互：head click / Enter / Space → 切换 `.is-collapsed`，同步 `aria-expanded`。
- `.ui-collapse.is-collapsed .ui-collapse-body { display:none }` 由 CSS 处理。

## 8. 选项框（Checkbox / Circle-check / Switch / Chip / Select / Dropdown）

```html
<!-- 原生复选框 -->
<label class="ui-check">
  <input type="checkbox" /> 记住我
</label>

<!-- 圆形勾选（任务风格） -->
<button class="ui-circle-check" type="button" role="checkbox" aria-checked="false"></button>

<!-- 开关 -->
<label class="ui-switch">
  <input type="checkbox" checked />
  <span class="ui-switch-track" aria-hidden="true"></span>
</label>

<!-- 标签多选 Chip -->
<button class="ui-chip is-checked" type="button" aria-pressed="true">标签A</button>

<!-- 下拉选择（原生） -->
<select class="ui-select">
  <option>选项一</option><option>选项二</option>
</select>

<!-- 自定义下拉（JS） -->
<div class="ui-dropdown-menu" id="menu" hidden>
  <button class="ui-dropdown-item is-active" type="button">动作一</button>
  <button class="ui-dropdown-item is-danger" type="button">删除</button>
</div>
```

- `.ui-circle-check` 点击切换 `.is-checked` + `aria-checked`。
- `.ui-dropdown-menu` 定位与关闭逻辑同右键菜单。

## 9. 时间 / 日期（Time / Date）

```html
<!-- 原生时间/日期输入 -->
<input class="ui-time-input" type="datetime-local" />

<!-- 快捷预设 -->
<div class="ui-time-quick">
  <button class="ui-time-chip is-active" type="button">今天</button>
  <button class="ui-time-chip" type="button">明天</button>
  <button class="ui-time-chip" type="button">本周末</button>
</div>

<!-- 时间选择面板 -->
<div class="ui-time-picker" id="timePanel" hidden>
  <div class="ui-time-picker-label">截止时间</div>
  <div class="ui-time-picker-row">
    <input class="ui-time-input" type="date" />
    <input class="ui-time-input" type="time" />
  </div>
  <div class="ui-time-picker-actions">
    <button class="ui-btn ui-btn-ghost ui-btn-sm" type="button">清除</button>
    <button class="ui-btn ui-btn-primary ui-btn-sm" type="button">确定</button>
  </div>
</div>

<!-- 大号时间显示 -->
<div class="ui-time-display">14:30<span class="ui-time-display-unit">PM</span></div>
```

- 深色模式：`.ui-time-input` 自动通过 `color-scheme` 适配（组件库已内置）。

## 10. 按钮（Button）

```html
<button class="ui-btn ui-btn-primary" type="button">主按钮</button>
<button class="ui-btn ui-btn-outline" type="button">描边</button>
<button class="ui-btn ui-btn-ghost" type="button">幽灵</button>
<button class="ui-btn ui-btn-danger" type="button">危险</button>
<button class="ui-btn ui-btn-outline ui-btn-sm is-loading" type="button">保存中</button>
<button class="ui-btn ui-btn-ghost ui-btn-icon" type="button" aria-label="更多">⋮</button>
```

- loading：加 `.is-loading`，JS 在异步期间禁用按钮。
- 图标按钮推荐配 `aria-label` 或 `title`。

## 11. Toast 通知

```html
<div class="ui-toast-container" id="toastWrap"></div>
<!-- JS 动态插入： -->
<div class="ui-toast is-success">
  <svg class="ui-toast-icon" …><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-5"/></svg>
  <span>保存成功</span>
</div>
```

- 类型：`.is-success` / `.is-error` / `.is-warning` / `.is-info`。
- 自动消失后加 `.is-exit` 播放离场动画再移除 DOM；可带 `.ui-toast-action` 操作按钮（如撤销）。

## 12. Badge / Tag / 状态点

```html
<span class="ui-badge is-accent">新版</span>
<span class="ui-badge is-danger">危险</span>
<span class="ui-badge">通知<span class="ui-badge-count">3</span></span>
<span class="ui-status-dot is-online" aria-label="在线"></span>
```

## 13. 右键菜单 / 命令菜单

```html
<div class="ui-context-menu" id="ctx" role="menu">
  <button class="ui-context-item" role="menuitem" type="button">
    <svg …/>重命名<span class="ui-context-kbd">F2</span>
  </button>
  <button class="ui-context-item is-danger" role="menuitem" type="button">
    <svg …/>删除
  </button>
  <div class="ui-context-sep" role="separator"></div>
  <button class="ui-context-item" role="menuitem" type="button">属性</button>
</div>
```

- 交互：`contextmenu` 事件定位显示（切 `.visible`）；点击外部 / Escape / Tab 关闭。

## 14. 卡片分区 / 表单行

```html
<section class="ui-section">
  <div class="ui-section-head" role="button" tabindex="0" aria-expanded="true">
    <span class="ui-section-icon" aria-hidden="true"><svg …/></span>
    <h2 class="ui-section-title">通用设置</h2>
    <span class="ui-section-arrow" aria-hidden="true">▾</span>
  </div>
  <p class="ui-section-desc">辅助说明</p>
  <div class="ui-section-body">
    <div class="ui-form-row">
      <div class="ui-form-left">
        <span class="ui-form-label">自动保存</span>
        <span class="ui-form-desc">每 5 分钟自动保存</span>
      </div>
      <div class="ui-form-right">
        <label class="ui-switch"><input type="checkbox" checked /><span class="ui-switch-track"></span></label>
      </div>
    </div>
  </div>
</section>
```

---

## 状态类速查

| 状态类 | 适用组件 | 含义 |
|--------|---------|------|
| `.is-active` | nav / tab / seg / chip / badge / dropdown-item / sidenav | 选中/激活 |
| `.is-checked` | circle-check / chip | 已勾选 |
| `.is-collapsed` | section / collapse / group | 折叠 |
| `.is-loading` | btn | 加载中（转 spinner） |
| `.is-invalid` | input / textarea | 校验失败 |
| `.is-disabled` | switch / chip | 禁用 |
| `.visible` | overlay / popover / context-menu / drawer | 显示浮层 |
| `.is-has-value` | input-wrap | 有值（显示清空按钮） |
