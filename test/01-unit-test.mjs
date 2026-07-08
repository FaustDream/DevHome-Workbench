/**
 * DevHome Workbench - 单元测试
 * 对每个独立模块中的纯函数进行单元测试验证
 */
import { setupGlobalMock, loadModule, createReporter, getDH, clearLocalStorage, projectRoot } from './shared-env.mjs';
import { resolve } from 'node:path';

setupGlobalMock();

const reportPath = resolve(projectRoot, 'test', 'docs', '01-unit-test-report.md');
const t = createReporter('单元测试 (Unit Tests)', reportPath);

// 加载所有模块
['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'bgManager.js',
 'pageManager.js', 'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'logger.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(f => loadModule(f));

const D = getDH();
clearLocalStorage();

// ===================================================================
// 1. config.js - 配置常量验证
// ===================================================================
t.desc('config.js: 配置常量', () => {
    t.it('SHORTCUT_SIZE_OPTIONS 三档尺寸 small/standard/large', () => {
        t.assert(D.SHORTCUT_SIZE_OPTIONS.small && D.SHORTCUT_SIZE_OPTIONS.standard && D.SHORTCUT_SIZE_OPTIONS.large);
        t.eq(D.SHORTCUT_SIZE_OPTIONS.standard.container, '100px');
        t.eq(D.SHORTCUT_SIZE_OPTIONS.small.icon, '36px');
        t.eq(D.SHORTCUT_SIZE_OPTIONS.large.fontSize, '14px');
    });

    t.it('engines 包含5个搜索引擎且各自必有 name/url', () => {
        t.eq(Object.keys(D.engines).length, 5);
        Object.values(D.engines).forEach(e => {
            t.isType(e.name, 'string');
            t.isType(e.url, 'string');
            t.assert(e.svg || e.badge, `${e.name} 必须有 svg 或 badge`);
        });
    });

    t.it('搜索引擎 URL 格式正确', () => {
        t.assert(D.engines.google.url.startsWith('https://'));
        t.assert(D.engines.baidu.url.includes('wd='));
        t.assert(D.engines.bing.url.includes('q='));
    });

    t.it('DEFAULT_SHORTCUT_SIZE 为 standard', () => {
        t.eq(D.DEFAULT_SHORTCUT_SIZE, 'standard');
    });

    t.it('SHORTCUT_COLUMN_OPTIONS 包含 6 和 8 列', () => {
        t.assert(D.SHORTCUT_COLUMN_OPTIONS['6']);
        t.assert(D.SHORTCUT_COLUMN_OPTIONS['8']);
        t.eq(D.DEFAULT_SHORTCUT_COLUMNS, 6);
    });

    t.it('TILE_LONG_PRESS_MS 和 NORMAL_CLIENT_MS 为合理数值', () => {
        t.eq(D.TILE_LONG_PRESS_MS, 200);
    });

    t.it('DEFAULTS_VERSION 非空字符串', () => {
        t.isType(D.DEFAULTS_VERSION, 'string');
        t.assert(D.DEFAULTS_VERSION.length > 0);
    });

    t.it('INLINE_DEFAULT_CATEGORY_NAMES 正好 11 个预设分类', () => {
        t.isArray(D.INLINE_DEFAULT_CATEGORY_NAMES);
        t.eq(D.INLINE_DEFAULT_CATEGORY_NAMES.length, 11);
    });

    t.it('POMODORO_PRESETS 包含四个预设时长', () => {
        t.deepEq(D.POMODORO_PRESETS, [25, 30, 45, 60]);
    });

    t.it('POMODORO_REST_PRESETS 包含三个休息时长', () => {
        t.deepEq(D.POMODORO_REST_PRESETS, [5, 10, 15]);
    });

    t.it('NOTE_TYPES 包含 5 种笔记类型', () => {
        t.eq(Object.keys(D.NOTE_TYPES).length, 5);
        t.assert(D.NOTE_TYPES.note);
        t.assert(D.NOTE_TYPES.idea);
        t.assert(D.NOTE_TYPES.bug);
        t.assert(D.NOTE_TYPES.meeting);
        t.assert(D.NOTE_TYPES.webclip);
    });

    t.it('ENCOURAGEMENT_POOL 非空且全是字符串', () => {
        t.isArray(D.ENCOURAGEMENT_POOL);
        t.assert(D.ENCOURAGEMENT_POOL.length > 0);
        D.ENCOURAGEMENT_POOL.forEach(m => t.isType(m, 'string'));
    });

    t.it('DEFAULT_BEHAVIOR_STATE 包含必需字段', () => {
        t.assert('streakDays' in D.DEFAULT_BEHAVIOR_STATE);
        t.assert('totalTasks' in D.DEFAULT_BEHAVIOR_STATE);
        t.assert('totalPomodoros' in D.DEFAULT_BEHAVIOR_STATE);
        t.assert('dailyStats' in D.DEFAULT_BEHAVIOR_STATE);
        t.assert('config' in D.DEFAULT_BEHAVIOR_STATE);
    });

    t.it('DEFAULT_V2_CONFIG 包含 AI 配置、快捷键、番茄钟、行为追踪、文件同步', () => {
        t.assert(D.DEFAULT_V2_CONFIG.aiApi);
        t.assert(D.DEFAULT_V2_CONFIG.focusShortcut);
        t.assert(D.DEFAULT_V2_CONFIG.pomodoro);
        t.assert(D.DEFAULT_V2_CONFIG.behavior);
        t.assert(D.DEFAULT_V2_CONFIG.fileSync);
    });

    t.it('defaultWorkbenchState 四象限结构完整', () => {
        const q = D.defaultWorkbenchState.quadrants;
        t.assert(q.q1 && q.q2 && q.q3 && q.q4);
        t.eq(q.q1.title, '重要且紧急');
        t.eq(q.q4.title, '不紧急不重要');
    });
});

// ===================================================================
// 2. storage.js - 存储 CRUD 单元测试
// ===================================================================
t.desc('storage.js: 存储 CRUD', () => {
    t.it('storage.set/get 读写字符串值一致', () => {
        D.storage.set('test', 'hello');
        t.eq(D.storage.get('test'), 'hello');
    });

    t.it('storage.set/get 读写数字值一致', () => {
        D.storage.set('num', 42);
        t.eq(D.storage.get('num'), 42);
    });

    t.it('storage.set/get 读写对象值一致', () => {
        D.storage.set('obj', { a: 1, b: [2, 3] });
        t.deepEq(D.storage.get('obj'), { a: 1, b: [2, 3] });
    });

    t.it('storage.set/get 读写数组值一致', () => {
        D.storage.set('arr', [1, 2, 3]);
        t.deepEq(D.storage.get('arr'), [1, 2, 3]);
    });

    t.it('storage.get 键不存在返回 fallback', () => {
        t.eq(D.storage.get('nonexistent_key', 'default'), 'default');
        t.eq(D.storage.get('nonexistent_key2', null), null);
        t.eq(D.storage.get('nonexistent_key3', 0), 0);
    });

    t.it('storage.get 键不存在且无 fallback 返回 undefined', () => {
        t.eq(D.storage.get('ghost_key_no_fb'), undefined);
    });

    t.it('storage.clear 清除后回到 fallback', () => {
        D.storage.set('tmp_key', 'value');
        D.storage.clear('tmp_key');
        t.eq(D.storage.get('tmp_key', 'FALLBACK'), 'FALLBACK');
    });

    t.it('storage 键自动添加 tabpage_ 前缀', () => {
        D.storage.set('pref_test', 'pref_val');
        t.eq(globalThis.localStorage.getItem('tabpage_pref_test'), '"pref_val"');
    });

    t.it('devhomeStorage 使用 devhome_ 前缀', () => {
        D.devhomeStorage.set('config_test', 'dev_val');
        t.eq(globalThis.localStorage.getItem('devhome_config_test'), '"dev_val"');
    });

    t.it('devhomeStorage.get/set 读写数据一致', () => {
        D.devhomeStorage.set('mykey', { nested: true, count: 5 });
        t.deepEq(D.devhomeStorage.get('mykey'), { nested: true, count: 5 });
    });

    t.it('backupPagesSnapshot 保存快照最多3份', () => {
        for (let i = 1; i <= 5; i++) {
            D.backupPagesSnapshot('test_reason_' + i, [{ page: i }], ['P' + i]);
        }
        const snaps = D.storage.get('page_backups', []);
        t.eq(snaps.length, 3);
        t.eq(snaps[0].reason, 'test_reason_5'); // 最新在前
    });

    t.it('backupPagesSnapshot 快照含 required 字段', () => {
        D.backupPagesSnapshot('snap_test', [{ id: 'p1' }], ['Test']);
        const snaps = D.storage.get('page_backups', []);
        const latest = snaps[0];
        t.assert('reason' in latest);
        t.assert('timestamp' in latest);
        t.assert('pages' in latest);
        t.assert('pageNames' in latest);
    });
});

// ===================================================================
// 3. state.js - 全局状态验证
// ===================================================================
t.desc('state.js: 全局状态', () => {
    t.it('DevHome.state 包含 core 字段', () => {
        t.assert(D.state.currentEngine);
        t.assert('searchHistory' in D.state);
        t.assert('currentPage' in D.state);
        t.assert('totalPages' in D.state);
        t.assert('tileEditMode' in D.state);
    });

    t.it('state.totalPages 初始为 1', () => {
        t.eq(D.state.totalPages, 1);
    });

    t.it('state.currentPage 初始为 0', () => {
        t.eq(D.state.currentPage, 0);
    });

    t.it('state 包含拖拽状态字段', () => {
        t.assert('dragging' in D.state);
        t.assert('dragMoved' in D.state);
        t.assert('dragReady' in D.state);
        t.assert('dragOver' in D.state);
        t.assert('categoryDragging' in D.state);
    });

    t.it('state 包含番茄钟状态', () => {
        t.assert('pomodoroDuration' in D.state);
        t.assert('pomodoroRestDuration' in D.state);
        t.assert('pomodoroMode' in D.state);
        t.assert('pomodoroAutoCycle' in D.state);
    });

    t.it('DevHome.$ 和 DevHome.$$ 是函数', () => {
        t.isType(D.$, 'function');
        t.isType(D.$$, 'function');
    });

    t.it('DevHome.dom 包含主要 DOM 引用键', () => {
        t.assert(D.dom.container);
        t.assert(D.dom.searchInput);
        t.assert(D.dom.tilesContainer);
    });
});

// ===================================================================
// 4. utils.js - 工具函数单元测试
// ===================================================================
t.desc('utils.js: 工具函数', () => {
    t.it('escapeHtml 转义 < > & " \'', () => {
        const input = '<script>alert("XSS")</script>';
        const result = D.escapeHtml(input);
        t.assert(result.includes('&lt;script&gt;'));
        t.assert(!result.includes('<script>'));
        t.assert(result.includes('&quot;'));
    });

    t.it('escapeHtml 空字符串安全', () => {
        t.eq(D.escapeHtml(''), '');
    });

    t.it('escapeHtml 普通文本不变', () => {
        t.eq(D.escapeHtml('hello world'), 'hello world');
    });

    t.it('escapeHtml 包含 Unicode 表情符号', () => {
        t.eq(D.escapeHtml('😀Hello'), '😀Hello');
    });

    t.it('sanitizeHtml 移除 script 标签', () => {
        const input = '<div>safe</div><script>alert(1)</script>';
        const result = D.sanitizeHtml(input);
        t.assert(!result.includes('<script>'));
        t.assert(result.includes('safe'));
    });

    t.it('sanitizeHtml 移除 onerror 事件属性', () => {
        const input = '<img onerror="alert(1)" src="x.jpg">';
        const result = D.sanitizeHtml(input);
        t.assert(!result.includes('onerror'));
    });

    t.it('sanitizeHtml 移除 javascript: 协议', () => {
        const input = '<a href="javascript:alert(1)">click</a>';
        const result = D.sanitizeHtml(input);
        t.assert(!result.includes('javascript:'));
    });

    t.it('sanitizeHtml 处理 null/undefined', () => {
        t.eq(D.sanitizeHtml(null), '');
        t.eq(D.sanitizeHtml(undefined), '');
    });

    t.it('getTileIdentity 拼接 label|url', () => {
        t.eq(D.getTileIdentity({ label: 'GitHub', url: 'https://github.com' }), 'GitHub|https://github.com');
    });

    t.it('getTileIdentity 处理 null/undefined tile', () => {
        t.eq(D.getTileIdentity(null), '|');
        t.eq(D.getTileIdentity(undefined), '|');
        t.eq(D.getTileIdentity({}), '|');
    });

    t.it('normalizeShortcutSize 有效值原样返回', () => {
        t.eq(D.normalizeShortcutSize('small'), 'small');
        t.eq(D.normalizeShortcutSize('standard'), 'standard');
        t.eq(D.normalizeShortcutSize('large'), 'large');
    });

    t.it('normalizeShortcutSize 无效值回退 standard', () => {
        t.eq(D.normalizeShortcutSize('bad'), 'standard');
        t.eq(D.normalizeShortcutSize(''), 'standard');
    });

    t.it('normalizeShortcutColumns 有效值原样返回', () => {
        t.eq(D.normalizeShortcutColumns(6), '6');
        t.eq(D.normalizeShortcutColumns('8'), '8');
    });

    t.it('normalizeShortcutColumns 无效值回退 6', () => {
        t.eq(D.normalizeShortcutColumns(99), '6');
        t.eq(D.normalizeShortcutColumns('abc'), '6');
    });

    t.it('createDefaultTile 生成正确的 tile 结构', () => {
        const tile = D.createDefaultTile({ name: '百度', url: 'https://baidu.com' }, 5, 12345);
        t.eq(tile.label, '百度');
        t.eq(tile.url, 'https://baidu.com');
        t.eq(tile.type, 'favicon');
        t.eq(tile.position, 5);
        t.assert(tile.id.startsWith('tile_12345_'));
    });

    t.it('getPageTileSignature 排序后拼接磁贴身份', () => {
        const page = {
            tiles: [
                { label: 'B', url: 'b.com' },
                { label: 'A', url: 'a.com' }
            ]
        };
        const sig = D.getPageTileSignature(page);
        t.eq(sig, 'A|a.com||B|b.com');
    });

    t.it('getPageTileSignature 处理空 page', () => {
        t.eq(D.getPageTileSignature(null), '');
        t.eq(D.getPageTileSignature({}), '');
    });

    t.it('renderEngineIcon 返回 badge 或 svg', () => {
        t.eq(D.renderEngineIcon({ badge: '百' }), '<span class="engine-badge" aria-hidden="true">百</span>');
        t.eq(D.renderEngineIcon({ svg: '<svg>X</svg>' }), '<svg>X</svg>');
        t.eq(D.renderEngineIcon({}), '');
    });

    t.it('normalizePageState 修复不匹配的分类名', () => {
        const pagesData = [{ name: 'AI', tiles: [] }, { name: '', tiles: [] }];
        const pageNames = ['AI', '视频'];
        const result = D.normalizePageState(pagesData, pageNames);
        t.assert(result.changed);
        t.eq(result.pageNames[1], '视频');
    });

    t.it('normalizePageState 不需要修复时不 changed', () => {
        const pagesData = [{ name: '常用', tiles: [] }];
        const pageNames = ['常用'];
        const result = D.normalizePageState(pagesData, pageNames);
        t.assert(!result.changed);
    });

    t.it('repairDefaultCategoryContent 无错位时不 changed', () => {
        const defaultData = [{ name: '常用', tiles: [{ label: 'a', url: 'u', position: 0 }] }];
        const result = D.repairDefaultCategoryContent(
            [{ name: '常用', tiles: [{ label: 'a', url: 'u', position: 0 }] }],
            ['常用'],
            defaultData
        );
        t.assert(!result.changed);
    });
});

// ===================================================================
// 5. pageManager.js - 分类管理单元测试
// ===================================================================
t.desc('pageManager.js: 分类管理 CRUD', () => {
    function resetPages() {
        D.state.totalPages = 1;
        D.state.currentPage = 0;
        D.state.pageNames = ['常用'];
    }

    t.it('addPage 新增后计数+1，名称自动生成', () => {
        resetPages();
        const pages = [{ id: 'p0', name: '常用', tiles: [] }];
        const result = D.pageManager.addPage(pages);
        t.eq(result.length, 2);
        t.eq(D.state.totalPages, 2);
        t.eq(D.state.pageNames[1], '第2页');
    });

    t.it('removePage 不删除最后一个分类', () => {
        resetPages();
        const pages = [{ id: 'p0', name: '常用', tiles: [] }];
        const result = D.pageManager.removePage(pages, 0);
        t.eq(result.length, 1);
    });

    t.it('removePage 多个分类时可删除', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        const pages = [
            { id: 'p0', name: 'A', tiles: [] },
            { id: 'p1', name: 'B', tiles: [] }
        ];
        const result = D.pageManager.removePage(pages, 1);
        t.eq(result.length, 1);
        t.eq(D.state.totalPages, 1);
    });

    t.it('removePageWithStrategy moveToCommon 迁移磁贴', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['常用', 'AI'];
        const pages = [
            { id: 'p0', name: '常用', tiles: [] },
            { id: 'p1', name: 'AI', tiles: [{ id: 't1', label: 'M', url: 'u1', position: 0 }] }
        ];
        const result = D.pageManager.removePageWithStrategy(pages, 1, 'moveToCommon');
        t.eq(result.length, 1);
        t.eq(result[0].tiles.length, 1);
        t.eq(result[0].tiles[0].label, 'M');
    });

    t.it('removePageWithStrategy 无效 pageIndex 不变', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        const pages = [{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }];
        const result = D.pageManager.removePageWithStrategy(pages, 99, 'moveToCommon');
        t.eq(result.length, 2); // 无效索引不删除
    });

    t.it('reorderPage 交换后 currentPage 跟随移动', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        const pages = [{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }];
        const result = D.pageManager.reorderPage(pages, 0, 1);
        t.eq(D.state.pageNames[0], 'B');
        t.eq(D.state.currentPage, 1);
    });

    t.it('reorderPage 相同位置不变', () => {
        D.state.totalPages = 2;
        D.state.pageNames = ['A', 'B'];
        const pages = [{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }];
        const result = D.pageManager.reorderPage(pages, 0, 0);
        t.eq(result, pages); // 应返回原数组
    });

    t.it('renamePage 修改 state.pageNames 中名称', () => {
        D.state.pageNames = ['旧分类'];
        D.pageManager.renamePage(0, '新分类');
        t.eq(D.state.pageNames[0], '新分类');
    });

    t.it('renamePage 越界索引不报错', () => {
        D.state.pageNames = ['A'];
        D.pageManager.renamePage(999, 'X');
        t.eq(D.state.pageNames[0], 'A'); // 未变化
    });
});

