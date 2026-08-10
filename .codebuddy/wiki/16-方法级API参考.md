# 16 方法级 API 参考

> 本文档对核心模块的每个公开方法给出：**实现逻辑、参数说明、返回值描述、异常处理**。
> 组织方式：按模块分组。标注「JS 现状」的为当前实现，标注「TS 目标」的为 Phase 2+ 迁移后的类型签名。
> 引用文件：`js/` 现状代码 + `src/shared/` 已建 TS 骨架（constants/types/messages/guards）。

---

## 16.1 存储层

### 16.1.1 `ns.storage`（js/storage.js，localStorage 抽象层）

#### `get(key, fallback)`
- **实现逻辑**：`localStorage.getItem('tabpage_' + key)` → `JSON.parse` → 成功返回；失败/空返回 `fallback`。
- **参数**：
  | 参数 | 类型 | 说明 |
  |------|------|------|
  | `key` | `string` | 存储键（自动加 `tabpage_` 前缀） |
  | `fallback` | `unknown` | 解析失败或不存在时的默认值 |
- **返回值**：`unknown`（解析后的 JSON 值或 fallback）。
- **异常处理**：`JSON.parse` 失败**不抛错**，静默返回 fallback；**不写日志**（历史行为，重构应补日志）。

#### `set(key, value)`
- **实现逻辑**：`JSON.stringify(value)` → 写入 `tabpage_<key>` → 成功后调用 `fileConfig.markDirty()`。
- **参数**：`key: string`，`value: unknown`（必须是可序列化值）。
- **返回值**：`void`。
- **异常处理**：`JSON.stringify` 遇循环引用/函数会抛 TypeError；`QuotaExceededError`（配额超限）未捕获——**重构必须补 try/catch 并 toast**（对应 R20）。

#### `clear(key)`
- **实现逻辑**：`localStorage.removeItem('tabpage_' + key)`。
- **参数**：`key: string`。
- **返回值**：`void`。
- **异常处理**：无（removeItem 不抛错）。

#### `backupPagesSnapshot(reason, pagesData, pageNames)`
- **实现逻辑**：将当前页面数据压入 `tabpage_page_backups` 备份队列，**最多保留 3 份**（超出则 shift 丢弃最旧）。用于磁贴数据变更前自动备份，可回滚。
- **参数**：`reason: string`（备份原因，如 `'before-save'`）、`pagesData: Array`、`pageNames: Array`。
- **返回值**：`void`。
- **异常处理**：序列化失败静默。

### 16.1.2 `ns.storageV2`（js/storageV2.js，chrome.storage.local 抽象层）

#### `get(key, fallback)` → Promise
- **实现逻辑**：
  1. 读 `chrome.storage.local['v2/'+key]`。
  2. 不可用（undefined）→ 降级读 localStorage 缓存 `devhome_v2_cache_<key>`（`{value,_cacheTime}`）。
  3. 读成功后写回缓存。
- **参数**：`key: StorageV2Key`（KEYS 成员），`fallback: unknown`。
- **返回值**：`Promise<unknown>`（经 `unwrapValue` 解包：`{data,_version}` → `data`）。
- **异常处理**：`chrome.runtime.lastError` 时降级缓存；`chrome.storage` 完全不可用（如扩展重载）返回 fallback。

#### `set(key, value)` → Promise
- **实现逻辑（乐观锁三步重试，最多 3 次）**：
  1. 读当前 `v2/<key>`，取 `_version`（无则 0）。
  2. 构造新值：对象 → 浅拷贝 + `_version: newVersion`；数组/基本类型 → 包装 `{data: value, _version: newVersion}`。
  3. 写 `chrome.storage.local`。
  4. 读回校验 `_version`；不一致（其他标签页覆盖）→ 重试。
  5. 重试 3 次失败 → `logger.error` + `showToast('数据保存失败，请刷新页面后重试', 'error')`。
  6. 写缓存 + `fileConfig.markDirty(category)`。
