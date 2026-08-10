# 项目反模式编码规则（Anti-Pattern Rules）

> 本文档由 `wiki/13-重构改造建议.md` 识别的项目代码问题转化而来，是 `rules/coding-standards/RULE.mdc` 的落地细则。
> 每条规则固定包含：**问题描述**（含同类问题在其他项目的典型表现与潜在风险）、**适用范围**、**违反示例**、**合规写法**。
> **适用技术栈：TypeScript（strict）**。项目正按 `wiki/14-TypeScript改造方案.md` 从 JS 迁移至 TS，本文示例一律以 TS 为准（`src/` + `lib/` + `tests/` 目录结构，`import/export` 模块化，`zod` 运行时校验）。「适用范围」中标注的 JS 文件为现状路径，括号内为迁移后的 TS 目标路径。

---

## R1. 全局命名空间挂载必须有类型契约

- **问题描述**：项目所有模块通过 IIFE 挂载到 `window.DevHome`（`ns`），40+ 方法无类型定义，调用方无法校验签名，重构一处签名后调用方静默失效。此模式在其他项目中的典型表现是「巨型全局对象 + 隐式依赖」，重构时出现运行时 `TypeError: xxx is not a function` 且难以静态定位。
- **潜在风险**：P0 —— 接口漂移、难以测试、IDE 无补全。
- **适用范围**：所有在 `window.DevHome` 上挂载模块入口的文件（`main.js` 等，迁移目标 `src/pages/**`、`src/background/**`）。
- **违反示例**：
  ```ts
  // 无类型契约地直接挂载
  (window as any).DevHome.tileManager = { add: (t: unknown) => { /* ... */ } };
  // 调用方不知道 add 的入参结构
  ns.tileManager.add('hello'); // 编译期不报错，运行时静默出错
  ```
- **合规写法**：模块化 + 显式接口，`ns` 为类型化的命名空间对象：
  ```ts
  // src/shared/types.ts
  export interface Tile { id: string; label: string; url: string }

  // src/pages/index/tiles.ts
  import type { Tile } from '../shared/types';
  export interface TileManager { add(tile: Tile): void }
  export const tileManager: TileManager = { add(tile) { /* ... */ } };

  // 聚合入口（main.ts）：export const ns = { tileManager, ... }（带类型）
  ```

---

## R2. 数据必须单一权威存储，禁止双写

- **问题描述**：任务同时写 `devhome_workbench`（localStorage）与 `v2/tasks`（chrome.storage）；磁贴写 `tabpage_pages` + `v2/pages` + `v2/pageNames`。写一半失败即产生不一致；其他项目中常见的「双写」还会导致迁移/回滚复杂、两处读取结果打架、缓存永久不一致。
- **潜在风险**：P0 —— 数据不一致、丢数据、难以排查。
- **适用范围**：`workbench_private/_quadrant-tasks.js`（`saveWorkbenchState`，→ `src/pages/workbench/_quadrant-tasks.ts`）、`tiles.js`/`pageManager.js`、`dataService.js`（→ `src/shared/storage.ts`）、`storageV2.js`。
- **违反示例**：
  ```ts
  function saveWorkbenchState(next: WorkbenchState) {
    localStorage.setItem('devhome_workbench', JSON.stringify(next)); // 写 A
    void storageV2.set('v2/tasks', flattenTasks(next));             // 写 B（可能失败且被吞掉）
  }
  ```
- **合规写法**：确定唯一权威（本项目 `v2/*`），旧格式只读兼容 + 一次性迁移；同一数据只保留一个写入路径。
  ```ts
  // 仅写 v2/tasks；devhome_workbench 仅在迁移期读取
  async function saveTasks(tasks: Task[]): Promise<void> {
    await storageV2.set(StorageKeys.TASKS, tasks);
  }
  ```

---

## R3. 消息协议必须判别联合 + 运行时校验，禁止裸字符串无校验

