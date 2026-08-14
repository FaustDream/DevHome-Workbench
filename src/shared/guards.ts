/**
 * 运行时类型守卫（R20：外部输入必须先校验再进入业务逻辑）
 *
 * 基于 zod schema 的 `safeParse` 封装：用于消息边界、存储读取、DOM 取值、JSON 解析。
 * - `isX(v)` 类型守卫：`v is X`，可在 if 中收窄。
 * - `parseX(v)` 抛出业务异常：调用方确认数据必然合法时使用。
 * 纯类型 + zod，无 chrome.* 依赖，可在 lib/pages/background 任意层引用。
 */

import { z } from 'zod';
import { MESSAGE_TYPE, SHORTCUT_SIZE_OPTIONS } from './constants';
import { ENGINES } from './types';
import type { TileId, EngineId, ShortcutSize, ShortcutColumns } from './types';
import type { ExtensionRequest, ResolveFaviconData } from './messages';

// 注册表派生的引擎 id 集合
const ENGINE_IDS: ReadonlySet<string> = new Set(ENGINES.map((e: { id: EngineId }) => e.id));

/* ===== 品牌类型字符串 schema（复用） ===== */
/** 磁贴 id 校验 */
const tileIdSchema = z.string().min(1).startsWith('tile_');

/* ===== 基础数据模型 schema ===== */

/** 磁贴 schema */
export const TileSchema = z.object({
  id: tileIdSchema,
  label: z.string(),
  url: z.string().url().or(z.string().min(1)),
  type: z.enum(['favicon', 'custom', 'text', 'emoji']),
  icon: z.string().default(''),
  color: z.string().default('#4a9eff'),
  position: z.number().int().nonnegative().default(0),
  imageData: z.string().default(''),
});

/** 磁贴分页 schema */
export const TilePageSchema = z.object({
  name: z.string().min(1),
  tiles: z.array(TileSchema).default([]),
});

/** 设置 schema（读取即校验） */
export const SettingsSchema = z.object({
  engine: z.enum(['google', 'bing', 'baidu', 'zhihu', 'weibo', 'duckduckgo', 'github', 'bilibili', 'yandex', 'gamer520', 'linuxdo']),
  shortcutSize: z.enum(['small', 'standard', 'large']),
  shortcutColumns: z.enum(['auto', '4', '5', '6', '7', '8']),
  autoFocus: z.boolean(),
  categoryMemory: z.boolean(),
  catRow: z.boolean(),
  pageTransition: z.boolean(),
  linkNewTabTiles: z.boolean(),
  linkNewTabSearch: z.boolean(),
  nickname: z.string(),
  lastPage: z.number().int().nonnegative(),
  batchModifierKey: z.enum(['ctrl', 'alt', 'ctrlShift']).default('ctrlShift'),
});

/* ===== 消息 payload schema ===== */

/** favicon 解析消息校验（R18：域名格式白名单） */
const resolveFaviconSchema: z.ZodType<ResolveFaviconData> = z.object({
  domain: z
    .string()
    .min(1)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      '非法域名格式',
    ),
});

/** 消息判别联合 schema：逐分支 safeParse 兜底 */
const requestParsers = [
  { type: MESSAGE_TYPE.RESOLVE_FAVICON, dataSchema: resolveFaviconSchema },
] as const;

/** 基础对象形状校验 */
const requestShapeSchema = z.object({
  type: z.string(),
  data: z.unknown().optional(),
});

/**
 * 运行时守卫：是否为合法的 ExtensionRequest
 * 匹配 type + 对应 payload schema（safeParse，非法即拒收）
 */
export function isExtensionRequest(v: unknown): v is ExtensionRequest {
  if (typeof v !== 'object' || v === null) return false;
  const shape = requestShapeSchema.safeParse(v);
  if (!shape.success) return false;
  const { type, data } = shape.data;
  for (const parser of requestParsers) {
    if (parser.type === type) {
      if (parser.dataSchema === null) return true;
      return parser.dataSchema.safeParse(data).success;
    }
  }
  return false;
}

/* ===== 常用类型守卫 ===== */

/** 是否为合法域名（favicon 解析 / 外链校验共用） */
export function isSafeDomain(v: string): boolean {
  return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(v);
}

/** 是否为合法 http(s) URL */
export function isHttpsUrl(v: string): boolean {
  try {
    const url = new URL(v);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 是否为合法引擎 id（从 ENGINES 注册表推导） */
export function isEngineId(v: unknown): v is EngineId {
  return typeof v === 'string' && ENGINE_IDS.has(v);
}

/** 是否为合法磁贴 id */
export function isTileId(v: unknown): v is TileId {
  return typeof v === 'string' && v.startsWith('tile_');
}

/** 是否为合法快捷方式尺寸 */
export function isShortcutSize(v: unknown): v is ShortcutSize {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHORTCUT_SIZE_OPTIONS, v);
}

/** 是否为合法快捷方式列数 */
export function isShortcutColumns(v: unknown): v is ShortcutColumns {
  return v === 'auto' || v === '4' || v === '5' || v === '6' || v === '7' || v === '8';
}

/** 布尔串 'true'/'false' → boolean（localStorage 字符串开关） */
export function parseBooleanStr(v: string | null | undefined): boolean {
  return v === 'true';
}
