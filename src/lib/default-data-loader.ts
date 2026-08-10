/**
 * 默认数据加载器（对齐原版 getDefaultPagesData）
 *
 * 读取扩展包内 `defaults.json` 的默认分类与磁贴，并缓存到 localStorage
 * （`tabpage_defaults_cached` + 版本号），供首次初始化/修复错位复用。
 * 纯逻辑 + fetch，无 chrome.* 直接依赖（URL 由调用方注入，便于单测）。
 */

import { warn } from './logger';
import { TilePageSchema } from '../shared/guards';
import type { TilePage } from '../shared/types';

/** defaults.json 文件内容形状 */
interface DefaultsFile {
  version: number;
  pages: unknown[];
}

/** 解析并校验 defaults.json 内容（失败返回空数组） */
export function parseDefaultPages(raw: string): TilePage[] {
  try {
    const json = JSON.parse(raw) as DefaultsFile;
    if (!Array.isArray(json.pages)) return [];
    const pages: TilePage[] = [];
    for (const item of json.pages) {
      const parsed = TilePageSchema.safeParse(item);
      if (parsed.success) pages.push(parsed.data);
    }
    return pages;
  } catch (e) {
    warn('default-data-loader', 'defaults.json 解析失败', { err: (e as Error).message });
    return [];
  }
}

/** 补齐磁贴 position（默认数据可能缺 position） */
export function normalizeTilePositions(pages: readonly TilePage[]): TilePage[] {
  return pages.map((p) => ({
    name: p.name,
    tiles: p.tiles.map((t, i) => ({ ...t, position: i })),
  }));
}
