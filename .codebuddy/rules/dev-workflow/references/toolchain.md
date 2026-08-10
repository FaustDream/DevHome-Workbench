# 工具链快速参考

> 本文件为 `dev-workflow/RULE.mdc` 第 7 节的外移附录。规则正文只保留命令清单要点。

## 常用命令

```bash
npm test                  # 运行单元测试
npm run test:coverage     # 测试 + 覆盖率报告
npm run typecheck         # TypeScript 类型检查（tsc --noEmit）
npm run lint              # ESLint 检查
npm run build             # 构建（esbuild / webpack 等）
npm run watch             # 构建并监听文件变化
```

## 推荐依赖

```bash
npm i -D typescript @types/chrome esbuild
npm i zod                  # 运行时校验
npm i -D vitest           # 测试框架
# UI（vanilla-extract 方案）
npm i -D @vanilla-extract/css @vanilla-extract/esbuild-plugin
```

## 相关文件快速跳转

| 目的 | 文件路径 |
| --- | --- |
| 扩展清单 | `manifest.json` |
| 全局规则 | `.codebuddy/rules/global/` |
| 编码规范 | `.codebuddy/rules/coding-standards/RULE.mdc` |
| 架构结构 | `.codebuddy/rules/architecture/RULE.mdc` |
| 开发流程 | `.codebuddy/rules/dev-workflow/RULE.mdc` |
| 上下文记忆 | `.codebuddy/rules/context-memory/RULE.mdc` |
| **编码工作流（总控，优先）** | **`.codebuddy/skills/coding-standard-workflow/SKILL.md`** |
| UI 设计系统 | `.codebuddy/skills/chrome-ext-ui-design-system/` |
| TS 高级类型 | `.codebuddy/skills/typescript-advanced-types/` |
| Chrome 扩展模式 | `.codebuddy/skills/clerk-chrome-extension-patterns/` |
| 项目知识库 | `.codebuddy/wiki/` |
