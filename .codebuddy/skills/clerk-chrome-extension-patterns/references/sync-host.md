# syncHost —— 与 Web App 同步认证

## 何时使用

在以下情况使用 `syncHost`：
- OAuth（Google、GitHub 等）
- SAML
- 邮件魔法链接（magic link）
- 希望扩展反映来自 web app 的认证状态，而无需用户重新登录

没有 `syncHost` 时，扩展 popup 只能使用邮箱/密码、OTP 与 passkeys。

## 工作原理

扩展通过 `host_permissions` 从你的 web app 域名读取 Clerk 的会话 cookie。`syncHost` 属性告诉 `ClerkProvider` 要从哪个域名同步。

## 步骤 1 —— 环境变量

为开发和生产使用独立文件，以便 Plasmo 向各自的构建传入正确的值。

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

生产环境的 `PLASMO_PUBLIC_CLERK_SYNC_HOST` 值应该是你的 Clerk Frontend API 运行的域名（如 `https://clerk.your-domain.com`），而非 app 的主域名。

## 步骤 2 —— 带 syncHost 的 ClerkProvider

```tsx
import { ClerkProvider, Show, UserButton } from '@clerk/chrome-extension'
import { Link, Outlet, useNavigate } from 'react-router-dom'

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

if (!PUBLISHABLE_KEY || !SYNC_HOST) {
  throw new Error('Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY or PLASMO_PUBLIC_CLERK_SYNC_HOST')
}

export function RootLayout() {
  const navigate = useNavigate()

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl="/"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <Outlet />
    </ClerkProvider>
  )
}
```

## 步骤 3 —— Manifest 的 host_permissions

在 `package.json` 中配置 `host_permissions`，授予扩展访问 sync host 域名的权限：

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

Plasmo 在构建时插值 `package.json` 中的环境变量。开发环境解析为 `http://localhost/*`。

## 步骤 4 —— 在 Clerk 中登记扩展 ID

Clerk 必须显式允许来自扩展源的请求。每个环境运行一次：

```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID"]}'
```

将 `YOUR_SECRET_KEY` 替换为你的 Clerk Secret Key（`sk_test_...` 或 `sk_live_...`），将 `YOUR_EXTENSION_ID` 替换为你的稳定 CRX ID。

如果扩展 ID 发生变化（密钥不稳定），必须重新运行此命令。配置稳定的 CRX ID 以避免重复此步骤。

## 在 Popup 中隐藏不支持的认证方式

使用 `syncHost` 时，你的 web app 可能启用了 OAuth，但 popup 本身无法完成 OAuth 流程。在 popup 中隐藏这些按钮：

```tsx
import { SignIn, SignUp } from '@clerk/chrome-extension'

function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          socialButtonsRoot: 'plasmo-hidden',
          dividerRow: 'plasmo-hidden',
        },
      }}
    />
  )
}

function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          socialButtonsRoot: 'plasmo-hidden',
          dividerRow: 'plasmo-hidden',
        },
      }}
    />
  )
}
```

这样 popup 只显示它支持的方式（邮箱/密码、OTP），而 web app 暴露包括 OAuth 在内的所有方式。

## Side Panel 限制

`syncHost` 不完全支持 side panel。如果用户通过 web app 登录，side panel 不会自动更新其认证状态。用户必须关闭并重新打开 side panel 才能反映新的认证状态。这是 SDK 的已知限制。

## 文档

[同步认证状态指南](https://clerk.com/docs/guides/sessions/sync-host)
