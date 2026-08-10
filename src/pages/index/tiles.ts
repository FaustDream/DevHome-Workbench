/**
 * 磁贴管理（对齐原版 js/tiles.js）
 *
 * 渲染 DOM 结构对齐原版：
 * `<a class="tile" data-tile-id data-index style="--tile-color">`
 *   `.tile-icon-wrap > img.tile-img`（favicon，失败回退字母）
 *   `.tile-label` / `.tile-delete-btn`（svg x）
 * 拖拽：长按 600ms 启动 → mousemove 跟随 → 目标位高亮 → mouseup 完成重排；触屏等价。
 */

import { LS_KEYS, TILE_LONG_PRESS_MS } from '../../shared/constants';
import type { Tile } from '../../shared/types';
import { isTileId } from '../../shared/guards';
import { localStorageService } from './storage';
import { dom, state } from './state';
import { pageManager } from './page-manager';
import { loadFavicon } from './favicon';
import { openUrl } from './link-opener';
import { icon, ICONS } from './icons';

/* ================= 数据操作 ================= */

export const tileManager = {
  /** 从 pageManager 加载页数据，更新 currentTiles */
  async load(): Promise<void> {
    await pageManager.load();
    this.updateCurrentTiles();
  },

  /** 用当前页数据刷新 currentTiles，并按 position 排序 */
  updateCurrentTiles(): void {
    const page = pageManager.getCurrentPageData();
    state.currentTiles = page === null ? [] : page.tiles.slice().sort((a, b) => a.position - b.position);
  },

  /** 保存：写回 position 与数组下标一致 → updateCurrentPage → save */
  async save(): Promise<void> {
    const tiles = state.currentTiles.slice().map((t, i) => ({ ...t, position: i }));
    const nextPages = pageManager.updateCurrentPage(state.pagesData, tiles);
    await pageManager.save(nextPages);
    this.updateCurrentTiles();
  },

  /** 新增磁贴 */
  add(tile: Tile): Tile[] {
    const tiles = state.currentTiles.slice();
    tiles.push({ ...tile, position: tiles.length });
    state.currentTiles = tiles;
    void this.save();
    renderTiles();
    return tiles;
  },

  /** 删除磁贴（按 id） */
  remove(tileId: Tile['id']): void {
    if (!isTileId(tileId)) return;
    state.currentTiles = state.currentTiles.filter((t) => t.id !== tileId);
    void this.save();
    renderTiles();
  },

  /** 更新磁贴属性（按 id） */
  update(tileId: Tile['id'], updates: Partial<Omit<Tile, 'id'>>): void {
    state.currentTiles = state.currentTiles.map((t) => (t.id === tileId ? { ...t, ...updates } : t));
    void this.save();
    renderTiles();
  },

  /** 拖拽重排 */
  reorder(fromIndex: number, toIndex: number): void {
    const tiles = state.currentTiles.slice();
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= tiles.length || toIndex >= tiles.length) {
      return;
    }
    const [moved] = tiles.splice(fromIndex, 1);
    if (moved === undefined) return;
    tiles.splice(toIndex, 0, moved);
    state.currentTiles = tiles;
    void this.save();
    renderTiles();
  },

  /** 切页（支持分类记忆写 last_page） */
  async changePage(pageIndex: number): Promise<void> {
    if (pageIndex < 0 || pageIndex >= state.totalPages || pageIndex === state.currentPage) return;
    state.currentPage = pageIndex;
    if (state.settings.categoryMemory) {
      localStorageService.set(LS_KEYS.LAST_PAGE, pageIndex);
    }
    this.updateCurrentTiles();
    renderTiles();
  },

  /** 新增空白页 */
  async addNewPage(): Promise<void> {
    const nextPages = pageManager.addPage(state.pagesData);
    state.pagesData = nextPages;
    state.pageNames = nextPages.map((p) => p.name);
    state.totalPages = nextPages.length;
    state.currentPage = nextPages.length - 1;
    await pageManager.save(nextPages);
    this.updateCurrentTiles();
  },

  /** 删除当前页 */
  async removeCurrentPage(): Promise<void> {
    const nextPages = pageManager.removePageWithStrategy(state.pagesData, state.currentPage);
    if (nextPages.length === state.pagesData.length) return; // 至少保留一页
    state.pagesData = nextPages;
    state.pageNames = nextPages.map((p) => p.name);
    state.totalPages = nextPages.length;
    await pageManager.save(nextPages);
    this.updateCurrentTiles();
  },

  /** 重命名当前页 */
  async renameCurrentPage(newName: string): Promise<void> {
    const nextPages = pageManager.renamePage(state.pagesData, state.currentPage, newName);
    state.pagesData = nextPages;
    state.pageNames = nextPages.map((p) => p.name);
    await pageManager.save(nextPages);
  },

  /** 删除指定页 */
  async removePageAt(pageIndex: number): Promise<void> {
    const nextPages = pageManager.removePageWithStrategy(state.pagesData, pageIndex);
    if (nextPages.length === state.pagesData.length) return;
    state.pagesData = nextPages;
    state.pageNames = nextPages.map((p) => p.name);
    state.totalPages = nextPages.length;
    await pageManager.save(nextPages);
    this.updateCurrentTiles();
  },

  /** 页面重排 */
  async reorderPage(fromIndex: number, toIndex: number): Promise<void> {
    const nextPages = pageManager.reorderPage(state.pagesData, fromIndex, toIndex);
    state.pagesData = nextPages;
    state.pageNames = nextPages.map((p) => p.name);
    await pageManager.save(nextPages);
    this.updateCurrentTiles();
  },

  /** 将磁贴移动到目标分类 */
  moveTileToPage(tileId: Tile['id'], targetPageIndex: number): void {
    if (targetPageIndex === state.currentPage) return;
    const page = pageManager.getCurrentPageData();
    if (page === null) return;
    const tile = page.tiles.find((t) => t.id === tileId);
    if (tile === undefined) return;
    this.remove(tileId);
    const nextPages = state.pagesData.slice();
    const target = nextPages[targetPageIndex];
    if (target !== undefined) {
      nextPages[targetPageIndex] = { ...target, tiles: target.tiles.concat([{ ...tile, position: target.tiles.length }]) };
    }
    state.pagesData = nextPages;
    void pageManager.save(nextPages);
  },

  /** 将磁贴复制到目标分类 */
  copyTileToPage(tileId: Tile['id'], targetPageIndex: number): void {
    if (targetPageIndex === state.currentPage) return;
    const page = pageManager.getCurrentPageData();
    if (page === null) return;
    const tile = page.tiles.find((t) => t.id === tileId);
    if (tile === undefined) return;
    const nextPages = state.pagesData.slice();
    const target = nextPages[targetPageIndex];
    if (target !== undefined) {
      nextPages[targetPageIndex] = { ...target, tiles: target.tiles.concat([{ ...tile, position: target.tiles.length }]) };
    }
    state.pagesData = nextPages;
    void pageManager.save(nextPages);
  },
};

