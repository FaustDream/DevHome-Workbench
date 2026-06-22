# DevHome Workbench v2.0.0 — 综合性开发工作台 实现计划

**Goal:** 将 DevHome Workbench 从"新标签页+四象限任务"升级为"个人工作操作系统"——融合快速捕获、内容笔记、日历、番茄钟、网页剪藏、AI 总结、行为追踪的综合性工作台，所有数据存于 chrome.storage.local，支持一键导出 Markdown 到 Obsidian。

**Architecture:** 新标签页新增工作台模式多 Tab 导航（单色聚焦风格），侧边栏做轻量记录面板。数据层从 localStorage 迁移到 chrome.storage.local（主存储）+ localStorage（缓存）。引入 marked.js 和 dayjs 两个轻量 CDN 库，保持无构建工具架构。

**Tech Stack:** 原生 HTML/CSS/JS，chrome.storage.local，marked.js（Markdown 渲染），dayjs（日期处理），腾讯混元大模型 API（AI 总结），Chrome Extension MV3 APIs（sidePanel, contextMenus, notifications, downloads, commands）

---

## 一、数据模型设计

### 1.1 chrome.storage.local 存储结构

所有新数据统一存于 `chrome.storage.local`，Key 前缀 `v2/`：

```
chrome.storage.local:
├── v2/config              → 应用配置（API Key、番茄钟设置、行为追踪开关等）
├── v2/notes               → 笔记数组 [{id, title, content, type, tags, sourceUrl, createdAt, updatedAt, status}]
├── v2/captures            → 快速捕获数组 [{id, content, tags, createdAt}]
├── v2/tasks               → 任务数组 [{id, title, description, quadrant, status, noteId, pomodoroCount, createdAt, completedAt, cancelledAt}]
├── v2/pomodoro_sessions   → 番茄钟会话 [{id, taskId, duration, restDuration, type, startedAt, endedAt, completed}]
├── v2/behavior            → 行为追踪数据 {streakDays, totalTasks, totalCompleted, totalPomodoros, totalFocusMinutes, dailyStats: {...}}
├── v2/encouragement_pool  → 鼓励文案池配置
```

### 1.2 核心实体定义

```javascript
// 笔记
{
  id: "note_1719000000000_a1b2c3",
  title: "登录页样式Bug修复记录",
  content: "## 问题描述\n...",  // Markdown 字符串
  type: "note",  // note | idea | bug | meeting | webclip
  tags: ["bug", "前端"],
  sourceUrl: "https://...",  // 网页剪藏时记录来源URL
  status: "active",  // active | archived
  createdAt: 1719000000000,
  updatedAt: 1719000000000
}

// 快速捕获
{
  id: "cap_1719000000000_x1y2z3",
  content: "重构用户模块的权限校验逻辑",
  tags: ["重构"],
  createdAt: 1719000000000
}

// 任务（扩展现有四象限任务模型）
{
  id: "task_1719000000000_a1b2",
  title: "修复登录页样式Bug",
  description: "",  // Markdown 详细描述
  quadrant: "q1",  // q1|q2|q3|q4
  status: "active",  // active | completed | cancelled
  noteId: "note_xxx",  // 关联笔记（可选）
  pomodoroCount: 2,  // 已完成的番茄钟数量
  createdAt: 1719000000000,
  completedAt: null,
  cancelledAt: null
}

// 番茄钟会话
{
  id: "pom_1719000000000_xyz",
  taskId: "task_xxx",  // 关联任务（可选）
  duration: 25,  // 分钟
  restDuration: 5,  // 休息分钟
  type: "default",  // default | focus（专注无限时长）
  startedAt: 1719000000000,
  endedAt: null,
  completed: false
}

// 每日行为数据
{
  date: "2026-06-22",
  tasksCreated: 3,
  tasksCompleted: 1,
  pomodorosCompleted: 4,
  focusMinutes: 100,
  notesCreated: 2,
  capturesCreated: 5,
  streakDay: true
}
```

### 1.3 数据迁移策略

启动时检测 `localStorage` 中是否有旧格式数据（`devhome_workbench`），有则自动迁移到 `chrome.storage.local` 的 `v2/tasks`，迁移后保留旧数据不删除（作为备份）。

---

## 二、Manifest 权限更新

### 需要新增的权限和配置

