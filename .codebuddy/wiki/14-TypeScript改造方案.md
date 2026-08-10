# 14 TypeScript 改造方案

> 本文基于第 01-13 章的代码分析、`.codebuddy/rules/`（5 项规则 + 3 份参考）与 `.codebuddy/skills/`（4 个技能），回答两个问题：
> 1. **能否改造成 TypeScript？** —— 结论：**可以，且规则体系本就为 TS 设计**。
> 2. **如何改造？** —— 给出分阶段路线、目录结构、工程配置、模块映射与规范适配。
>
> 撰写时间：2026-08-04 | 更新：2026-08-05（**技术栈已确认为 TypeScript**，本方案即执行总纲） | 基准版本：v2.31.0（manifest）
>
> **技术栈约定**：项目后续以 TypeScript 为唯一技术栈（`strict`），`coding-standards/anti-pattern-rules.md` 的示例已全部 TS 化，新代码必须按 TS 编写，禁止新增 `.js` 文件。

---

## 14.1 可行性结论

**✅ 可以改造，且规则体系是天然支持方。**

| 维度 | 评估 | 依据 |
|------|------|------|
| 规则体系 | 5 项规则均以「Chrome 扩展 MV3 · TypeScript」为前提编写，`architecture` 的 globs 明确为 `src/**,lib/**,manifest.json,tsconfig.json` | `rules/global`、`rules/coding-standards`、`rules/architecture`、`rules/dev-workflow`、`rules/context-memory` |
| 构建链 | `build.mjs` 已用 **esbuild**（支持 TS 转译，仅需 loader 调整 + 类型检查步骤），无需换构建工具 | `build.mjs` + `package.json` |
| 代码规模 | 40+ 业务 JS 文件，绝大多数为 IIFE + `window.DevHome` 命名空间注入，结构整齐，便于逐文件迁移 | 第 01-13 章分析 |
| 依赖 | 有 `@tiptap`（自带类型）、`react`（自带类型）、`marked`（@types）、`dayjs`（自带类型）；**缺 `@types/chrome`** | `package.json` |
| 测试 | 当前用 Node 脚本测试；规则要求 vitest，需引入 | `package.json` scripts |
| 风险 | 全局命名空间模式（IIFE）迁移到模块化是最大工作量；样式体系保持原生 CSS（**不迁 vanilla-extract**） | 见 14.5 与 14.7 |

### 14.1.1 关键现实：规则与现状存在「代差」

项目规则体系是按**目标态**（TS + src/ + lib/ + tests/）编写的，而代码仍是**现状态**（JS + js/ + IIFE + Node 测试）。改造的本质是**让代码向规则体系收敛**。改造过程中需特别留意以下偏差：

| # | 规则/技能要求 | 项目现状 | 改造决策 |
|---|--------------|---------|---------|
| 1 | UI 样式用 vanilla-extract（`rules/global` §2 技术栈表） | **原生 CSS + Semantic Token**（`css/tokens.css` 等，无运行时框架） | ⚠️ **以项目实际 + `chrome-ext-ui-design-system` 技能为准：不引入 vanilla-extract**（该技能明确「无 vanilla-extract / Tailwind / Emotion」）。`rules/global` 技术栈表为模板残留，需修正规则 |
| 2 | 目录 `src/` + `lib/` + `tests/`（`architecture` §2） | `js/` 平铺 + IIFE | 分阶段迁入 `src/`（页面/后台/共享）与 `lib/`（纯逻辑），测试入 `tests/` |
| 3 | 消息协议判别联合 + zod（`architecture` §3/§8） | 裸字符串 `type` + 无运行时校验 | 新建 `src/shared/messages.ts` + `src/shared/guards.ts`，逐步收敛 |
| 4 | vitest 单测（`architecture` §9） | `node test/*.mjs` 脚本 | 引入 vitest，`tests/` 目录，老脚本保留过渡 |
| 5 | `tsc --noEmit` + eslint 类型检查 | 无 tsconfig，eslint 仅 `--ext .js` | 新增 tsconfig + typescript-eslint |
| 6 | `enum` 禁用（`tsconfig-reference`） | JS 无 enum | TS 后用 `as const` 字面量联合替代 |
| 7 | Native Host（`architecture` §5） | **项目无 Native Host** | 不适用，忽略该节 |
| 8 | Clerk 鉴权（`clerk-chrome-extension-patterns`） | 项目无登录鉴权（仅本地 API Key） | 该技能本任务不涉及，仅当未来加鉴权时启用 |

