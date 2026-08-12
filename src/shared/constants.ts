/**
 * 全局常量表（R14：禁止魔法值）
 *
 * 集中定义业务常量：存储键、消息类型、交互阈值、缓存 TTL 等。
 * 所有模块禁止在业务代码中散落裸数字/裸字符串，必须引用此处常量。
 */

/** ===== 存储键（localStorage 前缀体系） ===== */
export const STORAGE_PREFIX = 'tabpage_' as const;

/** localStorage 键名（完整键 = STORAGE_PREFIX + key） */
export const LS_KEYS = {
  PAGES: 'pages',
  PAGE_NAMES: 'page_names',
  SEARCH_HISTORY: 'search_history',
  SHORTCUT_SIZE: 'shortcut_size',
  SHORTCUT_COLUMNS: 'shortcut_columns',
  AUTO_FOCUS: 'auto_focus',
  CATEGORY_MEMORY: 'category_memory',
  LAST_PAGE: 'last_page',
  CAT_ROW: 'cat_row',
  PAGE_TRANSITION: 'page_transition',
  ENGINE: 'engine',
  VIEW_SCALE: 'tabpage_view_scale',
  LINK_NEW_TAB_TILES: 'linkNewTab_tiles',
  LINK_NEW_TAB_SEARCH: 'linkNewTab_search',
  CONFIG_NICKNAME: 'config_nickname',
  SEARCH_SUGGESTIONS: 'search_suggestions',
  SEARCH_RETAIN: 'search_retain',
  SEARCH_HIDE_BTN: 'search_hide_btn',
  ANIM_REDUCE: 'anim_reduce',
  WEATHER_CACHE: 'tabpage_weather_cache',
  DEFAULTS_CACHED: 'tabpage_defaults_cached',
  DEFAULTS_VERSION: 'tabpage_defaults_version',
  /** 首次初始化标记（onboarding 已弹窗/已跳过） */
  ONBOARDED: 'tabpage_onboarded',
  /** 批量选择修饰键（ctrl / alt / ctrlShift） */
  BATCH_MODIFIER_KEY: 'batch_modifier_key',
} as const;

/** 裸键（无前缀） */
export const RAW_KEYS = {
  COUNTDOWNS: 'countdowns',
  DAILY_GREETING_QUOTE: 'daily_greeting_card_quote',
  WEATHER_CACHE: 'tabpage_weather_cache',
  THEME_CARD: '_devhome_theme_card',
  LAST_MODE: '_devhome_last_mode',
} as const;

/** ===== 消息类型（R3：判别联合 type 常量） ===== */
export const MESSAGE_TYPE = {
  RESOLVE_FAVICON: 'RESOLVE_FAVICON',
} as const;

/** ===== 磁贴/分类交互阈值 ===== */
/** 磁贴长按进入拖拽的阈值（ms） */
export const TILE_LONG_PRESS_MS = 600;
/** 分类长按进入拖拽的阈值（ms） */
export const CATEGORY_LONG_PRESS_MS = 600;
/** 滚轮翻页累加阈值（px） */
export const WHEEL_PAGE_THRESHOLD = 25;
/** 滚轮翻页冷却（ms） */
export const WHEEL_PAGE_COOLDOWN_MS = 350;
/** 搜索历史上限 */
export const SEARCH_HISTORY_LIMIT = 20;
/** 搜索建议面板最近历史条数 */
export const SUGGESTION_HISTORY_LIMIT = 10;
/** Bing 联想词防抖（ms） */
export const SUGGESTION_DEBOUNCE_MS = 150;

/** ===== 尺寸/布局 ===== */
export const DEFAULT_SHORTCUT_SIZE = 'standard' as const;
export const DEFAULT_SHORTCUT_COLUMNS = 'auto' as const;

/** 快捷方式尺寸配置（容器宽/图标尺寸/间距/圆角/字号） */
export const SHORTCUT_SIZE_OPTIONS = {
  small: { size: 76, icon: 44, gap: 18, radius: 14, fontSize: 12 },
  standard: { size: 100, icon: 56, gap: 24, radius: 18, fontSize: 12 },
  large: { size: 124, icon: 68, gap: 28, radius: 22, fontSize: 14 },
} as const;

/** ===== 默认配置 ===== */
export const DEFAULT_NICKNAME = '主人';
export const DEFAULT_TILE_COLOR = '#4a9eff';
export const DEFAULT_ENGINE = 'google' as const;
export const DEFAULT_PAGE_NAME = '第1页';
export const DEFAULT_SETTINGS = {
  engine: DEFAULT_ENGINE,
  shortcutSize: DEFAULT_SHORTCUT_SIZE,
  shortcutColumns: DEFAULT_SHORTCUT_COLUMNS,
  autoFocus: false,
  categoryMemory: true,
  catRow: true,
  pageTransition: true,
  viewScale: 1,
  linkNewTabTiles: true,
  linkNewTabSearch: true,
  nickname: DEFAULT_NICKNAME,
  lastPage: 0,
  batchModifierKey: 'ctrlShift',
} as const;

