# 全局 Agent 规则

> **速览**：编码用 UTF-8，Shell 用 PowerShell 7，路径用相对路径。先理解项目再动手，不改任务范围外代码。安全第一，中文注释，输出可追溯。

---

## 1. 硬性环境约束

- 文件编码固定使用 UTF-8，不得修改为 GBK、ANSI 或其他编码。
- PowerShell 固定使用 PowerShell 7，不得使用 Windows PowerShell 5。
- 执行命令前，优先确认当前终端、路径、编码与项目环境。
- 涉及到文件路径时，优先使用相对路径，避免硬编码绝对路径。

---

## 2. 指令优先级

当多级规则发生冲突时，按以下优先级裁决：

1. 用户在当前会话中的**明确要求**（最高优先级）
2. 当前项目根目录及各子目录中的 `AGENTS.md`（项目级规则）
3. 项目已有文档、代码风格、目录结构、命名约定（隐性规则）
4. 本全局 `AGENTS.md`（兜底规则）

> 说明：
> - 本文件定义通用工程纪律、环境约束、默认行为与沟通规则。
> - 项目级 `AGENTS.md` 负责该项目的具体实现规则。
> - 若项目规则与本文件冲突，**除硬性环境约束外**，优先执行项目规则。

---

## 3. 默认工作方式

- **质量优先，最短路径**：默认采用满足质量要求的最短实现路径。
- **轻量执行**：小任务默认轻量处理，不引入不必要的流程。
- **按需启用 Skill**：skill 仅在与当前任务高度相关时加载，避免过度激活。
- **不改任务范围外代码**：不做与任务无关的重构，不修改任务未涉及的文件。
- **先理解，再行动**：执行前先阅读项目 AGENTS.md 和相关代码，确保理解上下文。

---

## 4. 任务分类与执行纪律

### 4.1 只读任务

以下类型任务可直接处理，无需额外验证流程：

- 代码解释
- 架构分析
- 报错定位
- 命名建议
- 文档分析
- 只读排查

**要求**：

- 结论必须清晰，不能含糊其辞
- 根因必须可追溯，引用具体代码行或日志
- 不得虚构验证结果，不确定的信息必须标注"未经验证"

### 4.2 实现任务

涉及以下内容时，必须执行完整验证流程：

| 类型 | 示例 |
|------|------|
| 新功能 | 新增模块、页面、组件 |
| Bug 修复 | 修复逻辑错误、UI 异常 |
| 行为变更 | 修改现有功能的行为或返回值 |
| 重构 | 代码结构调整、模块拆分 |
| API 修改 | 接口签名变更、参数增减 |
| 数据处理 | SQL 逻辑、数据迁移、存储格式变更 |

**实现任务验证步骤**：

1. **范围确认**：明确改动范围，列出受影响的文件和模块
2. **影响评估**：分析变更的连锁影响（上游调用方、下游数据消费者）
3. **回归检查**：检查是否影响已有功能，尤其是边界条件
4. **注释同步**：确保中文注释与代码行为一致
5. **文档同步**：如果涉及 README、SPEC、API 文档，同步更新
6. **lint 检查**：修改后检查文件是否有新增 lint 错误

---

## 5. 代码与注释规范

### 5.1 通用原则

- 保持项目原有代码结构、风格与命名约定。
- 不引入项目原本不存在的第三方依赖，除非任务明确需要。
- 不硬编码密钥、Token、密码、凭证等敏感信息。
- 数据库访问必须使用参数化查询，禁止拼接 SQL。

### 5.2 中文注释要求

生成或修改 JS、CSS、Java 等代码时，必须补充以下类型注释：

| 必须注释的内容 | 说明 |
|---------------|------|
| 方法业务用途 | 这个方法做什么，为什么存在 |
| 关键变量含义 | 核心变量的业务语义 |
| 核心业务逻辑 | 复杂算法、状态机、判断链的意图 |
| 状态流转原因 | 状态变化的前置条件和触发理由 |
| 外部调用原因 | 为什么要调这个外部 API / 第三方服务 |
| 字段/表单/子表含义 | 数据模型中字段的中文业务含义 |

