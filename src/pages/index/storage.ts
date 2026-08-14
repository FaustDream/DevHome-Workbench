/**
 * 页面侧存储服务（统一 localStorage 层）
 *
 * - {@link localStorageService}：`tabpage_` 前缀同步读写
 * - {@link dataService}：磁贴/设置业务级门面
 *
 * 所有持久化统一走 localStorage，简洁直接。
 * chrome.storage 仅用于文件同步模块的外部变更监听。
 */

import { LS_KEYS, STORAGE_PREFIX } from '../../shared/constants';
import type { TabPageSettings, TilePage } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import { SettingsSchema } from '../../shared/guards';

/* ================= localStorage 同步层 ================= */

/**
 * 命名空间化 localStorage 读写（自动加前缀）
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

/* ================= 业务级门面 dataService ================= */

/** 磁贴设置默认值合并 */
export function mergeSettings(partial: Partial<TabPageSettings>): TabPageSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

/**
 * 磁贴/设置业务门面
 * 统一走 localStorage，简单直接
 */
export const dataService = {
  /* ----- 磁贴 ----- */
  async getPages(): Promise<TilePage[]> {
    return localStorageService.get<TilePage[]>(LS_KEYS.PAGES, []);
  },

  async savePages(pages: TilePage[]): Promise<void> {
    localStorageService.set(LS_KEYS.PAGES, pages);
  },

  async getPageNames(): Promise<string[]> {
    return localStorageService.get<string[]>(LS_KEYS.PAGE_NAMES, []);
  },

  async savePageNames(names: string[]): Promise<void> {
    localStorageService.set(LS_KEYS.PAGE_NAMES, names);
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
      linkNewTabTiles: localStorageService.getRaw(LS_KEYS.LINK_NEW_TAB_TILES) !== 'false',
      linkNewTabSearch: localStorageService.getRaw(LS_KEYS.LINK_NEW_TAB_SEARCH) !== 'false',
      nickname: localStorageService.getRaw(LS_KEYS.CONFIG_NICKNAME) ?? DEFAULT_SETTINGS.nickname,
      lastPage: parseInt(localStorageService.getRaw(LS_KEYS.LAST_PAGE) ?? '0', 10),
      categoryMemory: localStorageService.getRaw(LS_KEYS.CATEGORY_MEMORY) !== 'false',
      batchModifierKey: localStorageService.getRaw(LS_KEYS.BATCH_MODIFIER_KEY) ?? DEFAULT_SETTINGS.batchModifierKey,
    });
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  },
};
