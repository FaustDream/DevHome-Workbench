/**
 * 分类 UI
 *
 * 分类按钮 DOM：
 * `<button class="cat-btn[ active]" data-page="idx">`
 *   `.cat-btn-label`（分类名）
 *   `.cat-delete-btn`（SVG ×，分类编辑模式显示）
 * 交互：左键点击切页、右键弹出菜单（重命名/删除）、长按拖拽重排（目标位高亮）。
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
import { showPrompt, showConfirm } from './dialogs';
import { showPopover } from './popover';

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
      void confirmDeleteCategory(idx, name);
    });
    del.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        void confirmDeleteCategory(idx, name);
      }
    });
    btn.appendChild(del);

    // 左键点击切页
    btn.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cat-delete-btn') !== null) return;
      void changePageWithAnimation(idx);
    });

    // 右键弹出菜单（重命名 / 删除）
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPopover(btn, [
        {
          label: '重命名',
          icon: icon('edit'),
          action: () => void renameCategoryAt(idx),
        },
        {
          label: '删除',
          icon: icon('trash'),
          danger: true,
          action: () => void confirmDeleteCategory(idx, name),
        },
      ], { x: e.clientX, y: e.clientY });
    });

    // 双击分类名 → 重命名
    label.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void renameCategoryAt(idx);
    });

    fragment.appendChild(btn);
  });

  // 分类行末尾的 + 按钮（快速新建分类）
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'cat-add-btn';
  addBtn.title = '新建分类';
  addBtn.setAttribute('aria-label', '新建分类');
  addBtn.innerHTML = icon('plus', 'dh-icon--sm');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void promptAddPage();
  });
  fragment.appendChild(addBtn);

  row.replaceChildren(fragment);
  row.classList.toggle('visible', state.settings.catRow);
  // 关键修复：根据编辑模式切换 CSS 类（控制删除按钮显隐）
  row.classList.toggle('category-edit-mode', state.categoryEditMode);
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

/** 双击分类名 → 弹出重命名弹窗 */
async function renameCategoryAt(idx: number): Promise<void> {
  const oldName = state.pageNames[idx];
  if (oldName === undefined) return;
  const values = await showPrompt('重命名分类', {
    title: '重命名分类',
    fields: [
      { name: 'name', label: '分类名称', defaultValue: oldName },
    ],
    confirmText: '保存',
  });
  if (values === null) return;
  const v = values as { name?: string };
  const newName = (v.name ?? '').trim();
  if (newName === '' || newName === oldName) return;
  await tileManager.renamePageAt(idx, newName);
  renderCatRow();
}

/** 确认后删除分类（R15 统一 showConfirm，至少保留 1 页） */
async function confirmDeleteCategory(idx: number, name: string): Promise<void> {
  if (state.totalPages <= 1) {
    await showConfirm('至少需要保留一个分类页面。', { title: '无法删除' });
    return;
  }
  const ok = await showConfirm(`确定要删除分类「${name}」吗？\n分类中的磁贴将被清空。`, { title: '删除分类', danger: true });
  if (!ok) return;
  await tileManager.removePageAt(idx);
  refreshCatRowIfVisible();
}

/** 弹出新建分类弹窗，确认后创建空分类 */
async function promptAddPage(): Promise<void> {
  const name = await showPrompt('新建分类', {
    title: '新建分类',
    placeholder: '分类名称',
    confirmText: '创建',
  });
  if (name === null) return;
  const trimmed = (name as string).trim();
  if (trimmed === '') return;
  await tileManager.addNewPage(trimmed);
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