- **参数**：`key`，`value: Record<string,unknown> | unknown[] | unknown`。
- **返回值**：`Promise<void>`。
- **异常处理**：重试上限后抛出「乐观锁失败」错误（内部捕获，toast 提示用户）。

#### `remove(key)` → Promise
- **实现逻辑**：删 `v2/<key>` + 清缓存。
- **参数**：`key`。
- **返回值**：`Promise<void>`。
- **异常处理**：`lastError` 静默。

#### `getAll()` → Promise
- **实现逻辑**：批量读取 8 个已知 KEYS（用 key 数组而非 `get(null)`），一次返回全部 v2 数据。
- **返回值**：`Promise<Record<StorageV2Key, unknown>>`。
- **异常处理**：个别 key 失败返回 undefined，不中断。

#### `migrateFromLegacy()` → Promise
- **实现逻辑（幂等）**：若 `v2/tasks` 已存在 → 返回 `already_migrated`；否则从 `devhome_workbench.quadrants[q].tasks` 扁平化为数组，补 `quadrant` 字段 + 默认字段，写 `v2/tasks`。
- **参数**：无。
- **返回值**：`Promise<string>`（`'migrated'` | `'already_migrated'` | `'no_legacy_data'`）。
- **异常处理**：读取失败返回 `'no_legacy_data'`，不阻塞启动。

#### `isAvailable()` / `isCacheExpired(key)` / `getCacheRemainingTTL(key)`
- **实现逻辑**：基于缓存时间戳与 `CACHE_TTL_MS`（24h）计算。
- **参数**：`key: string`。
- **返回值**：`boolean` / `number`（ms）。
- **异常处理**：无。

#### `getQuotaInfo()` / `checkQuota()`
- **实现逻辑**：`chrome.storage.local.getBytesInUse(null)`；90% 阈值告警；30s 节流。
- **返回值**：`Promise<{used, quota, percent}>`；`checkQuota` 返回是否触发告警。
- **异常处理**：`lastError` 时返回保守值。

### 16.1.3 `ns.dataService`（js/dataService.js，统一数据门面）

#### `getPages()` / `savePages(pages)` → Promise
- **实现逻辑**：`getPages`：优先 `v2/pages`（经 `parsePages` 校验），空则降级 `tabpage_pages`。`savePages`：双写 `v2/pages` + `tabpage_pages`。
- **参数**：`pages: Page[]`。
- **返回值**：`Promise<Page[]>` / `Promise<void>`。
- **异常处理**：校验失败返回 `[]`，不抛错（R20 防御）。

#### `getNotes()` / `saveNote(note)` / `deleteNote(id)` → Promise
- **实现逻辑**：委托 `storageV2.KEYS.NOTES`，读写时经 `parseNotes` 校验。
- **参数**：`note: Note`，`id: NoteId`。
- **返回值**：`Promise<Note[]>` / `Promise<void>`。
- **异常处理**：校验失败丢数据；写入乐观锁失败 toast。

#### `getCaptures()` / `saveCapture(cap)` → Promise
- **实现逻辑**：`v2/captures`，**上限 200 条**（超出 shift）。
- **参数**：`cap: Capture`。
- **返回值**：同上。
- **异常处理**：同上。

#### `getTasks()` / `saveTask(task)` / `deleteTask(id)` → Promise
- **实现逻辑**：`v2/tasks`，`saveTask` 为 upsert（按 id 匹配替换）。
- **参数**：`task: Task`，`id: TaskId`。
- **返回值**：同上。
- **异常处理**：同上。

#### `getConfig()` / `saveConfig(config)` → Promise
- **实现逻辑**：`v2/config`，与默认配置 `DEFAULT_V2_CONFIG` 深合并。
- **参数**：`config: AppConfig`。
- **返回值**：`Promise<AppConfig>`。
- **异常处理**：缺字段以默认值兜底。

#### `getSetting(key, fallback)` / `setSetting(key, value)`
- **实现逻辑**：localStorage `tabpage_<key>`（同 ns.storage）。
- **参数**：`key: string`，`value: unknown`。
- **返回值**：`unknown` / `void`。
- **异常处理**：同 storage。

