---
name: coding-standard-workflow
description: Chrome 扩展（MV3 · TypeScript）全流程编码工作流编排 Skill。当用户要求编写代码、开发功能、修复 Bug、重构模块或进行任何代码修改时加载本 Skill。它会自动编排「上下文回顾 → 规则加载 → 技能选择 → 编码执行 → 环境自检 → 上下文记忆 → 提交」全流程，串联 .codebuddy/rules/global/、.codebuddy/rules/、.codebuddy/skills/ 等所有规范体系。
---

# Coding Standard Workflow — 全流程编码工作流

> 本 Skill 是开发流程的**总控编排器**。加载后自动执行标准化编码工作流，串联根目录 `.codebuddy/rules/global/`、`.codebuddy/rules/` 下所有规则、`.codebuddy/memory/` 上下文记忆以及各领域子 Skill，确保每次修改有章可循、有迹可查。

---

## 触发条件

当用户提出以下需求时加载本 Skill：

| 场景 | 示例 |
| --- | --- |
| 新增功能 | "新增一个 X 功能"、"实现 X 页面" |
| 修复 Bug | "修复 X Bug"、"X 不工作了" |
| 代码重构 | "重构 X 模块"、"优化 X 代码结构" |
| 配置变更 | "添加新依赖"、"修改构建配置" |
| 内容为"写代码"、"帮我开发"、"开始编码"等泛化表达 | |
| 需要串联多个子任务时 | 自动编排，而不是手动分别加载各 Skill |

---

## 1. 工作流总览

加载本 Skill 后，自动按以下 8 步流水线执行：

```
STEP 1 ─ 上下文回顾
        读取 .codebuddy/memory/MEMORY.md + 最近日志，了解项目背景与决策历史

STEP 2 ─ 规则确认
        .codebuddy/rules/global/ 与 coding-standards / context-memory 规则由 CodeBuddy 自动加载；
        按需确认 architecture（模块/协议）与 dev-workflow（流程/提交）规则

STEP 3 ─ 技能路由
        根据任务类型自动加载子 Skill：UI / 类型 / 鉴权

STEP 4 ─ 方案设计
        跨上下文边界检查（消息协议、存储、权限）

STEP 5 ─ 编码执行
        遵循模块边界红线，类型安全，UI 引用 vars.*，所有边界加运行时校验

STEP 6 ─ 环境自检
        语法检查 → 类型检查 → 单元测试 → Lint

STEP 7 ─ 上下文记忆
        按 context-memory 规则在 .codebuddy/memory/ 当日日志追加记忆条目

STEP 8 ─ 提交流程
        提交前 checklist → Conventional Commit → git commit
```

---

## 2. 各步骤详细操作

### STEP 1 — 上下文回顾

**操作**：

1. 读取 `.codebuddy/memory/MEMORY.md`（长期记忆：技术栈、关键决策、长期待办）。
2. 读取 `.codebuddy/memory/` 下最近 1-2 天的日志（`YYYY-MM-DD.md`），关注：
   - 关键决策（避免重复讨论）
   - 待办/遗留问题（可能需要延续处理）
   - 涉及文件与模块（了解当前代码变动范围）
3. 如果本次任务与某条记忆直接相关（如继续未完成功能），完整读取该条内容。

**输出**：AI 在回答中简述 "根据历史上下文，了解到……"。

### STEP 2 — 规则确认

**操作**：CodeBuddy 会自动加载全局与常驻规则，本步骤只需按需补充：

| 顺序 | 规则 | 加载方式 | 提取要点 |
| --- | --- | --- | --- |
| 1 | `.codebuddy/rules/global/`（根目录） | **自动加载** | 环境约束、技术栈、模块边界红线、编码核心约束 |
| 2 | `.codebuddy/rules/coding-standards/` | **常驻（alwaysApply）** | 类型安全原则、命名约定、禁止魔法值、外部输入校验、错误/日志体系 |
| 3 | `.codebuddy/rules/architecture/` | glob 自动附加 / 按需读取 | MV3 分层架构、目录结构、消息协议、存储规范、反模式红线 |
| 4 | `.codebuddy/rules/dev-workflow/` | 相关性自动引入 / 按需读取 | 当前阶段对应流程、提交前 checklist |
| 5 | `.codebuddy/rules/context-memory/` | **常驻（alwaysApply）** | 记忆条目模板与执行时机 |