**禁止**：

- 空洞翻译式注释（如 `// set name` 在 `setName()` 旁边）
- 无意义逐行注释（每行都加，掩盖代码可读性问题）
- 用注释掩盖混乱代码（代码本身逻辑不清时，先重构，再注释）

---

## 6. 验证规则

- **不得虚构执行结果**：未实际执行的操作不得声称"已完成""已验证"。
- **未验证不得声称可交付**：未经实际验证，不得声称"可提交""可合并""没问题"。
- **验证受阻必须报告**：关键验证无法执行时，必须向用户明确说明原因和阻塞点。
- **修改后必查清单**：
  1. 功能影响范围
  2. 回归风险
  3. 中文注释完整性
  4. 相关文档是否需要同步

---

## 7. 安全规则

- 不运行 `rm -rf`、`del /f /s` 等危险删除命令（除非用户明确要求且已确认路径）。
- 不执行 `git reset --hard`、`git push --force` 等破坏性 Git 命令，除非用户明确要求。
- 不直接修改 `.git` 目录内容（使用 `git` 命令本身操作）。
- 不拼接不可信输入到 shell 命令或 SQL 语句。
- 不终止非当前任务产生的系统进程。

---

## 8. 沟通与输出

| 规则 | 说明 |
|------|------|
| 默认语言 | 简体中文 |
| 技术术语 | 可使用英文（如 API、SQL、Git） |
| 代码标识符 | 保持英文原名，不得翻译 |
| 执行类任务输出 | 强调：当前动作 → 进度 → 验证结果 |
| 分析类任务输出 | 强调：结论 → 根因 → 依据 → 风险 |
| 透明声明 | 回答末尾标注本次使用了哪些关键规则或 skill |

---


## 9. 代码输出标准

请基于以下"行数阶梯"（排除空行和注释后的有效代码行数 NCLOC）来评估代码：

| 级别 | 行数 | 判定 |
|------|------|------|
| 🟢 绿色·健康 | < 300 行 | 逻辑紧凑，结构清晰。 |
| 🟡 黄色·预警 | 300 - 500 行 | 允许存在，但需警惕职责膨胀。 |
| 🟠 橙色·超标 | 500 - 800 行 | PR 需重点说明理由，原则上禁止新增逻辑，应建议拆分。 |
| 🔴 红色·技术债务 | > 800 行 | 必须强制重构和拆分。 |

> **例外**：纯配置文件（JSON / YAML）、i18n 语言包、机器自动生成代码（Protobuf / ORM 生成物）不计入此限制。

## 拆分规则（防文件爆炸铁律）

在建议拆分文件时，严格遵循以下平衡原则，禁止为凑行数而盲目拆分：

1. **复用性才拆分**：只有当某段逻辑在 **2 个或更多地方**使用时，才允许拆成公共文件（如 `utils/`、`helpers/`）。仅当前文件内部复用的私有函数，必须保留在原文件内。
2. **领域独立性才拆分**：某段逻辑（如页面内复杂子表单）虽不复用，但业务边界完全独立，允许抽离为同级目录下的子模块/子组件。
3. **物理邻近原则**：拆分出的子模块必须存放在与主文件同级的**私有目录**中（如 `_components/` 或 `_helpers/`），不得跨目录污染全局结构。

### 工作流程

当用户提交代码、类或模块给此角色审查时，按以下步骤执行：

1. **体积审计**：计算/预估当前代码的有效行数，给出所属的颜色级别。
2. **单一职责检查**：分析该文件目前承担了多少个职责。是否存在逻辑混杂（如 UI 视图里混杂大量网络请求和数据转换）？
3. **重构决策与落地引导**：
   - 若文件在 🟢/🟡 区间且职责单一 → 给予肯定，建议保持现状。
   - 若文件在 🟠/🔴 区间，或行数少但职责杂乱 → 提供重构方案：
     - 说明为什么要拆（指明代码坏味道）
     - 明确指出哪些部分应抽离（对应哪条拆分铁律）
     - 给出符合物理邻近原则的新目录树结构
     - 提供拆分后的核心代码片段示例

