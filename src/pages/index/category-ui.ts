/**
 * 分类 UI（对齐原版 js/categoryUI.js）
 *
 * 分类按钮 DOM：
 * `<button class="cat-btn[ active]" data-page="idx">`
 *   `.cat-btn-label`（分类名）
 *   `.cat-delete-btn`（SVG ×，分类编辑模式显示）
 * 交互：点击切页、长按拖拽重排（目标位高亮）、右键进入分类编辑模式。
 */

import { info } from '../../lib/logger';
import {
  CATEGORY_LONG_PRESS_MS,
  LS_KEYS,
  WHEEL_PAGE_COOLDOWN_MS,
  WHEEL_PAGE_THRESHOLD,
} from '../../shared/constants';
import { state, dom } from './state';
import { localStorageService } from './storage';
import { tileManager } from './tiles';
import { icon } from './icons';

const MODULE = 'category-ui';

/* ================= 分类行渲染 ================= */

/** 渲染分类按钮行（对齐原版 innerHTML 结构，DocumentFragment 构建） */
export function renderCatRow(): void {
  const row = dom.get('#catRow');
  if (row === null) return;
  const fragment = document.createDocumentFragment();

  state.pageNames.forEach((name, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = idx === state.currentPage ? 'cat-btn active' : 'cat-btn';
    btn.dataset.page = String(idx);

    const label = document.createElement('span');
    label.className = 'cat-btn-label';
    label.textContent = name;
    btn.appendChild(label);

    const del = document.createElement('span');
    del.className = 'cat-delete-btn';
    del.setAttribute('role', 'button');
    del.tabIndex = 0;
    del.dataset.catDelete = String(idx);
    del.setAttribute('aria-label', `删除分类 ${name}`);
    del.innerHTML = icon('x', 'dh-icon--sm');
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      void tileManager.removePageAt(idx).then(() => refreshCatRowIfVisible());
    });
    del.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        void tileManager.removePageAt(idx).then(() => refreshCatRowIfVisible());
      }
    });
    btn.appendChild(del);

    btn.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cat-delete-btn') !== null) return;
      void changePageWithAnimation(idx);
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setCategoryEditMode(!state.categoryEditMode);
    });
    fragment.appendChild(btn);
  });

  row.replaceChildren(fragment);
  row.classList.toggle('visible', state.settings.catRow);
}

/** 刷新分类行（若开启） */
export function refreshCatRowIfVisible(): void {
  if (state.settings.catRow) {
    renderCatRow();
  }
}

/** 开关分类按钮行并持久化 */
export function applyCategoryButtonMode(enabled: boolean, save = true): void {
  state.settings.catRow = enabled;
  if (save) {
    localStorageService.setRaw(LS_KEYS.CAT_ROW, String(enabled));
  }
  if (enabled) {
    renderCatRow();
  } else {
    const row = dom.get('#catRow');
    if (row !== null) row.replaceChildren();
  }
}

/** 切换分类编辑模式（显示删除按钮）并重渲染 */
export function setCategoryEditMode(active: boolean): void {
  state.categoryEditMode = active;
  renderCatRow();
}

/* ================= 切页动画 ================= */

/** 带动画切页（含越界/重复保护 + 分类记忆） */
export async function changePageWithAnimation(newPage: number): Promise<void> {
  if (state.pageTransition) return;
  if (newPage < 0 || newPage >= state.totalPages || newPage === state.currentPage) return;

  state.pageTransition = true;
  try {
    await tileManager.changePage(newPage);
    if (state.settings.catRow) renderCatRow();
  } finally {
    state.pageTransition = false;
  }
}

/* ================= 滚轮翻页 ================= */

/** 滚轮翻页累加器与冷却 */
const wheelState = {
  accumulator: 0,
  lastTriggerAt: 0,
};

