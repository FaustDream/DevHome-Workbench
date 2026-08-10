/**
 * 存储乐观锁纯逻辑（wiki/02 §2.3.3，可单测）
 *
 * 目标存储格式：
 * - 对象值：浅拷贝后附加 `_version` 字段
 * - 数组/基本类型值：包装为 `{ data, _version }`
 * 读取时按 {@link unwrapValue} 解包。
 */

/** 带版本标记的对象值 */
export interface VersionedObject {
  _version: number;
  [key: string]: unknown;
}

/** 包装值（数组/基本类型） */
export interface VersionedWrapper {
  data: unknown;
  _version: number;
}

/** 版本控制字段名 */
export const VERSION_FIELD = '_version' as const;

/** 是否为包装值：仅含 `data` 与 `_version` 两字段的对象 */
export function isVersionedWrapper(v: unknown): v is VersionedWrapper {
  if (typeof v !== 'object' || v === null) return false;
  const keys = Object.keys(v);
  return keys.length === 2 && '_version' in v && 'data' in v;
}

/**
 * 构造新版本值
 * - 对象类型 → 浅拷贝后附加 `_version`
 * - 其他类型 → `{ data, _version }`
 */
export function buildVersionedValue(value: unknown, version: number): VersionedObject | VersionedWrapper {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>), [VERSION_FIELD]: version };
  }
  return { data: value, _version: version };
}

/** 解包版本化值，返回业务数据 */
export function unwrapValue(value: unknown): unknown {
  if (isVersionedWrapper(value)) {
    return value.data;
  }
  if (typeof value === 'object' && value !== null && VERSION_FIELD in value) {
    const obj = value as Record<string, unknown>;
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== VERSION_FIELD) rest[k] = v;
    }
    return rest;
  }
  return value;
}

/** 读取版本号（无则 0） */
export function readVersion(value: unknown): number {
  if (typeof value !== 'object' || value === null) return 0;
  const v = (value as Record<string, unknown>)[VERSION_FIELD];
  return typeof v === 'number' && Number.isInteger(v) ? v : 0;
}

/** 下一版本号 */
export function nextVersion(current: number): number {
  return current + 1;
}
