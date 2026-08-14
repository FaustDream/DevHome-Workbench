/**
 * 全局事件总线
 *
 * 提供模块间松耦合通信：on / once / emit。
 * bindGlobalEvents 绑定数字键切换搜索引擎等全局键盘事件。
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

/** 绑定全局键盘（数字键 1-9 切引擎，仅非输入状态） */
export function bindGlobalEvents(): void {
  document.addEventListener('keydown', async (e) => {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target !== null && typeof target.matches === 'function' && target.matches('input, textarea, [contenteditable]');
    if (/^[1-9]$/.test(e.key) && !isTyping) {
      const m = await import('../index/navigation');
      m.switchEngineByNumber(Number(e.key));
    }
  });
}