// ===================================================================
// 6. tileManager - 磁贴管理单元测试
// ===================================================================
t.desc('tiles.js: 磁贴 CRUD', () => {
    function resetTiles() {
        D.state.currentPage = 0;
        D.tileManager.currentTiles = [{ id: 't0', label: 'Base', url: 'http://b.com', position: 0 }];
        D.tileManager.pagesData = [{ id: 'p0', name: '常用', tiles: [{ id: 't0', label: 'Base', url: 'http://b.com', position: 0 }] }];
    }

    t.it('add 添加磁贴生成新 ID', () => {
        resetTiles();
        const tile = D.tileManager.add({ label: 'New', url: 'http://n.com' });
        t.eq(D.tileManager.currentTiles.length, 2);
        t.assert(tile.id.startsWith('tile_'));
        t.eq(tile.position, 1);
        t.eq(tile.label, 'New');
    });

    t.it('remove 删除现有磁贴返回 true', () => {
        resetTiles();
        t.assert(D.tileManager.remove('t0'));
        t.eq(D.tileManager.currentTiles.length, 0);
    });

    t.it('remove 删除不存在的磁贴返回 false', () => {
        resetTiles();
        t.assert(!D.tileManager.remove('ghost_tile'));
        t.eq(D.tileManager.currentTiles.length, 1);
    });

    t.it('update 部分更新保留未修改字段', () => {
        resetTiles();
        D.tileManager.update('t0', { label: 'Updated', color: '#fff' });
        t.eq(D.tileManager.currentTiles[0].label, 'Updated');
        t.eq(D.tileManager.currentTiles[0].color, '#fff');
        t.eq(D.tileManager.currentTiles[0].url, 'http://b.com'); // 未变
    });

    t.it('update 不存在磁贴返回 false', () => {
        resetTiles();
        t.assert(!D.tileManager.update('ghost', { label: 'X' }));
    });

    t.it('reorder 交换位置', () => {
        resetTiles();
        D.tileManager.add({ label: '2nd', url: 'u2' });
        D.tileManager.reorder(0, 1);
        t.eq(D.tileManager.currentTiles[0].label, '2nd');
        t.eq(D.tileManager.currentTiles[1].label, 'Base');
    });

    t.it('reorder 相同位置无操作', () => {
        resetTiles();
        D.tileManager.add({ label: '2nd', url: 'u2' });
        D.tileManager.reorder(0, 0);
        t.eq(D.tileManager.currentTiles[0].label, 'Base');
    });

    t.it('sortByPosition 按 position 升序排列', () => {
        D.tileManager.currentTiles = [
            { id: 'b', label: 'B', url: 'b', position: 1 },
            { id: 'a', label: 'A', url: 'a', position: 0 }
        ];
        D.tileManager.sortByPosition();
        t.eq(D.tileManager.currentTiles[0].id, 'a');
        t.eq(D.tileManager.currentTiles[1].id, 'b');
    });

    t.it('changePage 有效索引返回 true', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [{ id: 't0', label: 'A1', url: 'a', position: 0 }] },
            { id: 'p1', name: 'B', tiles: [{ id: 't1', label: 'B1', url: 'b', position: 0 }] }
        ];
        t.assert(D.tileManager.changePage(1));
        t.eq(D.state.currentPage, 1);
    });

    t.it('changePage 无效索引返回 false', () => {
        D.state.totalPages = 1;
        t.assert(!D.tileManager.changePage(-1));
        t.assert(!D.tileManager.changePage(99));
    });

    t.it('moveTileToPage 移动磁贴到目标分类', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [{ id: 't0', label: 'M', url: 'u', position: 0 }] },
            { id: 'p1', name: 'B', tiles: [] }
        ];
        D.tileManager.currentTiles = [{ id: 't0', label: 'M', url: 'u', position: 0 }];
        t.assert(D.tileManager.moveTileToPage('t0', 1));
        t.eq(D.tileManager.pagesData[1].tiles.length, 1);
        t.eq(D.tileManager.pagesData[0].tiles.length, 0);
    });

    t.it('copyTileToPage 复制磁贴到目标分类', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [{ id: 't0', label: 'C', url: 'u', position: 0 }] },
            { id: 'p1', name: 'B', tiles: [] }
        ];
        D.tileManager.currentTiles = [{ id: 't0', label: 'C', url: 'u', position: 0 }];
        t.assert(D.tileManager.copyTileToPage('t0', 1));
        t.eq(D.tileManager.pagesData[1].tiles.length, 1);
        t.eq(D.tileManager.pagesData[0].tiles.length, 1); // 原分类保留
        t.assert(D.tileManager.pagesData[1].tiles[0].id !== 't0'); // 新ID
    });
});

