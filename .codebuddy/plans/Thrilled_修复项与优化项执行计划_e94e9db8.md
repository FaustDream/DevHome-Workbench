---
name: Thrilled 修复项与优化项执行计划
overview: 执行任务清单中的全部修复项（F1-F9）与优化项（O1-O6、O10），新增功能（时钟/待办/在线壁纸）单独列为建议项待用户确认。
todos:
  - id: f1-type-errors
    content: 修复 3 个类型错误：在 types.ts 定义导出 LinkOpenType，重写 background.ts 的 never 收窄为早返回，删除 file-config.ts 未使用导入，确保 tsc --noEmit 通过
    status: completed
  - id: f2-import-fix
    content: "修复导入备份数据断链：export.ts 中让 data-setting-action=importData 按钮触发 #importInput.click()"
    status: completed
  - id: f3-countdown-add
    content: 为倒计时补充添加入口：countdown.ts 新增 addCountdown 函数，通过设置面板或按钮弹出添加表单并持久化
    status: completed
  - id: f4-edit-mode
    content: 补上编辑模式入口：新增切换入口联动 state.tileEditMode 与 categoryEditMode，使磁贴/分类删除按钮可见
    status: completed
  - id: f5-auto-theme
    content: 补上自动跟随系统主题选项：index.html 新增 auto 主题卡片，settings-panel.ts 接入 setAutoFollowSystem
    status: completed
  - id: f6-dead-switches
    content: 让失效开关生效：search.ts 读取搜索建议/保留/隐藏按钮开关，main.ts 接入自动聚焦，settings-panel.ts 接入 anim_reduce
    status: completed
  - id: f7-copy-custom-icon
    content: "补上磁贴复制菜单项与自定义图标上传：右键菜单加复制项，新增更换图标入口走 createModal + #tileImageInput"
    status: completed
  - id: f8-category-touch
    content: 修复分类触屏拖拽：category-ui.ts 的 attachCategoryDrag 补充 touch 事件
    status: completed
  - id: f9-wheel-scope
    content: "修复滚轮翻页误触：main.ts 将 wheel 监听从 document 移到 #tilesContainer"
    status: completed
  - id: o1-weather-dedup
    content: 清理 weather 重复常量与类型：删除 constants.ts 的 WEATHER_* 系列与 types.ts 的 WeatherData
    status: completed
  - id: o2-state-residual
    content: "清理 state.ts 时钟残留：删除 lastMinute/lastDate 字段与 #timeMain/#dateDisplay 注册项"
    status: completed
  - id: o3-engine-html
    content: "清理 index.html 硬编码引擎选项：删除 8 个 .engine-option，仅保留 #engineDropdown 容器"
    status: completed
  - id: o4-dead-ui
    content: 移除设置面板死 UI：删除布局/视图缩放/图标/字体/动画效果五块，保留 animReduceToggle 与有效区块
    status: completed
  - id: o5-engine-keys
    content: 精简数字键切换引擎：events/index.ts 动态按 ENGINES.length 匹配数字键
    status: completed
  - id: o6-favicon-link
    content: 改进 favicon 解析：favicon-resolver.ts 补充解析页面
    status: completed
---

## 产品概述

对 Thrilled Chrome 新标签页扩展执行一轮系统性的缺陷修复与代码优化。本次工作范围严格限定为"问题项（修复项）"和"优化项"，不包含任何新增功能。新增功能（大号时钟、待办清单、在线壁纸）将作为"建议项"在本次全部完成后单独列出，由用户确认后再决定是否实施。

## 核心功能（本次处理范围）

### 修复项（9 项，均为"看得见但用不了"的缺陷或断裂点）

- F1 修复 3 个 TypeScript 类型错误，恢复 `tsc --noEmit` 通过
- F2 修复「导入备份数据」按钮点击无反应（选择器属性不匹配）
- F3 为倒计时补充添加入口（当前有渲染/删除逻辑，但无任何添加 UI）
- F4 补上编辑模式入口（磁贴与分类的删除按钮因编辑模式永为 false 而不可见）
- F5 补上「自动跟随系统主题」UI 选项（当前设置面板只有浅色/深色两档）
- F6 让 5 个失效设置开关真正生效（搜索建议/保留内容/隐藏按钮/自动聚焦/减少动画）
- F7 补上磁贴复制菜单项与自定义图标上传入口
- F8 修复分类触屏拖拽缺失（当前只有 mouse 事件，平板无法重排分类）
- F9 修复滚轮翻页误触（当前全局监听，设置面板滚动也会触发分类翻页）