/** ===== 文件同步 fileConfig ===== */
/** FileConfig IndexedDB 数据库名 */
export const FILECONFIG_DB_NAME = 'DevHomeFileConfig' as const;
/** FileConfig IndexedDB object store 名 */
export const FILECONFIG_DB_STORE = 'handles' as const;
/** DirectoryHandle 存储键 */
export const FILECONFIG_HANDLE_KEY = 'directoryHandle' as const;
/** 数据变更写盘防抖（ms） */
export const FILECONFIG_WRITE_DEBOUNCE_MS = 1000 as const;

/** ===== 天气 ===== */
export const WEATHER_DEFAULT_LAT = 39.9042;
export const WEATHER_DEFAULT_LON = 116.4074;
export const WEATHER_DEFAULT_CITY = '北京';
export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
export const WEATHER_AUTO_REFRESH_MS = 30 * 60 * 1000;
export const WEATHER_GEO_TIMEOUT_MS = 5000;
/** 定位与缓存坐标最大偏移（度） */
export const WEATHER_COORD_EPSILON = 1;
/** Open-Meteo API 端点 */
export const WEATHER_API_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/** WMO 天气码 → 文案+图标 映射 */
export const WEATHER_CODE_MAP: Readonly<Record<number, { text: string; icon: string }>> = {
  0: { text: '晴', icon: 'weather-sun' },
  1: { text: '大部晴', icon: 'weather-sun' },
  2: { text: '多云', icon: 'weather-cloud-sun' },
  3: { text: '阴', icon: 'weather-cloud' },
  45: { text: '雾', icon: 'weather-fog' },
  48: { text: '雾凇', icon: 'weather-fog' },
  51: { text: '小雨', icon: 'weather-rain' },
  53: { text: '中雨', icon: 'weather-rain' },
  55: { text: '大雨', icon: 'weather-rain' },
  61: { text: '小雨', icon: 'weather-rain' },
  63: { text: '中雨', icon: 'weather-rain' },
  65: { text: '大雨', icon: 'weather-rain' },
  71: { text: '小雪', icon: 'weather-snow' },
  73: { text: '中雪', icon: 'weather-snow' },
  75: { text: '大雪', icon: 'weather-snow' },
  77: { text: '雪粒', icon: 'weather-snow' },
  80: { text: '阵雨', icon: 'weather-rain' },
  81: { text: '暴雨', icon: 'weather-rain' },
  82: { text: '大暴雨', icon: 'weather-storm' },
  85: { text: '阵雪', icon: 'weather-snow' },
  86: { text: '大雪', icon: 'weather-snow' },
  95: { text: '雷暴', icon: 'weather-storm' },
  96: { text: '冰雹雷暴', icon: 'weather-storm' },
  99: { text: '强雷暴', icon: 'weather-storm' },
};

/** ===== 壁纸 ===== */
export const WALLPAPER_DEFAULT_SETTINGS = { blur: 0, overlay: 30 } as const;
/** 壁纸压缩目标宽度（px） */
export const WALLPAPER_MAX_WIDTH = 1920;
/** 壁纸压缩质量 */
export const WALLPAPER_JPEG_QUALITY = 0.85;

/** ===== 时钟/问候 ===== */
export const COUNTDOWN_REFRESH_INTERVAL_MS = 60 * 1000;
export const GREETING_PERIODS = [
  { from: 5, to: 9, text: '早上好' },
  { from: 9, to: 12, text: '上午好' },
  { from: 12, to: 14, text: '中午好' },
  { from: 14, to: 18, text: '下午好' },
  { from: 18, to: 24, text: '晚上好' },
] as const;
/** 深夜问候（0-5 点） */
export const GREETING_NIGHT = '夜深了' as const;

/** ===== 默认分类数据源路径 ===== */
export const DEFAULTS_JSON_PATH = 'defaults.json';
/** defaults.json 缓存版本校验 */
export const DEFAULTS_VERSION = '1' as const;

/** ===== 外部 API 端点 ===== */
/** Bing 联想词 API（osjson） */
export const BING_SUGGESTION_ENDPOINT = 'https://api.bing.com/osjson.aspx?query=';

/** ===== favicon 解析 ===== */
/** SW 解析 favicon 超时（ms） */
export const FAVICON_FETCH_TIMEOUT_MS = 4000;
/** favicon 响应体积上限（10MB，防超大图） */
export const FAVICON_MAX_BYTES = 10 * 1024 * 1024;
