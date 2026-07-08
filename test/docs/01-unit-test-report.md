# 单元测试 (Unit Tests) — 测试报告

- **生成时间**: 2026-07-07 09:23:37
- **测试总数**: 138
- **通过**: 133 ✓
- **失败**: 5 ✗
- **通过率**: 96%
- **耗时**: 149ms
- **项目**: DevHome Workbench v2.18.1

## 测试明细

| # | 测试项 | 状态 |
|---|--------|------|
| 1 | SHORTCUT_SIZE_OPTIONS 三档尺寸 small/standard/large | ✅ PASS |
| 2 | engines 包含5个搜索引擎且各自必有 name/url | ✅ PASS |
| 3 | 搜索引擎 URL 格式正确 | ✅ PASS |
| 4 | DEFAULT_SHORTCUT_SIZE 为 standard | ✅ PASS |
| 5 | SHORTCUT_COLUMN_OPTIONS 包含 6 和 8 列 | ✅ PASS |
| 6 | TILE_LONG_PRESS_MS 和 NORMAL_CLIENT_MS 为合理数值 | ✅ PASS |
| 7 | DEFAULTS_VERSION 非空字符串 | ✅ PASS |
| 8 | INLINE_DEFAULT_CATEGORY_NAMES 正好 11 个预设分类 | ✅ PASS |
| 9 | POMODORO_PRESETS 包含四个预设时长 | ✅ PASS |
| 10 | POMODORO_REST_PRESETS 包含三个休息时长 | ✅ PASS |
| 11 | NOTE_TYPES 包含 5 种笔记类型 | ✅ PASS |
| 12 | ENCOURAGEMENT_POOL 非空且全是字符串 | ✅ PASS |
| 13 | DEFAULT_BEHAVIOR_STATE 包含必需字段 | ✅ PASS |
| 14 | DEFAULT_V2_CONFIG 包含 AI 配置、快捷键、番茄钟、行为追踪、文件同步 | ✅ PASS |
| 15 | defaultWorkbenchState 四象限结构完整 | ✅ PASS |
| 16 | storage.set/get 读写字符串值一致 | ✅ PASS |
| 17 | storage.set/get 读写数字值一致 | ✅ PASS |
| 18 | storage.set/get 读写对象值一致 | ✅ PASS |
| 19 | storage.set/get 读写数组值一致 | ✅ PASS |
| 20 | storage.get 键不存在返回 fallback | ✅ PASS |
| 21 | storage.get 键不存在且无 fallback 返回 undefined | ✅ PASS |
| 22 | storage.clear 清除后回到 fallback | ✅ PASS |
| 23 | storage 键自动添加 tabpage_ 前缀 | ✅ PASS |
| 24 | devhomeStorage 使用 devhome_ 前缀 | ✅ PASS |
| 25 | devhomeStorage.get/set 读写数据一致 | ✅ PASS |
| 26 | backupPagesSnapshot 保存快照最多3份 | ✅ PASS |
| 27 | backupPagesSnapshot 快照含 required 字段 | ✅ PASS |
| 28 | DevHome.state 包含 core 字段 | ✅ PASS |
| 29 | state.totalPages 初始为 1 | ✅ PASS |
| 30 | state.currentPage 初始为 0 | ✅ PASS |
| 31 | state 包含拖拽状态字段 | ✅ PASS |
| 32 | state 包含番茄钟状态 | ✅ PASS |
| 33 | DevHome.$ 和 DevHome.$$ 是函数 | ✅ PASS |
| 34 | DevHome.dom 包含主要 DOM 引用键 | ✅ PASS |
| 35 | escapeHtml 转义 < > & " ' | ✅ PASS |
| 36 | escapeHtml 空字符串安全 | ✅ PASS |
| 37 | escapeHtml 普通文本不变 | ✅ PASS |
| 38 | escapeHtml 包含 Unicode 表情符号 | ✅ PASS |
| 39 | sanitizeHtml 移除 script 标签 | ❌ FAIL |
| 40 | sanitizeHtml 移除 onerror 事件属性 | ❌ FAIL |
| 41 | sanitizeHtml 移除 javascript: 协议 | ❌ FAIL |
| 42 | sanitizeHtml 处理 null/undefined | ✅ PASS |
| 43 | getTileIdentity 拼接 label|url | ✅ PASS |
| 44 | getTileIdentity 处理 null/undefined tile | ✅ PASS |
| 45 | normalizeShortcutSize 有效值原样返回 | ✅ PASS |
| 46 | normalizeShortcutSize 无效值回退 standard | ✅ PASS |
| 47 | normalizeShortcutColumns 有效值原样返回 | ✅ PASS |
| 48 | normalizeShortcutColumns 无效值回退 6 | ✅ PASS |
| 49 | createDefaultTile 生成正确的 tile 结构 | ✅ PASS |
| 50 | getPageTileSignature 排序后拼接磁贴身份 | ✅ PASS |
| 51 | getPageTileSignature 处理空 page | ✅ PASS |
| 52 | renderEngineIcon 返回 badge 或 svg | ✅ PASS |
| 53 | normalizePageState 修复不匹配的分类名 | ✅ PASS |
| 54 | normalizePageState 不需要修复时不 changed | ✅ PASS |
| 55 | repairDefaultCategoryContent 无错位时不 changed | ✅ PASS |
| 56 | addPage 新增后计数+1，名称自动生成 | ✅ PASS |
| 57 | removePage 不删除最后一个分类 | ✅ PASS |
| 58 | removePage 多个分类时可删除 | ✅ PASS |
| 59 | removePageWithStrategy moveToCommon 迁移磁贴 | ✅ PASS |
| 60 | removePageWithStrategy 无效 pageIndex 不变 | ✅ PASS |
| 61 | reorderPage 交换后 currentPage 跟随移动 | ✅ PASS |
| 62 | reorderPage 相同位置不变 | ✅ PASS |
| 63 | renamePage 修改 state.pageNames 中名称 | ✅ PASS |
| 64 | renamePage 越界索引不报错 | ✅ PASS |
| 65 | add 添加磁贴生成新 ID | ✅ PASS |
| 66 | remove 删除现有磁贴返回 true | ✅ PASS |
| 67 | remove 删除不存在的磁贴返回 false | ✅ PASS |
| 68 | update 部分更新保留未修改字段 | ✅ PASS |
| 69 | update 不存在磁贴返回 false | ✅ PASS |
| 70 | reorder 交换位置 | ✅ PASS |
| 71 | reorder 相同位置无操作 | ✅ PASS |
| 72 | sortByPosition 按 position 升序排列 | ✅ PASS |
| 73 | changePage 有效索引返回 true | ✅ PASS |
| 74 | changePage 无效索引返回 false | ✅ PASS |
| 75 | moveTileToPage 移动磁贴到目标分类 | ✅ PASS |
| 76 | copyTileToPage 复制磁贴到目标分类 | ✅ PASS |
| 77 | addSearchHistory 去重后移到最前 | ✅ PASS |
| 78 | addSearchHistory 限制最多 20 条 | ✅ PASS |
| 79 | addSearchHistory 空字符串不添加 | ✅ PASS |
| 80 | clearSearchHistory 清空历史 | ✅ PASS |
| 81 | buildSuggestions 空输入返回最近历史 (前10) | ✅ PASS |
| 82 | buildSuggestions 关键词匹配过滤历史 | ✅ PASS |
| 83 | buildSuggestions 匹配磁贴 label | ✅ PASS |
| 84 | loadSearchHistory 从 storage 加载历史 | ✅ PASS |
| 85 | getWorkbenchState 无存储时返回默认值 | ✅ PASS |
| 86 | saveWorkbenchState 持久化后能读取 | ❌ FAIL |
| 87 | getWorkbenchState 合并部分数据后的默认值 | ❌ FAIL |
| 88 | logger 暴露所有必需方法 | ✅ PASS |
| 89 | LEVELS 包含四级日志 | ✅ PASS |
| 90 | info 日志可写入并计数的 | ✅ PASS |
| 91 | warn 日志正确写入 | ✅ PASS |
| 92 | error 日志正确写入 | ✅ PASS |
| 93 | debug 日志正确写入 | ✅ PASS |
| 94 | query 按标签过滤 | ✅ PASS |
| 95 | query limit 限制返回条数 | ✅ PASS |
| 96 | count 返回日志总数 | ✅ PASS |
| 97 | exportLogs 返回有效 JSON 字符串 | ✅ PASS |
| 98 | getTags 返回活跃标签列表 | ✅ PASS |
| 99 | clear 清空所有日志 | ✅ PASS |
| 100 | 环形缓冲区限 500 条 | ✅ PASS |
| 101 | DevHome.engines 已导出 | ✅ PASS |
| 102 | DevHome.storage 已导出 | ✅ PASS |
| 103 | DevHome.devhomeStorage 已导出 | ✅ PASS |
| 104 | DevHome.state 已导出 | ✅ PASS |
| 105 | DevHome.dom 已导出 | ✅ PASS |
| 106 | DevHome.$ 已导出 | ✅ PASS |
| 107 | DevHome.$$ 已导出 | ✅ PASS |
| 108 | DevHome.escapeHtml 已导出 | ✅ PASS |
| 109 | DevHome.sanitizeHtml 已导出 | ✅ PASS |
| 110 | DevHome.getDefaultPagesData 已导出 | ✅ PASS |
| 111 | DevHome.openFaviconDB 已导出 | ✅ PASS |
| 112 | DevHome.loadFavicon 已导出 | ✅ PASS |
| 113 | DevHome.bgManager 已导出 | ✅ PASS |
| 114 | DevHome.pageManager 已导出 | ✅ PASS |
| 115 | DevHome.tileManager 已导出 | ✅ PASS |
| 116 | DevHome.renderTiles 已导出 | ✅ PASS |
| 117 | DevHome.openSettingsPanel 已导出 | ✅ PASS |
| 118 | DevHome.openUploadModal 已导出 | ✅ PASS |
| 119 | DevHome.loadSearchHistory 已导出 | ✅ PASS |
| 120 | DevHome.doSearch 已导出 | ✅ PASS |
| 121 | DevHome.buildSuggestions 已导出 | ✅ PASS |
| 122 | DevHome.getWorkbenchState 已导出 | ✅ PASS |
| 123 | DevHome.bindEvents 已导出 | ✅ PASS |
| 124 | DevHome.boot 已导出 | ✅ PASS |
| 125 | DevHome.logger 已导出 | ✅ PASS |
| 126 | DevHome.showConfirm 已导出 | ✅ PASS |
| 127 | DevHome.showToast 已导出 | ✅ PASS |
| 128 | DevHome.showActionToast 已导出 | ✅ PASS |
| 129 | DevHome.showPrompt 已导出 | ✅ PASS |
| 130 | DevHome.INLINE_DEFAULT_CATEGORY_NAMES 已导出 | ✅ PASS |
| 131 | DevHome.SHORTCUT_SIZE_OPTIONS 已导出 | ✅ PASS |
| 132 | DevHome.createDefaultTile 已导出 | ✅ PASS |
| 133 | DevHome.getTileIdentity 已导出 | ✅ PASS |
| 134 | DevHome.getPageTileSignature 已导出 | ✅ PASS |
| 135 | DevHome.normalizePageState 已导出 | ✅ PASS |
| 136 | DevHome.repairDefaultCategoryContent 已导出 | ✅ PASS |
| 137 | DevHome.normalizeShortcutSize 已导出 | ✅ PASS |
| 138 | DevHome.normalizeShortcutColumns 已导出 | ✅ PASS |

## 失败详情

### 1. sanitizeHtml 移除 script 标签
```
assertion failed
```

### 2. sanitizeHtml 移除 onerror 事件属性
```
assertion failed
```

### 3. sanitizeHtml 移除 javascript: 协议
```
assertion failed
```

### 4. saveWorkbenchState 持久化后能读取
```
Cannot read properties of undefined (reading 'set')
```

### 5. getWorkbenchState 合并部分数据后的默认值
```

```

## 结论

⚠️ 存在 5 个失败测试，通过率 96%
