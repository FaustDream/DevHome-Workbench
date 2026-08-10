/**
 * 图标系统（对齐原版 icons.css + #dhIconSprite）
 *
 * 原版使用 `<svg class="dh-icon dh-icon--md"><use href="#dh-icon-x"/></svg>`
 * 引用 index.html 顶部的 SVG symbol sprite。本模块提供统一的图标生成器。
 */

/** 图标尺寸类 */
export type DhIconSize = 'dh-icon--xs' | 'dh-icon--sm' | 'dh-icon--md' | 'dh-icon--lg' | 'dh-icon--xl';

/** 生成图标 SVG 字符串 */
export function icon(name: string, size: DhIconSize = 'dh-icon--md'): string {
  return `<svg class="dh-icon ${size}" role="img" aria-hidden="true"><use href="#dh-icon-${name}"></use></svg>`;
}

/** 图标名常量（索引 index.html #dhIconSprite 中的 symbol，仅导出被引用的项） */
export const ICONS = {
  X: 'x',
} as const;