### 16.1.4 `ns.fileConfig`（js/fileConfig.js，文件系统同步）

| 方法 | 参数 | 返回 | 实现/异常 |
|------|------|------|----------|
| `init()` | 无 | `Promise<{ready, dirName}>` | 恢复授权目录句柄并读取配置文件；权限过期时 `_tryRecoverRead` 降级 |
| `pickDir()` | 无 | `Promise<boolean>` | 目录选择器；用户取消返回 false，不抛错 |
| `markDirty(category?)` | `category?: string` | `void` | 防抖 3s（storage 路径）/1s（storageV2 路径）后 `syncToFile` |
| `syncToFile()` | 无 | `Promise<void>` | 读全部数据→序列化→写 `devhome-config.json`；写失败 toast |
| `updateBadge(text, color)` | `text, color` | `void` | `chrome.action.setBadgeText/BackgroundColor` |
| `hideWarningBar()` | 无 | `void` | 隐藏同步警告条 |
| `isSupported()` | 无 | `boolean` | `'showDirectoryPicker' in window` 检测 |

---

## 16.2 磁贴管理（js/tiles.js）

### 16.2.1 `ns.tileManager` 方法

#### `load()` → Promise
- **实现逻辑**：`pageManager.load()` → 更新 `state.totalPages/currentPage/pageNames` → `updateCurrentTiles()`。
- **参数**：无。
- **返回值**：`Promise<void>`。
- **异常处理**：加载失败保持空态，不阻塞启动（Phase 2/3 boot 依赖）。

#### `updateCurrentTiles()`
- **实现逻辑**：取当前页 tiles → 按 `position` 升序排序 → 存 `ns.currentTiles`。
- **参数**：无。
- **返回值**：`void`。
- **异常处理**：`position` 缺失视为 0。

#### `save()`
- **实现逻辑**：将 `currentTiles` 的 `position` 写回与数组下标一致 → `pageManager.updateCurrentPage` → `pageManager.save`。
- **参数**：无。
- **返回值**：`void`（内部异步，未 await）。
- **异常处理**：写失败乐观锁 toast。

#### `add(tile)`
- **实现逻辑**：`tile.id = 'tile_<ts>_<rand>'`，`position = currentTiles.length`，push 后 `save()`。
- **参数**：`tile: Omit<Tile,'id'|'position'>`。
- **返回值**：`Tile`（新磁贴）。
- **异常处理**：无。

#### `remove(tileId)`
- **实现逻辑**：filter 掉目标磁贴 → 更新 position → `save()`。
- **参数**：`tileId: TileId`。
- **返回值**：`void`。
- **异常处理**：id 不存在静默。

#### `update(tileId, updates)`
- **实现逻辑**：`Object.assign` 匹配磁贴 → `save()`。
- **参数**：`tileId: TileId`，`updates: Partial<Tile>`。
- **返回值**：`void`。
- **异常处理**：无。

#### `reorder(fromIndex, toIndex)`
- **实现逻辑**：数组 splice 移动 → 重写 position → `save()`。
- **参数**：`fromIndex: number`，`toIndex: number`。
- **返回值**：`void`。
- **异常处理**：越界索引 clamp。

#### `changePage(pageIndex)`
- **实现逻辑**：`state.currentPage = pageIndex` → `updateCurrentTiles()` → `renderTiles()`；分类记忆开启时写 `tabpage_last_page`。
- **参数**：`pageIndex: number`。
- **返回值**：`void`。
- **异常处理**：越界 clamp 到 `[0, totalPages-1]`。

#### `addNewPage()` / `removeCurrentPage()` / `removePageAt(idx, strategy)`
- **实现逻辑**：增/删页；`strategy='moveToCommon'` 时删页前将磁贴并入公共逻辑；删当前页后 `currentPage` 修正。
- **参数**：`idx: number`，`strategy: 'moveToCommon'`。
- **返回值**：`void`。
- **异常处理**：单页时禁止删除（最小 1 页）。

