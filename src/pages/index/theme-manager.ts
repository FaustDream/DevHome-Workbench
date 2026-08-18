/**
 * 主题管理（强制浅色模式）
 */

const SCHEME_ATTR = 'data-color-scheme';

/** 初始化主题（强制浅色模式） */
export function initTheme(): void {
  document.documentElement.setAttribute(SCHEME_ATTR, 'light');
}

/** 获取当前色彩方案（始终返回light） */
export function getColorScheme(): 'light' {
  return 'light';
}