---

## 14.2 改造目标态目录结构

遵循 `architecture` §2 分层 + 模块边界红线，结合项目实际（无 Native Host、保持原生 CSS）：

```
Thrilled/
├── manifest.json                 # 指向构建产物
├── tsconfig.json                 # strict + noUncheckedIndexedAccess + bundler resolution
├── build.mjs                     # 改造为 esbuild TS 打包（替代 script 拼接）
├── eslint.config.js              # typescript-eslint strict
├── vitest.config.ts
├── package.json                  # 新增 typecheck/test:unit 脚本
│
├── src/
│   ├── background/               # Service Worker（唯一可信源）
│   │   ├── background.ts         # 原 js/background.js
│   │   ├── _pomodoro-core.ts     # 原 js/bg/_pomodoro-core.js
│   │   ├── _pomodoro-broadcast.ts
│   │   ├── _clip-capture.ts
│   │   ├── _task-notify.ts
│   │   └── _quotes.ts
│   ├── pages/                    # 扩展内 UI 页面
│   │   ├── index/                # 新标签页（原 index.html 的 script 归属）
│   │   │   ├── main.ts           # 原 js/main.js（boot 启动）
│   │   │   ├── tiles.ts          # 原 js/tiles.js
│   │   │   ├── categoryUI.ts     # 原 js/categoryUI.js
│   │   │   ├── search.ts / navigation.ts / linkOpener.ts
│   │   │   ├── wallpaper.ts / matrix-bg.ts / countdown.ts
│   │   │   └── ui/               # 原 js/ui/*（_context-menu/_settings-panel/_tile-editor）
│   │   ├── workbench/            # 原 js/workbench*.js + workbench_private/*
│   │   │   ├── workbench.ts / _quadrant-tasks.ts / _pomodoro.ts
│   │   │   ├── _calendar.ts / _dashboard.ts / _notes-workbench.ts
│   │   │   └── ai-chat.ts / ai-modules.ts / ai-providers.ts
│   │   ├── notes/                # 原 js/notes*.js + notes/*
│   │   │   ├── notes.ts / _notes-crud.ts / _notes-notebook.ts
│   │   │   ├── _notes-capture.ts / _notes-view.ts / _notes-editor.ts / _notes-filter.ts
│   │   │   └── tiptap-editor.ts  # 原 js/tiptap-editor.js
│   │   ├── events/               # 原 js/events/*（11 子模块）
│   │   ├── popup.ts / popup.html # 原 popup.html 脚本
│   │   └── sidepanel.ts / sidepanel.html
│   ├── shared/                   # 跨上下文（无 chrome.*，纯类型+纯函数）
│   │   ├── messages.ts           # 判别联合：全部 runtime 消息类型（原 12 章协议）
│   │   ├── storage.ts            # 存储键常量 + zod schema（原 storageV2.KEYS + 数据模型）
│   │   ├── types.ts              # Tile / Note / Task / Notebook / PomodoroState 等品牌类型
│   │   └── guards.ts             # zod schema 与类型守卫（safeParse 封装）
│   └── styles/                   # 保持原生 CSS（不迁 vanilla-extract）
│       └── (css/ 目录维持现状)
│
├── lib/                          # 纯逻辑（无 chrome.*，可 Node 单测）
│   ├── countWords.ts             # 原 notes/_notes-crud.js 字数统计
│   ├── cleanEmptyHTML.ts         # 原 notes/_notes-editor.js HTML 清理
│   ├── formatTaskTime.ts         # 原 _quadrant-tasks.js 时间格式化
│   ├── repairDefaultCategory.ts  # 原 utils.js 默认分类修复
│   ├── storage-optimistic-lock.ts# 原 storageV2 乐观锁纯逻辑
│   └── weather-map.ts            # 合并 weather/dailyGreetingCard 的 WMO 映射
│
├── tests/                        # vitest（与 lib/ 一一对应 + 消息协议穷尽性测试）
│   ├── countWords.test.ts
│   ├── messages.test.ts          # 判别联合穷尽测试
│   └── storage-optimistic-lock.test.ts
│
└── css/                          # 现状保持（原生 CSS + Token）
```

