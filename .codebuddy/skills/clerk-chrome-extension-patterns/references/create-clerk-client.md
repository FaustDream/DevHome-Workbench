# createClerkClient() —— Vanilla JS 与 Service Worker 场景

## 何时使用

在以下情况使用 `createClerkClient()`：
- 扩展不使用 React
- 需要在 background service worker 中使用 Clerk
- 需要在内容脚本上下文中使用 Clerk（经由 background 的消息传递）
- 希望在没有可见 popup 的情况下保持会话新鲜

从 `@clerk/chrome-extension/client` 导入，**不是**从 `@clerk/chrome-extension` 导入。

## Background Service Worker

关键选项是 `background: true`。它告诉 Clerk 持续刷新会话 token，即使没有 popup 或 side panel 打开。如果不设置，UI 关闭 60 秒后 token 过期。

`src/background/index.ts`：
```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error('Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY')
}

async function getToken(): Promise<string | null> {
  const clerk = await createClerkClient({
    publishableKey,
    background: true,
  })

  if (!clerk.session) return null

  return await clerk.session.getToken()
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  getToken()
    .then((token) => sendResponse({ token }))
    .catch((error) => {
      console.error('[Background service worker] Error:', JSON.stringify(error))
      sendResponse({ token: null })
    })
  return true
})
```

监听器**必须 `return true`**，以保持消息通道对异步 `sendResponse` 调用开放。

## 从 Tab 或内容脚本请求 Token

```typescript
// tabs/my-tab.tsx 或内容脚本
async function getTokenFromBackground(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (response) => {
      resolve(response?.token ?? null)
    })
  })
}

async function makeAuthenticatedRequest() {
  const token = await getTokenFromBackground()
  if (!token) {
    console.warn('User not signed in')
    return
  }

  const res = await fetch('https://api.example.com/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  return res.json()
}
```

## Vanilla JS Popup（不使用 React）

对于使用纯 TypeScript 而非 React 的 popup 或 side panel：

`src/popup.ts`：
```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY
const EXTENSION_URL = chrome.runtime.getURL('.')
const POPUP_URL = `${EXTENSION_URL}popup.html`

const clerk = createClerkClient({ publishableKey })
const contentEl = document.getElementById('content') as HTMLDivElement

function render() {
  const email = clerk.user?.primaryEmailAddress?.emailAddress
  contentEl.textContent = email ?? 'Not signed in'
}

clerk.load({
  afterSignOutUrl: POPUP_URL,
  signInForceRedirectUrl: POPUP_URL,
  signUpForceRedirectUrl: POPUP_URL,
  allowedRedirectProtocols: ['chrome-extension:'],
}).then(() => {
  clerk.addListener(render)
  render()
})
```

`allowedRedirectProtocols: ['chrome-extension:']` 是允许重定向到 `chrome-extension://` URL 所必需的。

## createClerkClient() 选项

| 选项 | 类型 | 说明 |
|--------|------|-------------|
| `publishableKey` | `string` | 必填。你的 Clerk 发布密钥。 |
| `background` | `boolean` | 在 service worker 中设为 `true` 以保持会话新鲜。 |
| `syncHost` | `string` | 用于同步认证的 web app 域名（无头扩展）。 |

## 从 Background 发起带鉴权 API 调用

```typescript
async function callMyAPI() {
  const clerk = await createClerkClient({ publishableKey, background: true })

  if (!clerk.session) return

  const token = await clerk.session.getToken()

  const res = await fetch('https://api.yourapp.com/data', {
    headers: { Authorization: `Bearer ${token}` },
  })

  return res.json()
}
```

## 文档

[createClerkClient() 参考](https://clerk.com/docs/reference/chrome-extension/create-clerk-client)
