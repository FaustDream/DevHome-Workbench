---
name: clerk-chrome-extension-patterns
description: '使用 @clerk/chrome-extension 的 Chrome 扩展认证 —— popup/side panel 设置，通过 web app 使用 syncHost 实现 OAuth/SAML，通过 createClerkClient 处理 service worker 与无头扩展，以及稳定的 CRX ID。触发场景：Chrome 扩展认证、Plasmo clerk、popup 登录、syncHost、后台 service worker token、createClerkClient、无头扩展。'
license: MIT
allowed-tools: WebFetch
compatibility: 需要 PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY（Plasmo 用于公共环境变量的前缀）与 CLERK_FRONTEND_API。
metadata:
  author: clerk
  version: 2.0.0
  references:
  - references/sync-host.md
  - references/create-clerk-client.md
  - references/content-scripts.md
  - references/headless-extension.md
---

# Chrome 扩展模式（Clerk）

## 关键规则

1. OAuth（Google、GitHub 等）与 SAML 在 popup 或 side panel 中**不受支持**——请使用 `syncHost` 将认证委托给你的 web app。
2. 邮件链接（magic link）在 popup 中无法工作——用户点击外部时 popup 会关闭，重置登录状态。
3. side panel 不会自动刷新认证状态——用户通过 web app 登录后，必须关闭并重新打开 side panel。
4. service worker 与内容脚本**无法访问** Clerk React hooks——请使用 `createClerkClient()` 或消息传递。
5. 扩展 URL 使用 `chrome-extension://` 而非 `http://`——所有重定向 URL 都必须使用 `chrome.runtime.getURL('.')`。
6. 没有稳定的 CRX ID，每次重新构建都会破坏认证——请在部署前于 manifest 中配置 `key`。
7. 内容脚本因源限制无法直接使用 Clerk——Clerk 强制要求严格的允许源。
8. 必须在 Clerk Dashboard 中**禁用**机器人保护——扩展环境不支持 Cloudflare 机器人检测。

## 认证方式对照

| 方式 | Popup | Side Panel | syncHost（配合 web app） |
|--------|-------|------------|------------------------|
| 邮箱 + OTP | 是 | 是 | 是 |
| 邮箱 + 链接 | 否 | 否 | 是 |
| 邮箱 + 密码 | 是 | 是 | 是 |
| 用户名 + 密码 | 是 | 是 | 是 |
| 短信 + OTP | 是 | 是 | 是 |
| OAuth（Google、GitHub 等） | **否** | **否** | **是** |
| SAML | **否** | **否** | **是** |
| Passkeys | 是 | 是 | 是 |
| Google One Tap | 否 | 否 | 是 |
| Web3 | 否 | 否 | 是 |

## 快速开始（Plasmo）

```bash
npx create-plasmo --with-tailwindcss --with-src my-extension
cd my-extension
npm install @clerk/chrome-extension
```

在 Clerk Dashboard 的 Native applications 下启用 **Native API**。所有扩展集成都需要它。

`.env.development`：
```
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_FRONTEND_API=https://your-app.clerk.accounts.dev
```

`src/popup.tsx`：
```tsx
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/chrome-extension'

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const EXTENSION_URL = chrome.runtime.getURL('.')

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY')
}

function IndexPopup() {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl={`${EXTENSION_URL}/popup.html`}
      signInFallbackRedirectUrl={`${EXTENSION_URL}/popup.html`}
      signUpFallbackRedirectUrl={`${EXTENSION_URL}/popup.html`}
    >
      <Show when="signed-out">
        <SignInButton mode="modal" />
        <SignUpButton mode="modal" />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </ClerkProvider>
  )
}

export default IndexPopup
```

对 `SignInButton` 使用 `mode="modal"`——跳转到单独页面会破坏 popup 流程。

## syncHost —— 与 Web App 同步认证

当你需要 OAuth、SAML，或希望扩展反映来自 web app 的登录状态时使用。

**工作原理**：扩展通过 `host_permissions` 从你的 web app 域名读取 Clerk 会话 cookie。

**步骤 1 —— 环境变量：**

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

**步骤 2 —— 添加 `syncHost` 属性：**

```tsx
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

<ClerkProvider
  publishableKey={PUBLISHABLE_KEY}
  syncHost={SYNC_HOST}
  afterSignOutUrl="/"
  routerPush={(to) => navigate(to)}
  routerReplace={(to) => navigate(to, { replace: true })}
>
```

**步骤 3 —— 在 `package.json` 中配置 `host_permissions`：**

```json
{
  "manifest": {
    "key": "$CRX_PUBLIC_KEY",
    "permissions": ["cookies", "storage"],
    "host_permissions": [
      "$PLASMO_PUBLIC_CLERK_SYNC_HOST/*",
      "$CLERK_FRONTEND_API/*"
    ]
  }
}
```

**步骤 4 —— 通过 Clerk API 将扩展 ID 加入 web app 的允许源：**

```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID"]}'
```

**使用 syncHost 时在 popup 中隐藏不支持的认证方式：**

```tsx
<SignIn
  appearance={{
    elements: {
      socialButtonsRoot: 'plasmo-hidden',
      dividerRow: 'plasmo-hidden',
    },
  }}
/>
```

完整指南见 `references/sync-host.md`。

## createClerkClient() 用于 Vanilla JS / Service Worker

从 `@clerk/chrome-extension/client` 导入（不是 `@clerk/chrome-extension`）。

**Background service worker**（`src/background/index.ts`）：

