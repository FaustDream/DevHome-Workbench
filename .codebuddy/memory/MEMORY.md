# 长期记忆（MEMORY.md）

> 项目关键决策与技术事实，保持精炼。更新日期见各条目。

## 项目概况
- **Thrilled**（v1.0，前身 DevHome Workbench）：Chrome MV3 新标签页扩展，极简冷调设计（`minimal-style-spec.md` v1.1 为权威设计规范）。
- **合并（2026-08-10）**：已与 `D:\Thrilled`（最新 TS 重构版）合并。archive/ 归档目录已于 2026-08-10 完全删除。git remote 已更新为 `FaustDream/Thrilled.git`。
- **技术栈**：TypeScript strict + esbuild（bundle → `dist/`）+ vitest + zod；原生 CSS + Semantic Token，无运行时 CSS 框架。
- **知识库**：`.codebuddy/wiki/` 01-21 章为权威架构文档（含 TS 改造总纲 14 章；文档中旧名 DevHome 为历史称谓，保留以便对照）。
- **改名约定（2026-08-07）**：产品名/版本统一为 Thrilled / **3.0（manifest）、3.0.0（npm，2026-08-10 由 1.0 升级）**。**存储键与命名空间（`devhome_`/`tabpage_` 前缀、`devhome-favicon` IndexedDB 名、`DevhomeMode` 类型、`devhome_workbench`）为数据兼容保留不改**；`.codebuddy/wiki/` 历史文档保留旧名。
- **范围决策（2026-08-07）**：**AI 功能 / 代理管理 / 矩阵雨背景 明确不做**（详见 README「功能范围」+ wiki/15「范围调整」）；其余功能（工作台/笔记/事件/剪藏完整版/fileConfig/导出中心）持续推进。
- **UI 基准（2026-08-07）**：以原版 `D:\gitHub\DevHome Workbench` 的 23 个 CSS + index.html 结构为权威（非 minimal-style-spec），TS 渲染 DOM 类名与交互对齐原版。

## 关键架构决策
1. **目录**：`src/background`（SW）、`src/pages/index`（新标签页）、`src/shared`（无 chrome.* 类型+常量+协议）、`src/lib`（无 chrome.* 纯逻辑）。
2. **消息协议**：`src/shared/messages.ts` 判别联合 `ExtensionRequest` + `guards.ts` `isExtensionRequest` zod 守卫；SW 路由穷尽 switch + `never` 兜底。
3. **存储**：`src/pages/index/storage.ts` — localStorage（tabpage_ 前缀）+ chrome.storage v2 乐观锁（`{data,_version}` 包装，读-比较-写重试 3 次）+ 缓存；`lib/storage-optimistic-lock.ts` 为纯逻辑。
4. **品牌类型**：`Brand<T,B> = T & {__brand?: B}`（幽灵品牌，optional 属性）；zod `.brand()` 产物不兼容，schema 用普通 string 校验即可赋给幽灵品牌。
5. **权限**：MV3 最小权限；host_permissions `https://*/*`（favicon 解析）；域名白名单校验防 SSRF。
6. **UI 样式**：遵循极简冷调 spec（`--bg #f6f6f4` / 近黑交互），Token 全在 `css/tokens.css`；禁用彩色强调/投影/胶囊（Toggle 除外）。
7. **日志**：统一 `src/lib/logger.ts`；eslint `no-console` 仅放行 warn/error。

## 长期待办
- 工作台模式（四象限/笔记/番茄钟 UI/日历/仪表盘）迁移（wiki Phase 3.3-3.4）
- 设置面板完整生命周期（ui/_settings-panel）
- fileConfig（File System Access 备份）— storage 已预留 `registerDirtyListener` 钩子
- 旧 JS 源码若恢复，可对照 wiki/19 逐行迁移剩余模块
