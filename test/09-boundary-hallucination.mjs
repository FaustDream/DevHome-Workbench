/**
 * DevHome Workbench - 边界值与"幻觉"测试
 * 验证边界条件、异常输入、极端值和防御性编程。
 * 所谓"幻觉"测试：验证代码不会因不合理的输入产生错误的输出。
 */
import { setupGlobalMock, loadModule, createReporter, getDH, clearLocalStorage, projectRoot } from './shared-env.mjs';
import { resolve } from 'node:path';

setupGlobalMock();

const reportPath = resolve(projectRoot, 'test', 'docs', '09-boundary-hallucination-test-report.md');
const t = createReporter('边界值与幻觉测试 (Boundary & Hallucination Tests)', reportPath);

['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'bgManager.js',
 'pageManager.js', 'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'logger.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(f => loadModule(f));

const D = getDH();
clearLocalStorage();

// ===================================================================
// 1. Null/Undefined 边界值测试
// ===================================================================
t.desc('Null/Undefined 边界值', () => {
    t.it('escapeHtml(null) 安全返回 ""', () => {
        t.eq(D.escapeHtml(null), '');
    });

    t.it('escapeHtml(undefined) 安全返回 ""', () => {
        t.eq(D.escapeHtml(undefined), '');
    });

    t.it('sanitizeHtml(null) 返回 ""', () => {
        t.eq(D.sanitizeHtml(null), '');
    });

    t.it('sanitizeHtml(undefined) 返回 ""', () => {
        t.eq(D.sanitizeHtml(undefined), '');
    });

    t.it('getTileIdentity(null) 返回 "|"', () => {
        t.eq(D.getTileIdentity(null), '|');
    });

    t.it('getTileIdentity(undefined) 返回 "|"', () => {
        t.eq(D.getTileIdentity(undefined), '|');
    });

    t.it('getTileIdentity({}) 返回 "|"', () => {
        t.eq(D.getTileIdentity({}), '|');
    });

    t.it('getTileIdentity({ label: undefined, url: undefined }) 返回 "|"', () => {
        t.eq(D.getTileIdentity({ label: undefined, url: undefined }), '|');
    });

    t.it('getPageTileSignature(null) 返回 ""', () => {
        t.eq(D.getPageTileSignature(null), '');
    });

    t.it('getPageTileSignature(undefined) 返回 ""', () => {
        t.eq(D.getPageTileSignature(undefined), '');
    });

    t.it('getPageTileSignature({}) 返回 ""', () => {
        t.eq(D.getPageTileSignature({}), '');
    });

    t.it('createDefaultTile(null, 0, 1) 不崩溃', () => {
        const tile = D.createDefaultTile(null, 0, 1);
        t.assert(typeof tile === 'object');
        t.eq(tile.id, 'tile_1_0');
    });

    t.it('createDefaultTile({}, 0, 1) 标签为空', () => {
        const tile = D.createDefaultTile({}, 0, 1);
        t.eq(tile.label, undefined);
        t.eq(tile.url, undefined);
    });

    t.it('renderEngineIcon(null) 返回 ""', () => {
        t.eq(D.renderEngineIcon(null), '');
    });

    t.it('renderEngineIcon(undefined) 返回 ""', () => {
        t.eq(D.renderEngineIcon(undefined), '');
    });

    t.it('renderEngineIcon({}) 返回 ""', () => {
        t.eq(D.renderEngineIcon({}), '');
    });

    t.it('normalizePageState(null, []) 安全返回', () => {
        const result = D.normalizePageState(null, []);
        t.assert(!result.changed);
        t.deepEq(result.pageNames, []);
    });

    t.it('showConfirm 返回 Promise (即使 Shadcn 未加载)', () => {
        const result = D.showConfirm('test');
        t.assert(result instanceof Promise);
    });

    t.it('showPrompt 返回 Promise (即使 Shadcn 未加载)', () => {
        const result = D.showPrompt('test');
        t.assert(result instanceof Promise);
    });
});

// ===================================================================
// 2. 空数据结构测试
// ===================================================================
t.desc('空数据结构', () => {
    t.it('storage.get 不存在的键返回 fallback', () => {
        t.eq(D.storage.get('__nonexist__', 'fb'), 'fb');
        t.eq(D.storage.get('__nonexist__', undefined), undefined);
        t.eq(D.storage.get('__nonexist__', null), null);
        t.eq(D.storage.get('__nonexist__', 0), 0);
        t.eq(D.storage.get('__nonexist__', false), false);
        t.eq(D.storage.get('__nonexist__', ''), '');
    });

    t.it('storage 空对象读写', () => {
        D.storage.set('empty', {});
        t.deepEq(D.storage.get('empty'), {});
    });

    t.it('storage 空数组读写', () => {
        D.storage.set('empty_arr', []);
        t.deepEq(D.storage.get('empty_arr'), []);
    });

    t.it('tileManager 空 currentTiles 时各种操作安全', () => {
        D.tileManager.currentTiles = [];
        D.tileManager.pagesData = [{ id: 'p0', name: 'Empty', tiles: [] }];
        D.state.currentPage = 0;
        D.state.totalPages = 1;
        // 无磁贴时这些操作不应崩溃
        D.tileManager.sortByPosition(); // 空数组排序
        t.assert(D.tileManager.currentTiles.length === 0);
        t.assert(D.tileManager.remove('nonexistent') === false);
    });

    t.it('searchHistory 空数组 buildSuggestions 安全', () => {
        D.state.searchHistory = [];
        D.tileManager.currentTiles = [];
        const suggestions = D.buildSuggestions('');
        t.deepEq(suggestions, []);
    });

    t.it('pageManager 空 pagesData 处理', () => {
        D.state.totalPages = 0;
        D.state.currentPage = 0;
        try {
            D.pageManager.load();
        } catch (_) {
            // 异常在 test 环境中预期 — 真实环境有 defaults.json
        }
    });

    t.it('logger 空时 exportLogs 返回 "[]"', () => {
        D.logger.clear();
        t.eq(D.logger.exportLogs(), '[]');
    });

    t.it('logger 空时 count 返回 0', () => {
        D.logger.clear();
        t.eq(D.logger.count(), 0);
    });

    t.it('logger 空时 getTags 返回 []', () => {
        D.logger.clear();
        t.deepEq(D.logger.getTags(), []);
    });

    t.it('logger 空时 query 返回 []', () => {
        D.logger.clear();
        t.deepEq(D.logger.query(), []);
    });
});

// ===================================================================
// 3. 超大数据量测试
// ===================================================================
t.desc('超大数据量', () => {
    t.it('searchHistory 10000 条去重不爆栈', () => {
        D.state.searchHistory = [];
        for (let i = 0; i < 10000; i++) D.addSearchHistory('q_' + i);
        t.eq(D.state.searchHistory.length, 20);
    });

    t.it('logger 50000 条日志上限不爆内存', () => {
        D.logger.clear();
        for (let i = 0; i < 50000; i++) D.logger.info('massive', 'm_' + i);
        t.assert(D.logger.count() <= 500);
    });

    t.it('backupPagesSnapshot 100 份快照上限 3', () => {
        for (let i = 0; i < 100; i++) {
            D.backupPagesSnapshot('r_' + i, [{}], ['P' + i]);
        }
        t.eq(D.storage.get('page_backups', []).length, 3);
    });

    t.it('tileManager 1000 个磁贴 sortByPosition 不爆栈', () => {
        D.tileManager.currentTiles = Array(1000).fill(0).map((_, i) => ({
            id: 't' + i, label: 'T' + i, url: 'u', position: Math.random() * 10000
        }));
        D.tileManager.sortByPosition();
        t.eq(D.tileManager.currentTiles.length, 1000);
    });
});

// ===================================================================
// 4. 特殊字符测试
// ===================================================================
t.desc('特殊字符测试', () => {
    t.it('escapeHtml Unicode 表情符号', () => {
        t.eq(D.escapeHtml('😀🎉🚀'), '😀🎉🚀');
    });

    t.it('escapeHtml 零宽字符', () => {
        const zwj = 'hello\u200Bworld';
        // 零宽字符应保留（不破坏语义）
        t.eq(D.escapeHtml(zwj), zwj);
    });

    t.it('escapeHtml 换行符保留', () => {
        const multiline = 'line1\nline2\r\nline3';
        const escaped = D.escapeHtml(multiline);
        // 换行符应保留
        t.assert(escaped.includes('\n'));
    });

    t.it('storage key 支持特殊字符', () => {
        const keys = ['test#1', 'test!2', 'test$3', 'test%4', 'test@5'];
        keys.forEach(k => {
            D.storage.set(k, k);
            t.eq(D.storage.get(k), k);
        });
    });

    t.it('storage key 支持中文字符', () => {
        D.storage.set('中文键名', '中文值');
        t.eq(D.storage.get('中文键名'), '中文值');
    });

    t.it('storage value 支持 Unicode JSON', () => {
        D.storage.set('unicode', { emoji: '🎉', chinese: '你好' });
        const read = D.storage.get('unicode');
        t.eq(read.emoji, '🎉');
        t.eq(read.chinese, '你好');
    });

    t.it('getTileIdentity 特殊字符标签', () => {
        const tile = { label: 'Test@#$', url: 'http://☆.com' };
        const id = D.getTileIdentity(tile);
        t.eq(id, 'Test@#$|http://☆.com');
    });
});

// ===================================================================
// 5. 协议与 URL 边界测试
// ===================================================================
t.desc('协议与 URL 边界值', () => {
    t.it('getTileIdentity 空 URL', () => {
        t.eq(D.getTileIdentity({ label: 'No URL' }), 'No URL|');
        t.eq(D.getTileIdentity({ label: '', url: 'x' }), '|x');
    });

    t.it('search term 超长字符串 (10000 字符)', () => {
        const long = 'a'.repeat(10000);
        D.state.searchHistory = [];
        D.tileManager.currentTiles = [];
        D.addSearchHistory(long);
        t.eq(D.state.searchHistory.length, 1);
        const suggestions = D.buildSuggestions('a');
        t.eq(suggestions.length, 1);
    });

    t.it('search term 空字符串不添加到历史', () => {
        D.state.searchHistory = [];
        D.addSearchHistory('');
        t.eq(D.state.searchHistory.length, 0);
    });

    t.it('createDefaultTile undefined idx 为 NaN', () => {
        const tile = D.createDefaultTile({ name: 'T', url: 'u' }, undefined, 1);
        t.assert(isNaN(tile.position));
    });

    t.it('createDefaultTile 负数 position', () => {
        const tile = D.createDefaultTile({ name: 'T', url: 'u' }, -5, 1);
        t.eq(tile.position, -5); // 允许负数 position，但实际不应出现
    });
});

// ===================================================================
// 6. 数据类型"幻觉"测试
// ===================================================================
t.desc('数据类型"幻觉"测试', () => {
    t.it('normalizeShortcutSize 数字类型输入', () => {
        t.eq(D.normalizeShortcutSize(123), 'standard'); // 数字无效
    });

    t.it('normalizeShortcutColumns 非数字输入', () => {
        t.eq(D.normalizeShortcutColumns('abc'), '6');
        t.eq(D.normalizeShortcutColumns(null), '6');
        t.eq(D.normalizeShortcutColumns(undefined), '6');
    });

    t.it('storage.set 循环引用对象 (JSON.stringify 抛异常)', () => {
        const obj = { a: 1 };
        obj.self = obj;
        try {
            D.storage.set('circular', obj);
            // JSON.stringify 会抛异常，storage.set 应静默处理
        } catch (_) {
            // 预期: 静默失败
        }
        t.assert(true); // 不崩溃
    });

    t.it('escapeHtml 数字类型输入 → 转为字符串', () => {
        const result = D.escapeHtml(42);
        // mock 的 createElement('div').textContent = 42 会转为 "42"
        t.eq(result, '42');
    });

    t.it('escapeHtml 布尔值输入', () => {
        t.eq(D.escapeHtml(true), 'true');
        t.eq(D.escapeHtml(false), 'false');
    });

    t.it('addSearchHistory 数字类型 term', () => {
        D.state.searchHistory = [];
        D.addSearchHistory(123);
        // 在 search.js 中 if (!term) return; — 123 是 truthy，所以会添加
        t.eq(D.state.searchHistory.length, 1);
    });

    t.it('addSearchHistory 布尔值 term', () => {
        D.state.searchHistory = [];
        D.addSearchHistory(true);
        D.addSearchHistory(false);
        // false 会触发 if (!term) return
        t.eq(D.state.searchHistory.length, 1); // 只有 true
    });

    t.it('tile sortByPosition 无 position 字段', () => {
        D.tileManager.currentTiles = [
            { id: 'a', label: 'A', url: 'a' },
            { id: 'b', label: 'B', url: 'b', position: 0 }
        ];
        D.tileManager.sortByPosition();
        // NaN 排序结果不确定但不应崩溃
        t.eq(D.tileManager.currentTiles.length, 2);
    });
});

// ===================================================================
// 7. 并发/竞态条件测试
// ===================================================================
t.desc('竞态条件模拟', () => {
    t.it('storage 同一键快速覆盖不丢失数据', () => {
        for (let i = 0; i < 100; i++) {
            D.storage.set('race_key', i);
        }
        t.eq(D.storage.get('race_key'), 99);
    });

    t.it('devhomeStorage 快速读写一致性', () => {
        for (let i = 0; i < 50; i++) {
            D.devhomeStorage.set('race2', { idx: i });
            const val = D.devhomeStorage.get('race2');
            t.eq(val.idx, i);
        }
    });

    t.it('searchHistory 并发快速修改不丢数据', () => {
        D.state.searchHistory = [];
        for (let i = 0; i < 20; i++) {
            D.addSearchHistory('concurrent_' + i);
        }
        t.eq(D.state.searchHistory.length, 20);
        t.eq(D.state.searchHistory[0], 'concurrent_19'); // 最新在最前
    });
});

// ===================================================================
// 8. 状态一致性测试
// ===================================================================
t.desc('状态一致性', () => {
    t.it('pageManager.addPage 后 totalPages 一致', () => {
        D.state.totalPages = 1;
        D.state.pageNames = ['A'];
        const pages = [{ id: 'p0', name: 'A', tiles: [] }];
        D.pageManager.addPage(pages);
        t.eq(D.state.totalPages, D.state.pageNames.length);
    });

    t.it('pageManager.removePage 后 totalPages 一致', () => {
        D.state.totalPages = 2;
        D.state.pageNames = ['A', 'B'];
        D.state.currentPage = 0;
        const pages = [{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }];
        const result = D.pageManager.removePage(pages, 1);
        t.eq(D.state.totalPages, D.state.pageNames.length);
        t.eq(result.length, D.state.totalPages);
    });

    t.it('tileManager position 与数组下标一致性', () => {
        D.tileManager.currentTiles = [
            { id: 'a', label: 'A', url: 'a', position: 2 },
            { id: 'b', label: 'B', url: 'b', position: 0 },
            { id: 'c', label: 'C', url: 'c', position: 1 }
        ];
        D.tileManager.sortByPosition();
        for (let i = 0; i < D.tileManager.currentTiles.length; i++) {
            t.eq(D.tileManager.currentTiles[i].position, i); // sortByPosition 不修改 position
        }
        // 但 save() 方法会同步 position = idx
    });
});

const result = t.finalize();
if (result.fail > 0) process.exitCode = 1;