```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY

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
      console.error('[Background] Error:', JSON.stringify(error))
      sendResponse({ token: null })
    })
  return true
})
```

`background: true` 标志会在 popup/sidepanel 关闭后仍保持会话新鲜。不设置它，token 在 60 秒后过期。

**使用 Vanilla JS 的 Popup**（`src/popup.ts`）：

```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const EXTENSION_URL = chrome.runtime.getURL('.')
const POPUP_URL = `${EXTENSION_URL}popup.html`

const clerk = createClerkClient({ publishableKey })

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

完整指南见 `references/create-clerk-client.md`。

## 无头扩展（无 popup、无 side panel）

适用于完全在后台运行并与 web app 同步的扩展。

使用 `syncHost` + `createClerkClient`（`background: true`）从 web app 的 cookie 读取认证状态。

```typescript
import { createClerkClient } from '@clerk/chrome-extension/client'

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

async function getAuthenticatedUser() {
  const clerk = await createClerkClient({
    publishableKey,
    syncHost,
    background: true,
  })
  return clerk.user
}
```

需要在 `package.json` 中为 sync host 域名配置 `host_permissions`。

完整指南见 `references/headless-extension.md`。

## 内容脚本

内容脚本运行在注入网页的隔离 JavaScript 环境中。**Clerk 不能直接使用**——源限制阻止了它。

使用消息传递向 background service worker 请求认证状态：

```typescript
// content.ts
async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (response) => {
      resolve(response?.token ?? null)
    })
  })
}

async function main() {
  const token = await getToken()
  if (!token) return
  // 使用 token 发起带鉴权的 API 调用
}

main()
```

完整指南见 `references/content-scripts.md`。

## 稳定的 CRX ID

没有固定的 key，Chrome 会在构建时从随机 key 派生 CRX ID。每次重新构建都会轮换，破坏允许源。

**方案 A —— Plasmo Itero（推荐）：**
1. 访问 [Plasmo Itero Generate Keypairs](https://itero.plasmo.com/ext/generate-keypairs)
2. 点击 "Generate KeyPairs"——安全保存私钥，复制公钥与 CRX ID

**方案 B —— OpenSSL：**
```bash
openssl genrsa -out key.pem 2048
# 使用 Plasmo Itero 转换或提取正确格式的公钥
```

**`.env.chrome`：**
```
CRX_PUBLIC_KEY="<来自 Itero 的公钥>"
```

**`package.json`：**
```json
{
  "manifest": {
    "key": "$CRX_PUBLIC_KEY",
    "permissions": ["cookies", "storage"],
    "host_permissions": [
      "http://localhost/*",
      "$CLERK_FRONTEND_API/*"
    ]
  }
}
```

将 `chrome-extension://YOUR_STABLE_CRX_ID` 加入 Clerk Dashboard > Allowed Origins。

## Token 缓存（跨 popup 关闭持久化）

```tsx
const tokenCache = {
  async getToken(key: string) {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  },
  async saveToken(key: string, token: string) {
    await chrome.storage.local.set({ [key]: token })
  },
  async clearToken(key: string) {
    await chrome.storage.local.remove(key)
  },
}

<ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
```

| 存储类型 | 作用域 | 清除时机 |
|---|---|---|
| `chrome.storage.local` | 设备 | 卸载或手动清除 |
| `chrome.storage.session` | 会话 | 浏览器关闭 |
| `chrome.storage.sync` | 所有设备 | 卸载（有大小限制，8KB） |
| `localStorage` | 仅 popup | popup 关闭——不可用于认证 |

## 常见陷阱

| 症状 | 原因 | 修复 |
|---------|-------|-----|
| 登录时重定向循环 | ClerkProvider 属性中缺少 CRX URL | 设置 `afterSignOutUrl`、`signInFallbackRedirectUrl` |
| OAuth 按钮无效 | popup 不支持 OAuth | 使用 `syncHost` 委托给 web app |
| web app 登录后认证状态陈旧 | 未配置 `syncHost` | 添加 `syncHost` 属性 + `host_permissions` |
| web 登录后 side panel 显示未登录 | 已知限制 | 用户必须关闭并重新打开 side panel |
| 60 秒后 background 无法获取 token | 会话过期，无后台刷新 | 使用 `createClerkClient({ background: true })` |
| 内容脚本无法访问 Clerk | 隔离环境 + 源限制 | 使用消息传递到 background service worker |
| 重新构建后认证失效 | CRX ID 轮换 | 通过 `.env.chrome` 配置稳定 key |
| `PLASMO_PUBLIC_` 变量未定义 | 错误的环境文件 | 使用 `.env.development`，而非 `.env` |
| 机器人保护报错 | 扩展不支持 Cloudflare | 在 Clerk Dashboard 禁用机器人保护 |
| Token 缓存不持久 | 在 popup 中使用 `localStorage` | 使用 `chrome.storage.local` 或传入 `tokenCache` 属性 |

## 套餐要求

| 功能 | 套餐 |
|---------|------|
| 基础 popup 认证（邮箱/密码、OTP） | 免费 |
| Passkeys | 免费 |
| syncHost | 需要 Pro（自定义域名） |
| 通过 syncHost 的 OAuth | Pro + web app 已配置 OAuth |
| 通过 syncHost 的 SAML | 企业版 |
| 机器人保护 | 不适用——扩展必须禁用 |

## 参见

- `clerk-setup` - Clerk 初始安装
- `clerk-custom-ui` - 自定义流程与外观
