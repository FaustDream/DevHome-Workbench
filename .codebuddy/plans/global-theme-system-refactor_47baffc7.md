---
name: global-theme-system-refactor
overview: 全局主题管理系统全量重构：基于 Primitive→Semantic 两层 Design Token 体系，建立 4 主题（默认/黑客/暖纸/像素）× 深浅色的独立配置框架，集中化 ThemeManager，统一背景管理，新设置页替代旧面板
design:
  architecture:
    framework: html
  styleKeywords:
    - Glassmorphism
    - Dark & Light Dual
    - Terminal Matrix
    - Clean Cards
  fontSystem:
    fontFamily: Inter, PingFang SC
    heading:
      size: 20px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#47f0a2"
      - "#00ff41"
      - "#c0692a"
    background:
      - "#12161c"
      - "#1a1e26"
    text:
      - "#e8edf2"
      - "#8b949e"
      - "#484f58"
    functional:
      - "#3fb950"
      - "#d29922"
      - "#f85149"
      - "#58a6ff"
todos:
  - id: create-fonts-layer
    content: 新建 fonts.css 和 fonts 目录：集中声明所有 @font-face（Fira Code woff2 本地文件），下载 Fira Code Regular woff2 到 fonts/FiraCode.woff2，现有 Google Fonts（Press Start 2P、VT323）改为本地引用。在 index.html head 中新增 fonts.css link
    status: completed
  - id: restructure-base-css
    content: 改造 css/base.css：剥离所有色值变量（--bg-*、--text-*、--accent-*、--devhome-*、--danger-*、--doc-*、--glass-*、--border-color、--page-bg、--page-overlay、--panel-bg-*、--modal-* 等），仅保留结构令牌（--spacing-*、--radius-*、--transition-*、--z-*、--font-size-*、--shortcut-*）和全局 reset 样式
    status: completed
  - id: create-tokens-layer
    content: 新建 css/tokens.css：声明全部 39 个 Semantic Token ——色值层 25 个（--color-bg 系列 8 个、--color-text 系列 4 个、--color-accent 系列 4 个、--color-success/warning/danger/danger-hover/info/link 6 个、--color-input-bg/input-border 2 个、--color-overlay 1 个）、边框/分隔 3 个（--color-border 系列）、组件特殊 3 个（--color-separator/kbd-bg/kbd-border）、阴影 3 个（--shadow-sm/md/lg）、字体 3 个（--font-sans/mono/display）、梯度 2 个（--gradient-page/overlay）。不设默认值，由主题文件赋值。在 index.html 中 link 此文件
    status: completed
    dependencies:
      - restructure-base-css
  - id: rewrite-module-css
    content: 全量改造 5 个模块 CSS：将所有硬编码色值及 --px-*、--wb-*、--sp-* 变量引用替换为 Semantic Token 引用。css/modules/tiles.css、overlays.css、workbench.css、time-search.css、sidepanel.css。特别处理：workbench.css 从 warm-paper.css 迁入专注模式布局样式（导航栏、笔记编辑器、日历、番茄钟、统计面板等），sidepanel.css 退役 --sp-* 变量体系统一用主 Token
    status: completed
    dependencies:
      - create-tokens-layer
  - id: rewrite-theme-css
    content: "重写 4 个主题 CSS 文件：default.css（含浅色 :root + 深色 [data-color-scheme=\"dark\"] 两套 Primitive 色值，深色版迁移原 base.css :root 深海渐变配色）、hacker.css（纯黑底 + 终端绿 + 仅深色，含 --gradient-page: none、--shadow-* 改为发光阴影）、warm-paper.css（仅浅色 Primitive，剥离布局样式到 modules/workbench.css）、pixel.css（仅深色 Primitive，退役 --px-* 变量，像素字体 Token 引用）。每个主题文件自包含 Primitive → Semantic 赋值"
    status: completed
    dependencies:
      - create-tokens-layer
  - id: create-theme-manager
    content: 新建 js/theme-manager.js：集中式单例主题管理器。实现主题注册表（4 个主题的元数据：id、name、supportedSchemes、fonts 数组、linkId）、init() 从 localStorage 恢复、set(themeId) 切换 link media + 异步加载字体 + 发布 theme-changed 事件、setScheme(scheme) 设置 data-color-scheme + 跟随系统时监听 prefers-color-scheme 媒体查询变更、字体异步加载与兜底（document.fonts.check + new FontFace + document.fonts.add）
    status: completed
  - id: migrate-js-references
    content: 迁移全部 JS 文件中的主题相关代码：main.js 初始化 ThemeManager 替代原有 _devhome_last_mode 恢复逻辑；workbench.js enterFocusMode/exitFocusMode 删除所有 link media 操作仅保留工作台 DOM 显隐；state.js 新增 currentTheme/currentColorScheme 字段；ui.js、search.js、fileConfig.js、notes.js、export.js、events.js 中所有行内 style var(--wb-*) 和 var(--px-*) 引用改为新 Semantic Token 名
    status: completed
    dependencies:
      - create-theme-manager
  - id: restructure-html-links
    content: 改造 index.html CSS link 标签：新增 fonts.css、tokens.css 引用；主题 link 从 2 个扩展为 4 个（#theme-default、#theme-hacker、#theme-warm-paper、#theme-pixel），default 默认启用其余 media="not all"。CSS 目录结构调整后同步更新所有 link href 路径
    status: completed
    dependencies:
      - create-tokens-layer
      - rewrite-theme-css
  - id: rebuild-settings-page
    content: 重建外观设置页面：替换旧 settings-panel DOM，改为左右分栏布局。左侧 Tab 切换（外观/背景），外观 Tab 含深浅色分段控制器（三选一高亮卡片）+ 主题卡片网格（2x2 含缩略图特征色条+描述+选中态高亮边框+Check 图标）；背景 Tab 含三选一背景类型卡片（纯色/动态效果/自定义图片），自定义图片模式含上传按钮+URL输入+三滑块。右侧 40% 宽 Mini-DOM 预览沙箱（按钮+卡片+文本框+文本+状态色块）。实现智能联动：选黑客/像素时自动切深色+Toast
    status: completed
    dependencies:
      - create-theme-manager
      - rewrite-module-css
  - id: rewrite-bg-manager
    content: "重写 js/theme.js 为统一背景管理器：三种模式（纯色跟随--color-bg / 动态效果启动 Matrix canvas / 自定义图片通过 FileReader 读取或 URL 加载到 #bgContainer）。图片调整支持 CSS filter（blur/brightness）和 opacity，滑块值持久化到 localStorage。Matrix-bg.js 的数字雨启动/停止由背景管理器通过事件控制，不再绑定像素主题"
    status: completed
  - id: update-manifest-changelog
    content: 更新 manifest.json 版本号至 2.3.0，检查 CSP 策略是否需要新增 font-src 'self' 许可。更新 index.html 中 changelog 区段，新增 v2.3.0 条目记录本次全部改动（主题系统重构、4 主题、深浅色模式、外观设置页、背景管理升级）
    status: completed
    dependencies:
      - restructure-html-links
      - rebuild-settings-page
      - rewrite-bg-manager
  - id: final-integration-test
    content: 全量集成验证：确认 4 个主题切换无闪烁，深浅色切换正确，模式（日常/专注）切换不影响主题状态，设置页预览沙箱跟随主题即时变化，背景三模式切换正常，Matrix 数字雨在动态效果模式下启停正常，Fira Code 异步加载无报错，所有 JS 行内 var() 引用无残留 --px-*、--wb-*、--sp-* 变量名。console 无 CSS 变量未定义警告
    status: completed
    dependencies:
      - migrate-js-references
      - restructure-html-links
      - rebuild-settings-page
      - rewrite-bg-manager
      - update-manifest-changelog
