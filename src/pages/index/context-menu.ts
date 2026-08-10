/**
 * 右键菜单（对齐原版 js/ui/_context-menu.js + index.html #contextMenu/#blankContextMenu/#ctxCategorySubMenu）
 *
 * - 磁贴右键：编辑 / 删除 / 重新获取图片 / 上传图片 / 上传磁贴 / 移动到分类 / 复制到分类
 * - 空白右键：刷新 / 新添磁贴 / 新建分类
 * - 分类子菜单：#ctxCategorySubMenu（移动到/复制到分类时弹出，列出所有分类）
 * 打开方式：tiles.ts 在磁贴 contextmenu 时 dispatch `dh:tile-contextmenu` 事件。
 */

import { info, warn } from '../../lib/logger';
import type { TileId } from '../../shared/types';
import { isTileId } from '../../shared/guards';
import { state } from './state';
import { tileManager, renderTiles, setTileDeleteMode } from './tiles';
import { pageManager } from './page-manager';
import { refreshCatRowIfVisible } from './category-ui';
import { showPrompt } from './dialogs';
import type { PromptFieldValues } from './dialogs';

const MODULE = 'context-menu';

/** 当前上下文：磁贴 id */
let activeTileId: TileId | null = null;

/** 隐藏所有菜单 */
export function hideAllMenus(): void {
  const menus = document.querySelectorAll<HTMLElement>('.context-menu');
  menus.forEach((m) => {
    m.classList.remove('visible');
    m.style.left = '';
    m.style.top = '';
  });
}

/** 定位并显示菜单 */
function showMenuAt(menu: HTMLElement, x: number, y: number): void {
  menu.classList.add('visible');
  // 边界约束：防溢出视口
  const rect = menu.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;
  menu.style.left = `${Math.min(x, Math.max(8, maxX))}px`;
  menu.style.top = `${Math.min(y, Math.max(8, maxY))}px`;
}

/** 显示磁贴右键菜单 */
export function showTileContextMenu(tileId: TileId, x: number, y: number): void {
  activeTileId = tileId;
  const menu = document.getElementById('contextMenu');
  if (menu === null) return;
  hideAllMenus();
  showMenuAt(menu, x, y);
  // 聚焦模式（工作台未实现）隐藏日常专属项
  menu.querySelectorAll('.ctx-daily-only').forEach((el) => {
    (el as HTMLElement).style.display = '';
  });
}

/** 显示空白右键菜单 */
export function showBlankContextMenu(x: number, y: number): void {
  activeTileId = null;
  const menu = document.getElementById('blankContextMenu');
  if (menu === null) return;
  hideAllMenus();
  showMenuAt(menu, x, y);
}

/** 是否有可见菜单（防重复触发） */
function hasVisibleMenu(): boolean {
  return document.querySelector('.context-menu.visible') !== null;
}

/** 显示分类子菜单（移动到/复制到分类） */
function showCategorySubMenu(x: number, y: number, action: 'move' | 'copy'): void {
  const subMenu = document.getElementById('ctxCategorySubMenu');
  if (subMenu === null) return;
  subMenu.replaceChildren();
  state.pageNames.forEach((name, idx) => {
    if (idx === state.currentPage) return;
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.textContent = name;
    item.dataset.categoryIndex = String(idx);
    item.addEventListener('click', () => {
      if (activeTileId === null) return;
      if (action === 'move') {
        tileManager.moveTileToPage(activeTileId, idx);
      } else {
        tileManager.copyTileToPage(activeTileId, idx);
      }
      renderTiles();
      refreshCatRowIfVisible();
      hideAllMenus();
      info(MODULE, `磁贴${action === 'move' ? '移动' : '复制'}到分类`, { name });
    });
    subMenu.appendChild(item);
  });
  hideAllMenus();
  showMenuAt(subMenu, x, y);
}

/** 处理磁贴菜单操作 */
function handleTileAction(action: string): void {
  if (activeTileId === null) return;
  switch (action) {
    case 'edit':
      editTile(activeTileId);
      break;
    case 'delete':
      tileManager.remove(activeTileId);
      break;
    case 'refreshImage':
    case 'uploadImage':
      // 图片类操作（简化：进入删除模式提示）
      info(MODULE, `图片操作（待完善）`, { action });
      break;
    case 'move': {
      const menu = document.getElementById('contextMenu');
      if (menu !== null) {
        const rect = menu.getBoundingClientRect();
        showCategorySubMenu(rect.right + 4, rect.top, 'move');
        return; // 子菜单接管，不立即隐藏
      }
      break;
    }
    case 'copy': {
      const menu = document.getElementById('contextMenu');
      if (menu !== null) {
        const rect = menu.getBoundingClientRect();
        showCategorySubMenu(rect.right + 4, rect.top, 'copy');
        return;
      }
      break;
    }
    default:
      warn(MODULE, `未知磁贴操作`, { action });
  }
  hideAllMenus();
}