- **问题描述**：`background.js` 的 `onMessage` 直接 `switch` 裸字符串 `type`，数据不校验直接使用；`RESOLVE_FAVICON` 接受任意 `domain`。其他项目典型表现为「消息体无 schema、无版本、无类型」，跨上下文通信演变为调试地狱；`RESOLVE_FAVICON` 类的场景若不加白名单，SW 高权限下存在 SSRF 面。
- **潜在风险**：P0 —— 运行时崩溃、安全面、协议演进断裂。
- **适用范围**：`background.js`（→ `src/background/background.ts`）、`bg/_pomodoro-*.js`、`bg/_clip-capture.js`、所有 `chrome.runtime.sendMessage/onMessage` 调用方；协议类型集中在 `src/shared/messages.ts`。
- **违反示例**：
  ```ts
  chrome.runtime.onMessage.addListener((msg: unknown) => {
    if ((msg as any).type === 'RESOLVE_FAVICON') {
      fetch(`https://${(msg as any).domain}`); // 未校验 domain，any 透传
    }
  });
  ```
- **合规写法**：定义带 `type` 字段的判别联合 + zod 校验守卫，`switch` 穷尽且 `default` 兜底（`never` 收窄）。
  ```ts
  // src/shared/messages.ts
  const ResolveFaviconMsg = z.object({ type: z.literal('RESOLVE_FAVICON'), domain: z.string().regex(SAFE_HOST) });
  export type ExtensionRequest = z.infer<typeof ResolveFaviconMsg> | /* 其他消息 */;

  // src/background/background.ts
  function handleMessage(msg: unknown) {
    const parsed = ResolveFaviconMsg.safeParse(msg);
    if (!parsed.success) return { success: false, reason: 'invalid_message' };
    fetch(`https://${parsed.data.domain}/favicon.ico`);
  }
  ```

---

## R4. 日志必须统一入口，禁止 console.* 散落

- **问题描述**：项目同时存在 `ns.logger`（info/warn/error）与大量带 `[分类]` 前缀的 `console.*`。其他项目典型表现为「日志格式不统一 → 过滤失效、双份输出、生产不可控」，且 `console.error` 被误当唯一出口导致错误上下文丢失。
- **潜在风险**：P1 —— 排障困难、敏感信息泄漏（若直接打印 API Key）。
- **适用范围**：所有模块（页面 + SW）；`lib/logger.ts` 为统一出口。
- **违反示例**：
  ```ts
  console.log('[交互] 点击了磁贴', tile);        // 绕过统一入口
  console.log('API_KEY:', config.aiApi.apiKey);  // 敏感信息入日志
  ```
- **合规写法**：统一走 `logger`，只记标识不记全文，敏感字段脱敏。
  ```ts
  import { logger } from '../../lib/logger';
  logger.info('tiles', '点击磁贴', { tileId: tile.id });
  logger.error('pomodoro', '阶段结束失败', { code: 'PHASE_END_ERR' });
  ```

---

## R5. 事件绑定必须幂等，禁止重复绑定与重复 document 监听

- **问题描述**：`bindEvents()` 重复调用会重复绑定；`_nbEventBound` 仅个别按钮有防抖；`global-events`/`misc-events`/`pomodoro-events` 都向 document 注册 click/keydown 监听且无注册管理。其他项目典型表现为「同一 handler 触发多次、内存泄漏、遮罩点击一次关两个面板」。
- **潜在风险**：P1 —— 交互错乱、泄漏、性能退化。
- **适用范围**：`events.js` 及 `events/*` 全部子模块（→ `src/pages/events/**`）、`ai-chat.js`（已示范 `documentClickHandler` 管理）。
- **违反示例**：
  ```ts
  document.addEventListener('click', closePanel);           // bindEvents() 每次调用都新增
  function bindEvents(): void { document.addEventListener('click', h); } // 无幂等
  ```
- **合规写法**：绑定前检查标记（WeakSet），document 级监听集中注册一次并保留引用以便移除。
  ```ts
  const bound = new WeakSet<Document>();
  export function bindDocumentHandlers(): void {
    if (bound.has(document)) return;
    bound.add(document);
    document.addEventListener('click', closePanel);
  }
  ```

---

## R6. 统计/计数写入必须幂等，禁止「当日无记录即 +1」

- **问题描述**：`_dashboard.js` 连续打卡逻辑以「今日无 `streakDay`」判断 +1，同日刷新页面存在重复计数竞态。此类「未持久化幂等标记」的模式在其他项目（打卡、签到、限流计数）中广泛造成重复统计。
- **潜在风险**：P0 —— 统计失真、用户信任损失。
- **适用范围**：`workbench_private/_dashboard.js`（→ `src/pages/workbench/_dashboard.ts`）、任何基于「未记录」做增量计数的逻辑。
- **违反示例**：
  ```ts
  if (!dailyStats[today]?.streakDay) {
    streakDays += 1;                      // 两次渲染/两次刷新都 +1
    dailyStats[today] = { streakDay: true };
  }
  ```
- **合规写法**：以「最后打卡日期」判断连续性，写入与读取同源且带状态校验。
  ```ts
  const last = behavior.lastActiveDate;               // 'YYYY-MM-DD' | null
  const isNew = last !== today;
  if (isNew) {
    streakDays = (last === yesterday ? streakDays : 0) + 1; // 跨日判定
    behavior.lastActiveDate = today;                        // 幂等标志
  }
  ```

---

## R7. SW 状态禁止只存内存，跨唤醒必须持久化

- **问题描述**：`bg/_task-notify.js` 的 `_taskDueNotified`、`bg/_pomodoro-*` 的 `pomodoroTimer` 等为 SW 内存态；SW 随时休眠/唤醒，重启后状态丢失（已通知任务重复通知）。其他项目典型表现为「后台任务重复推送、定时任务错乱」。
- **潜在风险**：P0 —— 重复打扰、状态不一致。
- **适用范围**：`js/bg/*`（→ `src/background/**`，`_task-notify.ts`、`_pomodoro-core.ts`、`_pomodoro-broadcast.ts`）。
- **违反示例**：
  ```ts
  const notified: Record<string, boolean> = {}; // SW 唤醒后清空，同一任务再次通知
  ```
- **合规写法**：把「已处理标记」持久化（`v2/*`），读取恢复。
  ```ts
  // 通知成功后
  await storageV2.set('v2/taskNotified', { ...notified, [task.id]: true });
  // checkTaskDueNotifications 开头
  notified = await storageV2.get<Record<string, boolean>>('v2/taskNotified', {});
  ```

---

## R8. 剪贴板/文档操作必须用标准 API，禁止 execCommand

- **问题描述**：`misc-events.js` 编辑器右键菜单用 `document.execCommand('copy'/'paste')`，该 API 已被标准废弃且权限受限（paste 在多数浏览器不可用）。其他项目典型表现为「复制/粘贴在部分浏览器失效、无权限提示」。
- **潜在风险**：P1 —— 功能失效、无降级路径。
- **适用范围**：`events/misc-events.js`（→ `src/pages/events/misc-events.ts`，`editorContextMenu` copy/paste 分支）。
- **违反示例**：
  ```ts
  document.execCommand('copy'); // 已废弃，Safari/Firefox 表现不一致
  ```
- **合规写法**：
  ```ts
  await navigator.clipboard.writeText(selectedText);
  const text = await navigator.clipboard.readText(); // 需 try/catch 处理权限拒绝分支
  ```

---

## R9. 常量与映射表必须单一来源，禁止重复定义

- **问题描述**：WMO 天气码映射在 `weather.js` 与 `dailyGreetingCard.js` 各一份；`QUADRANTS` 数组在多个文件重复定义；散落的魔法值（滚轮阈值 25/350、缓存 TTL 24h 等）混在模块内。其他项目典型表现为「改一处漏一处 → 行为不一致」。
- **潜在风险**：P1 —— 隐性不一致、维护成本高。
- **适用范围**：`weather.js`、`dailyGreetingCard.js`、`config.js`、`storageV2.js`（→ `src/shared/constants.ts` 单一来源）。
- **违反示例**：
  ```ts
  // weather.ts
  export const WEATHER_MAP = { 0: '晴' };
  // dailyGreetingCard.ts 再次定义
  export const WEATHER_MAP = { 0: '晴' };
  ```
- **合规写法**：集中到 `src/shared/constants.ts` 单一来源导出，`as const` 保留字面量类型。
  ```ts
  // src/shared/constants.ts
  export const WEATHER_MAP = { 0: '晴' } as const;
  export const QUADRANTS = ['q1', 'q2', 'q3', 'q4'] as const;
  export const WHEEL_THRESHOLD = 25;
  export const WHEEL_COOLDOWN_MS = 350;
  ```

---

## R10. 大列表渲染禁止每次全量 innerHTML 重建

- **问题描述**：`renderTiles`/`renderCatRow`/`renderNotesList` 每次全量 `innerHTML` 重建 DOM，磁贴/笔记多时卡顿。其他项目典型表现为「列表 100+ 项时滚动掉帧、输入抖动」。
- **潜在风险**：P1 —— 性能退化、事件绑定随重建丢失。
- **适用范围**：`tiles.js`（→ `src/pages/index/tiles.ts`）、`categoryUI.js`、`notes/_notes-view.ts`。
- **违反示例**：
  ```ts
  container.innerHTML = tiles.map(t => `<div>${t.label}</div>`).join(''); // 全量重建
  ```
- **合规写法**：`DocumentFragment` 批量插入、按需局部更新；数据变化时 diff 或仅重建变化项。
  ```ts
  const frag = document.createDocumentFragment();
  tiles.forEach(t => frag.appendChild(createTileEl(t)));
  container.replaceChildren(frag);
  ```

---

## R11. 高频/大数据写入必须节流或分键，禁止全量序列化

- **问题描述**：`storageV2.set` 每次全量写数组（磁贴/笔记/任务）；拖拽重排、自动保存路径高频触发。其他项目典型表现为「storage 频繁写入 → 磁盘 I/O、chrome.storage 配额告警（90% 阈值已触发过）」。
- **潜在风险**：P1 —— 配额耗尽、写入竞争（乐观锁重试失败）。
- **适用范围**：`storageV2.js`、`dataService.js`、`notes/_notes-editor.js`（→ `src/pages/notes/_notes-editor.ts`，自动保存 400ms 防抖已做，需保持）。
- **违反示例**：
  ```ts
  onUpdate: () => { void saveCurrentNote(); } // 每次输入都全量写
  ```
- **合规写法**：写入前防抖/合并，大数组分键存储。
  ```ts
  let t: ReturnType<typeof setTimeout>;
  onUpdate: () => { clearTimeout(t); t = setTimeout(() => void saveCurrentNote(), 400); }
  ```

---

## R12. 高频路径禁止日志与重复 DOM 查询

- **问题描述**：`scroll/resize/mousemove/input/rAF` 回调中打日志或 `document.querySelector`，会卡顿/刷屏。本项目 Matrix 渲染已遵守「rAF 禁日志」，但需固化为全项目规则。
- **潜在风险**：P1 —— 性能退化、日志刷屏。
- **适用范围**：`matrix-bg.js`、`categoryUI.js`（滚轮）、`search.js`（输入联想）、`main.js`（时钟 `setInterval` 1s）。
- **违反示例**：
  ```ts
  inputEl.addEventListener('input', () => { console.log(e.target.value); renderAll(); });
  ```
- **合规写法**：高频回调内只做必要计算；日志节流（`Date.now()-last > 500`）；DOM 引用走缓存。
  ```ts
  let lastLog = 0;
  inputEl.addEventListener('input', (e) => {
    if (Date.now() - lastLog > 500) { logger.info('search', '输入中'); lastLog = Date.now(); }
    debounceSuggest((e.target as HTMLInputElement).value); // 防抖后处理
  });
  ```

---

## R13. 单文件/单函数超限必须拆分（行数铁律）

- **问题描述**：`index.html` 1680 行（红色区）；`favicon` 解析函数 ~110 行、`pomodoroPhaseEnd` ~60 行处于黄色预警。其他项目典型表现为「巨型文件 → 合并冲突频繁、职责混杂、无法测试」。
- **潜在风险**：P1 —— 可维护性崩塌。
- **适用范围**：全部源码（`*.ts`、`*.tsx`、模板、`*.css`）；异常：机器生成/测试夹具。
- **违反示例**：单文件 800+ 行仍持续新增逻辑；单函数 100+ 行不拆。
- **合规写法**：按「复用性才拆分 / 领域独立性才拆分 / 物理邻近原则」拆分：`index.html` 拆模板片段，favicon 解析拆 `extractIconLink`/`toDataUrl`/`resolveCandidates` 子函数。

---

## R14. 禁止魔法值，必须具名常量

- **问题描述**：裸数字/字符串散落（滚轮阈值、TTL、重试次数、状态码）。其他项目典型表现为「改一处漏一处、无取值说明」。
- **潜在风险**：P1 —— 隐性不一致。
- **适用范围**：所有 `.ts`/`.css`；集中到 `src/shared/constants.ts`。
- **违反示例**：
  ```ts
  if (Math.abs(acc) > 25) flipPage(); // 25 是什么？
  await sleep(350);                    // 350 单位？
  ```
- **合规写法**：
  ```ts
  if (Math.abs(acc) > WHEEL_THRESHOLD) flipPage();
  await sleep(WHEEL_COOLDOWN_MS);
  ```

---

## R15. 弹窗能力必须单一实现，禁止双轨

- **问题描述**：`showConfirm`/`showPrompt` 有原生（`ui/_tile-editor.js` 的 `wb-confirm`）与 Shadcn（`shadcn-dialogs.js`）两套实现。其他项目典型表现为「同一交互两套样式 → 视觉不一致、修一处漏一处」。
- **潜在风险**：P1 —— 视觉/行为不一致。
- **适用范围**：`ui/_tile-editor.js`、`shadcn-dialogs.js`（→ `src/pages/index/ui/dialogs.ts`）、所有调用 `showConfirm/Prompt/Toast` 的模块。
- **违反示例**：部分入口 `ns.showConfirm`（原生）与 `React.createElement(ShadcnDialog)` 混用。
- **合规写法**：统一单一实现并带类型签名；Shadcn 仅承载确需 React 的重组件，所有调用走同一入口。
  ```ts
  export function showConfirm(message: string, opts?: ConfirmOptions): Promise<boolean>;
  export function showPrompt(message: string, opts?: PromptOptions): Promise<string | null>;
  export function showToast(message: string, type?: ToastType): void;
  ```

---

## R16. 密钥与敏感配置禁止明文持久化到常规存储

- **问题描述**：AI API Key 明文存于 `v2/config.aiApi.providers[].apiKey`（chrome.storage.local 明文）。其他项目典型表现为「凭据泄露后无法审计、被误同步进备份/导出」。
- **潜在风险**：P0（视威胁模型）—— 凭据泄露。
- **适用范围**：`ai-providers.js`、`workbench_private/_dashboard.js`（→ `src/pages/workbench/_dashboard.ts`）、`secrets.js`（→ `src/shared/secrets.ts`）。
- **违反示例**：
  ```ts
  await storageV2.set('v2/config', { aiApi: { providers: { p: { apiKey: 'sk-xxx' } } } });
  ```
- **合规写法**：密钥与配置分离：`secrets.ts` 负责存取，明文不进业务配置；评估 `chrome.storage.session` + 加密；导出/备份时排除密钥字段；配置类型中 `apiKey` 仅存引用。

---

## R17. 渲染不可信内容必须净化（HTML 注入面）

- **问题描述**：`ai-chat.js` 用 `sanitizeHtml(marked.parse(...))`（轻量净化）；剪藏/捕获回填编辑器走富文本 HTML。其他项目典型表现为「Markdown 渲染 XSS、剪藏内容注入执行脚本」。
- **潜在风险**：P0（视威胁模型）—— XSS。
- **适用范围**：`ai-chat.js`（→ `src/pages/workbench/ai-chat.ts`）、`utils.js sanitizeHtml`（→ `lib/sanitize.ts`）、`notes/_notes-capture.js`、`tiptap-editor.js` 内容回填。
- **违反示例**：
  ```ts
  bubble.innerHTML = marked.parse(replyText); // 未净化
  ```
- **合规写法**：渲染前统一净化（DOMPurify 或同级别方案）；富文本入库前 sanitize。
  ```ts
  import DOMPurify from 'dompurify';
  bubble.innerHTML = DOMPurify.sanitize(marked.parse(replyText) as string);
  ```

---

## R18. 对外部 URL 的网络请求必须校验目标（SSRF 面）

- **问题描述**：`background.js resolveRealFavicon` 对任意 `domain` 发起 `fetch`（SW 拥有 `<all_urls>` 权限）。其他项目典型表现为「favicon/预览/代理类功能被用于访问内网地址（SSRF）」。
- **潜在风险**：P0（视威胁模型）—— 内网探测、请求滥用。
- **适用范围**：`background.js`（→ `src/background/**`）、`favicon.js`、`proxyManager.js`、`weather.js` 等所有发起外部请求处。
- **违反示例**：
  ```ts
  fetch(`https://${domain}/favicon.ico`); // domain 未校验
  ```
- **合规写法**：域名格式/白名单校验 + 协议限制（仅 https）+ 超时（AbortController）。
  ```ts
  const SAFE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  if (!SAFE_HOST.test(domain)) return { success: false, reason: 'invalid_domain' };
  const res = await fetch(`https://${domain}/favicon.ico`, { signal: AbortSignal.timeout(6000) });
  ```

---

## R19. 存储键/消息 type/通知 id 必须常量集中，禁止裸字符串

- **问题描述**：存储键（`tabpage_*`/`v2/*`）、消息 `type`、通知 id（`pomodoro-done`）、alarm 名（`task-due-check`）为裸字符串散落多处。其他项目典型表现为「改名漏改 → 数据读不到、事件收不到」。
- **潜在风险**：P1 —— 隐性契约断裂。
- **适用范围**：`storage.js`、`storageV2.js`（→ `src/shared/storage.ts`）、`background.js`、`bg/*`、`events/*`（→ `src/shared/messages.ts`）。
- **违反示例**：
  ```ts
  localStorage.setItem('tabpage_pages', ...); // 键名散落
  if (msg.type === 'POMODORO_START') { ... }  // type 散落
  chrome.alarms.create('task-due-check', ...); // alarm 名散落
  ```
- **合规写法**：全部集中在 `src/shared/constants.ts` + `src/shared/messages.ts`，`as const` + 模板字面量类型。
  ```ts
  // src/shared/constants.ts
  export const STORAGE_KEYS = { PAGES: 'tabpage_pages' } as const;
  export const ALARM_NAMES = { TASK_DUE_CHECK: 'task-due-check', POMODORO_PHASE: 'pomodoro-phase' } as const;
  export const NOTIFICATION_IDS = { POMODORO_DONE: 'pomodoro-done', TASK_DUE_PREFIX: 'task-due-' } as const;

  // 使用处
  chrome.alarms.create(ALARM_NAMES.TASK_DUE_CHECK, { periodInMinutes: 15 });
  ```

---

## R20. 外部输入必须先校验再进入业务逻辑

- **问题描述**：`chrome.runtime` 消息体、DOM 取值、JSON 解析、接口返回在部分路径未校验即使用（如剪藏内容、设置导入 JSON）。其他项目典型表现为「脏数据穿透 → 渲染异常、权限绕过」。
- **潜在风险**：P0 —— 运行时崩溃、注入。
- **适用范围**：`events/misc-events.js`（导入 JSON）、`background.js`、`_clip-capture.js`、`fileConfig.js`（→ 对应 `src/**` 与 `lib/parsers.ts`）。
- **违反示例**：
  ```ts
  const data: unknown = JSON.parse(text); // 未验证结构
  (data as any).tiles.forEach(t => render(t.label)); // t 可能缺字段
  ```
- **合规写法**：解析后立即做结构校验（类型守卫/zod），失败给默认值或拒绝。
  ```ts
  const ImportSchema = z.object({
    pages: z.array(z.object({ name: z.string(), tiles: z.array(z.object({ url: z.string(), label: z.string() })) }))
  });
  const parsed = ImportSchema.safeParse(JSON.parse(text));
  if (!parsed.success) return { ok: false, reason: 'invalid_format' };
  render(parsed.data);
  ```
