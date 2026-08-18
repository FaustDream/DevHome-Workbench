/**
 * 统一弹窗组件（对齐 R15 + 原版 css/ui-components.css）
 *
 * 【禁止使用浏览器原生弹窗】alert()/confirm()/prompt() 一律不允许出现在业务代码。
 * 本模块提供单一实现：
 * - {@link showConfirm}：确认弹窗 → Promise<boolean>
 * - {@link showPrompt}：输入弹窗 → Promise<string|null>（支持单输入/多输入）
 * - {@link showToast}：自动消失通知
 * - {@link createModal}：自定义内容弹窗（返回关闭函数）
 * 键盘支持：Enter 确认 / Esc 取消；焦点圈闭（打开聚焦首控件，关闭还原焦点）。
 * 样式使用 `.ui-overlay` + `.ui-dialog` + `.ui-input` + `.ui-btn-*`（已在 css/ui-components.css 定义）。
 */

/** 确认弹窗选项 */
export interface ConfirmOptions {
  title?: string;
  iconType?: 'info' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 输入字段定义（多输入用） */
export interface PromptField {
  name: string;
  label?: string;
  /** exactOptionalPropertyTypes 下允许显式 undefined */
  placeholder?: string | undefined;
  /** exactOptionalPropertyTypes 下允许显式 undefined */
  defaultValue?: string | undefined;
}

/** 单输入弹窗选项（不含 fields） */
export interface PromptOptions {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  iconType?: 'info' | 'warning';
}

/** 多输入弹窗选项（含 fields） */
export interface PromptMultiOptions extends PromptOptions {
  fields: PromptField[];
}

/** Toast 类型 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** 多输入结果 */
export interface PromptFieldValues {
  [name: string]: string;
}

let modalHost: HTMLElement | null = null;
/** 上次获得焦点的元素（关闭后还原） */
let lastFocused: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 获取弹窗挂载点（懒创建，包含 aria-live 区域用于通知） */
function getHost(): HTMLElement {
  if (modalHost === null || !document.body.contains(modalHost)) {
    modalHost = document.createElement('div');
    modalHost.id = 'dhDialogHost';
    modalHost.style.cssText = 'position:fixed;inset:0;z-index:3200;pointer-events:none;';
    modalHost.setAttribute('aria-live', 'polite');
    modalHost.setAttribute('aria-atomic', 'false');
    document.body.appendChild(modalHost);
  }
  return modalHost;
}

/** 记录并聚焦 */
function focusAndRestore(): void {
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function restoreFocus(): void {
  if (lastFocused !== null) {
    lastFocused.focus();
    lastFocused = null;
  }
}

/** 创建遮罩 + 对话框容器 */
function createOverlay(
  kind: 'confirm' | 'prompt' | 'custom',
  onDismiss?: () => void,
): { overlay: HTMLElement; dialog: HTMLElement; destroy: () => void } {
  const host = getHost();
  // host 为 fixed 全屏容器，pointer-events:none；每个 overlay 自身开启交互，
  // 避免 showToast 设置的 host pointer-events 干扰弹窗按钮点击
  const overlay = document.createElement('div');
  overlay.className = 'ui-overlay';
  overlay.style.pointerEvents = 'auto';

  const dialog = document.createElement('div');
  dialog.className = kind === 'confirm' ? 'ui-dialog ui-dialog--confirm' : 'ui-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  overlay.appendChild(dialog);

  host.appendChild(overlay);
  focusAndRestore();

  // 关闭函数
  let closed = false;
  const destroy = (): void => {
    if (closed) return;
    closed = true;
    host.removeChild(overlay);
    document.removeEventListener('keydown', onKey);
    restoreFocus();
    onDismiss?.();
  };

  // Esc 关闭
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') destroy();
  };
  document.addEventListener('keydown', onKey);

  // 遮罩点击关闭（custom 也支持）
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) destroy();
  });

  return { overlay, dialog, destroy };
}