### 优化项（7 项，均为冗余清理或结构改善）

- O1 清理 weather 相关重复常量与类型（constants.ts 与 weather.ts 双份且数值不一致）
- O2 清理 state.ts 时钟残留与过时 DOM 注册项
- O3 清理 index.html 硬编码的 8 个搜索引擎选项（含不一致的 yahoo）
- O4 移除设置面板中 5 块无逻辑支撑的死 UI（布局/视图缩放/图标/字体/动画效果）
- O5 精简数字键切换引擎逻辑（当前 1-8 只能切前 8 个，实际有 11 个引擎）
- O6 改进 favicon 解析覆盖率（补充 HTML `<link rel="icon">` 解析）
- O10 清理 ErrorCode 联合类型中 4 个未使用的错误码

### 建议项（本次不动，完成后单独列出待确认）

- 大号时钟、待办清单（Todo）、在线壁纸图库

## 技术栈

- TypeScript + 原生 CSS（项目既定，禁止 Tailwind/Shadcn）
- Chrome Manifest V3 + esbuild（build.mjs）
- 弹窗体系使用项目自建 `dialogs.ts`（`showPrompt` 仅支持 text 输入，`createModal` 支持自定义 HTML）
- 存储统一走 `localStorageService`（`src/pages/index/storage.ts`）
- 类型守卫使用 `src/shared/guards.ts`（含 `parseBooleanStr` 用于读取 localStorage 布尔串）

## 实现方案

### 总体策略

按依赖关系和风险从低到高排列，先修类型错误（F1，为所有后续改动扫清 typecheck 障碍），再逐个接上断裂点（F2-F9），最后做纯删除式的冗余清理（O1-O10）。所有改动遵循现有模块边界与命名约定，不引入新架构。

### 关键决策与理由

1. **F1 never 收窄**：`background.ts` 的 `ExtensionRequest` 是单成员联合，`isExtensionRequest` 守卫后 switch 的 default 分支中 `req` 无法被 TypeScript 正确收窄为 `never`（因 `req` 是整个对象）。修复方式：将 `default` 分支改为对 `req.type` 做 `never` 收窄（`const exhaustive: never = req.type`），或在 routeMessage 内改用 `if (req.type === MESSAGE_TYPE.RESOLVE_FAVICON)` 的早返回模式。选择后者更简洁。
2. **F2 导入断链**：`index.html` 已有 `#importInput`（`<input type="file" accept=".json" hidden>`），无需新建 input。修复方式：在 `initExport()` 中为 `[data-setting-action="importData"]` 按钮绑定 click，触发 `#importInput.click()`；同时保留 `#importInput` 的 change 监听解析文件。
3. **F7 自定义图标**：`dialogs.ts` 的 `showPrompt` 不支持文件选择，但 `createModal` 支持自定义 HTML。方案：在磁贴右键菜单增加「更换图标」项，用 `createModal` 展示含 `#tileImageInput` 触发逻辑的上传入口，选择后读 FileReader 转 dataURL，调 `tileManager.update(id, { type:'custom', imageData })`。`buildTileElement` 已支持 `tile.imageData` 渲染，无需改动。
4. **O4 死 UI 移除**：保留「色彩模式」「搜索框设置」「背景」等有效区块，以及 `animReduceToggle`（F6 需要它生效）。移除布局/视图缩放/图标/字体/动画类型与速度等无逻辑区块。

## 实现细节（执行要点）

### 性能与可靠性

- 所有删除式清理（O1/O2/O3/O4/O10）为纯删除，零运行时开销，需保证删除后 `tsc --noEmit` 零错误、无残留引用。
- F6 开关读取使用 `localStorageService.getRaw` + `parseBooleanStr`，启动时一次读取，避免反复访问 localStorage。
- F9 滚轮监听从 `document` 移到 `#tilesContainer`，减少无谓的全局事件触发。

### 日志