> 模块边界红线映射（`rules/global` §5）：
> - `src/shared/**` 只 import 类型与纯函数，禁止 `chrome.*` → 放置 messages/storage/types/guards。
> - `lib/**` 禁止 `chrome.*` → 纯逻辑独立成文件。
> - `src/background/**` 持 `chrome.*` 调用。
> - 跨进程只传可序列化 JSON。

---

## 14.3 工程配置改造

### 14.3.1 tsconfig.json（依据 `architecture/references/tsconfig-reference.md`）

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "node", "vitest/globals"],
    "skipLibCheck": true,
    "noEmit": true                 // 构建产物由 esbuild 生成
  },
  "include": ["src/**/*.ts", "lib/**/*.ts", "tests/**/*.ts"]
}
```

### 14.3.2 package.json 脚本与依赖

```jsonc
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "node build.mjs",                    // 改造 build.mjs 支持 TS
    "build:prod": "node build.mjs --prod",
    "test": "vitest run",                         // 新增
    "lint": "eslint src/ lib/ tests/ --ext .ts"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/chrome": "^0.x",
    "@types/node": "^22.x",
    "vitest": "^3.x",
    "zod": "^3.x"                                  // 运行时校验
  }
}
```

### 14.3.3 build.mjs 改造要点

当前 `build.mjs` 用 esbuild 将业务 JS **按顺序拼接**（IIFE 无法 tree-shake）。改造为 TS 后有两种模式：

**模式 A（推荐，渐进）**：`.ts` 文件仍写为 IIFE + `window.DevHome` 命名空间注入（改后缀、加类型注解），esbuild `loader: 'ts'` 转译后照旧拼接。**先获得类型检查收益，不改变运行时结构。**

**模式 B（彻底，Phase 3+）**：迁移为 ESM `import/export`，esbuild 以 `bundle: true` 从 `src/pages/index/main.ts` 入口打包，输出单文件 `js/bundle.js`。消息协议经 `src/shared/messages.ts` 共享。此模式解除 script 顺序依赖（第 11 章 60+ script 标签问题）。

建议：**先 A 后 B**（见 14.5 路线）。

### 14.3.4 eslint 配置（依据 `tsconfig-reference`）

```js
// eslint.config.js（flat config）
export default [
  { files: ['src/**/*.ts', 'lib/**/*.ts', 'tests/**/*.ts'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/strict'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': [{ selector: 'TSEnumDeclaration', message: '用 as const 字面量联合替代 enum' }]
    }
  }
];
```

---

## 14.4 模块级迁移映射（与第 01-13 章对应）

### 14.4.1 基础设施层 → 先迁（收益最大）

| 现状文件 | 目标 | 要点 |
|---------|------|------|
| `js/storageV2.js` | `src/shared/storage.ts` + `lib/storage-optimistic-lock.ts` | KEYS 常量 `as const`；乐观锁纯逻辑抽 `lib/`；数据模型 schema 入 `guards.ts` |
| `js/storage.js` / `js/dataService.js` | `src/shared/storage.ts` | 统一存储门面；消除双缓存体系 |
| `js/state.js` | `src/shared/state.ts` | `AppState` / `DomCache` 接口化，替代无类型全局对象 |
| `js/utils.js` | `lib/*` + `src/shared/types.ts` | `escapeHtml`/`sanitizeHtml`/`repairDefaultCategoryContent`/`getTileIdentity` 纯函数 |
| `js/config.js` | `src/shared/constants.ts` | `as const` 常量对象；集中散落魔法值 |
| `js/logger.js` | `lib/logger.ts` | 统一日志入口（收敛 console.*） |
| `js/icons.js` / `js/secrets.js` | `src/pages/index/icons.ts` / `src/shared/secrets.ts` | 类型化图标注册表；密钥读取接口化 |

### 14.4.2 消息协议 → 第二优先

| 现状 | 目标 | 关键类型 |
|------|------|---------|
| `background.js` onMessage switch | `src/shared/messages.ts` + `src/background/background.ts` | `ExtensionRequest = POMODORO_START \| POMODORO_PAUSE \| ...` 判别联合；`route()` 穷尽 switch + `never` 兜底；zod `safeParse` |
| `_pomodoro-broadcast.js` 长连接 | `messages.ts` 定义 `POMODORO_STATE` 消息 | 端口名 `'pomodoro'` 常量化 |
| 通知 id / alarm 名 | `src/shared/constants.ts` | `pomodoro-done` 等字面量联合 |

### 14.4.3 纯逻辑抽 `lib/`（可单测，优先落地）

- `countWords`（中英混排字数）、`cleanEmptyHTML`（HTML 清理）、`formatTaskTime`（相对时间）、`repairDefaultCategoryContent`（分类修复）、`computeRemaining`（番茄钟剩余推导）、`normalizeTask`（任务规范化）、`getDateGroupLabel`（日期分组）。

### 14.4.4 编排入口 → 最后迁移

`main.ts`（boot 6 Phase）、`workbench.ts`、`notes.ts`、`events.ts`（bindEvents）在依赖模块迁移完成后改后缀 + 类型化。

---

## 14.5 分阶段改造路线

### Phase 1 — 基建与类型落地（不改变运行时行为）

- [ ] 新增 `tsconfig.json`、`eslint.config.js`、`vitest.config.ts`，安装 `typescript/@types/chrome/@types/node/vitest/zod`。
- [ ] 建 `src/shared/` 骨架：`types.ts`（Tile/Note/Task/Notebook/PomodoroState/Behavior/Config）、`constants.ts`（KEYS/通知 id/alarm 名/快捷键常量）。
- [ ] **修正 `rules/global` 技术栈表**：UI 样式从「vanilla-extract」改为「原生 CSS + Semantic Token」（对齐 `chrome-ext-ui-design-system` 技能与项目实际）。
- [ ] 抽 `lib/` 纯函数并接 vitest 单测（`countWords`、`cleanEmptyHTML`、`formatTaskTime`、`computeRemaining` 等）。
- [ ] `build.mjs` 支持 `loader:'ts'`（模式 A），js 文件可逐步改 .ts。

> 质量门：`tsc --noEmit` + `vitest run` + `npm run build` 全绿，运行时行为不变。

### Phase 2 — 存储与消息协议类型化（正确性收益）

- [ ] `src/shared/messages.ts`：定义全部消息判别联合（对应第 12 章协议全集）+ `isExtensionRequest` 守卫 + zod schema。
- [ ] `background.ts` 路由改为穷尽 switch（`never` 兜底）+ `safeParse`。
- [ ] `storage.ts` 统一存储门面，数据模型 schema 化（读即校验），消除双写。
- [ ] 连续打卡幂等、任务通知持久化等 P0 正确性修复（见第 13 章）随迁移一起落地。

> 质量门：新增 `tests/messages.test.ts` 穷尽性测试；`tests/storage.test.ts` 迁移测试。

### Phase 3 — 模块化重构（结构收益）

- [ ] 迁移 `src/background/**`（bg 5 子模块合并类型化）。
- [ ] 迁移 `src/pages/index/**`、`src/pages/workbench/**`、`src/pages/notes/**`、`src/pages/events/**`，改 ESM + `build.mjs` 模式 B（bundle 入口打包）。
- [ ] 拆除 IIFE + `window.DevHome` 全局命名空间 → `import/export`（`main.ts` 统一 `export * from` 或按需导入）。
- [ ] `index.html` 60+ script 标签收敛为 bundle 产物（第 11 章问题 2 解决）。

> 质量门：`npm run build` 产物可在扩展中正常加载；`tsc --noEmit` 全绿。

### Phase 4 — 收尾

- [ ] 删除旧 `js/*.js`（备份后）；测试全量迁移 vitest。
- [ ] 文档同步（README、本 Wiki 更新）；`dev-workflow` 的 toolchain 更新脚本名。
- [ ] 版本升级（建议 +0.1.0，因构建体系变更）+ git 提交推送。

---

## 14.6 与 Skills 的协作方式（改造过程中）

| 阶段 | 需加载的 Skill | 用途 |
|------|---------------|------|
| 全程 | `coding-standard-workflow` | 总控编排：规则回顾 → 技能路由 → 编码 → 自检 → 记忆 → 提交（改造是大型重构，必须走其 8 步流水线） |
| Phase 1/2 | `typescript-advanced-types` | 判别联合消息协议、Branded Type（`TileId`/`NoteId`）、`as const` 常量表、类型守卫 |
| Phase 1/3 | `chrome-ext-ui-design-system` | 保持原生 CSS + Token 约束（防误引入 vanilla-extract）；HTML 结构拆分时遵循组件模式 |
| 不涉及 | `clerk-chrome-extension-patterns` | 项目无鉴权，**不加载** |

**Skill 落地约束**：
- 类型体操（判别式、模板字面量、条件类型）写在 `.ts` 内并加注释解释意图（`tsconfig-reference` AI 协作约定）。
- UI 改造遵循 `chrome-ext-ui-design-system`：**新 UI 禁止引入 React/Shadcn**（技能 §核心约束 7），遗留组件按对照表替换为原生 `ui-*`。
- 改造每个 Phase 结束按 `context-memory` 规则记录记忆条目；关键决策同步蒸馏 `MEMORY.md`。

---

## 14.7 需要特别注意的风险与决策点

| 风险 | 说明 | 应对 |
|------|------|------|
| **IIFE → ESM 迁移量大** | 60+ 文件全局命名空间互调，改 import/export 需逐文件调整 | 采用「模式 A（后缀化+类型）→ 模式 B（模块化）」两步，避免一步到位 |
| **vanilla-extract 规则冲突** | `rules/global` 技术栈表与 UI 技能/项目实际冲突 | 以 `chrome-ext-ui-design-system` 技能为准（它是项目定制版），并修正全局规则 |
| **`noUncheckedIndexedAccess` 报错多** | 大量 `arr[i]`、`obj[key]` 索引访问 | 改造早期开启会产生海量错误，建议 Phase 1 先 `strict`（含 strictNullChecks），`noUncheckedIndexedAccess` 放到 Phase 3 开启，避免淹没真实问题 |
| **`exactOptionalPropertyTypes` 严格** | `{foo?: string}` 不能赋 `foo: undefined` | 对 `noteIds`、`dueDate` 等可选字段需要 `undefined` 显式处理，属预期收益（修复隐性 bug） |
| **zod 引入范围** | 规则要求消息/storage 边界用 zod | 只在校验边界使用，不在渲染路径滥用（性能）；`lib/` 纯函数可用类型守卫代替 |
| **`chrome.runtime` 类型在注入脚本不可用** | 部分文件需区分上下文 | 按 `architecture` 分层，注入脚本用 `executeScript` 传 JSON |
| **构建产物与 manifest 路径** | manifest 引用 `js/background.js` 等 | 构建产物保持同路径输出（`js/bundle.js`），或更新 manifest 指向 `dist/` |

---

## 14.8 结论

- **可行性：高**。构建链（esbuild）已具备 TS 能力，规则体系本就以 TS 为目标态，最大障碍是 IIFE 命名空间 → 模块化的迁移工作量，可通过两阶段（类型化→模块化）控制风险。
- **收益**：编译期类型安全（存储模型、消息协议、DOM 缓存）、穷尽性消息路由、纯逻辑可单测、消除魔法值与裸字符串、为后续功能扩展（AI、更多工作台模块）提供类型地基。
- **符合规范**：改造全程遵循 `.codebuddy/rules/` 与 `.codebuddy/skills/`；唯一需要修正的是 `rules/global` 的 UI 样式技术栈表述（对齐项目实际与 UI 技能）。