/* ================= 渲染 ================= */

/**
 * 渲染磁贴网格（对齐原版 DOM）
 * tilesContainer 通过 `tile-edit-mode` 类控制删除按钮显示
 * 空状态：显示 `#hiddenMessage` 引导（提示如何添加快捷方式 + 添加快捷方式按钮）
 */
export function renderTiles(container: HTMLElement | null = dom.get('#tilesContainer')): void {
  if (container === null) return;
  const fragment = document.createDocumentFragment();
  for (const tile of state.currentTiles) {
    fragment.appendChild(buildTileElement(tile));
  }
  container.replaceChildren(fragment);
  container.classList.toggle('tile-edit-mode', state.tileEditMode);

  // 空状态引导：让用户知道如何添加
  const hidden = document.getElementById('hiddenMessage');
  if (hidden !== null) {
    if (state.currentTiles.length === 0) {
      hidden.style.display = '';
      hidden.replaceChildren();
      const hint = document.createElement('div');
      hint.className = 'hidden-message-hint';
      hint.textContent = '此分类暂无快捷方式';
      const sub = document.createElement('div');
      sub.className = 'hidden-message-sub';
      sub.textContent = '点击下方按钮，或右键空白处「新添磁贴」';
      const addBtn = document.createElement('button');
      addBtn.className = 'hidden-message-add';
      addBtn.textContent = '+ 添加快捷方式';
      addBtn.setAttribute('aria-label', '添加快捷方式');
      addBtn.addEventListener('click', () => void promptAddTile());
      hidden.appendChild(hint);
      hidden.appendChild(sub);
      hidden.appendChild(addBtn);
    } else {
      hidden.style.display = 'none';
    }
  }
}

