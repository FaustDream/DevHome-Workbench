# 覆盖率检查 (Coverage Check) — 测试报告

- **生成时间**: 2026-07-07 09:14:08
- **测试总数**: 16
- **通过**: 14 ✓
- **失败**: 2 ✗
- **通过率**: 88%
- **耗时**: 19ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | 项目总导出函数数统计 | ✅ PASS |
| 2 | 至少 70% 导出函数有测试覆盖 | ✅ PASS |
| 3 | logger.js 达到 100% 导出覆盖 | ✅ PASS |
| 4 | config.js 达到 80% 以上导出覆盖 | ✅ PASS |
| 5 | utils.js 达到 75% 以上导出覆盖 | ✅ PASS |
| 6 | storage.js 达到 100% 导出覆盖 | ✅ PASS |
| 7 | tiles.js (tileManager) 达到 70% 以上导出覆盖 | ❌ FAIL |
| 8 | pageManager.js 达到 100% 导出覆盖 | ❌ FAIL |
| 9 | bgManager.js 需要集成测试 (依赖 Chrome API) | ✅ PASS |
| 10 | events.js 需要 E2E 测试 (DOM 操作密集) | ✅ PASS |
| 11 | main.js boot 函数需要集成测试 (完整启动流程) | ✅ PASS |
| 12 | storageV2.js 需要 Chrome Storage API 环境 | ✅ PASS |
| 13 | favicon.js loadFavicon 需要网络环境 | ✅ PASS |
| 14 | 源代码文件总行数统计 | ✅ PASS |
| 15 | 单个文件最大行数 < 3000 (workbench.js) | ✅ PASS |
| 16 | 测试用例总数 > 100 | ✅ PASS |

## 失败详情

### 1. tiles.js (tileManager) 达到 70% 以上导出覆盖
```
tiles.js 覆盖率 65%
```

### 2. pageManager.js 达到 100% 导出覆盖
```
pageManager.js 覆盖率 100%
```

## 结论

⚠️ 存在 2 个失败测试，通过率 88%