#### `renameCurrentPage(newName)`
- **实现逻辑**：更新 `page.name` + `pageNames[idx]` → `save()`。
- **参数**：`newName: string`。
- **返回值**：`void`。
- **异常处理**：空名忽略。

### 16.2.2 渲染函数

#### `ns.renderTiles()`
- **实现逻辑**：`ns.currentTiles` → 遍历构建 `.tile` DOM（图标优先 `imageData` → favicon 库 → 内置 icon → 首字符）→ 一次性 append 到 `#tilesContainer`（DocumentFragment 模式）→ 绑定删除/拖拽事件。
- **参数**：无。
- **返回值**：`void`。
- **异常处理**：单磁贴渲染异常 catch 后跳过（不拖垮整页）；当前为全量 innerHTML 重建（R10 待优化）。

#### `ns.openUrl(url, opts)`
- **实现逻辑**：`opts.type`（`'tiles'`|`'search'`）→ 读 `linkNewTab_<type>` 设置 → `true` 则 `chrome.tabs.create({url})`，否则 `location.href=url`。
- **参数**：`url: string`，`opts?: {type?: string}`。
- **返回值**：`void`。
- **异常处理**：`chrome.tabs.create` 失败（无 tabs 权限/被拦截）→ `location.href` 兜底。

---

## 16.3 分页管理（js/pageManager.js）

| 方法 | 参数 | 返回 | 实现/异常 |
|------|------|------|----------|
| `load()` | 无 | `Promise<void>` | 读 pages+names → `normalizePageState` 修复名错位 → 若 changed 持久化 → 更新 state |
| `getCurrentPageData(pagesData)` | `pagesData: Page[]` | `Page` | 取 `[currentPage]`，越界取最后一页 |
| `updateCurrentPage(pagesData, tiles)` | `pagesData, tiles: Tile[]` | `void` | 写回当前页 tiles |
| `save(pagesData)` | `pagesData: Page[]` | `void` | 双写 `tabpage_pages` + `v2/pages` |
| `addPage(pagesData)` | `pagesData` | `void` | push `{name:'第N页', tiles:[]}` |
| `removePageWithStrategy(pagesData, idx, strategy)` | `idx, strategy` | `void` | moveToCommon 逻辑 |
| `reorderPage(pagesData, from, to)` | `from, to` | `void` | splice 移动 |
| `renamePage(idx, name)` | `idx, name` | `void` | 更新 name |

---

## 16.4 笔记系统（js/notes.js + notes/_*.js）

### 16.4.1 `notesManager.createNote(data)` → Note

- **实现逻辑**：
  1. `now = Date.now()`，生成 `id = 'note_<ts>_<rand>'`。
  2. `tags = [dateTag(now)] + data.tags`（日期标签置首）。
  3. `notebookId = data.notebookId ?? (state._notebookFilter || state._lastNotebookId || null)`。
  4. 组装完整 Note 对象 → `state.notes.unshift(note)` → `saveNotes()`。
- **参数**：
  | 参数 | 类型 | 说明 |
  |------|------|------|
  | `data.title` | `string` | 默认 `'无标题'` |
  | `data.content` | `string` | 默认 `''` |
  | `data.type` | `string` | 笔记类型，默认 `'note'` |
  | `data.tags` | `string[]` | 追加标签 |
  | `data.notebookId` | `NotebookId\|null` | 归属笔记本 |
  | `data.sourceUrl` / `sourceTitle` | `string` | 剪藏来源 |
- **返回值**：`Note`（新笔记对象）。
- **异常处理**：无显式；`saveNotes` 失败乐观锁 toast。

### 16.4.2 `notesManager.updateNote(id, updates)` → Promise

- **实现逻辑**：`Object.assign` 匹配 → 刷新 `updatedAt` → `saveNotes()`。
- **参数**：`id: NoteId`，`updates: Partial<Note>`。
- **返回值**：`Promise<void>`。
- **异常处理**：id 不存在静默；写入失败乐观锁 toast。

