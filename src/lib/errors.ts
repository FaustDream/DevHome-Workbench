/**
 * 统一异常体系（禁止裸 throw 非业务异常）
 *
 * 所有业务异常继承 {@link BusinessError}，携带错误码与上下文，便于日志定位。
 * 已知错误码：
 * - `STORAGE_WRITE_FAILED`    存储乐观锁重试失败
 * - `STORAGE_QUOTA_EXCEEDED`  存储配额超限
 * - `INVALID_INPUT`           外部输入校验失败
 * - `MESSAGE_UNKNOWN_TYPE`    未识别的消息类型
 * - `FETCH_FAILED`            外部网络请求失败
 * - `DOM_NOT_FOUND`           DOM 节点缺失
 * - `FILE_CONFIG_ERROR`       文件系统配置同步失败
 */

/** 错误码字面量联合 */
export type ErrorCode =
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'INVALID_INPUT'
  | 'MESSAGE_UNKNOWN_TYPE'
  | 'FETCH_FAILED'
  | 'DOM_NOT_FOUND'
  | 'FILE_CONFIG_ERROR';

/** 业务异常基类 */
export class BusinessError extends Error {
  readonly code: ErrorCode;
  /** 附加上下文（可序列化，避免敏感信息） */
  readonly context: Readonly<Record<string, unknown>>;

  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.context = context;
  }
}

/** 外部输入校验失败 */
export class InvalidInputError extends BusinessError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super('INVALID_INPUT', message, context);
    this.name = 'InvalidInputError';
  }
}

/** 存储写入失败（乐观锁重试超限 / 配额） */
export class StorageWriteError extends BusinessError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super('STORAGE_WRITE_FAILED', message, context);
    this.name = 'StorageWriteError';
  }
}

/** 网络请求失败 */
export class FetchError extends BusinessError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super('FETCH_FAILED', message, context);
    this.name = 'FetchError';
  }
}

/** DOM 节点缺失 */
export class DomNotFoundError extends BusinessError {
  constructor(selector: string) {
    super('DOM_NOT_FOUND', `DOM 节点未找到: ${selector}`, { selector });
    this.name = 'DomNotFoundError';
  }
}
