# 回归测试 (Regression Tests) — 测试报告

- **生成时间**: 2026-07-07 09:12:38
- **测试总数**: 35
- **通过**: 32 ✓
- **失败**: 3 ✗
- **通过率**: 91%
- **耗时**: 10ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | SHORTCUT_SIZE_OPTIONS 三档尺寸不变 | ✅ PASS |
| 2 | engines 仍是5个，百度用 badge 而非 icon | ✅ PASS |
| 3 | INLINE_DEFAULT_CATEGORY_NAMES 仍是11个 | ✅ PASS |
| 4 | storage set/get 行为未变 | ✅ PASS |
| 5 | createDefaultTile 结构不变 | ✅ PASS |
| 6 | getPageTileSignature 排序拼接不变 | ✅ PASS |
| 7 | repairDefaultCategoryContent 无错位时不变 | ✅ PASS |
| 8 | normalizePageState 修复不一致行为不变 | ✅ PASS |
| 9 | addPage 新增后计数+1 | ✅ PASS |
| 10 | removePage 不删最后一个 | ✅ PASS |
| 11 | removePageWithStrategy moveToCommon 迁移磁贴 | ✅ PASS |
| 12 | reorderPage 交换后 currentPage 跟随 | ✅ PASS |
| 13 | renamePage 修改分类名 | ✅ PASS |
| 14 | add 追加到末尾 | ❌ FAIL |
| 15 | remove 删除存在返回 true | ✅ PASS |
| 16 | remove 不存在返回 false | ✅ PASS |
| 17 | update 部分更新 | ✅ PASS |
| 18 | reorder 位置交换 | ✅ PASS |
| 19 | sortByPosition 按 position 升序 | ✅ PASS |
| 20 | buildSuggestions 空输入返回历史 | ✅ PASS |
| 21 | buildSuggestions 关键词过滤 | ✅ PASS |
| 22 | buildSuggestions 匹配磁贴 | ✅ PASS |
| 23 | addSearchHistory 去重+上限20 | ✅ PASS |
| 24 | clearSearchHistory 清空 | ✅ PASS |
| 25 | getWorkbenchState 空存储返回默认值 | ✅ PASS |
| 26 | getWorkbenchState 合并已保存数据 | ❌ FAIL |
| 27 | saveWorkbenchState 持久化并读取 | ❌ FAIL |
| 28 | 空磁贴分类不崩溃 (NULL tile 处理) | ✅ PASS |
| 29 | getTileIdentity null/undefined 处理 | ✅ PASS |
| 30 | sanitizeHtml 空输入不崩溃 | ✅ PASS |
| 31 | escapeHtml 已转义内容不二次转义风险低 | ✅ PASS |
| 32 | 无效搜索引擎不崩溃 | ✅ PASS |
| 33 | 无效 shortcutSize 回退 standard | ✅ PASS |
| 34 | addSearchHistory 空字符串不变历史 | ✅ PASS |
| 35 | removePageAt 仅一页时返回 false | ✅ PASS |

## 失败详情

### 1. add 追加到末尾
```
t.eq is not a function
```

### 2. getWorkbenchState 合并已保存数据
```

```

### 3. saveWorkbenchState 持久化并读取
```
Cannot read properties of undefined (reading 'set')
```

## 结论

⚠️ 存在 3 个失败测试，通过率 91%