```json
{
  "permissions": [
    "storage",        // 已有
    "bookmarks",      // 已有
    "history",        // 已有
    "downloads",      // 已有
    "tabs",           // 已有
    "sidePanel",      // 新增：侧边栏
    "contextMenus",   // 新增：右键菜单剪藏
    "notifications",  // 新增：番茄钟通知
    "unlimitedStorage" // 新增：chrome.storage.local 无限容量
  ],
  "host_permissions": [
    "*://api.bing.com/*",
    "*://api.xinac.net/*",
    "*://hunyuan.tencentcloudapi.com/*"  // 新增：腾讯混元 API
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "commands": {
    "_execute_action": { ... },
    "capture_selection": {     // 新增：快捷键剪藏
      "suggested_key": { "default": "Ctrl+Shift+S" },
      "description": "剪藏选中文字到工作台"
    },
    "open_side_panel": {      // 新增：打开侧边栏
      "suggested_key": { "default": "Ctrl+Shift+D" },
      "description": "打开工作台侧边栏"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' https://cdn.jsdelivr.net; object-src 'self'; connect-src 'self' https://hunyuan.tencentcloudapi.com"
  }
}
```

---

## 三、文件变更清单

### 3.1 新增文件（8 个）

| 文件 | 行数估算 | 职责 |
|------|---------|------|
| `sidepanel.html` | ~50 | 侧边栏 HTML 入口 |
| `css/sidepanel.css` | ~200 | 侧边栏样式 |
| `css/workbench-v2.css` | ~500 | 工作台 v2 Tab 导航、笔记编辑器、日历、番茄钟、行为仪表盘样式 |
| `js/sidepanel.js` | ~150 | 侧边栏逻辑：捕获输入、剪藏显示、番茄钟状态条 |
| `js/storageV2.js` | ~250 | chrome.storage.local 读写封装、数据迁移 |
| `js/notes.js` | ~300 | 笔记 CRUD、Markdown 渲染、搜索过滤 |
| `js/pomodoro.js` | ~250 | 番茄钟计时器、悬浮条、通知、会话记录 |
| `js/behavior.js` | ~200 | 行为追踪、打卡统计、激励文案 |
| `js/aiSummary.js` | ~150 | 智谱 AI API 调用、每日总结生成 |
| `js/export.js` | ~200 | Markdown 导出（分门别类 + 一键全部）、chrome.downloads |
| `js/webClip.js` | ~100 | contextMenu 创建、剪藏内容处理 |

### 3.2 修改文件（7 个）

| 文件 | 改动内容 |
|------|---------|
| `manifest.json` | 新增权限、side_panel 配置、commands、CSP |
| `index.html` | 工作台区域重构为多 Tab 导航；引入 marked.js/dayjs CDN |
| `js/workbench.js` | 扩展为 Tab 路由控制器；整合笔记、日历、番茄钟、行为面板 |
| `js/events.js` | 新增 Tab 切换事件、番茄钟控制事件、快捷键处理 |
| `js/storage.js` | devhomeStorage 改为写 chrome.storage.local；保留 localStorage 缓存 |
| `js/state.js` | 新增 dom 引用（Tab 导航、笔记编辑器、日历、番茄钟等） |
| `js/config.js` | 新增默认配置常量（番茄钟预设、鼓励文案池、日历配置） |
| `js/main.js` | 启动时执行数据迁移、初始化 Service Worker |

### 3.3 新增 Background Service Worker

需要创建 `js/background.js` 作为 Service Worker：
- 注册 contextMenu（右键剪藏）
- 处理快捷键命令
- 番茄钟计时器后台运行
- 番茄钟完成时发送通知
- 侧边栏消息中转

### 3.4 不修改的文件（保持不变）

`js/favicon.js`, `js/theme.js`, `js/pageManager.js`, `js/tiles.js`, `js/categoryUI.js`, `js/ui.js`, `js/search.js`, `js/utils.js`, `js/matrix-bg.js`, `css/base.css`, `css/time-search.css`, `css/tiles.css`, `css/overlays.css`, `css/pixel-theme.css`, `popup/*`（全部不变）

---

## 四、各模块实现要点

### 4.1 工作台 Tab 导航框架（index.html + js/workbench.js）

**HTML 结构**（替换现有 `#devhomeStage`）：
```
<section class="devhome-stage" id="devhomeStage">
  <nav class="wb-nav">
    <button class="wb-nav-tab" data-tab="dashboard">仪表盘</button>
    <button class="wb-nav-tab" data-tab="notes">笔记</button>
    <button class="wb-nav-tab" data-tab="calendar">日历</button>
    <button class="wb-nav-tab" data-tab="pomodoro">番茄钟</button>
    <button class="wb-nav-tab" data-tab="me">我</button>
  </nav>
  <div class="wb-content">
    <section class="wb-panel" data-panel="dashboard"><!-- 仪表盘内容 --></section>
    <section class="wb-panel" data-panel="notes"><!-- 笔记编辑器 --></section>
    <section class="wb-panel" data-panel="calendar"><!-- 日历视图 --></section>
    <section class="wb-panel" data-panel="pomodoro"><!-- 番茄钟控制 --></section>
    <section class="wb-panel" data-panel="me"><!-- 行为数据 + AI 总结 + 导出 + 设置 --></section>
  </div>
</section>
```

