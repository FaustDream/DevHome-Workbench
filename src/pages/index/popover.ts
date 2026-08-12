/**
 * 简易 Popover 组件
 *
 * 用于磁贴和分类的右键弹出菜单（编辑 / 删除）。
 * 单例：同一时间仅一个 popover 可见；点击外部自动关闭。
 */

/** Popover 菜单项 */
export interface PopoverItem {
  label: string;
  icon?: string | undefined;
  danger?: boolean | undefined;
  action: () => void;
}

/** 当前显示的 popover DOM（单例） */
let _current: HTMLElement | null = null;

/** 全局关闭监听（绑定一次） */
let _globalBound = false;

/** 销毁当前 popover */
function destroyCurrent(): void {
  if (_current !== null && document.body.contains(_current)) {
    _current.remove();
  }
  _current = null;
}

/** 绑定全局关闭（mousedown + Esc） */
function ensureGlobalClose(): void {
  if (_globalBound) return;
  _globalBound = true;
  document.addEventListener('mousedown', (e) => {
    if (_current === null) return;
    const target = e.target as HTMLElement;
    if (target.closest('.dh-popover') !== null) return;
    destroyCurrent();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') destroyCurrent();
  });
}

/**
 * 显示 popover 菜单
 * @param anchor 触发元素（用于 fallback 定位）
 * @param items 菜单项列表
 * @param at 可选鼠标坐标 {x, y}；提供时菜单定位到鼠标位置，否则定位到 anchor 右下
 */
export function showPopover(
  anchor: HTMLElement,
  items: readonly PopoverItem[],
  at?: { x: number; y: number },
): void {
  destroyCurrent();
  ensureGlobalClose();

  const menu = document.createElement('div');
  menu.className = 'dh-popover';
  menu.setAttribute('role', 'menu');

  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'dh-popover-item';
    el.setAttribute('role', 'menuitem');
    el.tabIndex = 0;
    if (item.danger) el.classList.add('danger');

    // 图标
    if (item.icon !== undefined) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'dh-popover-icon';
      iconSpan.innerHTML = item.icon;
      el.appendChild(iconSpan);
    }

    // 文字
    const label = document.createElement('span');
    label.textContent = item.label;
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      destroyCurrent();
      item.action();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        destroyCurrent();
        item.action();
      }
    });

    menu.appendChild(el);
  }

  // 先挂到 body 获取菜单尺寸
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);

  const menuRect = menu.getBoundingClientRect();
  const padding = 8;
  const gap = 4;

  let x: number;
  let y: number;

  if (at !== undefined) {
    // 按鼠标坐标定位：默认显示在鼠标右下方
    x = at.x + gap;
    y = at.y + gap;
  } else {
    // fallback：anchor 元素右下
    const anchorRect = anchor.getBoundingClientRect();
    x = anchorRect.right - padding;
    y = anchorRect.bottom + gap;
  }

  // 边界处理：右侧越界则翻到鼠标左侧
  if (x + menuRect.width + padding > window.innerWidth) {
    x = (at?.x ?? x) - menuRect.width - gap;
  }
  // 底部越界则翻到鼠标上方
  if (y + menuRect.height + padding > window.innerHeight) {
    y = (at?.y ?? y) - menuRect.height - gap;
  }

  // 最终钳位，确保不超出屏幕
  const minX = padding;
  const minY = padding;
  const maxX = window.innerWidth - menuRect.width - padding;
  const maxY = window.innerHeight - menuRect.height - padding;
  menu.style.left = `${Math.max(minX, Math.min(x, maxX))}px`;
  menu.style.top = `${Math.max(minY, Math.min(y, maxY))}px`;
  menu.style.visibility = '';

  _current = menu;
}