> 现有规则已覆盖全部约束，**无需在 SKILL.md 中重复定义**，仅引用即可。
> 注意：涉及 UI 时，`chrome-ext-ui-design-system` 中的约束（引用 `vars.*`、禁止运行时 CSS、内联 SVG 图标等）通过 STEP 3 子 Skill 落地。
> 需要项目背景知识（架构说明、平台适配、协议 spec）时查阅 `.codebuddy/wiki/`。

> ⚠️ **禁止重复读取常驻规则**：`global/`（alwaysApply）、`coding-standards/`（alwaysApply）、`context-memory/`（alwaysApply）已由系统在**每一轮**自动注入上下文。本工作流**不得**再用 `read` 工具重新打开这些 `RULE.mdc` / 规则文件——直接引用即可，避免上下文双份注入与重复 token 消耗。
> ⚠️ **禁止重复读取记忆文件**：`MEMORY.md` 与当日日志已通过 CodeBuddy 记忆机制注入上下文。STEP 1 **不得**再用 `read` 重新打开这些文件；仅在需要追溯某条历史条目的完整细节时，才读取对应 `YYYY-MM-DD.md`。
> `architecture/`、`dev-workflow/` 等按需规则仅在任务相关性命中时才读取，不要无差别预读。

### STEP 3 — 技能路由

**操作**：根据任务类型，自动加载对应的子 Skill：

```
                    ┌────────────────────┐
                    │  任务类型判断        │
                    └────────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     UI 相关         类型/协议相关      鉴权相关
     ↓               ↓               ↓
  chrome-ext-ui-    typescript-      clerk-chrome-
  design-system     advanced-types   extension-patterns
```

| 任务特征 | 加载的 Skill |
| --- | --- |
| 涉及 HTML/CSS/页面/弹窗/图标/样式 | `chrome-ext-ui-design-system` |
| 涉及消息协议/类型定义/跨上下文通信 | `typescript-advanced-types` |
| 涉及用户登录/鉴权/令牌管理 | `clerk-chrome-extension-patterns` |
| 同时涉及 UI + 类型（如新增页面+消息协议） | `chrome-ext-ui-design-system` + `typescript-advanced-types` |

子 Skill 加载后，按各自 SKILL.md 中的 SOP 执行。

### STEP 4 — 方案设计

**操作**：依据 `architecture` 规则的分层架构，完成以下检查：

**中大型改动（涉及多个模块、跨进程通信、存储结构变更）**：
- [ ] 消息协议设计：在 `src/shared/messages.ts` 中定义/扩展判别联合
- [ ] 品牌类型设计：在 `src/shared/types.ts` 中定义新的 Branded Type
- [ ] 存储结构设计：确认 `chrome.storage` schema 变更
- [ ] 权限评估：确认是否需要新增 `manifest.json` 权限
- [ ] 迁移方案：存储结构变更时设计数据迁移
- [ ] 方案记录：在 `.codebuddy/memory/` 当日日志中记录设计方案

**小型改动**（单文件、不涉及跨上下文通信）：
- 直接进入 STEP 5 编码阶段。

**跨上下文边界 checklist**（来自 `dev-workflow` 规则 3.2 节）：
- [ ] 消息体是否在 `src/shared/messages.ts` 中定义了判别联合？
- [ ] 是否在接收侧写了 switch 穷尽校验（`never` 兜底）？
- [ ] `payload` 是否只含可序列化数据？
- [ ] 是否在消息边界做了运行时类型守卫（`zod` `safeParse`）？
- [ ] 是否遵循 Branded Type（`SessionId`、`FilePath` 等）？
- [ ] `Result<T, E>` 是否处理了 `ok: false` 分支？

### STEP 5 — 编码执行

**操作**：在编码过程中严格执行以下约束：