/** 构建头部（标题 + 关闭按钮） */
function buildHeader(dialog: HTMLElement, title: string, onClose: () => void): HTMLElement {
  const header = document.createElement('div');
  header.className = 'ui-dialog-header';
  const h = document.createElement('h3');
  h.className = 'ui-dialog-title';
  h.textContent = title;
  const close = document.createElement('button');
  close.className = 'ui-dialog-close';
  close.setAttribute('aria-label', '关闭');
  close.innerHTML = '&#x2715;';
  close.addEventListener('click', onClose);
  header.appendChild(h);
  header.appendChild(close);
  dialog.appendChild(header);
  return close;
}

/**
 * 确认弹窗
 * @returns Promise<boolean> true=确认
 */
export function showConfirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const { dialog, destroy } = createOverlay('confirm', () => resolve(result));
    const iconType = opts.iconType ?? 'warning';

    // 图标
    if (iconType !== undefined) {
      const iconWrap = document.createElement('div');
      iconWrap.className = `ui-dialog-icon is-${iconType}`;
      // 内联 SVG 图标（警告/信息/危险）
      iconWrap.innerHTML =
        iconType === 'info'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
          : iconType === 'danger'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.4l7.8-7.9 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9l-7 12A2 2 0 0 0 5 19h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
      dialog.appendChild(iconWrap);
    }

    // 标题
    const title = document.createElement('div');
    title.className = 'ui-dialog-title';
    title.textContent = opts.title ?? '';
    dialog.appendChild(title);

    // 消息
    const body = document.createElement('div');
    body.className = 'ui-dialog-body';
    body.textContent = message;
    dialog.appendChild(body);

    // 按钮区
    const footer = document.createElement('div');
    footer.className = 'ui-dialog-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ui-btn ui-btn-outline';
    cancelBtn.textContent = opts.cancelText ?? '取消';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = opts.danger ? 'ui-btn ui-btn-danger' : 'ui-btn ui-btn-primary';
    confirmBtn.textContent = opts.confirmText ?? '确认';
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    dialog.appendChild(footer);

    // 默认聚焦确认按钮
    confirmBtn.focus();

    // 事件
    cancelBtn.addEventListener('click', () => {
      result = false;
      destroy();
    });
    confirmBtn.addEventListener('click', () => {
      result = true;
      destroy();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        result = true;
        destroy();
      }
    });
  });
}

/**
 * 输入弹窗（单输入或多输入）
 * @returns 单输入 → string|null；多输入 → Record<string,string>|null
 */
export function showPrompt(message: string, opts?: PromptOptions): Promise<string | null>;
export function showPrompt(message: string, opts: PromptMultiOptions): Promise<PromptFieldValues | null>;
export function showPrompt(
  message: string,
  opts?: PromptOptions | PromptMultiOptions,
): Promise<string | null | PromptFieldValues> {
  return new Promise((resolve) => {
    const options = opts ?? ({} as PromptOptions);
    let result: string | PromptFieldValues | null = null;
    const { dialog, destroy } = createOverlay('prompt', () => resolve(result));

    // 标题（若有）
    if (options.title !== undefined && options.title !== '') {
      buildHeader(dialog, options.title, destroy);
    }

    // 消息
    if (message !== '') {
      const body = document.createElement('div');
      body.className = 'ui-dialog-body';
      body.textContent = message;
      dialog.appendChild(body);
    }

    const multiFields: readonly PromptField[] | null =
      'fields' in options ? (options as PromptMultiOptions).fields : null;
    const fields: readonly PromptField[] =
      multiFields !== null && multiFields.length > 0
        ? multiFields
        : [
            {
              name: 'value',
              placeholder: options.placeholder,
              defaultValue: options.defaultValue,
            },
          ];
    const inputs = new Map<string, HTMLInputElement>();

    for (const field of fields) {
      if (field.label !== undefined && field.label !== '') {
        const label = document.createElement('label');
        label.className = 'ui-dialog-label';
        label.textContent = field.label;
        dialog.appendChild(label);
      }
      const input = document.createElement('input');
      input.className = 'ui-input';
      input.type = 'text';
      input.placeholder = field.placeholder ?? '';
      input.value = field.defaultValue ?? '';
      dialog.appendChild(input);
      inputs.set(field.name, input);
    }

    // 按钮区
    const footer = document.createElement('div');
    footer.className = 'ui-dialog-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ui-btn ui-btn-outline';
    cancelBtn.textContent = options.cancelText ?? '取消';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'ui-btn ui-btn-primary';
    confirmBtn.textContent = options.confirmText ?? '确认';
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    dialog.appendChild(footer);

    // 聚焦首个输入框
    const firstInput = fields[0] !== undefined ? inputs.get(fields[0].name) : null;
    (firstInput ?? confirmBtn).focus();

    const collect = (): string | PromptFieldValues | null => {
      if (multiFields !== null && multiFields.length > 0) {
        const values: PromptFieldValues = {};
        for (const field of multiFields) {
          values[field.name] = inputs.get(field.name)?.value ?? '';
        }
        return values;
      }
      return inputs.get('value')?.value ?? '';
    };

    cancelBtn.addEventListener('click', () => {
      result = null;
      destroy();
    });
    confirmBtn.addEventListener('click', () => {
      result = collect();
      destroy();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        result = collect();
        destroy();
      }
    });
  });
}