### 架构问题剖析
- [指出代码中的多余职责、代码坏味道、或潜在的冲突隐患]

### 推荐重构方案
- **目录结构调整**：
```
[用树状图展示拆分后的物理目录，展示如何避免文件爆炸]
```

## 10. 弹窗规范（禁止原生弹窗）

**强制**：项目中一律禁止使用浏览器原生弹窗（`alert()`、`confirm()`、`prompt()`）。

| 需求 | 替代方案 |
|------|---------|
| 确认操作 | `ns.showConfirm(message, opts)` → 返回 `Promise<boolean>` |
| 提示/错误通知 | `ns.showToast(message, type)` → 自动消失的 toast 通知 |
| 输入文本 | `ns.showPrompt(message, opts)` → 返回 `Promise<string|null>` |

**理由**：
- 原生弹窗破坏视觉一致性，在专注模式（暖纸主题）下尤其突兀
- 原生弹窗阻塞整个浏览器线程，用户体验极差
- 自定义弹窗支持键盘操作（Enter/Esc），样式跟随主题

## 11. 交互日志规范（控制台调试铁律）

**强制**：所有涉及用户交互的功能模块，必须在控制台输出结构化日志。

### 11.1 必须打日志的场景

| 场景 | 级别 | 示例 |
|------|------|------|
| 点击按钮/菜单项（工具栏、右键菜单、徽章等） | `[交互]` | `console.log('[交互] 点击工具栏 加粗')` |
| 弹出/关闭面板（颜色面板、选择器、弹窗） | `[面板]` | `console.log('[面板] 打开颜色面板')` |
| 格式/内容变更（execCommand、保存笔记） | `[编辑]` | `console.log('[编辑] 应用颜色 #ff0000')` |
| DOM 元素未找到（静默失败高危） | `[警告]` | `console.warn('[警告] #wbColorPalette 不存在')` |
| 异步操作失败 | `[错误]` | `console.error('[错误] 保存笔记失败', err)` |
| 模式切换 | `[模式]` | `console.log('[模式] 进入专注模式')` |

### 11.2 日志格式要求

- 统一前缀：`[分类]` 中文标签，一眼可识别来源
- 带关键参数：如 `[交互] 点击标题下拉 选中 h2`
- 带 DOM 信息：如 `[面板] 打开颜色面板 按钮坐标(200, 300)`
- **函数入口和出口**：关键函数开头和结尾输出 `[函数名] 开始/完成`

### 11.3 防死循环规则

- **不得**在 `scroll`、`resize`、`mousemove`、`input` 等高频事件回调中无条件输出日志
- 高频事件如需日志，必须做节流：`if (Date.now() - lastLog > 500) { console.log(...); lastLog = Date.now(); }`
- `setInterval` / `requestAnimationFrame` 回调中**禁止**输出日志（Matrix 数字雨渲染等）
- 自动保存（防抖 800ms）只打一次日志，不打每次 input

### 11.4 日志开关

- 所有日志统一用 `console.log/warn/error`，不引入第三方日志库
- 生产环境可保留日志（Chrome 扩展开发阶段需要排查问题），不做编译剔除

---

## 版本更新

### 版本规则
- 一个小问题就更新一个小版本。版本加0.0.1，写好更新注释。
- 多个问题就更新一个中版本。0.1.0，写好更新注释。
- 一个大问题就更新一个大版本。1.0.0，写好更新注释。
- 其中10个小版本升级成一个中版本，10个中版本升级成一个大版本。
- 每次更新一个中版本或者大版本，原有的小版本或者中版本都开始从0计算。

## git同步
- 每次代码修改完成后，执行版本号更新操作，并确保当前版本不存在任何已知问题。验证无误后，自动将代码及版本信息同步提交并推送到Git仓库。

---

## 12. Shadcn/ui 组件规范

本项目引入 **Shadcn/ui** 组件库（配合 React 18 + Tailwind CSS），用于弹窗、按钮等 UI 组件的标准化。

### 12.1 目录结构

