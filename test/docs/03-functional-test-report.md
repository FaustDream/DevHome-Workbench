# 功能测试 (Functional Tests) — 测试报告

- **生成时间**: 2026-07-07 09:12:08
- **测试总数**: 27
- **通过**: 23 ✓
- **失败**: 4 ✗
- **通过率**: 85%
- **耗时**: 9ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | 搜索词添加到历史记录 | ✅ PASS |
| 2 | 重复搜索词去重并移到最前 | ✅ PASS |
| 3 | 搜索建议包含历史 + 磁贴匹配 | ✅ PASS |
| 4 | 搜索引擎切换正确更新状态 | ✅ PASS |
| 5 | setEngine 无效引擎不更改状态 | ✅ PASS |
| 6 | 添加磁贴并验证列表更新 | ✅ PASS |
| 7 | 删除磁贴并验证列表减少 | ✅ PASS |
| 8 | 更新磁贴属性 | ✅ PASS |
| 9 | 拖拽排序：磁贴位置交换 | ✅ PASS |
| 10 | 移动磁贴到另一分类 | ✅ PASS |
| 11 | 复制磁贴到另一分类 | ✅ PASS |
| 12 | 新增分类后自动跳转 | ✅ PASS |
| 13 | 删除分类（非最后一个） | ❌ FAIL |
| 14 | 最后一个分类不可删除 | ✅ PASS |
| 15 | 重命名分类 | ❌ FAIL |
| 16 | 分类拖拽排序 | ❌ FAIL |
| 17 | 页面切换正确更新 currentTiles | ✅ PASS |
| 18 | 保存并读取工作台状态 | ❌ FAIL |
| 19 | 工作台状态合并默认四象限 | ✅ PASS |
| 20 | 预设时长合理 (25/30/45/60 分钟) | ✅ PASS |
| 21 | 休息时长合理 (5/10/15 分钟) | ✅ PASS |
| 22 | state.pomodoroDuration 默认 25 | ✅ PASS |
| 23 | state.pomodoroRestDuration 默认 5 | ✅ PASS |
| 24 | state.pomodoroMode 默认 default | ✅ PASS |
| 25 | state.pomodoroAutoCycle 默认 true | ✅ PASS |
| 26 | 五种笔记类型各有 label 和 icon | ✅ PASS |
| 27 | 默认当前笔记类型为 note | ✅ PASS |

## 失败详情

### 1. 删除分类（非最后一个）
```
ns.refreshCatRowIfVisible is not a function
```

### 2. 重命名分类
```
ns.refreshCatRowIfVisible is not a function
```

### 3. 分类拖拽排序
```
ns.refreshCatRowIfVisible is not a function
```

### 4. 保存并读取工作台状态
```
Cannot read properties of undefined (reading 'set')
```

## 结论

⚠️ 存在 4 个失败测试，通过率 85%
