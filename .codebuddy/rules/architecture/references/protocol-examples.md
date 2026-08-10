# 架构协议代码示例参考

> 本文件为 `architecture/RULE.mdc` 的代码附录，存放完整的 TypeScript 示例。规则正文只保留**约束要点**，细节与可复制代码见此处。

## 1. 进程间通信协议（判别联合）

所有 `runtime.sendMessage` / `onMessage` 的消息体必须符合 `src/shared/messages.ts` 的判别联合。

```ts
// src/shared/types.ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { [brand]: B };

export type SessionId = Brand<string, "SessionId">;
export type CrxId     = Brand<string, "CrxId">;
export type FilePath  = Brand<string, "FilePath">;

// 跨进程统一结果包装
export type Result<T, E = string> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

// src/shared/messages.ts
import type { SessionId, Result } from "./types";

// 判别字段统一为字面量 type
export type PopupToBackground =
  | { type: "HOST_PING" }
  | { type: "SESSION_OPEN"; sessionId: SessionId }
  | { type: "NATIVE_REQUEST"; command: NativeCommand; payload: unknown };

export type BackgroundToPopup =
  | { type: "HOST_STATUS"; connected: boolean; crxId: CrxId }
  | { type: "NATIVE_RESPONSE"; requestId: string; result: Result<unknown> }
  | { type: "SESSION_CHANGED"; sessionId: SessionId };

export type ExtensionMessage = PopupToBackground | BackgroundToPopup;

// 类型守卫 + 穷尽校验
export function isPopupToBackground(m: ExtensionMessage): m is PopupToBackground {
  return m.type.startsWith("HOST_") || m.type.startsWith("SESSION_") || m.type === "NATIVE_REQUEST";
}

// 路由时使用 never 强制穷尽
function route(msg: ExtensionMessage): void {
  switch (msg.type) {
    case "HOST_PING": /* ... */ break;
    case "SESSION_OPEN": /* ... */ break;
    case "NATIVE_REQUEST": /* ... */ break;
    case "HOST_STATUS": /* ... */ break;
    case "NATIVE_RESPONSE": /* ... */ break;
    case "SESSION_CHANGED": /* ... */ break;
    default:
      // 新增消息类型时此处编译报错 -> 强制处理
      const _exhaustive: never = msg;
      throw new Error(`unhandled message: ${JSON.stringify(_exhaustive)}`);
  }
}
```

## 2. Native Host 通信协议

Background 通过 `chrome.runtime.connectNative("<native_host_name>")` 建立长连接，双方以**换行分隔的 JSON**（Native Messaging 标准）互发。协议类型统一在 `src/shared/protocol.ts`：

```ts
// src/shared/protocol.ts
export type NativeCommand =
  | "PING"
  | "READ_FILE"
  | "WRITE_FILE"
  | "LIST_DIR"
  | "RUN_DIAGNOSTIC";

export interface NativeRequest {
  id: string;            // 关联响应
  command: NativeCommand;
  payload: unknown;      // 由 command 决定具体结构，建议再用判别联合细化
}

export type NativeEvent =
  | { kind: "RESPONSE"; id: string; result: Result<unknown> }
  | { kind: "LOG"; level: "info" | "warn" | "error"; message: string };
```

## 3. 运行时校验（zod 守卫）

跨上下文边界（消息、storage、Native 响应）必须做**运行时校验**，不能只靠编译期类型：

```ts
const SessionMsg = z.object({ type: z.literal("SESSION_OPEN"), sessionId: z.string() });
export const isSessionOpen = (m: unknown): m is SessionOpen =>
  SessionMsg.safeParse(m).success;
```
