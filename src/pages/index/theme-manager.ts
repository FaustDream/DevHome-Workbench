/**
 * 主题管理（对齐原版 js/theme-manager.js）
 *
 * - 存储：`_devhome_theme` = `{ colorScheme: 'light'|'dark', autoFollowSystem: boolean }`
 * - DOM：`data-color-scheme` 属性驱动 css/themes/default.css 的深色覆盖
 * - 系统自动跟随：首次使用启用；手动切换方案时禁用自动跟随
 */

const STORAGE_KEY = '_devhome_theme';
const SCHEME_ATTR = 'data-color-scheme';

/** 主题状态 */
export interface ThemeState {
  colorScheme: 'light' | 'dark';
  autoFollowSystem: boolean;
}

const state: ThemeState = { colorScheme: 'light', autoFollowSystem: false };

/** 系统深色偏好 */
function systemScheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 应用主题到 DOM */
function applySchemeToDOM(): void {
  document.documentElement.setAttribute(SCHEME_ATTR, state.colorScheme);
}

/** 持久化 */
function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** 发布主题变更事件（供设置面板同步） */
export function getTheme(): ThemeState {
  return { ...state };
}

/** 当前方案 */
export function getColorScheme(): 'light' | 'dark' {
  return state.colorScheme;
}

/** 是否自动跟随 */
export function isAutoFollowSystem(): boolean {
  return state.autoFollowSystem;
}

/** 初始化主题（boot Phase 0 调用） */
export function initTheme(): void {
  let saved: ThemeState | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<ThemeState>;
      if (parsed.colorScheme === 'light' || parsed.colorScheme === 'dark') {
        saved = { colorScheme: parsed.colorScheme, autoFollowSystem: !!parsed.autoFollowSystem };
      }
    }
  } catch {
    // 损坏忽略
  }

  if (saved !== null) {
    state.colorScheme = saved.colorScheme;
    state.autoFollowSystem = saved.autoFollowSystem;
  } else {
    // 首次使用：启用系统自动跟随
    state.colorScheme = systemScheme();
    state.autoFollowSystem = true;
    persist();
  }
  applySchemeToDOM();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (state.autoFollowSystem) {
      state.colorScheme = e.matches ? 'dark' : 'light';
      applySchemeToDOM();
      persist();
    }
  });
}

/** 手动设置方案（自动跟随将关闭） */
export function setColorScheme(scheme: 'light' | 'dark'): void {
  if (state.colorScheme === scheme && !state.autoFollowSystem) return;
  state.colorScheme = scheme;
  if (state.autoFollowSystem) {
    state.autoFollowSystem = false;
  }
  applySchemeToDOM();
  persist();
}

/** 设置自动跟随系统偏好 */
export function setAutoFollowSystem(enabled: boolean): void {
  state.autoFollowSystem = enabled;
  if (enabled) {
    state.colorScheme = systemScheme();
  }
  applySchemeToDOM();
  persist();
}
