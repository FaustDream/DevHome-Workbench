/**
 * 首次初始化引导（onboarding）
 *
 * 首次打开扩展（无磁贴数据 + 未跳过引导）时，弹出与整体 UI 一致的自定义确认弹窗，
 * 询问用户是否根据浏览器收藏夹自动生成默认分类与磁贴：
 * - 确认 → 读取 chrome.bookmarks 树 → 生成分类磁贴
 * - 取消 → 不预置任何数据，进入空白布局
 * 无论确认/取消，完成后写入 `tabpage_onboarded` 标记，后续不再弹窗。
 *
 * @see src/lib/bookmark-importer.ts
 */

import { info, warn } from '../../lib/logger';
import { LS_KEYS } from '../../shared/constants';
import type { TilePage } from '../../shared/types';
import { buildPagesFromBookmarks } from '../../lib/bookmark-importer';
import { showConfirm, showToast } from './dialogs';
import { dataService, localStorageService } from './storage';
import { state } from './state';
import { tileManager, renderTiles } from './tiles';
import { renderCatRow } from './category-ui';

const MODULE = 'onboarding';

/* ===== 常量 ===== */

/** 首次初始化标记（与 LS_KEYS.ONBOARDED 同值，统一走常量表，R19） */
const ONBOARDED_KEY = LS_KEYS.ONBOARDED;

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
  if (localStorageService.getRaw(ONBOARDED_KEY) === '1') return false;
  // 已有数据（非空分类）→ 视为已初始化
  const pages = localStorageService.get(LS_KEYS.PAGES, []);
  if (Array.isArray(pages) && pages.length > 0) return false;
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

  if (useBookmarks) {
    const tree = await readBookmarksTree();
    if (tree !== null) {
      const pages = buildPagesFromBookmarks(tree);
      if (pages.length > 0) {
        await persistPages(pages);
        // 刷新 UI：分类行 + 磁贴（首次导入后必须重渲染）
        renderCatRow();
        renderTiles();
        info(MODULE, '已按收藏夹生成分类', { count: pages.length });
      } else {
        showToast('收藏夹中未找到可导入的书签', 'info');
      }
    } else {
      showToast('无法读取收藏夹', 'error');
    }
  }

  localStorageService.setRaw(ONBOARDED_KEY, '1');
  info(MODULE, '初始化完成', { source: useBookmarks ? 'bookmarks' : 'blank' });
}