/** 空状态添加快捷方式（自定义弹窗，R15） */
async function promptAddTile(): Promise<void> {
  const { showPrompt } = await import('./dialogs');
  const values = await showPrompt('添加新磁贴', {
    title: '添加新磁贴',
    fields: [
      { name: 'label', label: '磁贴名称', placeholder: '例如：GitHub' },
      { name: 'url', label: '网址', placeholder: 'https://...', defaultValue: 'https://' },
    ],
    confirmText: '添加',
  });
  if (values === null) return;
  const v = values as { label?: string; url?: string };
  const url = (v.url ?? '').trim();
  if (url === '' || url === 'https://') return;
  const label = (v.label ?? '').trim();
  tileManager.add({
    id: `tile_${Date.now()}_${Math.floor(Math.random() * 1000)}` as Tile['id'],
    label: label || url,
    url,
    type: 'favicon',
    icon: '',
    color: '#4a9eff',
    position: state.currentTiles.length,
    imageData: '',
  });
}

/** 构建单个磁贴 DOM（对齐原版） */
export function buildTileElement(tile: Tile): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'tile';
  a.href = tile.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.title = tile.label;
  a.dataset.tileId = tile.id;
  a.draggable = false;
  a.style.setProperty('--tile-color', tile.color || '#4a9eff');

  // 图标区
  const iconWrap = document.createElement('div');
  iconWrap.className = 'tile-icon-wrap';
  const img = document.createElement('img');
  img.className = 'tile-img';
  img.width = 56;
  img.height = 56;
  img.decoding = 'async';
  iconWrap.appendChild(img);
  // favicon 加载（含字母兜底，失败时 img 移除、iconWrap 显示首字符）
  if (tile.imageData) {
    img.src = tile.imageData;
  } else {
    void loadFavicon(tile.url, img, iconWrap, tile.label);
  }

  // 标签
  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = tile.label;

  // 删除按钮（编辑模式）
  const deleteBtn = document.createElement('span');
  deleteBtn.className = 'tile-delete-btn';
  deleteBtn.setAttribute('role', 'button');
  deleteBtn.tabIndex = 0;
  deleteBtn.dataset.tileDelete = tile.id;
  deleteBtn.setAttribute('aria-label', `删除 ${tile.label}`);
  deleteBtn.innerHTML = icon(ICONS.X, 'dh-icon--sm');
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    tileManager.remove(tile.id);
  });
  deleteBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      tileManager.remove(tile.id);
    }
  });

  a.appendChild(iconWrap);
  a.appendChild(label);
  a.appendChild(deleteBtn);

  a.addEventListener('click', (e) => {
    if (state.dragMoved || state.preventNextTileClick || state.tileEditMode) {
      e.preventDefault();
      state.dragMoved = false;
      state.preventNextTileClick = false;
      return;
    }
    e.preventDefault();
    void openUrl(tile.url, { type: 'tiles' });
  });
  return a;
}

/* ================= 删除模式 ================= */

/** 是否处于删除模式 */
export function isTileDeleteModeActive(): boolean {
  return state.tileEditMode;
}

/** 切换删除模式并重渲染 */
export function setTileDeleteMode(active: boolean): void {
  state.tileEditMode = active;
  const container = dom.get('#tilesContainer');
  container?.classList.toggle('tile-edit-mode', active);
}

/* ================= 拖拽系统（对齐原版：长按 + 跟随 + 目标位高亮 + 触屏） ================= */

interface DragPointer {
  tile: HTMLElement | null;
  index: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  moved: boolean;
  ready: boolean;
  active: boolean;
}

const pointer: DragPointer = {
  tile: null,
  index: -1,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  longPressTimer: null,
  moved: false,
  ready: false,
  active: false,
};

function isTouch(e: Event): boolean {
  return 'touches' in e;
}

function getClientPos(e: Event): { x: number; y: number } {
  if (isTouch(e)) {
    const touch = (e as TouchEvent).touches[0];
    return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
  }
  const me = e as MouseEvent;
  return { x: me.clientX, y: me.clientY };
}