**模块边界红线**（编码时逐行检查）：
```
✅ lib/**            — 不引用 chrome.*
✅ src/shared/**     — 不引用 chrome.*
✅ injected/**       — 纯函数，不引用 chrome.runtime，不持有状态
✅ Popup             — 不直连 Native Host，不缓存跨期会话
✅ Background        — 状态用 chrome.storage，不用模块级可变变量假设永久存活
✅ 跨进程传递        — 仅可序列化 JSON，不传函数/DOM/Map/Set
✅ 消息协议          — 判别联合，不用 any 或裸 string type
```

**编码规范**（来自 `coding-standards` 规则）：
- `unknown` 优于 `any`，外部输入用类型守卫收窄
- 禁止魔法值，所有常量提为具名常量
- 外部输入（消息体、DOM 取值、JSON 解析）先 `zod.safeParse` 或类型守卫
- 统一异常体系（`src/lib/errors.ts`），禁止 `throw "xxx"`
- 统一日志入口（`src/lib/logger.ts`），禁止 `console.*` 散落

**UI 约束**（来自 `chrome-ext-ui-design-system`，仅当 STEP 3 加载了该 Skill）：
- 颜色/间距/字号引用 `vars.*`，不写死字面量
- 仅 vanilla-extract 编译期 CSS，不引入运行时方案
- 图标用内联 SVG（`currentColor`）
- 动画加 `prefers-reduced-motion` 兜底

### STEP 6 — 环境自检

**操作**：编码完成后，按以下顺序执行验证：

```
1. 语法检查       → 对应项目的 check 命令（如 tsc --noEmit）
2. 类型检查       → tsc --noEmit
3. 单元测试       → npm test
4. Lint 检查      → eslint（如配置）
```

**通过标准**：全部通过，无 Error。

**失败处理**：
- 语法/类型错误：定位修复 → 重新检查
- 测试失败：分析失败原因 → 修复代码或补充测试 → 重新运行
- Lint 警告/错误：按规则修复 → 重新检查

> 每轮修复最多 3 次，第 3 次仍未通过则输出错误摘要请求人工介入。

### STEP 7 — 上下文记忆

**操作**：按 `.codebuddy/rules/context-memory/` 规则执行。**会话内仅累积要点、会话结束统一落盘**（每轮写文件会使注入的系统提示词前缀变化，拉低缓存命中率）：

1. **会话内（每完成一个任务）**：仅在本轮回复中简述要点，将「任务标题 / 关键决策 / 变更摘要 / 待办 / 质量门」暂存于上下文，**不调用写文件工具**。
2. **会话结束（用户收工 / 要求记录 / 对话收尾）**：将本会话累积的所有要点**一次性追加**到 `.codebuddy/memory/YYYY-MM-DD.md`（当日日志，不存在则创建）：

```markdown
## HH:mm - <任务标题>（<feat|fix|refactor|chore|...>）

### 任务描述
...

### 关键决策
1. **决策**：...
   **原因**：...
   **替代方案**：...

### 变更摘要
- [新增/修改/删除] path — 说明

### 影响范围
- 消息协议变更？是/否；存储结构变更？是/否；权限变更？是/否

### 待办/遗留问题
- [ ] ...

### 质量门
- tsc / vitest / build 结果
```

3. 项目级关键决策（架构选型、协议变更等）同步蒸馏进 `.codebuddy/memory/MEMORY.md`（原地更新，保持精炼；可在会话末统一处理）。

**不需要单独记录的场景**：仅拼写/格式修复、仅注释变更、单文件微调；这类琐碎改动也不必在会话内即时落盘，合并到会话末即可。

### STEP 8 — 提交流程

**操作**：按 `dev-workflow` 规则 3.5 节执行：

**提交前 checklist**：
- [ ] 代码通过语法/类型检查
- [ ] 测试通过
- [ ] 无 Lint 警告/错误
- [ ] 未违反模块边界红线
- [ ] 所有外部输入已做空值/类型校验
- [ ] 消息协议如有变更，已更新 messages.ts 并添加类型守卫
- [ ] 存储结构如有变更，已设计迁移方案
- [ ] UI 样式引用 vars.* Token，未写死字面量
- [ ] 未引入运行时 CSS 方案
- [ ] 无 console.* 残留
- [ ] 无直接 throw 非业务异常
- [ ] 已在 .codebuddy/memory/ 当日日志追加记忆条目

