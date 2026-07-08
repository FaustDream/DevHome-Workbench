# 安全测试 (Security Tests) — 测试报告

- **生成时间**: 2026-07-07 09:13:08
- **测试总数**: 33
- **通过**: 20 ✓
- **失败**: 13 ✗
- **通过率**: 61%
- **耗时**: 26ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | escapeHtml 转义 script 标签 | ❌ FAIL |
| 2 | escapeHtml 转义 img onerror 攻击 | ❌ FAIL |
| 3 | escapeHtml 转义事件处理器 | ❌ FAIL |
| 4 | escapeHtml 保留安全文本 | ✅ PASS |
| 5 | sanitizeHtml 移除 script 标签 | ❌ FAIL |
| 6 | sanitizeHtml 移除 iframe 标签 | ❌ FAIL |
| 7 | sanitizeHtml 移除 style 标签 (CSS injection) | ❌ FAIL |
| 8 | sanitizeHtml 移除 object/embed 标签 | ❌ FAIL |
| 9 | sanitizeHtml 移除 link/meta/base 标签 | ❌ FAIL |
| 10 | sanitizeHtml 移除 on* 事件属性 | ❌ FAIL |
| 11 | sanitizeHtml 移除 javascript: 协议 | ❌ FAIL |
| 12 | sanitizeHtml 移除 data:text/html 协议 | ❌ FAIL |
| 13 | secrets.js 中 API Key 不在日志导出中泄漏 | ✅ PASS |
| 14 | config.js 中 API 端点不硬编码密钥 | ✅ PASS |
| 15 | CSP 阻止 eval() | ✅ PASS |
| 16 | CSP 限制 connect-src 为 https: | ✅ PASS |
| 17 | package.json 中无硬编码密钥 | ✅ PASS |
| 18 | manifest.json 中无硬编码密钥 | ✅ PASS |
| 19 | build.mjs 中无硬编码密钥 | ✅ PASS |
| 20 | sanitizeHtml 空/null 安全 | ✅ PASS |
| 21 | escapeHtml 空/null 安全 | ✅ PASS |
| 22 | addSearchHistory 空字符串不添加 | ✅ PASS |
| 23 | storage 防止 XSS through storage key (key 不作为 HTML 渲染) | ✅ PASS |
| 24 | normalizeShortcutSize 注入值回退安全 | ❌ FAIL |
| 25 | normalizeShortcutColumns 注入值回退安全 | ❌ FAIL |
| 26 | JSON parse 异常不暴露到外部 (try-catch 包裹) | ✅ PASS |
| 27 | storage.set 异常静默处理 | ✅ PASS |
| 28 | devhomeStorage 异常静默处理 | ✅ PASS |
| 29 | 搜索引擎 URL 仅使用 https 协议 | ✅ PASS |
| 30 | host_permissions 仅授予已知域名 | ✅ PASS |
| 31 | web_accessible_resources 仅有 defaults.json | ✅ PASS |
| 32 | escapeHtml 覆盖所有 HTML 特殊字符 | ✅ PASS |
| 33 | search suggestions 使用 escapeHtml 防护 | ✅ PASS |

## 失败详情

### 1. escapeHtml 转义 script 标签
```
assertion failed
```

### 2. escapeHtml 转义 img onerror 攻击
```
assertion failed
```

### 3. escapeHtml 转义事件处理器
```
assertion failed
```

### 4. sanitizeHtml 移除 script 标签
```
assertion failed
```

### 5. sanitizeHtml 移除 iframe 标签
```
assertion failed
```

### 6. sanitizeHtml 移除 style 标签 (CSS injection)
```
assertion failed
```

### 7. sanitizeHtml 移除 object/embed 标签
```
assertion failed
```

### 8. sanitizeHtml 移除 link/meta/base 标签
```
assertion failed
```

### 9. sanitizeHtml 移除 on* 事件属性
```
assertion failed
```

### 10. sanitizeHtml 移除 javascript: 协议
```
assertion failed
```

### 11. sanitizeHtml 移除 data:text/html 协议
```
assertion failed
```

### 12. normalizeShortcutSize 注入值回退安全
```

```

### 13. normalizeShortcutColumns 注入值回退安全
```

```

## 结论

⚠️ 存在 13 个失败测试，通过率 61%