/**
 * Toast 通知（自动消失）
 * @param message 通知文本
 * @param type 类型：info / success / error / warning
 * @param options 可选配置：action 显示操作按钮（用于撤销等）；duration 自定义停留时间（毫秒）
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options?: { action?: { label: string; onClick: () => void }; duration?: number },
): void {
  const host = getHost();
  // 移除旧 toast
  host.querySelectorAll('.ui-toast').forEach((t) => t.remove());
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  const toast = document.createElement('div');
  toast.className = `ui-toast ui-toast--${type}`;
  toast.style.pointerEvents = 'auto';
  // 错误通知使用 role="alert" 立即播报，其他使用 role="status" 礼貌播报
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  const icon = document.createElement('span');
  icon.className = 'ui-toast-icon';
  icon.innerHTML =
    type === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/></svg>'
      : type === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
        : type === 'warning'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  const text = document.createElement('span');
  text.className = 'ui-toast-message';
  text.textContent = message;
  toast.appendChild(icon);
  toast.appendChild(text);

  // 操作按钮（用于撤销等）
  if (options?.action) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'ui-toast-undo-btn';
    actionBtn.textContent = options.action.label;
    actionBtn.addEventListener('click', () => {
      options.action!.onClick();
      toast.classList.add('ui-toast--out');
      setTimeout(() => toast.remove(), 200);
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
    });
    toast.appendChild(actionBtn);
  }

  host.appendChild(toast);
  const duration = options?.duration ?? (options?.action ? 4000 : 2200);
  toastTimer = setTimeout(() => {
    toast.classList.add('ui-toast--out');
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, duration);
}

/**
 * 自定义内容弹窗
 * @param title 弹窗标题
 * @param bodyHTML 正文 HTML
 * @param footerHTML 底部按钮 HTML
 * @param onDismiss 弹窗关闭时的回调（无论以何种方式关闭）
 * @returns 关闭函数
 */
export function createModal(title: string, bodyHTML: string, footerHTML = '', onDismiss?: () => void): () => void {
  const { dialog, destroy } = createOverlay('custom', onDismiss);
  buildHeader(dialog, title, destroy);
  const body = document.createElement('div');
  body.className = 'ui-dialog-body';
  body.innerHTML = bodyHTML;
  dialog.appendChild(body);
  if (footerHTML !== '') {
    const footer = document.createElement('div');
    footer.className = 'ui-dialog-footer';
    footer.innerHTML = footerHTML;
    dialog.appendChild(footer);
  }
  return destroy;
}