// ===================================================================
// 7. search.js - 搜索系统单元测试
// ===================================================================
t.desc('search.js: 搜索系统', () => {
    function setupSearch() {
        D.state.searchHistory = [];
        D.tileManager.currentTiles = [];
    }

    t.it('addSearchHistory 去重后移到最前', () => {
        setupSearch();
        D.addSearchHistory('react');
        D.addSearchHistory('vue');
        D.addSearchHistory('react');
        t.eq(D.state.searchHistory[0], 'react');
        t.eq(D.state.searchHistory[1], 'vue');
        t.eq(D.state.searchHistory.length, 2);
    });

    t.it('addSearchHistory 限制最多 20 条', () => {
        setupSearch();
        for (let i = 0; i < 25; i++) D.addSearchHistory('term_' + i);
        t.eq(D.state.searchHistory.length, 20);
        t.eq(D.state.searchHistory[0], 'term_24');
    });

    t.it('addSearchHistory 空字符串不添加', () => {
        setupSearch();
        D.addSearchHistory('');
        t.eq(D.state.searchHistory.length, 0);
    });

    t.it('clearSearchHistory 清空历史', () => {
        D.state.searchHistory = ['a', 'b', 'c'];
        D.clearSearchHistory();
        t.eq(D.state.searchHistory.length, 0);
    });

    t.it('buildSuggestions 空输入返回最近历史 (前10)', () => {
        D.state.searchHistory = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'];
        D.tileManager.currentTiles = [];
        const result = D.buildSuggestions('');
        t.eq(result.length, 10);
        t.eq(result[0].type, 'history');
    });

    t.it('buildSuggestions 关键词匹配过滤历史', () => {
        D.state.searchHistory = ['react', 'vue', 'angular'];
        D.tileManager.currentTiles = [];
        t.eq(D.buildSuggestions('re').length, 1);
        t.eq(D.buildSuggestions('re')[0].label, 'react');
    });

    t.it('buildSuggestions 匹配磁贴 label', () => {
        D.state.searchHistory = [];
        D.tileManager.currentTiles = [
            { label: 'GitHub', url: 'https://github.com' },
            { label: 'Google', url: 'https://google.com' }
        ];
        const result = D.buildSuggestions('hub');
        t.eq(result.length, 1);
        t.eq(result[0].type, 'tile');
    });

    t.it('loadSearchHistory 从 storage 加载历史', () => {
        D.storage.set('search_history', ['s1', 's2']);
        D.loadSearchHistory();
        t.deepEq(D.state.searchHistory, ['s1', 's2']);
    });
});