### 16.4.3 `notesManager.deleteNote(id)` → Promise

- **实现逻辑**：filter 移除 → `saveNotes()`；删除后联动：关闭正在编辑的笔记、重渲染列表、刷新四象限看板。
- **参数**：`id: NoteId`。
- **返回值**：`Promise<void>`。
- **异常处理**：无。

### 16.4.4 `notesManager.deleteWithUndo(item, kind)` → Promise

- **实现逻辑**：
  1. 压入 `state._deletedNotes` 队列（内存态，刷新丢失）。
  2. 执行真实删除。
  3. `showActionToast('已删除"xx"', '撤销', onUndo)`。
  4. `onUndo`：从队列移除 → `restoreNote/restoreCapture` → 若正在编辑则 `openNoteEditor` 恢复。
- **参数**：`item: Note|Capture`，`kind: 'note'|'capture'`。
- **返回值**：`Promise<void>`。
- **异常处理**：撤销时若 item 已被其他操作改写，恢复仍以原数据为准（无冲突检测，P2 风险）。

### 16.4.5 `notesManager.addCapture(content)` → Capture

- **实现逻辑**：`id = 'cap_<ts>_<rand>'`，`wordCount = countWords(content)` → `state.captures.unshift` → `storageV2.set(CAPTURES)` → `renderCaptures()`。
- **参数**：`content: string`。
- **返回值**：`Capture`。
- **异常处理**：`content` 为空拒绝。

### 16.4.6 `notesManager.openNoteEditor(note)` → void

- **实现逻辑**（关键流程）：
  1. `state.currentNote = note`，判定 `isCapture`。
  2. 专注模式下确保 `#devhomeStage` visible。
  3. 切换 UI（隐藏空态/激活编辑态）；捕获只读标题半透明。
  4. 渲染类型/笔记本徽章。
  5. **销毁旧 Tiptap 实例** → `tiptapEditor.create('#wbNoteContent', content, {editable:!isCapture, onUpdate})`。
- **参数**：`note: Note|Capture`。
- **返回值**：`void`。
- **异常处理**：Tiptap 创建失败（依赖未加载）→ `logger.error` + 保持只读文本视图。

### 16.4.7 `notesManager.saveCurrentNote()` → Promise

- **实现逻辑**：
  - 捕获：`getHTML` → `cleanEmptyHTML` → `updateCapture`。
  - 笔记：标题/类型/日期标签保障（无日期标签补创建日）→ `getHTML` → `cleanEmptyHTML` → `countWords` → `updateNote`。
- **参数**：无。
- **返回值**：`Promise<void>`。
- **异常处理**：`state.currentNote` 为空直接 return。

### 16.4.8 `notesManager.countWords(text)` → number

- **实现逻辑**（lib/countWords.ts 已 TS 化）：剥离 HTML 标签 → `CJK_RE` 计中文字符 + `WORD_RE` 计英文词/数字 → 求和。
- **参数**：`text: string`。
- **返回值**：`number`。
- **异常处理**：空串返回 0。

### 16.4.9 笔记本 CRUD

| 方法 | 参数 | 返回 | 实现/异常 |
|------|------|------|----------|
| `createNotebook(name)` | `name: string` | `Notebook` | `id='nb_<ts>_<rand>'`，按 order 排序 |
| `renameNotebook(id, newName)` | `id, newName` | `Promise<void>` | 校验重名 |
| `deleteNotebook(id)` | `id` | `Promise<void>` | 该笔记本下笔记 `notebookId=null` → 删笔记本 → 当前筛选重置 → toast「N 条笔记移回未分类」 |
| `renderNotebookDropdown()` / `renderNotebookChips()` / `renderNotebookBadge()` | 无 | `void` | 渲染各笔记本 UI |

### 16.4.10 编辑器辅助