**样式要点**（css/workbench-v2.css）：
- 左侧竖排导航栏，宽 56px（仅图标）hover 展开到 180px（图标+文字）
- 选中 Tab：2px 细线强调色，无发光无动画
- 内容区切换：150ms 极快淡入
- 基调：深灰底（`#1a1a2e`），强调色蓝绿（`#47f0a2`），其余全灰阶
- 俏皮元素：任务完成时像素点炸开微动画；空状态幽默文案

### 4.2 仪表盘 Tab（dashboard）

包含：时间（复用现有）、搜索（复用现有）、快速捕获输入框、四象限任务（复用现有并增强）、番茄钟迷你状态

**快速捕获输入框**：
- 一个宽输入框，placeholder "记录想法、灵感、待办..."
- 回车保存，自动打时间戳
- 保存到 `v2/captures`
- 下方显示最近 5 条捕获

**四象限增强**：
- 任务项新增"关联笔记"按钮（可选）
- 任务完成时触发像素炸开动画
- 数据从 `v2/tasks` 读写（迁移后）

### 4.3 笔记 Tab（notes）

**左侧列表 + 右侧编辑器布局**：
- 左侧：笔记列表，按时间倒序，支持按类型/标签筛选
- 右侧：Markdown 编辑器 + 实时预览
- 编辑器：纯 textarea（左侧写 Markdown）+ 预览区（右侧渲染）

**Markdown 渲染**：使用 marked.js CDN
```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

**笔记操作**：
- 新建：右上角 + 按钮
- 编辑：点击列表项或双击预览区
- 删除：列表项悬停显示删除按钮
- 标签：底部标签栏，点击添加/移除
- 类型切换：note / idea / bug / meeting / webclip
- 全文搜索：顶部搜索框，实时过滤

### 4.4 日历 Tab（calendar）

**月视图日历**：
- 使用 dayjs 处理日期
- 每个日期格显示：当日任务数（圆点）、笔记数（小方块）
- 点击日期 → 弹出当日摘要（任务列表 + 笔记列表）
- 当天高亮（强调色边框）

```html
<script src="https://cdn.jsdelivr.net/npm/dayjs/dayjs.min.js"></script>
```

### 4.5 番茄钟 Tab（pomodoro）

**控制面板**：
- 大圆形倒计时显示
- 预设按钮：25 / 30 / 45 / 60 分钟 + 自定义输入
- 专注模式按钮（无限时长）
- 休息时间设置：5 / 10 / 15 分钟
- 开始/暂停/重置按钮
- 当前会话关联任务（可选下拉选择）

**悬浮条**（所有网页可见）：
- Content script 注入（`content/pomodoro-bar.js`）
- 页面顶部固定细条（高 4px，背景强调色）
- 宽度按剩余时间比例缩小
- 鼠标悬停展开显示完整倒计时 + 暂停按钮
- 时间到 → chrome.notifications 通知

**通知文案池**（`v2/encouragement_pool`）：
```
["又干掉一个🍅", "大脑说谢谢", "比刚才的自己多坚持了25分钟", "专注是一种超能力", "休息一下，你值得", ...]
```

### 4.6 「我」Tab（me）

**行为仪表盘**：
- 连续打卡天数（大数字）
- 本周/本月统计卡片：完成任务数、番茄钟数、专注分钟数、笔记数
- 简易趋势图（纯 CSS 柱状图，最近 7 天）

**AI 每日总结**：
- "生成今日总结"按钮
- 调用智谱 AI API，传入今日所有笔记/任务/捕获
- 显示生成的 Markdown 摘要
- 可手动编辑后保存为一篇笔记

**导出中心**：
- 「按类型导出」：选择 note/idea/bug/meeting/webclip → 导出为 .md 文件
- 「按日期导出」：选择日期范围 → 导出
- 「一键导出全部」：所有笔记+任务+捕获 → 一个 .zip（多个 .md）
- 使用 `chrome.downloads` API

**设置区**：
- AI API Key 配置
- 番茄钟默认时长
- 行为追踪开关
- 严厉鞭策模式开关（强度 1-5）
- 文件备份开关（关闭自动同步）

### 4.7 网页剪藏（js/webClip.js + content script）

**右键菜单**（Service Worker 中注册）：
```javascript
chrome.contextMenus.create({
  id: 'capture-selection',
  title: '剪藏到工作台',
  contexts: ['selection']
});
```

**流程**：
1. 用户选中网页文字 → 右键 → "剪藏到工作台"
2. 或按 Ctrl+Shift+S
3. Service Worker 接收选中文字 + 来源 URL + 页面标题
4. 保存到 `v2/notes`（type: "webclip"）
5. 打开侧边栏，自动显示刚保存的内容

### 4.8 侧边栏（sidepanel.html + js/sidepanel.js）

**布局**（约 400px 宽）：
```
┌─────────────────────┐
│  🔍 快速捕获        │  ← 输入框 + 回车保存
├─────────────────────┤
│  最近捕获           │
│  ┌─────────────────┐│
│  │ 重构权限校验...  ││  ← 最近 10 条
│  │ 2026-06-22 10:30││
│  └─────────────────┘│
│  ...                │
├─────────────────────┤
│  最近剪藏           │
│  ┌─────────────────┐│
│  │ 来自 github.com ││
│  │ React 18 发布...││
│  └─────────────────┘│
├─────────────────────┤
│  🍅 番茄钟 24:59    │  ← 底部固定状态条
│  [暂停]             │
└─────────────────────┘
```

### 4.9 AI 每日总结（js/aiSummary.js）

**API 调用（腾讯混元）**：
- Endpoint: `https://hunyuan.tencentcloudapi.com/`
- Model: `hunyuan-lite`（免费额度 100万 Token/月）
- 认证：TC3-HMAC-SHA256 签名（需 SecretId + SecretKey）
- API Key 配置：用户在「我」Tab 设置中填入 SecretId 和 SecretKey
- Prompt 模板：收集当日所有笔记内容 → "请将以下工作记录整理为结构化的每日总结，包括：1) 今日完成的任务 2) 遇到的问题 3) 关键收获 4) 明日计划"

