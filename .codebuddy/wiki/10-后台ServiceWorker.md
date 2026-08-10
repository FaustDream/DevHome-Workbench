# 10 后台 Service Worker

> 本章覆盖 `js/background.js` 编排入口与 `js/bg/` 5 个子模块：番茄钟核心、广播、网页剪藏、任务到期通知、语录库。

## 10.1 整体架构

```
js/background.js（编排入口，importScripts 加载子模块）
  ├─ bg/_quotes.js              激励语录库（工作/休息/开始）
  ├─ bg/_pomodoro-core.js       番茄钟核心（状态机+持久化+alarms+通知）
  ├─ bg/_pomodoro-broadcast.js  状态广播 + 长连接管理
  ├─ bg/_clip-capture.js        网页剪藏 + 右键菜单 + 快捷键
  └─ bg/_task-notify.js         任务到期检查通知
```

**关键**：子模块通过 `importScripts` 加载，**共享 SW 全局作用域**，模块变量（`pomodoroState`、`pomodoroPorts`）在全局互通。

## 10.2 `js/background.js` — 编排入口

### 10.2.1 生命周期

| 事件 | 行为 |
|------|------|
| `onInstalled` | 创建右键菜单「剪藏到工作台」（contexts: selection） |
| `onStartup` | `restorePomodoroState()` |
| `onAlarm` | `pomodoro-phase` → `pomodoroPhaseEnd()`；`task-due-check` → `checkTaskDueNotifications()` |
| `notifications.onClicked` | `pomodoro-done`/`pomodoro-rest-done`/`task-due-*` → 聚焦或打开 index.html |
| 启动时 | `chrome.alarms.create('task-due-check', {periodInMinutes:15})` + `restorePomodoroState()` |

### 10.2.2 消息处理（onMessage 全表）

| message.type | 行为 | 响应 |
|--------------|------|------|
| `POMODORO_START` | `startPomodoro(message.data)` | `{success:true}` |
| `POMODORO_PAUSE` | `pausePomodoro()` | `{success:true}` |
| `POMODORO_RESUME` | `resumePomodoro()` | `{success:true}` |
| `POMODORO_STOP` | `stopPomodoro()` | `{success:true}` |
| `POMODORO_GET_STATE` | 组装完整状态（active/remaining/duration/restDuration/type/isResting/autoCycle/sessionCount/formatted/phaseStartAt/phaseTotalSeconds/taskId） | `{success:true, data}` |
| `OPEN_SIDE_PANEL` | `chrome.sidePanel.open({tabId})` | `{success:true}` |
| `RESOLVE_FAVICON` | `resolveRealFavicon(domain)` → dataURL | `{success:true, dataUrl\|null}` 或 `{success:false, reason}` |
| 其他 | — | `{success:false, reason:'unknown_message_type'}` |

**注意**：onMessage listener 返回 `true`（异步 sendResponse）。

### 10.2.3 `resolveRealFavicon(domain)`（关键算法）

SW 因拥有 `<all_urls>` host_permissions 可豁免 CORS，直接抓取站点图标。解析优先级：

