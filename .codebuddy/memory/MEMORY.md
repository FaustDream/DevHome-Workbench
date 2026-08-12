# Thrilled 项目记忆

## 项目概述
- **Thrilled**：Chrome 扩展程序，替换浏览器新标签页
- **技术栈**：TypeScript + 原生 CSS（禁止 Tailwind/Shadcn），Manifest V3
- **构建工具**：esbuild（build.mjs）
- **包管理**：npm

## 设计规范
- CSS 框架：禁止使用 Tailwind CSS、Shadcn 等 CSS 框架
- UI 组件：使用项目自建的 `.ui-*` 原生 CSS 组件体系（定义于 `css/ui-components.css`）
  - 包含：弹窗、按钮、输入框、Switch、Toast、下拉菜单、徽章等
- 图标：SVG symbol 引用方式（`css/icons.css`）
- 字体：Inter 可变字体（`fonts/Inter.woff2`）
- 动画：统一使用 `css/animations.css`，支持 `prefers-reduced-motion`
- 日志：使用 `src/lib/logger.ts` 统一日志系统

## 架构约定
- 类型定义集中在 `src/shared/types.ts`
- 消息协议在 `src/shared/messages.ts`（判别联合类型）
- 常量在 `src/shared/constants.ts`
- 纯逻辑放在 `src/lib/`（无 chrome.* / 无 DOM 依赖）
- 事件总线在 `src/pages/events/index.ts`
- 存储服务三层架构：localStorage / chrome.storage / dataService

## 已完成的重点工作
- 2026-08-12：快捷方式图标 fallback 从 Google favicon 服务改为纯色背景色块
- 2026-08-12：完成新标签页主题设计全网调研，形成参考清单
