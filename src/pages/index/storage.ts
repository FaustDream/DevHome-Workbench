/**
 * 页面侧存储服务（wiki/02 三层存储）
 *
 * - {@link localStorageService}：`tabpage_`/`devhome_` 前缀同步读写（页面内快速访问，前缀为数据兼容保留）
 * - {@link chromeStorageV2}：`v2/` 前缀异步读写（乐观锁 + localStorage 缓存 + 外部变更监听）
 * - {@link dataService}：磁贴/设置业务级门面（读优先缓存，写双写）
 *
 * 依赖 chrome.storage，仅可在页面/后台上下文引用（非 lib/、非 shared/）。
 */

import { info, warn } from '../../lib/logger';
import { BusinessError } from '../../lib/errors';
import {
  buildVersionedValue,
  readVersion,
  unwrapValue,
  nextVersion,
} from '../../lib/storage-optimistic-lock';
import {
  LS_KEYS,
  OPTIMISTIC_LOCK_MAX_RETRY,
  STORAGE_PREFIX,
  V2_CACHE_PREFIX,
  V2_CACHE_TTL_MS,
  V2_KEYS,
  QUOTA_CHECK_THROTTLE_MS,
  QUOTA_WARN_THRESHOLD,
} from '../../shared/constants';
import type { TabPageSettings, TilePage } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import { SettingsSchema } from '../../shared/guards';

const MODULE = 'storage';

/* ================= 1. localStorage 同步层 ================= */

/**
 * 命名空间化 localStorage 读写（自动加前缀）
 * 用于高频同步访问与 v2 读缓存
 */
export const localStorageService = {
  /** 读 `tabpage_<key>`，JSON 解析失败返回 fallback */
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /** 读原始字符串（开关类布尔串 'true'/'false'） */
  getRaw(key: string): string | null {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  },

  /** 写 `tabpage_<key>` */
  set<T>(key: string, value: T): void {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  },

  /** 写原始字符串 */
  setRaw(key: string, value: string): void {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
  },

  /** 删除 `tabpage_<key>` */
  remove(key: string): void {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  },
};

/* ================= 2. chrome.storage.local v2 层 ================= */

/** 数据变更回调（fileConfig 防抖写盘注册用） */
type DirtyListener = (category: string) => void;
let dirtyListener: DirtyListener | null = null;

/** 注册数据变更监听（markDirty 派发） */
export function registerDirtyListener(fn: DirtyListener): void {
  dirtyListener = fn;
}

/** 组装 v2 完整键 */
export function v2Key(key: string): string {
  return `v2/${key}`;
}

/** v2 键 → 文件同步 category 映射（wiki/02 §2.3.6，fileConfig 复用） */
export const V2_TO_CATEGORY: Readonly<Record<string, string>> = {
  [V2_KEYS.CAPTURES]: 'captures',
  [V2_KEYS.CONFIG]: 'config',
  [V2_KEYS.PAGES]: 'tiles',
  [V2_KEYS.PAGE_NAMES]: 'tiles',
};

/** 配额检查节流状态 */
let lastQuotaCheckAt = 0;

/**
 * chrome.storage.local v2/ 前缀抽象
 * - 乐观锁写入（读-比较-写，最多 3 次重试）
 * - localStorage 缓存（TTL 24h）+ storage.onChanged 外部变更同步
 */
export const chromeStorageV2 = {
  /** 读 `v2/<key>`，不可用时降级 localStorage 缓存；读到后写缓存 */
  async get<T>(key: string, fallback: T): Promise<T> {
    const fullKey = v2Key(key);
    try {
      const res = await chrome.storage.local.get(fullKey);
      const value = res[fullKey];
      if (value !== undefined) {
        writeCache(key, value);
        return unwrapValue(value) as T;
      }
    } catch {
      warn(MODULE, `chrome.storage 读取失败，降级缓存`, { key });
    }
    const cached = readCache<T>(key);
    return cached !== undefined ? cached : fallback;
  },

  /** 乐观锁写入 */
  async set<T>(key: string, value: T): Promise<void> {
    const fullKey = v2Key(key);
    for (let attempt = 0; attempt < OPTIMISTIC_LOCK_MAX_RETRY; attempt++) {
      const res = await chrome.storage.local.get(fullKey);
      const current = res[fullKey];
      const newVersion = nextVersion(readVersion(current));
      const versioned = buildVersionedValue(value, newVersion);

      await chrome.storage.local.set({ [fullKey]: versioned });

      // 写后读回校验版本，防多标签页覆盖
      const readback = await chrome.storage.local.get(fullKey);
      if (readVersion(readback[fullKey]) === newVersion) {
        writeCache(key, versioned);
        const category = V2_TO_CATEGORY[key];
        if (category !== undefined) dirtyListener?.(category);
        return;
      }
      info(MODULE, `乐观锁冲突重试`, { key, attempt: attempt + 1 });
    }
    throw new BusinessError('STORAGE_WRITE_FAILED', `数据保存失败（${key} 乐观锁重试超限）`, { key });
  },

  /** 删除 */
  async remove(key: string): Promise<void> {
    const fullKey = v2Key(key);
    await chrome.storage.local.remove(fullKey);
    localStorage.removeItem(`${V2_CACHE_PREFIX}${key}`);
  },

  /** 批量读取已知键 */
  async getAll<T extends Record<string, unknown>>(keys: readonly string[]): Promise<T> {
    const fullKeys = keys.map(v2Key);
    const res = await chrome.storage.local.get(fullKeys);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const raw = res[v2Key(k)];
      out[k] = raw === undefined ? undefined : unwrapValue(raw);
    }
    return out as T;
  },

  /** 配额监控（90% 告警，节流） */
  async checkQuota(): Promise<void> {
    const now = Date.now();
    if (now - lastQuotaCheckAt < QUOTA_CHECK_THROTTLE_MS) return;
    lastQuotaCheckAt = now;
    const estimate = await navigator.storage.estimate();
    const { quota, usage } = estimate;
    if (quota === undefined || usage === undefined) return;
    if (usage / quota >= QUOTA_WARN_THRESHOLD) {
      warn(MODULE, `存储配额已达 ${Math.round((usage / quota) * 100)}%`);
    }
  },
};