| 方法 | 参数 | 返回 | 实现/异常 |
|------|------|------|----------|
| `closeNoteEditor()` | 无 | `void` | 保存当前 → 销毁 Tiptap → `state.currentNote=null` → 重渲染列表 |
| `cleanEmptyHTML(html)` | `html: string` | `string` | lib 纯函数：空段落/多余 br/首尾空段落/任务项空块清理 |
| `_triggerAutoSave()` | 无 | `void` | 400ms 防抖后 `saveCurrentNote` + `renderNotesList` |

---

## 16.5 番茄钟系统（SW 侧：js/bg/_pomodoro-core.js + _pomodoro-broadcast.js）

### 16.5.1 `startPomodoro(params)`

- **实现逻辑**：
  1. 重置 `pomodoroState` 全字段。
  2. `phaseStartAt = Date.now()`，`phaseTotalSeconds = duration*60`。
  3. 启动 `setInterval(pomodoroTick, 1000)`。
  4. `schedulePomodoroAlarm()`（`chrome.alarms.create('pomodoro-phase', {when: now + remaining*1000})`）。
  5. `persistPomodoroState()` + `broadcastPomodoroState()`。
- **参数**：
  | 参数 | 类型 | 说明 |
  |------|------|------|
  | `params.duration` | `number` | 专注分钟 |
  | `params.restDuration` | `number` | 休息分钟 |
  | `params.type` | `'default'\|'focus'` | 模式 |
  | `params.taskId` | `TaskId\|null` | 关联任务 |
  | `params.taskTitle` | `string` | 任务标题 |
  | `params.autoCycle` | `boolean` | 自动循环 |
- **返回值**：`void`。
- **异常处理**：`chrome.alarms.create` 失败（配额）→ 降级纯内存计时（SW 休眠会中断，风险已记录）。

### 16.5.2 `computeRemaining()` → number

- **实现逻辑**（lib/computeRemaining.ts）：`Math.max(0, phaseTotalSeconds - Math.floor((now - phaseStartAt)/1000))`。
- **参数**：无（读全局 state）。
- **返回值**：`number`（剩余秒数）。
- **异常处理**：`phaseStartAt` 为空返回 0。

### 16.5.3 `pomodoroPhaseEnd()`（关键状态机）

- **实现逻辑**：
  ```
  if (isResting) {
    // 休息结束 → 自动开始新一轮
    isResting=false; phaseStartAt=now; phaseTotalSeconds=duration*60;
    通知 'pomodoro-rest-done'（语录+第N+1轮）
  } else {
    sessionCount++; savePomodoroSession();
    if (autoCycle) {
      isResting=true; phaseStartAt=now; phaseTotalSeconds=restDuration*60;
      通知 'pomodoro-done'（语录+休息N分钟）
    } else {
      // 单轮：停止全部
      清 timer/alarm; active=false; remaining=0;
      通知 'pomodoro-done'（共N个番茄）
    }
  }
  scheduleAlarm + persist + broadcast（finally 释放 _phaseEndInProgress 锁）
  ```
- **参数**：无。
- **返回值**：`void`。
- **异常处理**：`_phaseEndInProgress` 防重入；`savePomodoroSession` 失败不影响主流程。

### 16.5.4 `pausePomodoro()` / `resumePomodoro()` / `stopPomodoro()`

- **pause**：停 tick + 清 alarm → `remaining=computeRemaining()` → `active=false` → persist。
- **resume**：`phaseStartAt = now - (phaseTotalSeconds - remaining)*1000` → tick+alarm+persist。
- **stop**：全字段清零 + 清 alarm + persist。
- **返回值**：均 `void`。
- **异常处理**：`remaining<=0` 时 resume 直接触发 phaseEnd。

### 16.5.5 `restorePomodoroState()`

- **实现逻辑**：SW 唤醒 → 读 `v2/pomodoro_state` → 合并 → 若 `active && remaining>0` → 恢复 tick+alarm；`remaining<=0` → 直接 `pomodoroPhaseEnd()`。
- **参数**：无。
- **返回值**：`void`。
- **异常处理**：读取失败以默认状态运行。

### 16.5.6 `broadcastPomodoroState()`