```
└── js/
    ├── lib/
    │   ├── react.production.min.js       # React 18 生产构建
    │   └── react-dom.production.min.js    # ReactDOM 18 生产构建
    ├── components/
    │   └── ui/                           # Shadcn 组件源码（JSX）
    │       ├── README.md                 # 组件使用说明
    │       ├── button.jsx                # Button 组件
    │       └── dialog.jsx                # Dialog 组件
    └── ui-components/                    # esbuild 编译产物（JS，可直接引用）
        ├── button.js
        └── dialog.js
```

### 12.2 安装与编译

```bash
# 首次使用：安装依赖
npm install

# 下载 React 生产构建到 js/lib/
node scripts/install-react.mjs

# 编译 JSX 组件 → js/ui-components/
npm run build:components
```

### 12.3 页面引入方式

```html
<link rel="stylesheet" href="css/tailwind-base.css">
<script src="js/lib/react.production.min.js"></script>
<script src="js/lib/react-dom.production.min.js"></script>
<script src="js/ui-components/button.js"></script>
```

### 12.4 使用组件

```javascript
// 在页面中创建 React 挂载点
const root = ReactDOM.createRoot(document.getElementById('modalRoot'));

// 使用 Shadcn Button
root.render(React.createElement(window.ShadcnButton, {
    variant: 'default',  // default | destructive | outline | secondary | ghost | link
    size: 'default',     // default | sm | lg | icon
    onClick: function () { console.log('clicked'); }
}, '按钮文字'));

// 使用 Shadcn Dialog
root.render(React.createElement(window.ShadcnDialog.Dialog, { open: true },
    React.createElement(window.ShadcnDialog.DialogOverlay),
    React.createElement(window.ShadcnDialog.DialogContent, null,
        React.createElement(window.ShadcnDialog.DialogHeader, null,
            React.createElement(window.ShadcnDialog.DialogTitle, null, '标题')
        ),
        React.createElement(window.ShadcnDialog.DialogFooter, null,
            React.createElement(window.ShadcnButton, { variant: 'outline' }, '取消')
        )
    )
));
```

### 12.5 添加新 Shadcn 组件

1. 从 [shadcn/ui 官网](https://ui.shadcn.com) 找到需要的组件
2. 复制源码到 `js/components/ui/<组件名>.jsx`
3. 将 Tailwind class 替换为项目 CSS 变量：
   - `bg-background` → `var(--color-bg)`
   - `text-foreground` → `var(--color-text)`
   - `bg-primary` → `var(--color-accent)`
   - `border-border` → `var(--color-border)`
   - `bg-destructive` → `var(--color-danger)`
4. 将组件暴露到全局 `window.ShadcnXxx`
5. 运行 `npm run build:components`
6. 在页面中引入编译产物即可使用

### 12.6 主题 CSS 变量映射

| Shadcn Token | 项目 CSS 变量 | 说明 |
|--------------|-------------|------|
| `--background` | `--color-bg` | 页面背景 |
| `--foreground` | `--color-text` | 文字颜色 |
| `--card` | `--color-bg-elevated` | 卡片/弹窗背景 |
| `--primary` | `--color-accent` | 主色调 |
| `--secondary` | `--color-bg-secondary` | 次要背景 |
| `--destructive` | `--color-danger` | 危险操作色 |
| `--border` | `--color-border` | 边框色 |
| `--input` | `--color-input-bg` | 输入框背景 |
| `--ring` | `--color-accent` | 聚焦环颜色 |

### 12.7 与现有弹窗的关系

- **Shadcn Dialog** → 用于需要 React 交互的复杂弹窗（如磁贴编辑等未来功能）
- **wb-confirm / wb-prompt** (原生 JS) → 当前项目中的确认/输入弹窗继续保留，两者共存
- 新弹窗优先使用 Shadcn Dialog，旧弹窗逐步迁移


## 测试
针对所有功能代码，请编写并执行全面的测试体系，具体包含：单元测试、自动化测试、功能测试、非功能测试、回归测试、环境测试、安全测试、代码静态分析、边界值与“幻觉”测试以及覆盖率检查。请为上述每一项测试类型分别生成独立的测试报告，并将所有报告文件统一输出至项目根目录下的 `test/docs` 文件夹中。