**Commit 格式**：
```
<type>(<scope>): <简短描述>
```
- type: feat / fix / refactor / style / test / docs / chore / perf

**完成后输出使用清单**（对齐全局规则第 8 节）：AI 在回应的收尾处**必须列出本次实际生效 / 使用的规则与技能名称**，便于审计上下文来源与积分消耗。包含：
- **常驻规则（alwaysApply）**：`.codebuddy/rules/global/`、`coding-standards/`、`context-memory/`（每轮自动注入，列出以明示）。
- **按需引入的规则**：本次实际读取/引用的 `architecture`、`dev-workflow` 等（未命中则不列）。
- **加载的技能**：本次实际调用的 Skill（如 `coding-standard-workflow`、`chrome-ext-ui-design-system`、`typescript-advanced-types`、`clerk-chrome-extension-patterns`）。
- **未使用的排除项**：被显式禁用或本次未触发的场景规则 / MCP（如本项目已禁用的 `yunshu-mcp`、`ssh-server-agent`，或未触发的 `design-to-code`），可一行注明「未使用」。
- **格式**：回复末尾以简短列表呈现，仅列名称 + 一句话用途，不展开全文。

---

## 3. 文件交互汇总

| 操作 | 读取 | 写入 |
| --- | --- | --- |
| STEP 1 | `.codebuddy/memory/MEMORY.md`, `.codebuddy/memory/YYYY-MM-DD.md` | — |
| STEP 2 | `.codebuddy/rules/global/`, `.codebuddy/rules/*/RULE.mdc`（多为自动加载） | — |
| STEP 3 | `.codebuddy/skills/*/SKILL.md` | — |
| STEP 4 | `src/shared/messages.ts`, `manifest.json` | `.codebuddy/memory/YYYY-MM-DD.md`（中大型方案） |
| STEP 5 | 对应源代码文件 | 源代码文件 |
| STEP 6 | — | 检查命令输出 |
| STEP 7 | `.codebuddy/rules/context-memory/RULE.mdc` | `.codebuddy/memory/YYYY-MM-DD.md`（+ 必要时 `MEMORY.md`） |
| STEP 8 | — | git commit |

---

## 4. 与各规则/技能的关系

```
                        coding-standard-workflow（总控编排）
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
      .codebuddy/rules/global/      .codebuddy/rules/    .codebuddy/skills/
      （全局入口，       ├─ coding-standards   ├─ chrome-ext-ui-design-system
       自动加载）        ├─ architecture       ├─ typescript-advanced-types
                        ├─ dev-workflow       └─ clerk-chrome-extension-patterns
                        └─ context-memory

            ▲                  ▲
            └──────────────────┘
              .codebuddy/memory/（持久化记忆：MEMORY.md + 每日日志）
              .codebuddy/wiki/（项目知识库）
```

- **`coding-standard-workflow`**：工作流总控，不重复定义规则，只编排和引用。
- **`.codebuddy/rules/`**：存放所有具体规则，由 CodeBuddy 自动加载（常驻/glob/相关性），本 Skill 按步骤引用。
- **`.codebuddy/skills/`**：存放各领域子 Skill，由本 Skill 按任务类型按需加载。
- **`.codebuddy/memory/`**：持久化上下文记忆，由本 Skill 的 STEP 1 读取、STEP 7 写入。
- **`.codebuddy/wiki/`**：项目知识库（架构、平台适配、协议 spec），需要背景知识时查阅。

---

## 5. AI 协作约定

AI 执行本 Skill 时：

1. **每步完成后输出简短状态**：如 "STEP 1 ✓ 已读取长期记忆与最近日志"
2. **关键决策在 STEP 7 中记录**：不直接在对话中长篇幅重复讨论
3. **遇到红线约束直接拦截**：如检测到 `lib/` 引用 `chrome.*`，立即指出并修复
4. **按需跳过**：如果任务不涉及 UI，STEP 3 路由自动跳过 UI Skill；如果任务仅修复拼写，可跳过 STEP 4/6/7
5. **环境自检失败时**：输出清晰的错误定位，最多自动重试 3 次修复
