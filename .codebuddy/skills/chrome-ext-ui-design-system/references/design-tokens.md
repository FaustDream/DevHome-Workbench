# 设计 Token 完整参考

> 来源：`css/tokens.css`（语义声明 + 降级默认）、`css/base.css`（结构令牌）、`css/themes/default.css`（主题覆盖）。
> 所有组件样式**只能引用下列 Token 变量**，禁止写死色值/间距/字号字面量。

---

## 1. 背景层级（Backgrounds）

| Token | 默认值（浅色） | 说明 |
|------|--------------|------|
| `--color-bg` | `#F5F6F8` | 主画布背景（浅灰） |
| `--color-bg-secondary` | `#EEF0F3` | 次级背景（侧边栏/导航） |
| `--color-bg-tertiary` | `#E8E8ED` | 三级背景 |
| `--color-bg-elevated` | `#FFFFFF` | 悬浮弹窗/面板背景 |
| `--color-surface` | `#FFFFFF` | 卡片/面板表面 |
| `--color-surface-hover` | `#F2F3F5` | hover 态 |
| `--color-surface-subtle` | `rgba(0,0,0,0.03)` | 极浅表面 |
| `--color-surface-muted` | `#E9EBEE` | 弱表面（分隔线、微妙边框） |
| `--color-aux-bg` | `#f5f7fa` | 侧栏/次级表面 |
| `--color-hover-bg` | `#eaf3ff` | 蓝色 hover 浅底 |
| `--color-overlay` | `rgba(0,0,0,0.35)` | 遮罩层背景 |

## 2. 输入控件（Inputs）

| Token | 默认值 | 说明 |
|------|--------|------|
| `--color-input-bg` | `#FFFFFF` | 输入框背景 |
| `--color-input-border` | `#D8DCE1` | 输入框边框 |

## 3. 文字层级（Typography）

| Token | 默认值 | 说明 |
|------|--------|------|
| `--color-text` | `#1F2329` | 主文本 |
| `--color-text-secondary` | `#303133` | 次级文本 |
| `--color-text-tertiary` | `#86909C` | 辅助/占位符 |
| `--color-text-disabled` | `#C9CDD4` | 禁用文字 |
| `--color-text-inverse` | `#FFFFFF` | 反色文字（主色按钮上） |

## 4. 交互颜色（Interactive）

| Token | 默认值 | 说明 |
|------|--------|------|
| `--color-accent` | `#1677ff` | 品牌主色（Ant Design 蓝） |
| `--color-accent-hover` | `#0958d9` | 悬停态 |
| `--color-accent-active` | `#003eb3` | 点击激活态 |
| `--color-accent-disabled` | `rgba(22,119,255,0.25)` | 禁用态 |

**交互背景阶梯**（按透明度递增，hover/选中态常用）：`--color-accent-bg-04/05/06/08/10/12/15/16/18`

**交互边框阶梯**：`--color-accent-border-18/20/30/46/56/70/88`

**聚焦环**：`--color-accent-shadow`（`0 0 12px rgba(0,122,255,0.15)`）、`--color-accent-glow`

## 5. 状态色（Status）

| Token | 默认值 | 说明 |
|------|--------|------|
| `--color-success` | `#34C759` | 成功绿 |
| `--color-warning` | `#FF9500` | 警告琥珀 |
| `--color-danger` | `#FF3B30` | 错误红 |
| `--color-danger-hover` | `#D70015` | 错误红 hover |
| `--color-info` | `#5AC8FA` | 信息青 |
| `--color-link` | `#007AFF` | 链接色 |

危险派生：`--color-danger-bg-08/10/12/15/20/85/92/94`、`--color-danger-border-20/30/60`、`--color-danger-shadow`

## 6. 边框 / 分隔（Borders）

| Token | 默认值 | 说明 |
|------|--------|------|
| `--color-border` | `#E5E5EA` | 默认边框 |
| `--color-border-hover` | `#C7C7CC` | 悬停边框 |
| `--color-border-active` | `#007AFF` | 激活/聚焦边框 |
| `--color-separator` | `#E5E5EA` | 分割线 |
| `--color-kbd-bg` / `--color-kbd-border` | `#F2F2F7` / `#E5E5EA` | 快捷键标签 |

## 7. 阴影（Shadows）

| Token | 值 | 说明 |
|------|-----|------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | 卡片/微浮起 |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.08)` | 中浮层 |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.10)` | 弹窗/下拉 |

## 8. 字体（Fonts）

| Token | 值 |
|------|-----|
| `--font-sans` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif` |
| `--font-mono` | `'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace` |
| `--font-display` | `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` |

## 9. 结构令牌（base.css）

### 间距
`--spacing-xs: 4px` / `--spacing-sm: 8px` / `--spacing-md: 16px` / `--spacing-lg: 24px` / `--spacing-xl: 32px` / `--spacing-2xl: 48px`

### 圆角
`--radius-sm: 8px` / `--radius-md: 12px` / `--radius-lg: 20px` / `--radius-xl: 28px` / `--radius-full: 9999px`

### 过渡
`--transition-fast: 0.15s cubic-bezier(0.4,0,0.2,1)` / `--transition-normal: 0.25s cubic-bezier(0.4,0,0.2,1)`

### 字号
`--font-size-xs: 11px` / `--font-size-sm: 13px` / `--font-size-md: 15px` / `--font-size-lg: 18px` / `--font-size-xl: 24px` / `--font-size-2xl: 36px` / `--font-size-time: clamp(72px,15vw,160px)`

### Z 层级
`--z-trash: 1000` / `--z-floating: 2000` / `--z-context-menu: 2700` / `--z-modal: 3000`

---

## 深色模式

`css/themes/default.css` 中 `[data-color-scheme="dark"]` 选择器覆盖全部 Semantic Token（背景转深灰 `#1C1C1E` 系、文字转亮、accent 转 `#0A84FF`）。
**组件不需要写任何暗色逻辑**，只要引用 Semantic Token 即自动适配。

## 特殊变量（仅供业务模块使用，勿滥用）

- `--color-glass-bg` / `--color-glass-border`：毛玻璃卡片
- `--color-nav-bg` / `--color-sidebar-bg`：导航/侧栏半透明背景
- `--color-scrollbar-thumb`：滚动条滑块
- `--color-tile-bg` / `--color-tile-drag-*`：磁贴
- `--color-popup-item-*`：弹窗列表项
- `--gradient-page` / `--gradient-overlay`：背景梯度