/** 读 localStorage v2 缓存 */
function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(`${V2_CACHE_PREFIX}${key}`);
    if (raw === null) return undefined;
    const { value, _cacheTime } = JSON.parse(raw) as { value: unknown; _cacheTime: number };
    if (Date.now() - _cacheTime > V2_CACHE_TTL_MS) return undefined;
    return unwrapValue(value) as T;
  } catch {
    return undefined;
  }
}

/** 写 localStorage v2 缓存 */
function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${V2_CACHE_PREFIX}${key}`, JSON.stringify({ value, _cacheTime: Date.now() }));
  } catch {
    // 缓存写失败不影响主流程
  }
}

/** 订阅 chrome.storage 外部变更，同步 v2 缓存（页面 boot 时注册一次） */
export function initStorageWatch(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [fullKey, change] of Object.entries(changes)) {
      if (!fullKey.startsWith('v2/')) continue;
      const key = fullKey.slice('v2/'.length);
      if (change.newValue !== undefined) {
        writeCache(key, change.newValue);
      } else {
        localStorage.removeItem(`${V2_CACHE_PREFIX}${key}`);
      }
    }
  });
}

/* ================= 3. 业务级门面 dataService ================= */

/** 磁贴设置默认值合并 */
export function mergeSettings(partial: Partial<TabPageSettings>): TabPageSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

/**
 * 磁贴/设置业务门面（wiki/02 §2.4）
 * 写：localStorage + chrome.storage 双写；读：优先缓存
 */
export const dataService = {
  /* ----- 磁贴 ----- */
  async getPages(): Promise<TilePage[]> {
    const pages = localStorageService.get<TilePage[]>(LS_KEYS.PAGES, []);
    if (pages.length > 0) return pages;
    const v2Pages = await chromeStorageV2.get<TilePage[]>(V2_KEYS.PAGES, []);
    return v2Pages;
  },

  async savePages(pages: TilePage[]): Promise<void> {
    localStorageService.set(LS_KEYS.PAGES, pages);
    await chromeStorageV2.set(V2_KEYS.PAGES, pages);
  },

  async getPageNames(): Promise<string[]> {
    const names = localStorageService.get<string[]>(LS_KEYS.PAGE_NAMES, []);
    if (names.length > 0) return names;
    return chromeStorageV2.get<string[]>(V2_KEYS.PAGE_NAMES, []);
  },

  async savePageNames(names: string[]): Promise<void> {
    localStorageService.set(LS_KEYS.PAGE_NAMES, names);
    await chromeStorageV2.set(V2_KEYS.PAGE_NAMES, names);
  },

  /* ----- 设置 ----- */
  /** 读取设置，读取即校验（R20） */
  async getSettings(): Promise<TabPageSettings> {
    const engine = localStorageService.getRaw(LS_KEYS.ENGINE);
    const parsed = SettingsSchema.safeParse({
      engine: engine ?? DEFAULT_SETTINGS.engine,
      shortcutSize: localStorageService.getRaw(LS_KEYS.SHORTCUT_SIZE) ?? DEFAULT_SETTINGS.shortcutSize,
      shortcutColumns: localStorageService.getRaw(LS_KEYS.SHORTCUT_COLUMNS) ?? DEFAULT_SETTINGS.shortcutColumns,
      autoFocus: localStorageService.getRaw(LS_KEYS.AUTO_FOCUS) === 'true',
      catRow: localStorageService.getRaw(LS_KEYS.CAT_ROW) !== 'false',
      pageTransition: localStorageService.getRaw(LS_KEYS.PAGE_TRANSITION) !== 'false',
      viewScale: parseFloat(localStorageService.getRaw(LS_KEYS.VIEW_SCALE) ?? '1'),
      linkNewTabTiles: localStorageService.getRaw(LS_KEYS.LINK_NEW_TAB_TILES) !== 'false',
      linkNewTabSearch: localStorageService.getRaw(LS_KEYS.LINK_NEW_TAB_SEARCH) !== 'false',
      nickname: localStorageService.getRaw(LS_KEYS.CONFIG_NICKNAME) ?? DEFAULT_SETTINGS.nickname,
      lastPage: parseInt(localStorageService.getRaw(LS_KEYS.LAST_PAGE) ?? '0', 10),
      // 注意：categoryMemory 默认 true（DEFAULT_SETTINGS.categoryMemory: true），
      // 故此处应用 `!== 'false'` 而非 `=== 'true'`（修复：默认值反转 bug）
      categoryMemory: localStorageService.getRaw(LS_KEYS.CATEGORY_MEMORY) !== 'false',
    });
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  },
};
