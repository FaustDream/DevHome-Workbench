# 无头扩展（无 popup、无 side panel）

## 适用场景

完全在后台运行的扩展——没有 UI、没有 popup、没有 side panel。它从配套的 web app 同步认证状态，并在已登录用户不知情的情况下自动代表其行事。

示例：
- 用户访问特定页面时激活的自动填充工具
- 用户在 web app 登录后在后台同步数据的扩展
- 无需用户交互即可调用你的 API 的开发者工具

## 要求

- 用户通过 web app（而非扩展）登录
- 扩展从 web app 的会话 cookie 读取认证状态
- `syncHost` + `createClerkClient({ background: true })` 组合

## Background Service Worker

`src/background/index.ts`：
```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

if (!publishableKey || !syncHost) {
  throw new Error('Missing publishable key or sync host')
}

async function getAuthenticatedUser() {
  const clerk = await createClerkClient({
    publishableKey,
    syncHost,
    background: true,
  })

  return clerk.user
}

async function getSessionToken(): Promise<string | null> {
  const clerk = await createClerkClient({
    publishableKey,
    syncHost,
    background: true,
  })

  if (!clerk.session) return null

  return await clerk.session.getToken()
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return

  const token = await getSessionToken()
  if (!token) return

  await fetch('https://api.yourapp.com/page-visit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: tab.url }),
  })
})
```

## 环境变量

`.env.development`：
```
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_FRONTEND_API=https://your-app.clerk.accounts.dev
PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost
```

`.env.production`：
```
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_FRONTEND_API=https://clerk.your-domain.com
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://clerk.your-domain.com
```

## Manifest 配置

`package.json`：
```json
{
  "manifest": {
    "key": "$CRX_PUBLIC_KEY",
    "permissions": ["cookies", "storage", "tabs"],
    "host_permissions": [
      "$PLASMO_PUBLIC_CLERK_SYNC_HOST/*",
      "$CLERK_FRONTEND_API/*"
    ]
  }
}
```

`host_permissions` 中 sync host 域名正是让扩展能从 web app 读取 Clerk 会话 cookie 的配置。

## 在 Clerk 中登记扩展

扩展 ID 必须位于 web app 实例的允许源中：

```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID"]}'
```

## 与「Popup + syncHost」的关键区别

在使用 `syncHost` 的 popup 扩展中，用户也可以直接通过 popup 登录（邮箱/密码、OTP）。而在无头扩展中完全没有 UI——用户**必须**通过 web app 登录，扩展只读取认证状态。

## 调试

要验证认证状态是否在同步：

```typescript
const clerk = await createClerkClient({ publishableKey, syncHost, background: true })
console.log('User:', clerk.user?.emailAddresses[0]?.emailAddress ?? 'Not signed in')
console.log('Session:', clerk.session?.id ?? 'No session')
```

如果用户在 web app 已登录但 `user` 为 null，请检查：
1. `host_permissions` 是否包含 sync host 域名
2. 扩展 ID 是否在 Clerk 的允许源中
3. `syncHost` 的值是否与 Clerk Frontend API URL 一致（而非 web app 主域名）
