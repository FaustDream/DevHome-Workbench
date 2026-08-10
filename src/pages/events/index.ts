/**
 * 全局事件总线（对齐原版 js/events/ 11 子模块的统一抽象）
 *
 * 原版 events/ 下有 category-events / notebook-events / toolbar-events / quadrant-events /
 * calendar-events / pomodoro-events / filter-events / settings-events / search-events /
 * global-events / misc-events。TS 重构合并为统一 EventBus + 按域命名空间，
 * 各域模块通过 `events.on('category:change', ...)` 订阅。
 */

const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

/** 订阅事件（返回退订函数） */
export function on(event: string, handler: (...args: unknown[]) => void): () => void {
  let set = listeners.get(event);
  if (set === undefined) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
  };
}

/** 一次性订阅 */
export function once(event: string, handler: (...args: unknown[]) => void): void {
  const off = on(event, (...args) => {
    off();
    handler(...args);
  });
}

/** 发布事件 */
export function emit(event: string, ...args: unknown[]): void {
  const set = listeners.get(event);
  if (set !== undefined) {
    for (const fn of set) {
      try {
        fn(...args);
      } catch {
        // 订阅者异常不影响其他
      }
    }
  }
}

/** 常用事件名（统一管理，R19） */
export const EVENTS = {
  // 磁贴
  TILE_ADD: 'tile:add',
  TILE_REMOVE: 'tile:remove',
  TILE_UPDATE: 'tile:update',
  TILES_RENDER: 'tiles:render',
  // 分类
  CATEGORY_ADD: 'category:add',
  CATEGORY_RENAME: 'category:rename',
  CATEGORY_REMOVE: 'category:remove',
  CATEGORY_CHANGE: 'category:change',
  CATROW_RENDER: 'catrow:render',
  // 搜索
  SEARCH_INPUT: 'search:input',
  SEARCH_SELECT: 'search:select',
  // 设置
  SETTINGS_CHANGE: 'settings:change',
  THEME_CHANGE: 'theme:change',
  // 工作台
  WORKBENCH_ENTER: 'workbench:enter',
  WORKBENCH_EXIT: 'workbench:exit',
  // 全局
  STORAGE_CHANGE: 'storage:change',
} as const;

/** 绑定全局键盘（global-events 对齐：Esc 关闭面板/数字键切引擎等） */
export function bindGlobalEvents(): void {
  document.addEventListener('keydown', async (e) => {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target !== null && typeof target.matches === 'function' && target.matches('input, textarea, [contenteditable]');
    // Esc 不做全局拦截（工作台已移除）
    // 数字键 1-8 切引擎（仅日常模式）
    if (/^[1-8]$/.test(e.key) && !isTyping) {
      const m = await import('../index/navigation');
      m.switchEngineByNumber(Number(e.key));
    }
  });
}
