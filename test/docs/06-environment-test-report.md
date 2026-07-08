# 环境测试 (Environment Tests) — 测试报告

- **生成时间**: 2026-07-07 09:13:08
- **测试总数**: 53
- **通过**: 52 ✓
- **失败**: 1 ✗
- **通过率**: 98%
- **耗时**: 6ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | Node.js 版本 >= 18.0.0 | ❌ FAIL |
| 2 | 操作系统是 Windows | ✅ PASS |
| 3 | 架构是 x64 | ✅ PASS |
| 4 | globalThis 可用 (ES2020) | ✅ PASS |
| 5 | Promise.allSettled 可用 (ES2020) | ✅ PASS |
| 6 | Array.flat 可用 (ES2019) | ✅ PASS |
| 7 | Object.fromEntries 可用 (ES2019) | ✅ PASS |
| 8 | String.trimStart/trimEnd 可用 (ES2019) | ✅ PASS |
| 9 | package.json 是有效的 UTF-8 JSON | ✅ PASS |
| 10 | manifest.json 是有效的 UTF-8 JSON | ✅ PASS |
| 11 | defaults.json 是有效的 UTF-8 JSON | ✅ PASS |
| 12 | 所有 HTML 文件为 UTF-8 编码 | ✅ PASS |
| 13 | manifest.json 是 Manifest V3 格式 | ✅ PASS |
| 14 | permissions 包含必需的 Chrome API | ✅ PASS |
| 15 | chrome_url_overrides 正确配置 | ✅ PASS |
| 16 | content_security_policy 限制合理 | ✅ PASS |
| 17 | icons 至少包含 16/48/128 尺寸 | ✅ PASS |
| 18 | commands 快捷键配置有效 | ✅ PASS |
| 19 | esbuild 已安装在 devDependencies | ✅ PASS |
| 20 | React 已安装在 dependencies | ✅ PASS |
| 21 | Tiptap 编辑器依赖已安装 | ✅ PASS |
| 22 | node_modules 存在 (npm install 已执行) | ✅ PASS |
| 23 | build.mjs 包含 esbuild 导入 | ✅ PASS |
| 24 | scripts/install-react.mjs 存在 | ✅ PASS |
| 25 | scripts/convert-notes.mjs 存在 | ✅ PASS |
| 26 | index.html 存在 | ✅ PASS |
| 27 | popup.html 存在 | ✅ PASS |
| 28 | sidepanel.html 存在 | ✅ PASS |
| 29 | js/main.js 存在 | ✅ PASS |
| 30 | js/config.js 存在 | ✅ PASS |
| 31 | js/state.js 存在 | ✅ PASS |
| 32 | js/storage.js 存在 | ✅ PASS |
| 33 | js/utils.js 存在 | ✅ PASS |
| 34 | js/workbench.js 存在 | ✅ PASS |
| 35 | js/events.js 存在 | ✅ PASS |
| 36 | js/search.js 存在 | ✅ PASS |
| 37 | js/tiles.js 存在 | ✅ PASS |
| 38 | js/pageManager.js 存在 | ✅ PASS |
| 39 | js/favicon.js 存在 | ✅ PASS |
| 40 | js/bgManager.js 存在 | ✅ PASS |
| 41 | js/storageV2.js 存在 | ✅ PASS |
| 42 | js/logger.js 存在 | ✅ PASS |
| 43 | js/secrets.js 存在 | ✅ PASS |
| 44 | css/base.css 存在 | ✅ PASS |
| 45 | css/tokens.css 存在 | ✅ PASS |
| 46 | defaults.json 存在 | ✅ PASS |
| 47 | manifest.json 存在 | ✅ PASS |
| 48 | package.json 存在 | ✅ PASS |
| 49 | AGENTS.md 存在 | ✅ PASS |
| 50 | README.md 存在 | ✅ PASS |
| 51 | build.mjs 存在 | ✅ PASS |
| 52 | 所有路径使用正斜杠 (跨平台兼容) | ✅ PASS |
| 53 | package.json scripts 使用跨平台语法 | ✅ PASS |

## 失败详情

### 1. Node.js 版本 >= 18.0.0
```
nodeVersion is not a function
```

## 结论

⚠️ 存在 1 个失败测试，通过率 98%
