/**
 * 首次初始化引导（onboarding）
 *
 * 首次打开扩展（无磁贴数据 + 未跳过引导）时，弹出与整体 UI 一致的自定义确认弹窗，
 * 询问用户是否根据浏览器收藏夹自动生成默认分类与磁贴：
 * - 确认 → 读取 chrome.bookmarks 树 → 生成分类磁贴；同时预置 defaults.json 默认分类磁贴（合并）
 * - 取消 → 仅预置 defaults.json 默认分类磁贴（为所有默认分类预置默认磁贴）
 * 无论确认/取消，完成后写入 `tabpage_onboarded` 标记，后续不再弹窗。
 *
 * @see src/lib/bookmark-importer.ts / src/lib/default-data-loader.ts
 */

import { info, warn } from '../../lib/logger';
import { DEFAULTS_JSON_PATH, DEFAULTS_VERSION, LS_KEYS } from '../../shared/constants';
import type { TilePage } from '../../shared/types';
import { buildPagesFromBookmarks } from '../../lib/bookmark-importer';
import { normalizeTilePositions, parseDefaultPages } from '../../lib/default-data-loader';
import { showConfirm, showToast } from './dialogs';
import { dataService } from './storage';
import { state } from './state';
import { tileManager, renderTiles } from './tiles';
import { renderCatRow } from './category-ui';

const MODULE = 'onboarding';

/* ===== 常量 ===== */

/** 首次初始化标记（与 LS_KEYS.ONBOARDED 同值，统一走常量表，R19） */
const ONBOARDED_KEY = LS_KEYS.ONBOARDED;

/* ===== defaults.json 加载（fetch + 缓存） ===== */

/** 加载默认分类磁贴（带 localStorage 缓存，DEFAULTS_CACHED/DEFAULTS_VERSION 复用） */
async function loadDefaultPages(): Promise<TilePage[]> {
  const cacheKey = LS_KEYS.DEFAULTS_CACHED;
  const versionKey = LS_KEYS.DEFAULTS_VERSION;
  const cachedRaw = localStorage.getItem(cacheKey);
  const cachedVersion = localStorage.getItem(versionKey);
  if (cachedRaw !== null && cachedVersion === DEFAULTS_VERSION) {
    const cached = parseDefaultPages(cachedRaw);
    if (cached.length > 0) return cached;
  }
  try {
    const url = chrome.runtime.getURL(DEFAULTS_JSON_PATH);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const pages = parseDefaultPages(raw);
    if (pages.length > 0) {
      localStorage.setItem(cacheKey, raw);
      localStorage.setItem(versionKey, DEFAULTS_VERSION);
    }
    return pages;
  } catch (e) {
    warn(MODULE, '默认数据加载失败', { err: (e as Error).message });
    return [];
  }
}

/* ===== 收藏夹读取 ===== */

/** 读取收藏夹树（bookmarks 权限；API 不可用时返回 null） */
async function readBookmarksTree(): Promise<chrome.bookmarks.BookmarkTreeNode[] | null> {
  if (chrome.bookmarks?.getTree === undefined) {
    warn(MODULE, 'chrome.bookmarks 不可用（缺少权限或 API 变更）');
    return null;
  }
  try {
    return await chrome.bookmarks.getTree();
  } catch (e) {
    warn(MODULE, '收藏夹读取失败', { err: (e as Error).message });
    return null;
  }
}

/* ===== 分类合并 ===== */

/** 收藏夹分类 + 默认分类合并（收藏夹优先；默认分类补充缺页；去重同名分类） */
function mergePages(bookmarkPages: TilePage[], defaultPages: TilePage[]): TilePage[] {
  const merged = bookmarkPages.slice();
  const names = new Set(merged.map((p) => p.name));
  for (const def of defaultPages) {
    if (!names.has(def.name)) {
      names.add(def.name);
      merged.push(def);
    }
  }
  return merged;
}

/* ===== 持久化 ===== */

/** 写入分类并刷新 state（对齐 pageManager.save 双写路径） */
async function persistPages(pages: TilePage[]): Promise<void> {
  await dataService.savePages(pages);
  const names = pages.map((p) => p.name);
  await dataService.savePageNames(names);
  state.pagesData = pages;
  state.pageNames = names;
  state.totalPages = pages.length;
  state.currentPage = 0;
  tileManager.updateCurrentTiles();
}

/* ===== 首次判定 ===== */

/** 是否应展示首次引导（无磁贴数据 + 未标记过） */
export function shouldShowOnboarding(): boolean {
  if (localStorage.getItem(ONBOARDED_KEY) === '1') return false;
  // 已有数据（非空分类）→ 视为已初始化
  const pages = localStorage.getItem(LS_KEYS.PAGES);
  if (pages !== null && pages !== '' && pages !== '[]') return false;
  return state.totalPages === 0;
}

/* ===== 主流程 ===== */

/**
 * 首次初始化入口：判定 → 弹窗 → 生成
 * 在 boot 渲染完成后调用（此时 state.totalPages 已就绪）
 */
export async function initOnboarding(): Promise<void> {
  if (!shouldShowOnboarding()) return;
  info(MODULE, '首次使用，展示初始化引导');

  const useBookmarks = await showConfirm(
    '检测到你首次使用 Thrilled，是否根据浏览器收藏夹自动生成默认分类和磁贴？',
    {
      title: '欢迎使用',
      iconType: 'info',
      confirmText: '生成',
      cancelText: '暂不',
    },
  );

  // 默认分类磁贴（无论确认/取消都预置，满足「为所有默认分类预置默认磁贴」）
  const defaultPages = normalizeTilePositions(await loadDefaultPages());

  let pages: TilePage[];
  if (useBookmarks) {
    const tree = await readBookmarksTree();
    if (tree !== null) {
      const bookmarkPages = buildPagesFromBookmarks(tree);
      if (bookmarkPages.length > 0) {
        pages = mergePages(bookmarkPages, defaultPages);
        info(MODULE, '已按收藏夹生成分类', { count: bookmarkPages.length });
      } else {
        pages = defaultPages;
        showToast('收藏夹中未找到可导入的书签，已使用默认布局', 'info');
      }
    } else {
      pages = defaultPages;
      showToast('无法读取收藏夹，已使用默认布局', 'error');
    }
  } else {
    pages = defaultPages;
  }

  if (pages.length > 0) {
    await persistPages(pages);
    // 刷新 UI：分类行 + 磁贴（首次导入后必须重渲染）
    renderCatRow();
    renderTiles();
  }
  localStorage.setItem(ONBOARDED_KEY, '1');
  info(MODULE, '初始化完成', { pages: pages.length, source: useBookmarks ? 'bookmarks+defaults' : 'defaults' });
}
