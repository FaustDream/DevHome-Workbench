/**
 * favicon 解析（SW 侧，wiki/10 + wiki/05 §5.10）
 *
 * 接收页面 `RESOLVE_FAVICON` 请求，解析站点真实 favicon 为 dataURL：
 * 1. 域名白名单校验（R18，防 SSRF）
 * 2. 尝试 `https://<domain>/favicon.ico`
 * 仅 https，加超时（R18）。
 * 注意：不再使用 Google favicon 服务兜底，其默认地球图标不符合设计预期；
 *       获取失败时由页面侧展示纯色背景。
 */

import { isSafeDomain } from '../shared/guards';
import { FAVICON_FETCH_TIMEOUT_MS, FAVICON_MAX_BYTES } from '../shared/constants';
import { warn } from '../lib/logger';

const MODULE = 'favicon-resolver';

/** 带超时的 fetch（AbortController） */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 图片 MIME 类型白名单 */
const IMAGE_MIME_PREFIXES: ReadonlyArray<string> = ['image/', 'application/octet-stream'] as const;

/** 响应 → dataURL（Content-Type + 体积双重校验） */
async function responseToDataUrl(res: Response): Promise<string | null> {
  if (!res.ok) return null;
  // 校验 Content-Type：拒绝非图片响应（防止 HTML 404 页面被当图标渲染）
  const contentType = res.headers.get('content-type') ?? '';
  const isImage = IMAGE_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));
  if (!isImage) return null;
  const blob = await res.blob();
  if (blob.size === 0 || blob.size > FAVICON_MAX_BYTES) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * 从站点首页 HTML 解析 `<link rel="icon">` 的 href
 * @returns 绝对 URL 或 null
 */
async function extractIconHref(domain: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://${domain}/`, FAVICON_FETCH_TIMEOUT_MS);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;
    const html = await res.text();
    // 匹配 <link rel="...icon..." href="...">，rel 优先取含 "icon" 的项
    const linkRe = /<link\b[^>]*rel=["']([^"']*icon[^"']*)["'][^>]*>/gi;
    let href: string | null = null;
    for (const match of html.matchAll(linkRe)) {
      const tag = match[0];
      const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
      if (hrefMatch !== null && hrefMatch[1] !== undefined) {
        href = hrefMatch[1];
        break;
      }
    }
    if (href === null) return null;
    // 相对路径 → 绝对 URL
    return new URL(href, `https://${domain}/`).href;
  } catch {
    return null;
  }
}

/**
 * 解析真实 favicon
 * @returns dataURL 或 null
 */
export async function resolveRealFavicon(domain: string): Promise<string | null> {
  if (!isSafeDomain(domain)) return null;

  // 1. 尝试站点根路径 favicon.ico
  try {
    const res = await fetchWithTimeout(`https://${domain}/favicon.ico`, FAVICON_FETCH_TIMEOUT_MS);
    const dataUrl = await responseToDataUrl(res);
    if (dataUrl !== null) return dataUrl;
  } catch {
    // 失败走下一候选
  }

  // 2. 解析首页 HTML 的 <link rel="icon"> 指向的图标
  try {
    const iconUrl = await extractIconHref(domain);
    if (iconUrl !== null && isSafeDomain(new URL(iconUrl).hostname)) {
      const res = await fetchWithTimeout(iconUrl, FAVICON_FETCH_TIMEOUT_MS);
      const dataUrl = await responseToDataUrl(res);
      if (dataUrl !== null) return dataUrl;
    }
  } catch {
    // 失败走兜底
  }

  warn(MODULE, `favicon 解析失败`, { domain });
  return null;
}
