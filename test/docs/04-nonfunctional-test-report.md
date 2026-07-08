# 非功能测试 (Non-functional Tests) — 测试报告

- **生成时间**: 2026-07-07 09:14:49
- **测试总数**: 15
- **通过**: 14 ✓
- **失败**: 1 ✗
- **通过率**: 93%
- **耗时**: 45ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | storage.set 100次操作 < 100ms | ✅ PASS |
| 2 | storage.get 100次操作 < 50ms | ✅ PASS |
| 3 | 大数据存储（10KB）读写正常 | ✅ PASS |
| 4 | buildSuggestions 100磁贴+20历史 < 20ms | ❌ FAIL |
| 5 | addSearchHistory 20条去重 < 50ms | ✅ PASS |
| 6 | 写入600条日志上限为500 | ✅ PASS |
| 7 | 日志查询 limit=10 返回10条 | ✅ PASS |
| 8 | exportLogs 对500条日志生成JSON < 100ms | ✅ PASS |
| 9 | backupPagesSnapshot 快照上限3份 | ✅ PASS |
| 10 | searchHistory 上限20条 | ✅ PASS |
| 11 | storage 支持嵌套深度 6 层 JSON | ✅ PASS |
| 12 | 所有模块在 1 秒内加载完成 | ✅ PASS |
| 13 | 1000次 escapeHtml < 200ms | ✅ PASS |
| 14 | 创建50个磁贴 < 200ms | ✅ PASS |
| 15 | sortByPosition 50个磁贴 < 20ms | ✅ PASS |

## 失败详情

### 1. buildSuggestions 100磁贴+20历史 < 20ms
```
Cannot read properties of undefined (reading 'currentTiles')
```

## 结论

⚠️ 存在 1 个失败测试，通过率 93%