- **实现逻辑**：组装 `{type:'POMODORO_STATE', data:{...}}` → 遍历 `pomodoroPorts` 逐端口 postMessage（单端口抛错移除）→ 无端口则 `chrome.runtime.sendMessage(msg).catch(()=>{})`。
- **参数**：无。
- **返回值**：`void`。
- **异常处理**：单端口 postMessage 失败移除该端口；sendMessage 无接收方静默。

---

## 16.6 消息协议处理（js/background.js → src/shared/messages.ts）

### 16.6.1 `onMessage` 路由（TS 目标实现）

- **实现逻辑**：`ExtensionRequest.safeParse(msg)` → `success` 时 `switch(parsed.data.type)` 分派；`default` 分支返回 `{success:false, reason:'unknown_message_type'}`。
- **参数**：`msg: unknown`（来自 `chrome.runtime.onMessage`）。
- **返回值**：`{success:true, data?}` 或 `{success:false, reason}`。
- **异常处理**（R3/R20）：
  - schema 校验失败 → `{success:false, reason:'invalid_message'}`（不进入业务）。
  - `RESOLVE_FAVICON` domain 不匹配 `SAFE_HOST` → 拒绝。
  - 处理器内异常 → catch → `{success:false, reason:'internal_error'}`。

### 16.6.2 `resolveRealFavicon(domain)` → Promise<dataUrl|null>

- **实现逻辑**（关键算法）：
  1. 约定路径 `https://<domain>/favicon.ico`（AbortController 6s 超时）。
  2. 抓取首页 → 正则解析 `<link rel="icon">` / `apple-touch-icon`，评分排序（dataURI=4 > apple-touch-icon=3 > shortcut=2 > icon=1），相对/绝对/`//` 地址归一化。
  3. `toDataUrl`：MIME 校验（image/*、image-x-icon、vnd.microsoft.icon）+ .ico 空 MIME 特殊处理 + blob→FileReader→dataURL。
  4. 兜底 DuckDuckGo `https://icons.duckduckgo.com/ip3/<domain>.ico`。
  5. 结果写 IndexedDB 缓存后返回。
- **参数**：`domain: string`。
- **返回值**：`Promise<string|null>`（dataURL 或 null）。
- **异常处理**：全程 try/catch，任一失败返回 null；超时（6s）AbortController 终止。

### 16.6.3 `checkTaskDueNotifications()`（js/bg/_task-notify.js）

- **实现逻辑**：
  1. 读 `v2/taskNotifySettings`，未启用 return。
  2. `remindBefore = settings.remindBefore || 15`。
  3. 遍历 active 任务：`dueTime = dueDate ? new Date(dueDate) : plannedAt`，`remaining = dueTime - now`。
  4. `0 < remaining ≤ remindBefore*60s` 且未通知 → 通知「N 分钟到期」；`≤0` 且未通知 → 通知「已超期」。
  5. 已通知标记存 `_taskDueNotified`（SW 内存态，R7 待持久化）。
- **参数**：无。
- **返回值**：`Promise<void>`。
- **异常处理**：单任务异常不中断整体遍历；`chrome.notifications.create` 失败静默。

---

## 16.7 搜索系统（js/search.js）

| 方法 | 参数 | 返回 | 实现/异常 |
|------|------|------|----------|
| `loadSearchHistory()` | 无 | `void` | 读 `tabpage_search_history` → `state.searchHistory` |
| `addSearchHistory(term)` | `term: string` | `void` | 去重 unshift，超 20 截断，写存储 |
| `buildSuggestions(query)` | `query: string` | `Suggestion[]` | 历史匹配 + 磁贴匹配 +（可选）Bing 联想合并去重 |
| `renderSuggestions()` | 无 | `void` | 构建建议面板 DOM，键盘选中态同步 |
| `setEngine(id)` | `id: string` | `void` | 写 `tabpage_engine`，更新 UI |
| `hideSuggestions()` | 无 | `void` | 隐藏面板 + 重置索引 |
| `getSearchConfig()` | 无 | `{showSuggestions:boolean}` | 读搜索配置 |
