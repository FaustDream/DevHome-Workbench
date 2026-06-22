# DevHome Workbench - 项目记忆

## 项目概述
- Chrome MV3 新标签页扩展，面向独立开发者的个人工作台
- 作者：凌致，当前版本 1.4.1，计划升级到 v2.0.0
- 蓝绿玻璃拟态视觉风格（日常模式），深海渐变背景
- 开发工作台采用艾森豪威尔四象限矩阵（重要/紧急 × 2），支持任务增删、拖拽移动、完成标记

## v2.0.0 规划（2026-06-22 确认）

### 核心定位
- 新标签页（全功能仪表盘）+ 侧边栏（轻量记录面板）
- 个人工作操作系统，轻量 Notion/Obsidian 替代
- 工作流：日常快速捕获 → 定期导出 Markdown → 导入 Obsidian 深度整理

### 功能清单（一阶段全部实现）
1. 快速捕获输入框
2. 内容笔记（Markdown 编辑 + 预览）
3. 四象限任务（保留并增强：关联笔记）
4. 日历视图（月视图，仅展示）
5. 标签筛选（辅助过滤）
6. 全文搜索
7. 导出中心（分门别类 + 一键导出 Markdown）
8. 网页剪藏（右键 + 快捷键 + 侧边栏即时显示）
9. 番茄钟（浏览器悬浮条 + Chrome 通知 + 专注/默认模式）
10. AI 每日总结（智谱 GLM-4-Flash）
11. 行为追踪仪表盘（正面激励 + 数据追踪 + 可选严厉鞭策）

### 设计决策
- **布局**：工作台模式内多 Tab 导航（仪表盘/笔记/日历/番茄钟/我），与日常模式隔离
- **风格**：「单色聚焦」静默设计 — 深灰底 + 蓝绿强调色 + 2px 选中线，无动画干扰
- **俏皮元素**：任务完成像素炸开动画 + 空状态幽默文案 + 番茄钟鼓励文案池
- **技术栈**：原生 JS + marked.js + dayjs，无框架无构建工具
- **数据存储**：chrome.storage.local（主存储，无限容量）+ localStorage（缓存）
- **文件备份**：File System Access API 可选备份，默认关闭
- **数据格式**：JSON 结构化元数据 + Markdown 字符串正文 → 导出时生成 .md 文件
- **AI API**：智谱 AI GLM-4-Flash（新用户 2000万 Token 免费），备选腾讯混元/硅基流动/GitHub Models
- **开发策略**：一阶段全部做完，逐功能试用，问题集中修复

## 架构决策
- 使用原生 HTML/CSS/JS，无构建工具，无框架
- `tabpage_*` 存储前缀用于原有磁贴/分类数据，`devhome_*` 用于二开工作台数据
- 主页面模块通过 `window.DevHome` 全局命名空间通信
- Popup 模块通过 `window.PopupApp` 全局命名空间通信

## 目录结构
```
DevHome Workbench/
├── manifest.json / index.html / popup.html / sidepanel.html
├── defaults.json / AGENTS.md / README.md
├── js/          → 主页 JS 模块
├── css/         → 主页 CSS 模块
├── popup/js/    → Popup JS 模块
├── popup/css/   → Popup CSS 模块
├── docs/        → 原型 + 产品规范 + 烟雾测试
├── tests/       → TDD 测试套件
└── icons/       → 扩展图标
```

## 代码质量
- 2026-06-12：完成全部单体文件拆分
- 全部 29 个模块通过语法检查，66 项 TDD 测试全部通过

## 文件系统配置持久化（2026-06-18 方案修订）
- **设计修正**：localStorage 为可靠主存储，文件配置为增强备份（非强制）
- **修订原因**：FileSystemDirectoryHandle 存入 IndexedDB 后，在 Chrome 扩展全部新标签页关闭时无法跨会话恢复
- **当前策略**：
  1. localStorage 始终是可用主存储，100% 可靠
  2. 启动时若 IndexedDB 无 handle 但 localStorage 有数据 → 静默就绪
  3. 仅首次使用时提示选择目录
  4. 运行时双写：localStorage 缓存 + 3 秒防抖写盘（有 handle 时）