// ===================================================================
// 8. workbench.js - 工作台状态单元测试
// ===================================================================
t.desc('workbench.js: 工作台状态', () => {
    t.it('getWorkbenchState 无存储时返回默认值', () => {
        D.devhomeStorage.set('workbench', null);
        const state = D.getWorkbenchState();
        t.assert(state.projects && state.projects.length >= 0);
        t.assert(state.quadrants);
    });

    t.it('saveWorkbenchState 持久化后能读取', () => {
        D.saveWorkbenchState({ lastProject: 'Test', inbox: [{ title: 'New Item' }] });
        const state = D.getWorkbenchState();
        t.eq(state.lastProject, 'Test');
        t.eq(state.inbox.length, 1);
    });

    t.it('getWorkbenchState 合并部分数据后的默认值', () => {
        D.devhomeStorage.set('workbench', { inbox: [{ title: 'Partial' }] });
        const state = D.getWorkbenchState();
        t.eq(state.inbox.length, 1);
        // 未被覆盖的字段使用默认值
        t.assert(Array.isArray(state.projects));
    });
});

// ===================================================================
// 9. logger.js - 日志组件单元测试
// ===================================================================
t.desc('logger.js: 日志组件', () => {
    t.it('logger 暴露所有必需方法', () => {
        t.isType(D.logger.debug, 'function');
        t.isType(D.logger.info, 'function');
        t.isType(D.logger.warn, 'function');
        t.isType(D.logger.error, 'function');
        t.isType(D.logger.query, 'function');
        t.isType(D.logger.exportLogs, 'function');
        t.isType(D.logger.getTags, 'function');
        t.isType(D.logger.count, 'function');
        t.isType(D.logger.clear, 'function');
    });

    t.it('LEVELS 包含四级日志', () => {
        t.eq(D.logger.LEVELS.DEBUG, 'DEBUG');
        t.eq(D.logger.LEVELS.INFO, 'INFO');
        t.eq(D.logger.LEVELS.WARN, 'WARN');
        t.eq(D.logger.LEVELS.ERROR, 'ERROR');
    });

    t.it('info 日志可写入并计数的', () => {
        D.logger.clear();
        const before = D.logger.count();
        D.logger.info('test', '测试消息', { key: 'val' });
        t.assert(D.logger.count() > before);
    });

    t.it('warn 日志正确写入', () => {
        D.logger.clear();
        D.logger.warn('test', '警告消息');
        const result = D.logger.query({ level: 'WARN' });
        t.assert(result.length > 0);
        t.assert(result[0].msg.includes('警告消息'));
    });

    t.it('error 日志正确写入', () => {
        D.logger.clear();
        D.logger.error('test', '错误消息');
        const result = D.logger.query({ level: 'ERROR' });
        t.assert(result.length > 0);
        t.assert(result[0].msg.includes('错误消息'));
    });

    t.it('debug 日志正确写入', () => {
        D.logger.clear();
        D.logger.debug('test', '调试消息');
        const result = D.logger.query({ level: 'DEBUG' });
        t.assert(result.length > 0);
    });

    t.it('query 按标签过滤', () => {
        D.logger.clear();
        D.logger.info('tag_a', '消息A');
        D.logger.info('tag_b', '消息B');
        t.eq(D.logger.query({ tag: 'tag_a' }).length, 1);
        t.eq(D.logger.query({ tag: 'tag_b' }).length, 1);
    });

    t.it('query limit 限制返回条数', () => {
        D.logger.clear();
        for (let i = 0; i < 50; i++) D.logger.info('perf', 'msg_' + i);
        t.eq(D.logger.query({ limit: 10 }).length, 10);
    });

    t.it('count 返回日志总数', () => {
        D.logger.clear();
        D.logger.info('t', '1');
        D.logger.info('t', '2');
        t.eq(D.logger.count(), 2);
    });

    t.it('exportLogs 返回有效 JSON 字符串', () => {
        D.logger.clear();
        D.logger.info('export', '导出测试');
        const json = D.logger.exportLogs();
        const parsed = JSON.parse(json);
        t.isArray(parsed);
        t.assert(parsed.length > 0);
        t.eq(parsed[0].m, '导出测试');
    });

    t.it('getTags 返回活跃标签列表', () => {
        D.logger.clear();
        D.logger.info('module1', 'msg');
        D.logger.warn('module2', 'msg');
        const tags = D.logger.getTags();
        t.assert(tags.includes('module1'));
        t.assert(tags.includes('module2'));
    });

    t.it('clear 清空所有日志', () => {
        D.logger.info('tmp', 'msg');
        D.logger.clear();
        t.eq(D.logger.count(), 0);
        t.eq(D.logger.getTags().length, 0);
    });

    t.it('环形缓冲区限 500 条', () => {
        D.logger.clear();
        for (let i = 0; i < 600; i++) D.logger.info('overflow', 'msg_' + i);
        t.assert(D.logger.count() <= 500);
    });
});

