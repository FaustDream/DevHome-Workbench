/**
 * favicon 解析（wiki/05 §5.10）
 *
 * 为磁贴加载站点 favicon：
 * 1. 优先 IndexedDB favicon 缓存（避免重复请求）
 * 2. 未命中 → 发 `RESOLVE_FAVICON` 消息给 SW（SW 解析真实 favicon 返回 dataURL）
 * 3. 返回 dataURL 后写缓存 + 更新磁贴图标
 *
 * 域名白名单校验（R18）：仅允许合法域名格式，防 SSRF。
 */

import { MESSAGE_TYPE } from '../../shared/constants';
import { isSafeDomain } from '../../shared/guards';
import type { ExtensionResponse } from '../../shared/messages';
import type { Tile } from '../../shared/types';
import { warn } from '../../lib/logger';
import { stripHtml } from '../../lib/utils';

const MODULE = 'favicon';
const FAVICON_DB_NAME = 'devhome-favicon';
const FAVICON_DB_VERSION = 1;
const FAVICON_STORE = 'favicons';

/** 图标解析结果：图片或文本字形 */
export type TileGlyph =
  | { kind: 'img'; src: string | null; domain: string | null }
  | { kind: 'text'; text: string };

/** 从 URL 提取域名 */
export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 同步解析磁贴图标字形（占位）
 * - imageData（自定义 base64）由 tiles.ts 直接处理，不在此处
 * - custom + icon → 图片
 * - favicon → 图片（src 置空，由 hydrateFavicons 异步填充）
 * - emoji/text → 文本（首字符 / emoji）
 */
export function resolveTileIcon(tile: Tile): TileGlyph {
  if (tile.type === 'custom' && tile.icon !== '') {
    return { kind: 'img', src: tile.icon, domain: null };
  }
  if (tile.type === 'favicon') {
    const domain = extractDomain(tile.url);
    if (domain !== null && isSafeDomain(domain)) {
      return { kind: 'img', src: null, domain };
    }
    return { kind: 'text', text: firstChar(tile.label) };
  }
  if (tile.icon !== '') {
    return { kind: 'text', text: tile.icon };
  }
  return { kind: 'text', text: firstChar(tile.label) };
}

/** 标签首字符（去 HTML/空白） */
function firstChar(label: string): string {
  const text = stripHtml(label).trim();
  return text.charAt(0) || '?';
}

/* ================= IndexedDB 缓存 ================= */

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** 打开 favicon IndexedDB（单例） */
export function openFaviconDB(): Promise<IDBDatabase | null> {
  if (dbPromise !== null) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(FAVICON_DB_NAME, FAVICON_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FAVICON_STORE)) {
        db.createObjectStore(FAVICON_STORE, { keyPath: 'domain' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      warn(MODULE, 'favicon DB 打开失败');
      resolve(null);
    };
  });
  return dbPromise;
}

/** 读取缓存 favicon dataURL */
export async function getCachedFavicon(domain: string): Promise<string | null> {
  const db = await openFaviconDB();
  if (db === null) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(FAVICON_STORE, 'readonly');
    const req = tx.objectStore(FAVICON_STORE).get(domain);
    req.onsuccess = () => {
      const row = req.result as { domain: string; dataUrl: string } | undefined;
      resolve(typeof row?.dataUrl === 'string' ? row.dataUrl : null);
    };
    req.onerror = () => resolve(null);
  });
}

/** 写缓存 favicon dataURL */
export async function cacheFavicon(domain: string, dataUrl: string): Promise<void> {
  const db = await openFaviconDB();
  if (db === null) return;
  return new Promise((resolve) => {
    const tx = db.transaction(FAVICON_STORE, 'readwrite');
    tx.objectStore(FAVICON_STORE).put({ domain, dataUrl });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/* ================= SW 请求 ================= */

/** 发 RESOLVE_FAVICON 消息给 SW（页面上下文，允许 chrome.runtime） */
export async function requestFavicon(domain: string): Promise<string | null> {
  if (!isSafeDomain(domain)) return null;
  try {
    const res = (await chrome.runtime.sendMessage({
      type: MESSAGE_TYPE.RESOLVE_FAVICON,
      data: { domain },
    })) as ExtensionResponse<string | null>;
    if (res.success && typeof res.data === 'string') {
      return res.data;
    }
    return null;
  } catch {
    warn(MODULE, `favicon 解析失败`, { domain });
    return null;
  }
}

/* ================= 磁贴图标加载（对齐原版 js/favicon.js loadFavicon） ================= */

/**
 * 加载磁贴 favicon（原版 API 形态：url + img 元素 + 容器 + 标签）
 * - IndexedDB 缓存 → SW 解析（RESOLVE_FAVICON）→ 写缓存
 * - 失败时尝试 Google favicon 服务直链（仅 https 站点）
 * - 全部失败显示首字符字母兜底
 */
export async function loadFavicon(url: string, imgElement: HTMLImageElement, iconWrap: HTMLElement, label: string): Promise<void> {
  const domain = extractDomain(url);
  if (domain === null || !isSafeDomain(domain)) {
    showLetterFallback(imgElement, iconWrap, label);
    return;
  }
  const cached = await getCachedFavicon(domain);
  if (cached !== null) {
    imgElement.src = cached;
    imgElement.onerror = () => {
      // 缓存数据可能已损坏，清除并降级
      void (async () => {
        const db = await openFaviconDB();
        if (db !== null) {
          const tx = db.transaction(FAVICON_STORE, 'readwrite');
          tx.objectStore(FAVICON_STORE).delete(domain);
        }
      })();
      tryGoogleFaviconFallback(url, domain, imgElement, iconWrap, label);
    };
    return;
  }
  const dataUrl = await requestFavicon(domain);
  if (dataUrl !== null) {
    imgElement.src = dataUrl;
    void cacheFavicon(domain, dataUrl);
    imgElement.onerror = () => tryGoogleFaviconFallback(url, domain, imgElement, iconWrap, label);
    return;
  }
  tryGoogleFaviconFallback(url, domain, imgElement, iconWrap, label);
}

/** Google favicon 服务直链兜底（仅 https 站点；http 站直走字母降级，节省无效请求） */
function tryGoogleFaviconFallback(
  originalUrl: string,
  domain: string,
  imgElement: HTMLImageElement,
  iconWrap: HTMLElement,
  label: string,
): void {
  // http 站点谷歌图标服务不可达，跳过
  if (originalUrl.startsWith('http://')) {
    showLetterFallback(imgElement, iconWrap, label);
    return;
  }
  imgElement.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=48`;
  imgElement.onerror = () => showLetterFallback(imgElement, iconWrap, label);
}

/** 字母兜底：移除 img，容器显示首字符 */
function showLetterFallback(imgElement: HTMLImageElement, iconWrap: HTMLElement, label: string): void {
  imgElement.remove();
  const text = label.trim().charAt(0) || '?';
  iconWrap.textContent = text;
  iconWrap.classList.add('tile-icon-fallback');
}