### 4.10 数据导出（js/export.js）

**导出方式**：用户选择要导出的内容（支持多选笔记/任务/捕获），拼接为单个 .md 文件，通过 `chrome.downloads.download()` 下载。

**Markdown 导出格式**：
```markdown
---
id: "note_1719000000000_a1b2c3"
type: "note"
tags: ["bug", "前端"]
created: "2026-06-22T10:30:00"
source: "https://github.com/..."
---
# 登录页样式Bug修复记录

## 问题描述
...
```

**导出流程**：
1. 「我」Tab 中显示内容列表（笔记+任务+捕获），每项带复选框
2. 用户勾选要导出的条目
3. 点击「导出选中」→ 拼接所有选中条目为单个 .md 文件
4. 通过 `chrome.downloads.download({ url: blobUrl, filename: 'devhome-export-2026-06-22.md' })` 下载
5. 也提供「全选」和「按类型筛选」快捷操作

---

## 五、Service Worker 设计（js/background.js）

```javascript
// 职责：
// 1. 注册 contextMenu（右键剪藏）
// 2. 监听 commands 快捷键
// 3. 番茄钟后台计时（setInterval）
// 4. 番茄钟完成 → chrome.notifications.create()
// 5. 侧边栏消息中转（content script ↔ sidepanel）
// 6. 处理剪藏消息
```

manifest.json 中声明：
```json
"background": {
  "service_worker": "js/background.js"
}
```

---

## 六、实现顺序

### 阶段 1：基础设施（必须最先完成）
1. 更新 `manifest.json`（权限、side_panel、commands、CSP、background）
2. 创建 `js/storageV2.js`（chrome.storage.local 封装）
3. 创建 `js/background.js`（Service Worker 骨架）
4. 修改 `js/storage.js`（devhomeStorage 迁移到 chrome.storage.local）
5. 修改 `js/main.js`（启动时数据迁移）
6. 在 `index.html` 引入 marked.js 和 dayjs CDN

### 阶段 2：工作台 Tab 框架
7. 重写 `index.html` 中 `#devhomeStage` 为多 Tab 导航结构
8. 创建 `css/workbench-v2.css`
9. 重写 `js/workbench.js`（Tab 路由控制器）
10. 修改 `js/state.js`（新增 dom 引用）
11. 修改 `js/events.js`（新增 Tab 切换事件）

### 阶段 3：核心功能模块
12. 创建 `js/notes.js`（笔记 CRUD + Markdown 渲染）
13. 增强四象限任务（关联笔记、数据迁移）
14. 创建 `js/pomodoro.js`（番茄钟核心逻辑）
15. 创建 content script 番茄钟悬浮条
16. 创建 `js/export.js`（Markdown 导出）