/** 滚轮翻页处理器（阈值 + 冷却，方向反转清零） */
export function handleWheelScroll(e: WheelEvent): void {
  const now = Date.now();
  if (now - wheelState.lastTriggerAt < WHEEL_PAGE_COOLDOWN_MS) return;
  if (state.pageTransition) return;

  const deltaY = e.deltaY;
  if ((deltaY > 0 && wheelState.accumulator < 0) || (deltaY < 0 && wheelState.accumulator > 0)) {
    wheelState.accumulator = 0;
  }
  wheelState.accumulator += deltaY;

  if (Math.abs(wheelState.accumulator) >= WHEEL_PAGE_THRESHOLD) {
    const direction = wheelState.accumulator > 0 ? 1 : -1;
    wheelState.accumulator = 0;
    wheelState.lastTriggerAt = now;
    const target = state.currentPage + direction;
    if (target >= 0 && target < state.totalPages) {
      info(MODULE, `滚轮翻页`, { from: state.currentPage, to: target });
      void changePageWithAnimation(target);
    }
  }
}

/* ================= 分类拖拽重排（长按） ================= */

const catDrag = {
  fromIndex: -1,
  btn: null as HTMLElement | null,
  timer: null as ReturnType<typeof setTimeout> | null,
};

/** 绑定分类行拖拽（长按进入，跟随，松手重排） */
export function attachCategoryDrag(row: HTMLElement): void {
  row.addEventListener('mousedown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.cat-btn');
    if (btn === null || btn.dataset.page === undefined) return;
    if ((e.target as HTMLElement).closest('.cat-delete-btn') !== null) return;
    if (e.button !== 0) return;
    catDrag.fromIndex = Number(btn.dataset.page);
    catDrag.btn = btn;
    catDrag.timer = setTimeout(() => {
      btn.classList.add('dragging');
    }, CATEGORY_LONG_PRESS_MS);
  });

  row.addEventListener('mousemove', (e) => {
    if (catDrag.btn === null || !catDrag.btn.classList.contains('dragging')) return;
    const rect = catDrag.btn.getBoundingClientRect();
    catDrag.btn.style.position = 'fixed';
    catDrag.btn.style.left = `${e.clientX - rect.width / 2}px`;
    catDrag.btn.style.top = `${e.clientY - rect.height / 2}px`;
    catDrag.btn.style.zIndex = '9999';
    highlightCatDropTarget(e.clientX, e.clientY);
  });

  row.addEventListener('mouseup', () => {
    if (catDrag.timer !== null) {
      clearTimeout(catDrag.timer);
      catDrag.timer = null;
    }
    if (catDrag.fromIndex < 0) return;
    const target = row.querySelector<HTMLElement>('.cat-btn.drag-over');
    if (target !== null && target.dataset.page !== undefined) {
      const toIndex = Number(target.dataset.page);
      if (toIndex !== catDrag.fromIndex) {
        void tileManager.reorderPage(catDrag.fromIndex, toIndex).then(() => refreshCatRowIfVisible());
      }
    }
    row.querySelectorAll('.cat-btn.dragging, .cat-btn.drag-over').forEach((el) => {
      (el as HTMLElement).classList.remove('dragging', 'drag-over');
      (el as HTMLElement).style.position = '';
      (el as HTMLElement).style.left = '';
      (el as HTMLElement).style.top = '';
      (el as HTMLElement).style.zIndex = '';
    });
    catDrag.fromIndex = -1;
    catDrag.btn = null;
  });
}

/** 分类目标位高亮 */
function highlightCatDropTarget(x: number, y: number): void {
  const row = dom.get('#catRow');
  if (row === null) return;
  row.querySelectorAll('.cat-btn.drag-over').forEach((el) => el.classList.remove('drag-over'));
  const btns = row.querySelectorAll<HTMLElement>('.cat-btn:not(.dragging)');
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const btn of Array.from(btns)) {
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = btn;
    }
  }
  if (best !== null && best.dataset.page !== String(catDrag.fromIndex)) {
    best.classList.add('drag-over');
  }
}
