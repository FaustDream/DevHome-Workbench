/**
 * 分页管理（wiki/04 §4.2 pageManager）
 *
 * 磁贴页面数据的加载、增删改、重排与持久化。
 * 数据流向：load → normalizePageState（修复名错位）→ 持久化修复结果 → 写入 state。
 */

import { info, warn } from '../../lib/logger';
import { createId, normalizePageState } from '../../lib/utils';
import { BusinessError } from '../../lib/errors';
import { DEFAULT_PAGE_NAME } from '../../shared/constants';
import type { Tile, TilePage } from '../../shared/types';
import { TilePageSchema } from '../../shared/guards';
import { dataService } from './storage';
import { state } from './state';

const MODULE = 'page-manager';

/** 校验页面数据（读取即校验，R20） */
function validatePages(raw: unknown): TilePage[] {
  if (!Array.isArray(raw)) return [];
  const pages: TilePage[] = [];
  for (const item of raw) {
    const parsed = TilePageSchema.safeParse(item);
    if (parsed.success) {
      pages.push(parsed.data);
    } else {
      warn(MODULE, `忽略非法页面数据`, { error: parsed.error.issues });
    }
  }
  return pages;
}

/** 页面管理器 */
export const pageManager = {
  /**
   * 加载页数据 + 页名，归一化并持久化修复结果
   * 写入 state.pageNames / state.totalPages / state.pagesData
   */
  async load(): Promise<void> {
    const [rawPages, pageNames] = await Promise.all([dataService.getPages(), dataService.getPageNames()]);
    const pages = validatePages(rawPages);

    const { pages: normalized, changed } = normalizePageState(pages, pageNames);
    if (changed) {
      info(MODULE, '分类名错位已修复并持久化');
      await dataService.savePages(normalized);
      const names = normalized.map((p) => p.name);
      await dataService.savePageNames(names);
      state.pageNames = names;
    } else {
      state.pageNames = pageNames.length === normalized.length ? pageNames : normalized.map((p) => p.name);
    }

    state.pagesData = normalized;
    state.totalPages = normalized.length;
  },

  /** 取当前页数据（含总页数同步到 state） */
  getCurrentPageData(pagesData: readonly TilePage[] = state.pagesData): TilePage | null {
    const page = pagesData[state.currentPage];
    if (page === undefined) return null;
    state.totalPages = pagesData.length;
    return page;
  },

  /** 写回当前页 tiles */
  updateCurrentPage(pagesData: readonly TilePage[], tiles: TilePage['tiles']): TilePage[] {
    const next = pagesData.slice();
    const page = next[state.currentPage];
    if (page === undefined) throw new BusinessError('INVALID_INPUT', '当前页不存在', { index: state.currentPage });
    next[state.currentPage] = { ...page, tiles: tiles.slice() };
    state.pagesData = next;
    return next;
  },

  /** 持久化（双写 localStorage + chrome.storage） */
  async save(pagesData: readonly TilePage[]): Promise<void> {
    const pages = pagesData.slice();
    await dataService.savePages(pages);
    await dataService.savePageNames(pages.map((p) => p.name));
  },

  /** 追加新页 */
  addPage(pagesData: readonly TilePage[]): TilePage[] {
    return pagesData.concat([{ name: `第${pagesData.length + 1}页`, tiles: [] }]);
  },

  /**
   * 删除指定页（strategy: 'moveToCommon' 时把磁贴并入首页）
   * 至少保留一页
   */
  removePageWithStrategy(
    pagesData: readonly TilePage[],
    idx: number,
    strategy: 'moveToCommon' = 'moveToCommon',
  ): TilePage[] {
    if (pagesData.length <= 1) return pagesData.slice();
    if (idx < 0 || idx >= pagesData.length) return pagesData.slice();
    const target = pagesData[idx];
    if (target === undefined) return pagesData.slice();

    const next = pagesData.filter((_, i) => i !== idx);
    if (strategy === 'moveToCommon' && target.tiles.length > 0) {
      const first = next[0];
      if (first !== undefined) {
        next[0] = { ...first, tiles: first.tiles.concat(target.tiles) };
      }
    }
    // 页码越界保护
    if (state.currentPage >= next.length) {
      state.currentPage = next.length - 1;
    }
    return next;
  },

  /** 页面重排 */
  reorderPage(pagesData: readonly TilePage[], from: number, to: number): TilePage[] {
    if (from === to || from < 0 || to < 0 || from >= pagesData.length || to >= pagesData.length) {
      return pagesData.slice();
    }
    const next = pagesData.slice();
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return next;
    next.splice(to, 0, moved);
    state.currentPage = to;
    return next;
  },

  /** 重命名页 */
  renamePage(pagesData: readonly TilePage[], idx: number, name: string): TilePage[] {
    const safeName = name.trim() || `${DEFAULT_PAGE_NAME}_${idx + 1}`;
    const next = pagesData.slice();
    const page = next[idx];
    if (page === undefined) return next;
    next[idx] = { ...page, name: safeName };
    return next;
  },

  /** 新建空白页（用于「新建分类」） */
  createPage(pagesData: readonly TilePage[], name?: string): TilePage[] {
    const idx = pagesData.length + 1;
    return pagesData.concat([{ name: name?.trim() || `第${idx}页`, tiles: [] }]);
  },
};

/** 创建磁贴 id（统一前缀） */
export function createTileId(): Tile['id'] {
  return createId('tile') as Tile['id'];
}

/** 创建空磁贴草稿 */
export function createEmptyTile(url = ''): Tile {
  return {
    id: createTileId(),
    label: '',
    url,
    type: 'favicon',
    icon: '',
    color: '#4a9eff',
    position: 0,
    imageData: '',
  };
}
