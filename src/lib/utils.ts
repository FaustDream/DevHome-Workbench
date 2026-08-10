/**
 * 纯逻辑工具函数（无 chrome.* / 无 DOM 依赖，可在 Node 单测）
 *
 * 对应 wiki/03 §3.2 utils.js 与 wiki/14 §14.4.3 抽 lib 清单：
 * escapeHtml / sanitizeHtml / getTileIdentity / getPageTileSignature /
 * normalizePageState / repairDefaultCategoryContent / createDefaultTile /
 * countWords / formatTaskTime / computeRemaining / calcCountdown / getGreetingByHour
 */

import { GREETING_PERIODS, GREETING_NIGHT } from '../shared/constants';
import type { Tile, TilePage, CountdownItem } from '../shared/types';

/* ===== ID 生成 ===== */

/** 生成业务 ID：`<prefix>_<ts>_<rand6>`（磁贴/笔记/任务等统一格式） */
export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

/* ===== HTML 处理 ===== */

/** HTML 转义（基于 div.textContent 等价逻辑的纯函数实现） */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}

/** 剥离 HTML 标签为纯文本（纯函数，Node/浏览器通用） */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 危险标签名单（R17：不可信内容净化） */
const UNSAFE_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form']);
/** 危险协议名单 */
const UNSAFE_PROTOCOL_RE = /^\s*(?:javascript|data:text\/html|vbscript):/i;

/**
 * 轻量 HTML 净化（R17）
 * - 剔除 script/style/iframe/object/embed/link/meta/base/form 标签
 * - 剔除所有 on* 事件属性
 * - 剔除 javascript:/data:text/html: 协议链接
 * 说明：低成本防护；若渲染不可信内容升级场景应引入 DOMPurify。
 */
export function sanitizeHtml(html: string): string {
  let out = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?\/?>/g, (tag, tagName: string) => {
    const name = tagName.toLowerCase();
    if (UNSAFE_TAGS.has(name)) {
      return '';
    }
    // 剔除 on* 事件属性
    const cleaned = tag.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return cleaned;
  });
  // 剔除危险协议链接
  out = out.replace(/\b(?:href|src)\s*=\s*(?:"[^"]*"|'[^']*')/gi, (attr) => {
    const value = attr.slice(attr.indexOf('=') + 1).replace(/^["']|["']$/g, '');
    return UNSAFE_PROTOCOL_RE.test(value) ? attr.replace(/=\s*["'][^"']*["']/gi, '=""') : attr;
  });
  return out;
}

/* ===== 磁贴工具（wiki/03 §3.2） ===== */

/** 磁贴身份指纹：`label|url` */
export function getTileIdentity(tile: Tile): string {
  return `${tile.label}|${tile.url}`;
}

/** 页面磁贴签名（按 identity 排序拼接，用于分类内容修复对比） */
export function getPageTileSignature(page: TilePage): string {
  return page.tiles
    .map(getTileIdentity)
    .slice()
    .sort()
    .join('||');
}

/**
 * 归一化页面状态（修复分类名错位，wiki/03 §3.2 normalizePageState）
 * 以 `page.name || page_names[i] || '第N页'` 归一化
 * @returns { pages, changed }
 */
export function normalizePageState(
  pagesData: readonly TilePage[],
  storedPageNames: readonly string[],
): { pages: TilePage[]; changed: boolean } {
  let changed = false;
  const pages = pagesData.map((page, i) => {
    const fallback = storedPageNames[i] ?? `第${i + 1}页`;
    if (page.name !== fallback) {
      changed = true;
    }
    return { ...page, name: page.name || fallback };
  });
  return { pages, changed };
}

/**
 * 默认分类内容错位修复（wiki/03 §3.2.1）
 * 仅当页数一致、所有页名都在默认页名集合中、且存在签名错位时执行修复。
 * @returns 修复后的 pages（无需修复时原样返回）
 */
