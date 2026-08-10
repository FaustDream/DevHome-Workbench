/**
 * 图标水合（对齐原版 iconfont Symbol 图标系统）
 *
 * index.html 中存在两种图标写法：
 * 1. `<svg class="dh-icon ..."><use href="#dh-icon-x"/></svg>`（sprite 直接引用，正常显示）
 * 2. `<span class="dh-icon dh-icon--x dh-icon--md">`（CSS 类形式，依赖 iconfont.js，未加载时空白）
 *
 * 本模块在 boot 时扫描 span 形式图标，将其转换为 `<use>` 引用 #dhIconSprite 中的 symbol，
 * 使图标统一通过 sprite 渲染。仅处理 sprite 中存在的 symbol；不存在的保持原样（避免破坏）。
 */

import { debug } from '../../lib/logger';

const MODULE = 'icon-hydrate';

/** 从 class 列表提取图标名（`dh-icon--xxx` 中的 xxx） */
function extractIconName(classes: string): string | null {
  for (const cls of classes.split(/\s+/)) {
    if (cls.startsWith('dh-icon--') && !cls.startsWith('dh-icon--sm') && !cls.startsWith('dh-icon--md') && !cls.startsWith('dh-icon--lg') && !cls.startsWith('dh-icon--xl')) {
      return cls.slice('dh-icon--'.length);
    }
  }
  return null;
}

/** 尺寸类（保留原样式） */
function extractSizeClass(classes: string): string | null {
  for (const cls of classes.split(/\s+/)) {
    if (cls === 'dh-icon--sm' || cls === 'dh-icon--md' || cls === 'dh-icon--lg' || cls === 'dh-icon--xl') {
      return cls;
    }
  }
  return null;
}

/** 将 span 图标转为 svg<use> 形式 */
function hydrateOne(span: HTMLElement): void {
  const name = extractIconName(span.className);
  if (name === null) return;
  // sprite 中是否定义该 symbol
  const sprite = document.getElementById('dhIconSprite');
  if (sprite === null) return;
  if (sprite.querySelector(`symbol[id="dh-icon-${name}"]`) === null) return;

  const size = extractSizeClass(span.className) ?? 'dh-icon--md';
  const svg = document.createElement('svg');
  svg.className = `dh-icon ${size}`;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#dh-icon-${name}`);
  svg.appendChild(use);
  span.replaceWith(svg);
}

/** 水合所有 span 形式图标 */
export function hydrateIconSpans(root: ParentNode = document): void {
  const spans = root.querySelectorAll<HTMLElement>('span.dh-icon');
  for (const span of Array.from(spans)) {
    hydrateOne(span);
  }
  debug(MODULE, `图标水合完成，处理 ${spans.length} 个 span 图标`);
}

/** 初始化（boot 调用） */
export function initIconHydrate(): void {
  hydrateIconSpans();
}