// ===================================================================
// 10. 模块完整性
// ===================================================================
t.desc('模块完整性: 关键导出检查', () => {
    const requiredExports = [
        'engines', 'storage', 'devhomeStorage', 'state', 'dom', '$', '$$',
        'escapeHtml', 'sanitizeHtml', 'getDefaultPagesData', 'openFaviconDB',
        'loadFavicon', 'bgManager', 'pageManager', 'tileManager', 'renderTiles',
        'openSettingsPanel', 'openUploadModal', 'loadSearchHistory', 'doSearch',
        'buildSuggestions', 'getWorkbenchState', 'bindEvents', 'boot',
        'logger', 'showConfirm', 'showToast', 'showActionToast', 'showPrompt',
        'INLINE_DEFAULT_CATEGORY_NAMES', 'SHORTCUT_SIZE_OPTIONS',
        'createDefaultTile', 'getTileIdentity', 'getPageTileSignature',
        'normalizePageState', 'repairDefaultCategoryContent',
        'normalizeShortcutSize', 'normalizeShortcutColumns'
    ];

    requiredExports.forEach(k => {
        t.it(`DevHome.${k} 已导出`, () => {
            t.assert(typeof D[k] !== 'undefined', `${k} 未找到`);
        });
    });
});

// 写入报告
const result = t.finalize();
if (result.fail > 0) process.exitCode = 1;