### 阶段 4：侧边栏 + 剪藏
17. 创建 `sidepanel.html` + `css/sidepanel.css`
18. 创建 `js/sidepanel.js`
19. 创建 `js/webClip.js`（右键菜单 + 快捷键）

### 阶段 5：AI + 行为追踪
20. 创建 `js/aiSummary.js`
21. 创建 `js/behavior.js`
22. 「我」Tab 完整实现

### 阶段 6：俏皮元素 + 文案
23. 任务完成像素炸开动画
24. 空状态幽默文案
25. 番茄钟鼓励文案池

---

**Testing Plan**

测试策略：本项目为 Chrome 扩展，测试以手动功能验证为主（加载未打包扩展，逐功能验证）。

### 阶段 1 测试
- [ ] 扩展加载后 `chrome.storage.local` 中 `v2/` 前缀的 key 可正常读写
- [ ] 旧数据（`devhome_workbench`）自动迁移到 `v2/tasks`，旧数据不删除
- [ ] CSP 不阻止 marked.js 和 dayjs CDN 加载
- [ ] Service Worker 正常注册，contextMenu 创建成功

### 阶段 2 测试
- [ ] Ctrl+K 打开工作台，5 个 Tab 正常显示
- [ ] 点击各 Tab 切换内容区，无闪烁无卡顿
- [ ] Esc 返回日常模式
- [ ] 单色聚焦风格生效（深灰底 + 蓝绿强调色 + 2px 选中线）

### 阶段 3 测试
- [ ] 笔记 Tab：新建、编辑、删除笔记，Markdown 预览正确渲染
- [ ] 笔记全文搜索实时过滤
- [ ] 四象限任务：添加、完成、取消、拖拽移动均正常
- [ ] 任务完成时像素炸开动画播放一次
- [ ] 番茄钟：25/30/45/60 分钟预设可用，自定义时长可用
- [ ] 番茄钟倒计时准确，完成后弹出通知
- [ ] 导出：分类型导出生成正确 .md 文件，一键导出全部下载多个文件

### 阶段 4 测试
- [ ] 侧边栏打开（Ctrl+Shift+D），快速捕获输入框可用
- [ ] 回车保存捕获，侧边栏列表即时更新
- [ ] 网页选中文字 → 右键"剪藏到工作台"→ 侧边栏自动打开显示
- [ ] Ctrl+Shift+S 快捷键剪藏生效

### 阶段 5 测试
- [ ] 「我」Tab 显示连续打卡天数、本周统计
- [ ] AI 总结按钮调用智谱 API，返回 Markdown 摘要
- [ ] AI 总结可编辑保存为笔记

### 阶段 6 测试
- [ ] 空状态显示幽默文案而非空白
- [ ] 番茄钟完成时随机显示鼓励文案
- [ ] 严厉鞭策模式开关可切换

NOTE: 所有测试在实现完成后逐功能手动验证。

---

**Testing Details** 所有测试针对用户可见行为：Tab 切换是否流畅、笔记能否正常 CRUD、番茄钟倒计时是否准确、导出文件格式是否正确、剪藏流程是否完整。不测试内部实现细节。

**Implementation Details**
1. chrome.storage.local 异步 API，所有读写用 async/await 包装
2. Service Worker 不能访问 DOM，番茄钟计时器在 SW 中用 setInterval 维护
3. marked.js 需要配置 `marked.setOptions({ breaks: true, gfm: true })`
4. 智谱 AI API 签名：Bearer Token，请求体 `{ model: "glm-4-flash", messages: [...] }`
5. chrome.downloads.download 不支持批量，逐个下载
6. Content script 番茄钟悬浮条用 Shadow DOM 隔离样式
7. CSP 必须允许 `https://cdn.jsdelivr.net` 和 `https://open.bigmodel.cn`
8. 数据迁移是幂等的：检查 `v2/tasks` 已存在则跳过
9. 文件配置自动同步默认关闭，用户手动开启
10. 单色聚焦主题 CSS 变量覆盖在 `:root` 中，仅在 `body.workbench-mode` 下生效

**Questions**
- 智谱 AI API Key 需要用户自行申请（`open.bigmodel.cn`），在「我」Tab 设置中配置
- 是否需要数据加密？（当前不加密，chrome.storage.local 浏览器级别隔离）
- 导出 .zip 需要 JSZip 库（额外 CDN 依赖），还是接受逐个下载多个 .md 文件？

---
