/**
 * 共享类型定义（跨上下文，纯类型，无 chrome.* 依赖）
 *
 * 集中定义新标签页项目的数据模型：磁贴、分页、搜索引擎、设置项等。
 * 命名约定：`TileId`/`PageIndex` 等品牌类型（Branded Type）用于防止原始类型混用；
 * 所有可空字段显式使用 `| null`，避免 `exactOptionalPropertyTypes` 下赋值歧义。
 */

/**
 * 品牌类型工具：给原始类型打上语义标签
 * 采用「幽灵品牌」（optional 属性）：不强制构造处写品牌标记，仅用于文档化意图与
 * 防止跨语义的原始类型混用（配合 zod 产物与字面量赋值时零摩擦）。
 */
export type Brand<T, B extends string> = T & { readonly __brand?: B };

/** 磁贴 ID：`tile_<ts>_<rand>` */
export type TileId = Brand<string, 'TileId'>;
/** 页面索引（分类序号，从 0 开始） */
export type PageIndex = number;

/** 磁贴类型：favicon（站点图标）/ custom（自定义图标）/ text（首字符）/ emoji */
export type TileType = 'favicon' | 'custom' | 'text' | 'emoji';

/**
 * 磁贴（快捷方式）
 */
export interface Tile {
  /** 唯一 ID，`tile_<ts>_<rand>` */
  id: TileId;
  /** 显示名称 */
  label: string;
  /** 目标地址 */
  url: string;
  /** 图标渲染类型 */
  type: TileType;
  /** 图标 URL / emoji / SVG */
  icon: string;
  /** 磁贴底色 */
  color: string;
  /** 排序位 */
  position: number;
  /** 自定义图标 base64（`type === 'custom'` 时使用） */
  imageData: string;
}

/** 磁贴分页（分类），每个分类一页 */
export interface TilePage {
  /** 分类名（页面名） */
  name: string;
  /** 该分类下的磁贴列表 */
  tiles: Tile[];
}

/** 搜索引擎 id 字面量联合 */
export type EngineId =
  | 'google'
  | 'bing'
  | 'baidu'
  | 'zhihu'
  | 'weibo'
  | 'duckduckgo'
  | 'github'
  | 'bilibili'
  | 'yandex'
  | 'gamer520'
  | 'linuxdo';

/**
 * 搜索引擎定义
 * 图标渲染优先级：iconName（SVG symbol）→ badge（文本徽标）→ svg（内联路径）
 */
export interface SearchEngine {
  id: EngineId;
  /** 显示名 */
  name: string;
  /** 展示 URL */
  url: string;
  /** 搜索 URL 模板（query 需 encodeURIComponent） */
  base: string;
  /** SVG symbol 名（可选） */
  iconName?: string;
  /** 文本徽标（可选） */
  badge?: string;
  /** 内联 SVG path（可选） */
  svg?: string;
}

/** 快捷方式尺寸 */
export type ShortcutSize = 'small' | 'standard' | 'large';
/** 快捷方式列数配置值 */
export type ShortcutColumns = 'auto' | '4' | '5' | '6' | '7' | '8' | '10';

/** 主题方案 */
export type ColorScheme = 'light' | 'dark' | 'auto';

/** 链接打开类型（link-opener 统一入口） */
export type LinkOpenType = 'tiles' | 'search' | 'other';

/**
 * 新标签页设置项（tabpage_ 前缀存储）
 */
export interface TabPageSettings {
  /** 当前搜索引擎 id */
  engine: EngineId;
  /** 快捷方式尺寸 */
  shortcutSize: ShortcutSize;
  /** 快捷方式列数 */
  shortcutColumns: ShortcutColumns;
  /** 自动聚焦开关 */
  autoFocus: boolean;
  /** 分类记忆开关 */
  categoryMemory: boolean;
  /** 分类按钮行开关 */
  catRow: boolean;
  /** 页面切换动画 */
  pageTransition: boolean;
  /** 磁贴新标签打开 */
  linkNewTabTiles: boolean;
  /** 搜索结果新标签打开 */
  linkNewTabSearch: boolean;
  /** 昵称（默认「主人」） */
  nickname: string;
  /** 上次所在分页（分类记忆恢复） */
  lastPage: PageIndex;
  /** 批量选择修饰键：ctrl / alt / ctrlShift */
  batchModifierKey: string;
}

/** 倒计时目标（localStorage `countdowns`） */
export interface CountdownItem {
  id: string;
  title: string;
  /** 目标日期 YYYY-MM-DD */
  targetDate: string;
  /** 创建日期 YYYY-MM-DD */
  createdAt: string;
}

/** 壁纸设置（localStorage `wallpaperSettings`） */
export interface WallpaperSettings {
  /** 模糊度 0-100 */
  blur: number;
  /** 遮罩透明度 0-100 */
  overlay: number;
}

/** 搜索引擎注册表 */
export const ENGINES: readonly SearchEngine[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com', base: 'https://www.google.com/search?q=', iconName: 'google' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com', base: 'https://www.bing.com/search?q=', iconName: 'bing' },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com', base: 'https://www.baidu.com/s?wd=', iconName: 'baidu' },
  { id: 'zhihu', name: '知乎', url: 'https://www.zhihu.com', base: 'https://www.zhihu.com/search?type=content&q=', iconName: 'zhihu' },
  { id: 'weibo', name: '微博', url: 'https://weibo.com', base: 'https://s.weibo.com/weibo?q=', iconName: 'weibo' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com', base: 'https://duckduckgo.com/?q=', iconName: 'duckduckgo' },
  { id: 'github', name: 'GitHub', url: 'https://github.com', base: 'https://github.com/search?q=', iconName: 'github' },
  { id: 'bilibili', name: '哔哩哔哩', url: 'https://www.bilibili.com', base: 'https://search.bilibili.com/all?keyword=', iconName: 'bilibili' },
  { id: 'yandex', name: 'Yandex', url: 'https://ya.ru/', base: 'https://ya.ru/search/?text=', iconName: 'yandex' },
  { id: 'gamer520', name: 'Gamer520', url: 'https://www.gamer520.com/', base: 'https://www.gamer520.com/?s=', iconName: 'gamer520' },
  { id: 'linuxdo', name: 'Linux.do', url: 'https://linux.do/', base: 'https://linux.do/search?q=', iconName: 'linuxdo' },
] as const;

/** 引擎查询辅助 */
export function getEngineById(id: EngineId): SearchEngine | null {
  return ENGINES.find((e) => e.id === id) ?? null;
}
