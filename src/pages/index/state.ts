/**
 * 全局状态 + DOM 缓存（wiki/03 §3.1）
 *
 * 集中管理跨模块共享的应用状态与高频 DOM 引用。
 * DOM 引用采用「注册表 + 懒加载 + 缺失警告」机制，避免 HTML 结构调整后静默失效。
 */

import { warn } from '../../lib/logger';
import type { EngineId, TabPageSettings, Tile, TilePage } from '../../shared/types';

const MODULE = 'state';

/** 全局应用状态 */
export interface AppState {
  /** 磁贴分页数据 */
  pagesData: TilePage[];
  /** 当前页索引 */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 分类名列表 */
  pageNames: string[];
  /** 当前页磁贴（按 position 排序） */
  currentTiles: Tile[];
  /** 当前搜索引擎 */
  engine: EngineId;
  /** 设置 */
  settings: TabPageSettings;
  /** 磁贴删除模式 */
  tileEditMode: boolean;
  /** 分类编辑模式 */
  categoryEditMode: boolean;
  /** 页面切换动画中 */
  pageTransition: boolean;
  /** 时钟防重复更新缓存 */
  lastMinute: string;
  /** 日期防重复更新缓存 */
  lastDate: string;
  /** 搜索历史 */
  searchHistory: string[];
  /** 拖拽已移动（点击需忽略） */
  dragMoved: boolean;
  /** 拖拽后抑制下一次磁贴点击 */
  preventNextTileClick: boolean;
}

/** 初始状态 */
export function createInitialState(): AppState {
  return {
    pagesData: [],
    currentPage: 0,
    totalPages: 0,
    pageNames: [],
    currentTiles: [],
    engine: 'google',
    settings: {
      engine: 'google',
      shortcutSize: 'standard',
      shortcutColumns: 'auto',
      autoFocus: false,
      categoryMemory: true,
      catRow: true,
      pageTransition: true,
      viewScale: 1,
      linkNewTabTiles: true,
      linkNewTabSearch: true,
      nickname: '主人',
      lastPage: 0,
    },
    tileEditMode: false,
    categoryEditMode: false,
    pageTransition: false,
    lastMinute: '',
    lastDate: '',
    searchHistory: [],
    dragMoved: false,
    preventNextTileClick: false,
  };
}

export const state: AppState = createInitialState();

/* ================= DOM 缓存 ================= */

/** DOM 注册表：selector → 描述（用于缺失警告） */
const DOM_REGISTRY: Readonly<Record<string, string>> = {
  '#searchInput': '搜索输入框',
  '#tilesContainer': '磁贴容器',
  '#catRow': '分类按钮行',
  '#timeMain': '时间显示',
  '#dateDisplay': '日期显示',
  '#engineDropdown': '引擎下拉',
  '#settingsPanel': '设置面板',
};

/**
 * 类型化 DOM 缓存
 * 懒加载：首次访问时查询并缓存；缺失时 warn 提示（避免静默失效）
 */
export class DomCache {
  private readonly cache = new Map<string, HTMLElement | null>();

  /** 获取缓存元素，缺失返回 null 并告警 */
  get<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    if (this.cache.has(selector)) {
      return this.cache.get(selector) as T | null;
    }
    const el = document.querySelector<T>(selector);
    if (el === null) {
      warn(MODULE, `DOM 缺失: ${selector}（${DOM_REGISTRY[selector] ?? '未注册'}）`);
    }
    this.cache.set(selector, el);
    return el;
  }

  /** 强制重新查询（HTML 结构动态变化后失效恢复） */
  invalidate(selector: string): void {
    this.cache.delete(selector);
  }

  /** 批量清理（页面重渲染后调用） */
  reset(): void {
    this.cache.clear();
  }
}

export const dom = new DomCache();