1. **约定路径**：`https://<domain>/favicon.ico`（多数站点直接提供）。
2. **首页 HTML 解析**：抓取首页 → 正则解析 `<link rel="icon">` / `rel="apple-touch-icon"` 等。
   - 支持相对/绝对/协议相对（`//`）地址；以最终响应 origin 为基准（处理重定向）。
   - 评分排序：内联 data URI=4 > apple-touch-icon=3 > shortcut icon=2 > icon=1。
   - `toDataUrl`：校验 MIME（image/*、image-x-icon、vnd.microsoft.icon）+ 扩展名防御；.ico 特殊处理空 MIME；blob→FileReader→dataURL。
3. **兜底**：DuckDuckGo 图标服务 `https://icons.duckduckgo.com/ip3/<domain>.ico`。

- 总超时 6s（`AbortController`）。
- 返回 dataURL 或 null，写 IndexedDB 缓存后回传页面。

## 10.3 `js/bg/_pomodoro-core.js` — 番茄钟核心

### 10.3.1 状态对象

```js
const POMODORO_STORAGE_KEY = 'v2/pomodoro_state';
const pomodoroState = {
  active: false, taskId: null, taskTitle: '',
  duration: 25, restDuration: 5, type: 'default',
  isResting: false, autoCycle: true, sessionCount: 0,
  phaseStartAt: null, phaseTotalSeconds: 0, remaining: 0
};
let pomodoroTimer = null;           // 内存每秒 tick
let _phaseEndInProgress = false;    // 防重入锁
```

### 10.3.2 设计核心（关键算法：SW 休眠可靠计时）

> SW 随时可能被浏览器休眠，内存 `setInterval` 不可靠。因此：
> - **状态持久化到 chrome.storage.local**。
> - **以「阶段开始时间戳 + 阶段总时长」推导剩余秒数**：`computeRemaining() = phaseTotalSeconds - floor((now - phaseStartAt)/1000)`。
> - **阶段切换交给 chrome.alarms（精确 when）**：`schedulePomodoroAlarm()` 用 `chrome.alarms.create('pomodoro-phase', {when: now + remaining*1000})`。
> - 内存 `setInterval` 仅用于存活期间每秒广播。

### 10.3.3 生命周期函数

| 函数 | 行为 |
|------|------|
| `startPomodoro(params)` | 重置所有字段；`phaseStartAt=now`；`phaseTotalSeconds=duration*60`；start tick + alarm + persist + broadcast |
| `pomodoroTick()` | 每秒：`remaining=computeRemaining()` → broadcast → 若 ≤0 → `pomodoroPhaseEnd()` |
| `pomodoroPhaseEnd()` | **阶段结束主流程**（`_phaseEndInProgress` 防重入） |
| `pausePomodoro()` | 停 tick + 清 alarm；`remaining=computeRemaining()`；`active=false`；persist |
| `resumePomodoro()` | `phaseStartAt = now - (phaseTotalSeconds - remaining)*1000`；`active=true`；tick + alarm + persist |
| `stopPomodoro()` | 全清零 + 清 alarm + persist + broadcast |
| `restorePomodoroState()` | SW 唤醒时恢复：合并持久化状态 → 若 active 且 remaining>0 → tick+alarm；≤0 → 直接 phaseEnd |
| `savePomodoroSession()` | 完成一轮专注 → 追加 `v2/pomodoro_sessions` |

### 10.3.4 `pomodoroPhaseEnd()` 状态机（关键）

```
if (isResting) {
    // 休息结束 → 自动开始新一轮工作
    isResting=false; sessionCount++（已++）；
    phaseStartAt=now; phaseTotalSeconds=duration*60;
    通知 pomodoro-rest-done「休息结束 — 语录，开始第N+1轮」
} else {
    sessionCount++; savePomodoroSession();
    if (autoCycle) {
        isResting=true; phaseStartAt=now; phaseTotalSeconds=restDuration*60;
        通知 pomodoro-done「工作完成！语录，休息 N 分钟」
    } else {
        // 单轮模式：停止
        stop tick + clear alarm + active=false + remaining=0;
        通知 pomodoro-done「番茄钟完成！共完成 N 个番茄」
    }
}
最后：scheduleAlarm + persist + broadcast（finally 释放 _phaseEndInProgress）
```

### 10.3.5 通知

- `sendPomodoroNotification(id, options)` → Promise<notificationId|false>，处理 `chrome.runtime.lastError`。
- 通知 icon：`icons/icon48.png`（阶段通知）/ `icons/icon128.png`（任务到期）。
- 通知 id 约定：`pomodoro-done`、`pomodoro-rest-done`、`task-due-<taskId>`。
- `priority:2, requireInteraction:true`。

### 10.3.6 时间格式

`formatTime(seconds)` → `MM:SS`。

## 10.4 `js/bg/_pomodoro-broadcast.js` — 广播与长连接

**挂载点**：全局 `pomodoroPorts`、`broadcastPomodoroState`

### 10.4.1 广播

```
broadcastPomodoroState()：
  组装 POMODORO_STATE 消息（active/remaining/duration/restDuration/type/isResting/autoCycle/sessionCount/formatted/phaseStartAt/phaseTotalSeconds）
  若有长连接端口 → 逐个 postMessage（postMessage 抛错则过滤掉该端口）
  无端口 → chrome.runtime.sendMessage(msg).catch(()=>{}) 降级单播
```

### 10.4.2 长连接管理

- `chrome.runtime.onConnect`：仅接受 `port.name === 'pomodoro'`，压入 `pomodoroPorts`。
- `port.onDisconnect`：从数组移除。
- 页面端建立长连接后每秒收到广播。

## 10.5 `js/bg/_clip-capture.js` — 网页剪藏

**职责**：右键菜单「剪藏到工作台」触发，捕获当前页选区文本/链接，处理为笔记/捕获。

### 10.5.1 触发方式

- `chrome.contextMenus.onClicked`（selection 菜单，id='capture-selection'）。
- 可能还有快捷键（页面脚本请求剪藏）。

### 10.5.2 剪藏流程（关键）

```
菜单点击 → 读取 sender.tab 与 selectionText
  → 构造剪藏数据（标题=页面 title，内容=选区文本，sourceUrl=页面 URL，sourceTitle）
  → 写入 v2/captures 或 v2/notes（取决于配置）
  → 可选发送通知提示「已剪藏」
```

> 说明：由于选区文本无法直接跨 contextMenus 事件获得富 HTML，当前实现以纯文本选区为主；`_notes-capture.js` 的捕获渲染以文本为核心。

## 10.6 `js/bg/_task-notify.js` — 任务到期通知

### 10.6.1 触发

`chrome.alarms('task-due-check', {periodInMinutes:15})` → `checkTaskDueNotifications()`。

### 10.6.2 检查逻辑（关键算法）

```
1. 读 v2/taskNotifySettings；未启用 → return
2. remindBefore = settings.remindBefore || 15（分钟）
3. 读 v2/tasks
4. 遍历 active 任务，取 dueTime = dueDate ? new Date(dueDate) : plannedAt
   remaining = dueTime - now
   - 0 < remaining ≤ checkWindow(=remindBefore*60s) 且未通知过 → 通知「任务即将到期（N 分钟）」+ _taskDueNotified[id]=true
   - remaining ≤ 0 且未通知过 → 通知「任务已超期」
5. 通知标题/文案：『任务标题』还有 N 分钟到期 / 已过期，请尽快处理
6. 通知 id：'task-due-'+task.id；icon128
```

> 注意：`_taskDueNotified` 为 SW 内存态，SW 重启后可能重复通知（同一任务 15 分钟内最多一次，但重启窗口会重置）。

## 10.7 `js/bg/_quotes.js` — 番茄钟语录库

三组语录池 + `randomQuote(pool)`：

- `WORK_COMPLETE_QUOTES`（11 条）：「又干掉一个🍅」「大脑说谢谢」…
- `REST_COMPLETE_QUOTES`（10 条）：「满血复活，继续冲！」…
- `REST_START_QUOTES`（6 条）：「起身走动一下吧」…

## 10.8 SW 与页面通信全景

```
[页面 → SW] POMODORO_START/PAUSE/RESUME/STOP/GET_STATE
[页面 → SW] OPEN_SIDE_PANEL
[页面 → SW] RESOLVE_FAVICON(domain)
[页面 → SW] 长连接 name='pomodoro'
[SW → 页面] POMODORO_STATE（每秒广播，经长连接或 sendMessage）
[SW → 页面] notifications（独立通道）
```

## 10.9 重构要点（后台 SW）

1. **`_taskDueNotified` 内存态重启丢**：可持久化到 storage 避免重复通知。
2. **番茄钟状态与页面端 `_pomodoro.js` 双份逻辑**：页面 UI 状态需与 SW 状态严格同步，存在轻微延迟（1s 广播粒度）。
3. **favicon 解析放 SW 是正确决策**（CORS），但每次磁贴渲染都可能触发，缓存命中率需优化（IndexedDB 已有）。
4. **`restorePomodoroState` 与 `phaseEnd` 并发**有 `_phaseEndInProgress` 防重入，但恢复期间 alarm 可能已触发，需留意时序。
5. **导入脚本顺序**：`_quotes` 必须先于 `_pomodoro-core` 加载（randomQuote 依赖）。