---

## 产品概述

DevHome Workbench 全局主题管理系统全量重构。将现有两套硬编码主题（像素/暖纸）升级为可扩展的多主题框架，支持浅色/深色双轨模式、4 套预设主题（默认深海、黑客终端、暖纸、像素），配合统一的外观设置页（含实时预览沙箱和背景管理），实现主题与布局模式的完全解耦。

## 核心功能

- **浅色/深色双轨模式**：提供跟随系统、始终浅色、始终深色三种选项，通过 `data-color-scheme` 属性驱动，带 200ms 渐变过渡
- **4 套预设主题**：默认（深海深色+配套浅色）、黑客（纯黑终端绿+等宽字体）、暖纸（米白色纸质，仅浅色）、像素（黑底绿字像素风，仅深色）
- **主题选择器**：外观设置页中以卡片网格形式展示，含主题缩略图特征色，选中态高亮边框+Check 图标
- **智能联动**：选择黑客/像素等强深色主题时，深浅色模式自动跳转为深色并弹出 Toast 提示
- **实时预览沙箱**：设置页右侧 Mini-DOM 沙箱，含按钮、卡片、输入框、文本、状态色块，主题切换即时预览
- **统一背景管理**：纯色背景（跟随主题）/ 动态效果（Matrix 数字雨）/ 自定义图片（本地上传+URL输入+模糊/亮度/不透明度滑块）三选一
- **字体配置驱动**：主题元数据声明字体需求，ThemeManager 异步加载，系统等宽字体兜底，Fira Code 以 woff2 本地存储
- **Design Token 体系**：39 个 Semantic Token 覆盖背景、文字、交互色、边框、阴影、字体、梯度等全部视觉维度，组件与主题配置完全解耦

## 技术栈（沿用现有项目栈）

- **前端框架**：原生 JavaScript（无框架，Chrome Extension MV3）
- **样式方案**：纯 CSS + CSS Variables（Design Token 体系）
- **存储**：localStorage（主题偏好 + 背景数据）
- **字体加载**：CSS Font Loading API (`document.fonts.load()`)
- **构建工具**：无（直接开发，esbuild 仅用于第三方库打包）

## 实现方案