export function repairDefaultCategoryContent(
  pagesData: readonly TilePage[],
  pageNames: readonly string[],
  defaultPagesData: readonly TilePage[],
): TilePage[] {
  // 条件 1：页数不一致 → 不修复
  if (pagesData.length !== defaultPagesData.length) return pagesData.slice();

  const defaultNames = new Set(defaultPagesData.map((p) => p.name));
  // 条件 2：任意页名不在默认页名中 → 不修复
  if (pageNames.some((n) => !defaultNames.has(n))) return pagesData.slice();

  // 默认页名 → 页、默认页名 → 签名、签名 → 默认页名
  const defaultByName = new Map(defaultPagesData.map((p) => [p.name, p]));
  const signatureToDefaultName = new Map(defaultPagesData.map((p) => [getPageTileSignature(p), p.name]));

  let needsRepair = false;
  for (let i = 0; i < pagesData.length; i++) {
    const expected = defaultByName.get(pageNames[i] ?? '');
    const page = pagesData[i];
    if (page === undefined || expected === undefined) continue;
    const curSig = getPageTileSignature(page);
    if (curSig !== getPageTileSignature(expected) && signatureToDefaultName.get(curSig) !== (pageNames[i] ?? '')) {
      needsRepair = true;
      break;
    }
  }
  if (!needsRepair) return pagesData.slice();

  // 修复：按 pageNames[i] 重建每页 tiles，并补齐 position
  return pageNames.map((name) => {
    const def = defaultByName.get(name);
    const tiles = (def?.tiles ?? []).map((t, idx) => ({ ...t, position: idx }));
    return { name, tiles };
  });
}

/** 创建默认磁贴（wiki/03 §3.2 createDefaultTile） */
export function createDefaultTile(
  item: { label: string; url: string },
  idx: number,
  seed: string,
): Tile {
  return {
    id: `tile_${seed}_${idx}` as Tile['id'],
    label: item.label,
    url: item.url,
    type: 'favicon',
    icon: '',
    color: '#4a9eff',
    position: idx,
    imageData: '',
  };
}

/* ===== 问候（wiki/05 §5.9.2） ===== */

/** 按小时返回时段问候语 */
export function getGreetingByHour(hour: number): string {
  const period = GREETING_PERIODS.find((p) => hour >= p.from && hour < p.to);
  return period?.text ?? GREETING_NIGHT;
}

/* ===== 字数统计（中英混排） ===== */

/**
 * 字数统计：中文字符 + 英文单词数
 * 输入为 HTML 时先剥离标签再统计
 */
export function countWords(html: string): number {
  const text = stripHtml(html);
  const zhCount = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const enWords = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+(?:['-][a-zA-Z0-9]+)*/g) ?? []).length;
  return zhCount + enWords;
}

/* ===== 时间工具 ===== */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * 相对时间格式化：刚刚 / X分钟前 / X小时前 / 昨天 / X天前 / YYYY-MM-DD
 */
export function formatTaskTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < MINUTE_MS) return '刚刚';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}小时前`;

  const d = new Date(timestamp);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const startOfTs = new Date(timestamp).setHours(0, 0, 0, 0);
  if (startOfTs === startOfToday) return '今天';
  if (startOfTs === startOfToday - DAY_MS) return '昨天';
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}天前`;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 秒数 → mm:ss 格式化 */
export function formatSeconds(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ===== 倒计时（wiki/05 §5.6.2） ===== */

export interface CountdownResult {
  /** 剩余天数（可为负） */
  days: number;
  /** 进度 0~100 */
  progress: number;
  /** 是否已过期 */
  isOverdue: boolean;
  /** 是否今天到期 */
  isToday: boolean;
}

/** 计算倒计时状态 */
export function calcCountdown(item: CountdownItem, now: Date = new Date()): CountdownResult {
  const target = new Date(`${item.targetDate}T00:00:00`).getTime();
  const created = new Date(`${item.createdAt}T00:00:00`).getTime();
  const nowMs = now.getTime();

  const diff = target - nowMs;
  // `+ 0` 消除 Math.ceil 对负零的 -0 输出
  const days = Math.ceil(diff / DAY_MS) + 0;
  const isOverdue = diff < 0;
  const isToday = days === 0;

  let progress = 0;
  if (!isOverdue && target > created) {
    progress = Math.min(100, Math.max(0, ((nowMs - created) / (target - created)) * 100));
  }
  return { days, progress, isOverdue, isToday };
}

/* ===== 数值工具 ===== */

/** 数值钳制 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