- 复用 `src/lib/logger.ts` 的 `info`/`warn`，仅在关键交互（编辑模式切换、倒计时添加、自定义图标上传）记录，不记录敏感数据。

### 影响范围控制

- 所有改动限定在已识别的文件，不做无关重构。
- O4 移除死 UI 时，需同步检查 `settings-panel.ts` 中是否有对这些控件的绑定（经查仅 `animReduceToggle` 在 TOGGLE_MAP 中，需保留其绑定）。
- 删除死 UI 后，`state.ts` 的 `viewScale` 字段与 `types.ts` 的 `viewScale` 设置项可一并清理（属于 O4 范围）。

## 架构设计

### 模块关系

- 修复项主要在 `src/pages/index/` 下的 UI 交互模块（tiles/category-ui/search/settings-panel/countdown/export/theme-manager）内闭环完成，不跨越上下文边界。
- 优化项涉及 `src/shared/`（types/constants）、`src/lib/`（errors）、`src/background/`（favicon-resolver）的纯清理。

### 数据流

用户交互（右键复制/上传图标/添加倒计时/切换编辑模式）→ 模块内状态更新 → `tileManager`/`saveCountdowns` 等持久化到 localStorage → 重渲染。

## 目录结构（改动文件清单）

### 修复项涉及文件

```
src/shared/types.ts                      # [MODIFY] 定义并导出 LinkOpenType
src/background/background.ts             # [MODIFY] 修复 never 收窄
src/pages/index/file-config.ts           # [MODIFY] 删除未使用导入
src/pages/index/export.ts                # [MODIFY] F2 导入按钮触发 #importInput
src/pages/index/countdown.ts             # [MODIFY] F3 新增 addCountdown 与入口
src/pages/index/tiles.ts                 # [MODIFY] F4 编辑模式入口 + F7 复制菜单项/自定义图标
src/pages/index/category-ui.ts           # [MODIFY] F4 编辑模式 + F8 触屏拖拽 + F9 滚轮限定
src/pages/index/settings-panel.ts        # [MODIFY] F5 自动主题卡片 + F6 开关读取 + O4 死UI绑定清理
src/pages/index/search.ts                # [MODIFY] F6 读取搜索相关开关
src/pages/index/theme-manager.ts         # [MODIFY] F5 无需改（逻辑已完整），仅 settings-panel 接入
src/pages/index/main.ts                  # [MODIFY] F6 自动聚焦 + F9 滚轮监听位置
src/pages/events/index.ts                # [MODIFY] O5 动态数字键匹配
index.html                               # [MODIFY] F5 新增 auto 主题卡 + O3 删硬编码引擎 + O4 删死UI
```

### 优化项涉及文件

```
src/shared/constants.ts                  # [MODIFY] O1 删 WEATHER_* 系列
src/shared/types.ts                      # [MODIFY] O1 删 WeatherData + O4 删 viewScale
src/pages/index/state.ts                 # [MODIFY] O2 删 lastMinute/lastDate + #timeMain/#dateDisplay
src/pages/index/navigation.ts            # [MODIFY] O5 数字键逻辑（配合 events）
src/background/favicon-resolver.ts       # [MODIFY] O6 补充 <link rel="icon"> 解析
src/lib/errors.ts                        # [MODIFY] O10 删 4 个未使用错误码
```

## 关键代码结构

### LinkOpenType（F1）

```ts
// src/shared/types.ts 新增
export type LinkOpenType = 'tiles' | 'search' | 'other';
```

### 编辑模式切换（F4）

复用已有 `setTileDeleteMode`，在设置面板或右键菜单增加入口，同时切换 `state.categoryEditMode` 并调用 `renderCatRow()` 与 `renderTiles()`。

### 数字键匹配（O5）

```ts
// events/index.ts：将 /^[1-8]$/ 改为动态生成
// 按 ENGINES.length 生成正则，或使用数字比较 Number(e.key) 在 [1, ENGINES.length] 范围内
```

## Agent Extensions

### Skill

- **coding-standard-workflow**
- 用途：编排本次修复与优化工作的完整编码流程（上下文回顾、规则加载、编码执行、环境自检、上下文记忆），确保遵循项目 .codebuddy/rules 与 skills 规范体系。
- 预期结果：每个修复/优化任务严格按项目规范执行，类型检查与环境自检通过。