### 核心架构：Primitive → Semantic 两层 Token 间接引用

采用被 GitHub Primer、Radix Colors、Shopify Polaris 等广泛验证的 Design Token 模式：

```
主题 CSS 文件（如 default.css）
  ├── :root 块：定义 Primitive 原始色值（如 --_gray-50: #fafafa）
  │    └── 赋值 Semantic 令牌（如 --color-bg: var(--_gray-50)）
  └── [data-color-scheme="dark"] 块：
       ├── 覆写 Primitive（如 --_gray-50: #111827）
       └── 覆写 Semantic（如 --color-bg: var(--_gray-900)）

模块 CSS 文件（如 tiles.css）
  └── 只引用 Semantic 令牌（background: var(--color-bg)，不写色值）
```

每个主题文件自包含其所需的所有 Primitive 和 Semantic 值，零交叉依赖。模块 CSS 永远只写 `var(--color-*)`，不看具体色值。

### 关键设计决策

1. **主题加载互斥**：沿用现有 `<link media>` 机制，每个主题一个 `<link>` 标签，同一时刻只有一个 `media="all"`，其余 `media="not all"`。深浅色切换通过改动 `document.documentElement.dataset.colorScheme` 即可，无需更换 CSS 文件。

2. **ThemeManager 单例**：`js/theme-manager.js` 集中管理所有主题操作——注册、加载/卸载 link、字体异步加载、方案切换、`localStorage` 持久化。发布 `theme-changed` CustomEvent，其他模块（如 Matrix 数字雨、hljs 代码高亮）通过监听事件响应，彻底消除分散在各文件中的主题操作代码。

3. **模式与主题彻底解耦**：`enterFocusMode`/`exitFocusMode` 不再操作任何 `<link>` 标签，只负责切换工作台 DOM 的显隐。主题跟随全局 ThemeManager 状态，跨模式保持不变。

4. **全量重写不留尾巴**：所有 9 个 CSS 文件中直接引用的 `--px-*`、`--wb-*`、`--sp-*` 变量以及硬编码色值全部替换为 Semantic Token。JS 行内 `style` 中的 `var(--wb-*)` 引用同步迁移为新 Token 名。

### 性能优化

- 字体文件（Fira Code woff2 ~80KB）不在初始化时阻塞加载，仅在用户首次选中黑客主题时通过 `new FontFace().load()` 异步拉取，加载期间使用系统等宽字体兜底
- 主题切换仅触发 CSS 变量重新计算，不产生 DOM 重排
- `data-color-scheme` 变更时已通过 `transition: background-color 200ms` 在关键元素上做平滑过渡，避免闪烁

### 日志规范

- 所有主题操作输出 `[主题]` 前缀日志：`console.log('[主题] 切换至 hacker 深色')`
- 字体加载状态：`[字体] Fira Code 加载完成`
- 背景操作：`[背景] 选择动态效果 Matrix`
- 错误处理：`console.warn('[主题] 字体加载失败，使用系统兜底')`

## 设计风格

沿用项目现有的两套视觉基因：深海科技风（深色系，渐变玻璃面板）和暖纸极简风（浅色系，纸质纹理）。外观设置页本身采用中性暗色玻璃面板，与两种模式均兼容。

## 外观设置页布局

### 桌面端：左右分栏（Grid 60%/40%）

**左侧控制区**：Tab 切换「外观」和「背景」两个区段

**Tab 1 - 外观**：

- 深浅色模式分段控制器（跟随系统 / 浅色 / 深色），三张强调型单选卡片横向排列
- 主题样式选择器：4 张主题卡片网格（2x2），每张卡片左侧为主题特征色条（默认深海渐变、黑客纯黑+绿光、暖纸米白+铁锈红、像素黑底+像素绿），右侧为主题名称和描述。当前选中卡片带 2px 高亮边框和右上角绿色 Check 图标

**Tab 2 - 背景**：

- 背景类型选择器：三张卡片（纯色/动态效果/自定义图片）
- 自定义图片模式下：上传按钮 + URL 输入框 + 模糊/亮度/不透明度三个调整滑块

**右侧预览区**：圆角卡片容器，内含系统组件微缩沙箱——一个主要按钮、一个次要按钮、一张信息卡片（含标题+文本）、一个文本输入框、一段主体文本 + 一段次级文本、一个链接、一排状态色块（成功绿/警告琥珀/错误红/信息蓝）

### 字体系统

- 默认主题和暖纸主题使用系统无衬线字体（`-apple-system, 'PingFang SC', 'Microsoft YaHei'`）
- 像素主题使用等宽像素字体（`'Press Start 2P', 'VT323'`）
- 黑客主题使用代码等宽字体（`'Fira Code', 'Cascadia Code', 'Consolas', monospace`）

### 色彩系统

- 设置页本身使用深色半透明玻璃面板（`rgba(18, 22, 28, 0.94)`），与所有主题背景兼容
- 卡片选中态使用当前主题的 accent 色（`var(--color-accent)`）
- Toast 提示继承当前主题色板，右下角滑入动画