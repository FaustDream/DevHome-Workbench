# DevHome Workbench

面向独立开发者 / 全栈个人项目开发者的新标签页工作台。

当前版本：`1.0.0`

作者：凌致

本项目升级目标是"项目启动器 + 开发资源中枢"，同时保留日常浏览时需要的时间、搜索、磁贴、分类、右键设置、背景主题、导入导出和 Popup 搜索能力。

默认视觉风格：蓝绿玻璃拟态、深海渐变背景、细网格纹理和半透明卡片，不使用原来的纯黑默认风格。

## 项目结构

```text
DevHome Workbench/
├── manifest.json          # Chrome MV3 扩展清单
├── index.html             # 新标签页主页面
├── styles.css             # 主页面样式
├── js/                    # 主页面模块化 JS
│   ├── main.js            # 启动入口
│   ├── config.js          # 常量与默认配置
│   ├── state.js           # 全局状态与 DOM 缓存
│   ├── storage.js         # 存储抽象层
│   ├── utils.js           # 工具函数
│   ├── theme.js           # 主题管理
│   ├── background.js      # 背景图片/视频管理
│   ├── favicon.js         # Favicon IndexedDB 缓存
│   ├── pageManager.js     # 分类页管理
│   ├── tileManager.js     # 磁贴数据管理
│   ├── tileRenderer.js    # 磁贴 DOM 渲染
│   ├── tileDrag.js        # 磁贴拖拽系统
│   ├── categoryUI.js      # 分类按钮/浮窗/翻页
│   ├── contextMenu.js     # 右键菜单
│   ├── settingsPanel.js   # 设置面板
│   ├── tileModal.js       # 磁贴编辑弹窗
│   ├── search.js          # 搜索系统
│   ├── workbench.js       # 开发工作台
│   └── events.js          # 事件绑定
├── popup.html             # 扩展 Popup
├── popup.css              # Popup 样式
├── popup.js               # Popup 搜索与保存逻辑
├── defaults.json          # 默认磁贴数据
├── docs/                  # 文档与原型
│   ├── DEVELOPER_WORKBENCH_SPEC.md
│   ├── prototype.html
│   ├── prototype-server.mjs
│   └── verify-devhome-smoke.mjs
└── icons/                 # 扩展图标
```

## 核心能力

1. 日常模式：中央时间、日期、多搜索引擎、分类、磁贴和背景主题继续作为默认首屏。
2. 开发工作台：右键空白区域选择"打开开发工作台"，进入全屏工作台，展示当前焦点、项目卡、资源栈、Inbox 和命令搜索。
3. 专注模式：点击日期/时间按设置策略隐藏分类、磁贴或搜索；再次点击恢复。底部提示栏默认隐藏，减少干扰。
4. 设置入口：空白区域右键只保留刷新、新添磁贴、打开开发工作台；右下角齿轮打开完整设置面板。
5. Popup 中枢：保留书签、历史、下载、综合搜索，并支持把当前网页保存到 DevHome 分类和工作台 Inbox。

## 稳定边界

- `tabpage_*`：继续保存原有磁贴、分类、背景、主题、隐藏状态和搜索设置。
- `devhome_*`：只保存新增工作台配置，避免工作台升级影响旧首页内核。
- 备份文件：`DevHome_Backup_YYYY-MM-DD.json`，包含 `version: "1.0.0"`、`author: "凌致"`、旧磁贴数据和新增工作台配置。
- 旧备份：仍可导入；没有 `devhome` 字段时只恢复磁贴和分类。

## 安装方式

1. 打开 Chrome 的 `chrome://extensions/`。
2. 开启右上角"开发者模式"。
3. 点击"加载已解压的扩展程序"。
4. 选择包含 `manifest.json` 的项目目录。
5. 打开新标签页，即进入 DevHome Workbench。

## 常用操作

1. 顶部三段切换：`日常模式` 回到极简首页，`开发工作台` 打开项目与资源中枢，`Popup 面板` 查看 Popup 能力预览。
2. `/` 聚焦搜索框，`Enter` 执行搜索。
3. 右键空白区域打开高频操作菜单，右下角齿轮打开完整设置。
4. 点击日期/时间进入或退出专注模式。
5. `Ctrl/Cmd + K` 打开开发工作台，输入关键词搜索项目、资源、Inbox 或命令。
6. 在工作台点击"新增项目"创建项目卡，双击项目卡打开默认入口。
7. Popup 中点击保存按钮，把当前网页沉淀为磁贴，并同步到工作台 Inbox。

## 验证

```powershell
node --check .\script.js
node --check .\popup.js
node .\docs\verify-devhome-smoke.mjs
```
