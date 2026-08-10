# 内容脚本（Content Scripts）

## 约束

内容脚本运行在注入网页的**隔离 JavaScript 环境**中。它不能：
- 使用 Clerk React hooks
- 直接调用 Clerk API（Clerk 强制严格的源限制——内容脚本可能运行在任意域名）
- 访问扩展的 React 上下文

应使用**消息传递**向 background service worker 请求认证状态。

## 模式：从 Background 请求 Token

`src/content.ts`：
```typescript
async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (response) => {
      resolve(response?.token ?? null)
    })
  })
}

async function isSignedIn(): Promise<boolean> {
  const token = await getToken()
  return token !== null
}

async function injectUI() {
  const signedIn = await isSignedIn()

  if (!signedIn) {
    console.log('User not signed in, skipping injection')
    return
  }

  const overlay = document.createElement('div')
  overlay.id = 'my-extension-overlay'
  document.body.appendChild(overlay)
}

injectUI()
```

`src/background/index.ts`：
```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY

async function getToken(): Promise<string | null> {
  const clerk = await createClerkClient({ publishableKey, background: true })
  if (!clerk.session) return null
  return await clerk.session.getToken()
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TOKEN') {
    getToken()
      .then((token) => sendResponse({ token }))
      .catch(() => sendResponse({ token: null }))
    return true
  }
})
```

## 模式：内容脚本中的带鉴权请求

```typescript
// content.ts
async function fetchUserData() {
  const token = await getToken()
  if (!token) return null

  const res = await fetch('https://api.yourapp.com/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  return res.json()
}
```

## Manifest 权限

`package.json`（Plasmo）：
```json
{
  "manifest": {
    "permissions": ["storage", "tabs"],
    "host_permissions": ["<all_urls>"]
  }
}
```

仅在特定域名运行内容脚本：
```json
{
  "manifest": {
    "permissions": ["storage"],
    "host_permissions": ["https://specific-site.com/*"]
  }
}
```

## 内容脚本注册（Plasmo）

项目根目录下名为 `content.ts` 或 `content.tsx` 的文件会被自动注册为匹配所有 URL 的内容脚本。

若需要多个不同匹配模式的内容脚本，使用 `package.json`：
```json
{
  "manifest": {
    "content_scripts": [
      {
        "matches": ["https://specific-site.com/*"],
        "js": ["content.js"]
      }
    ]
  }
}
```

## 为什么不能在内容脚本中直接使用 Clerk

Clerk 对 API 请求强制严格的允许源。内容脚本可能被注入到任意域名（如 `https://github.com`、`https://google.com`）。无法把所有可能的域名都加入 Clerk 的允许源，因此直接在任何域名的内容脚本中使用 Clerk 在设计上被禁止。

[文档](https://clerk.com/docs/chrome-extension/getting-started/quickstart)