/** 绑定拖拽事件（事件委托到容器，一次绑定 R5） */
export function attachTileDrag(container: HTMLElement): void {
  container.addEventListener('mousedown', onPointerDown);
  container.addEventListener('touchstart', onPointerDown, { passive: false });
  container.addEventListener('contextmenu', onTileContextMenu);
  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('mouseup', onPointerUp);
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('touchend', onPointerUp);
}

function onTileContextMenu(e: Event): void {
  const target = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (target === null) return;
  const id = target.dataset.tileId;
  if (id === undefined || !isTileId(id)) return;
  e.preventDefault();
  // 交给 context-menu 模块处理
  const detail = new CustomEvent('dh:tile-contextmenu', {
    detail: { tileId: id, clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY },
    bubbles: true,
  });
  target.dispatchEvent(detail);
}

function onPointerDown(e: Event): void {
  const target = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (target === null) return;
  if ((e.target as HTMLElement).closest('.tile-delete-btn') !== null) return;
  if (e instanceof MouseEvent && e.button !== 0) return;
  if (isTouch(e)) e.preventDefault();

  const id = target.dataset.tileId;
  if (id === undefined || !isTileId(id)) return;
  const index = state.currentTiles.findIndex((t) => t.id === id);
  if (index < 0) return;

  const pos = getClientPos(e);
  pointer.tile = target;
  pointer.index = index;
  pointer.startX = pos.x;
  pointer.startY = pos.y;
  pointer.currentX = pos.x;
  pointer.currentY = pos.y;
  pointer.moved = false;
  pointer.ready = false;
  pointer.active = true;

  pointer.longPressTimer = setTimeout(() => {
    pointer.ready = true;
    pointer.tile?.classList.add('long-pressing');
  }, TILE_LONG_PRESS_MS);
}

function onPointerMove(e: Event): void {
  if (!pointer.active || pointer.tile === null) return;
  const pos = getClientPos(e);
  pointer.currentX = pos.x;
  pointer.currentY = pos.y;
  if (pointer.ready) {
    pointer.moved = true;
    if (isTouch(e)) e.preventDefault();
    positionDragTile();
    highlightDropTarget();
  }
}

function onPointerUp(): void {
  if (pointer.longPressTimer !== null) {
    clearTimeout(pointer.longPressTimer);
    pointer.longPressTimer = null;
  }
  if (!pointer.active) return;
  const tile = pointer.tile;
  if (pointer.ready && pointer.moved && tile !== null) {
    const target = document.querySelector<HTMLElement>('.tile.drag-over');
    const toId = target?.dataset.tileId;
    if (toId !== undefined) {
      const toIndex = state.currentTiles.findIndex((t) => t.id === toId);
      if (toIndex >= 0 && toIndex !== pointer.index) {
        tileManager.reorder(pointer.index, toIndex);
      }
    }
    state.preventNextTileClick = true;
  }
  resetDragState();
}

function resetDragState(): void {
  document.querySelectorAll('.tile.long-pressing, .tile.dragging, .tile.drag-over').forEach((el) => {
    el.classList.remove('long-pressing', 'dragging', 'drag-over');
    (el as HTMLElement).style.position = '';
    (el as HTMLElement).style.left = '';
    (el as HTMLElement).style.top = '';
    (el as HTMLElement).style.zIndex = '';
  });
  pointer.tile = null;
  pointer.index = -1;
  pointer.moved = false;
  pointer.ready = false;
  pointer.active = false;
}

/** 拖拽跟随定位 */
function positionDragTile(): void {
  const tile = pointer.tile;
  if (tile === null) return;
  const rect = tile.getBoundingClientRect();
  tile.classList.add('dragging');
  tile.style.position = 'fixed';
  tile.style.left = `${pointer.currentX - rect.width / 2}px`;
  tile.style.top = `${pointer.currentY - rect.height / 2}px`;
  tile.style.zIndex = '9999';
}

/** 目标位高亮 */
function highlightDropTarget(): void {
  document.querySelectorAll('.tile.drag-over').forEach((el) => el.classList.remove('drag-over'));
  const tiles = document.querySelectorAll<HTMLElement>('.tile:not(.dragging)');
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const t of Array.from(tiles)) {
    const r = t.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = (pointer.currentX - cx) ** 2 + (pointer.currentY - cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  if (best !== null && best.dataset.tileId !== pointer.tile?.dataset.tileId) {
    best.classList.add('drag-over');
  }
}


