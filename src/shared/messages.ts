/**
 * 前后台消息协议（R3：判别联合 + 运行时校验）
 *
 * 所有 `chrome.runtime.sendMessage` / `onMessage` 消息体必须符合本文件判别联合。
 * - 新增消息 = 新增联合成员 + 在 background 路由 switch 中补充分支（never 兜底）。
 * - payload 只含可序列化 JSON，禁止函数/DOM/Map/Set。
 * @see wiki/12 §12.1 页面 ↔ SW 消息协议
 */

import type { MESSAGE_TYPE } from './constants';

/** favicon 解析消息体 */
export interface ResolveFaviconData {
  /** 站点域名（SW 侧做格式白名单校验，防 SSRF，R18） */
  domain: string;
}

/** ===== 判别联合：全部 runtime 消息 ===== */
export type ExtensionRequest =
  | { type: typeof MESSAGE_TYPE.OPEN_SIDE_PANEL }
  | { type: typeof MESSAGE_TYPE.RESOLVE_FAVICON; data: ResolveFaviconData };

/** 响应统一结构：success 判别 */
export type ExtensionResponse<T = unknown> =
  | { success: true; data?: T }
  | { success: false; reason: string };

/** 未识别消息的固定 reason（与 wiki/12 一致） */
export const UNKNOWN_MESSAGE_REASON = 'unknown_message_type' as const;

/** 构造成功响应 */
export function okResponse<T>(data?: T): ExtensionResponse<T> {
  return data === undefined ? { success: true } : { success: true, data };
}

/** 构造失败响应 */
export function errResponse(reason: string): ExtensionResponse<never> {
  return { success: false, reason };
}