/** 处理空白菜单操作 */
function handleBlankAction(action: string): void {
  switch (action) {
    case 'refresh':
      location.reload();
      break;
    case 'addTile': {
      void showPrompt('添加新磁贴', {
        title: '添加新磁贴',
        fields: [
          { name: 'label', label: '磁贴名称', placeholder: '例如：GitHub' },
          { name: 'url', label: '网址', placeholder: 'https://...', defaultValue: 'https://' },
        ],
        confirmText: '添加',
      }).then((values) => {
        if (values === null) return;
        const v = values as PromptFieldValues;
        const url = (v.url ?? '').trim();
        if (url === '' || url === 'https://') return;
        const label = (v.label ?? '').trim();
        const page = pageManager.getCurrentPageData();
        if (page === null) return;
        tileManager.add({
          id: `tile_${Date.now()}_${Math.floor(Math.random() * 1000)}` as TileId,
          label: label || url,
          url,
          type: 'favicon',
          icon: '',
          color: '#4a9eff',
          position: state.currentTiles.length,
          imageData: '',
        });
      });
      break;
    }
    case 'addPage':
      void tileManager.addNewPage().then(() => refreshCatRowIfVisible());
      break;
    default:
      warn(MODULE, `未知空白操作`, { action });
  }
  hideAllMenus();
}

/** 编辑磁贴（自定义弹窗表单，R15 禁止原生 prompt） */
function editTile(tileId: TileId): void {
  const page = pageManager.getCurrentPageData();
  const tile = page?.tiles.find((t) => t.id === tileId);
  if (page === undefined || tile === undefined) return;
  void showPrompt('编辑磁贴', {
    title: '编辑磁贴',
    fields: [
      { name: 'label', label: '磁贴名称', defaultValue: tile.label },
      { name: 'url', label: '网址', defaultValue: tile.url },
    ],
    confirmText: '保存',
  }).then((values) => {
    if (values === null) return;
    const v = values as PromptFieldValues;
    const label = (v.label ?? '').trim();
    const url = (v.url ?? '').trim();
    if (url === '') return;
    tileManager.update(tileId, { label: label || tile.label, url });
    info(MODULE, '磁贴已编辑', { tileId });
  });
}

/** 初始化右键菜单 */
export function initContextMenus(): void {
  // 磁贴右键（tiles.ts dispatch 的 dh:tile-contextmenu）
  document.addEventListener('dh:tile-contextmenu', ((e: Event) => {
    const detail = (e as CustomEvent).detail as { tileId: string; clientX: number; clientY: number };
    if (detail === undefined || !isTileId(detail.tileId)) return;
    showTileContextMenu(detail.tileId as TileId, detail.clientX, detail.clientY);
  }) as EventListener);

  // 空白右键：不在磁贴/分类/输入框上时显示空白菜单
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;

    // 点在已有磁贴/分类/搜索框/菜单/输入框上 → 由其各自的 handler 处理
    if (target.closest('.tile, .cat-btn, .search-wrapper, input, .context-menu, .engine-dropdown') !== null) return;

    // 如果当前菜单已是可见状态，说明用户是在菜单外右键想关闭它
    // → 仅关闭，不弹出新菜单
    if (hasVisibleMenu()) {
      hideAllMenus();
      e.preventDefault();
      return;
    }

    e.preventDefault();
    showBlankContextMenu(e.clientX, e.clientY);
  });

  // 磁贴菜单项点击
  const tileMenu = document.getElementById('contextMenu');
  tileMenu?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (item === null) return;
    e.preventDefault();
    e.stopPropagation();
    const action = item.dataset.action;
    if (action !== undefined) handleTileAction(action);
  });

  // 空白菜单项点击
  const blankMenu = document.getElementById('blankContextMenu');
  blankMenu?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (item === null) return;
    e.preventDefault();
    e.stopPropagation();
    const action = item.dataset.action;
    if (action !== undefined) handleBlankAction(action);
  });

  // 点击其他区域/Esc 隐藏（仅左键 button=0 关闭菜单；右键由 contextmenu 事件自身处理，避免时序竞争）
  document.addEventListener('mousedown', (e) => {
    const me = e as MouseEvent;
    if (me.button !== 0) return;
    if ((e.target as HTMLElement).closest('.context-menu') === null) {
      hideAllMenus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAllMenus();
  });
}

/** 进入删除模式（供右键菜单快捷入口） */
export function enterTileEditMode(): void {
  setTileDeleteMode(true);
}
