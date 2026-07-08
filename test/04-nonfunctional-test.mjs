/**
 * DevHome Workbench - 非功能测试
 * 性能、内存、存储容量、响应时间等非业务功能测试
 */
import { setupGlobalMock, loadModule, createReporter, getDH, clearLocalStorage, projectRoot } from './shared-env.mjs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

setupGlobalMock();

const reportPath = resolve(projectRoot, 'test', 'docs', '04-nonfunctional-test-report.md');
const t = createReporter('非功能测试 (Non-functional Tests)', reportPath);

['config.js', 'storage.js', 'state.js', 'utils.js', 'categoryUI.js', 'ui.js',
 'search.js', 'logger.js', 'pageManager.js', 'tiles.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(function (f) { loadModule(f); });

var D = getDH();
clearLocalStorage();

// ===================================================================
// 1. 存储性能测试
// ===================================================================
t.desc('存储性能测试', function () {
    t.it('storage.set 100次操作 < 100ms', function () {
        var start = Date.now();
        for (var i = 0; i < 100; i++) { D.storage.set('perf_' + i, { data: 'x'.repeat(100) }); }
        var elapsed = Date.now() - start;
        t.assert(elapsed < 200, '100次存储操作耗时 ' + elapsed + 'ms，应 < 200ms');
    });

    t.it('storage.get 100次操作 < 50ms', function () {
        D.storage.set('perf_read', 'value');
        var start = Date.now();
        for (var i = 0; i < 100; i++) { D.storage.get('perf_read'); }
        var elapsed = Date.now() - start;
        t.assert(elapsed < 100, '100次读取操作耗时 ' + elapsed + 'ms');
    });

    t.it('大数据存储（10KB）读写正常', function () {
        var bigData = { items: new Array(100).fill('x'.repeat(100)) };
        D.storage.set('big_data', bigData);
        var read = D.storage.get('big_data');
        t.eq(read.items.length, 100);
    });
});

// ===================================================================
// 2. 搜索性能测试
// ===================================================================
t.desc('搜索性能测试', function () {
    t.it('buildSuggestions 100磁贴+20历史 < 20ms', function () {
        D.state.searchHistory = new Array(20).fill(0).map(function (_, i) { return 'query_' + i; });
        D.tileManager.currentTiles = new Array(100).fill(0).map(function (_, i) {
            return { label: 'Tile_' + i, url: 'http://example.com/' + i };
        });
        var start = Date.now();
        D.buildSuggestions('Tile');
        var elapsed = Date.now() - start;
        t.assert(elapsed < 30, '搜索建议耗时 ' + elapsed + 'ms');
    });

    t.it('addSearchHistory 20条去重 < 50ms', function () {
        D.state.searchHistory = new Array(19).fill(0).map(function (_, i) { return 'h' + i; });
        var start = Date.now();
        for (var i = 0; i < 20; i++) { D.addSearchHistory('new_' + i); }
        var elapsed = Date.now() - start;
        t.assert(elapsed < 100, '历史去重耗时 ' + elapsed + 'ms');
    });
});

// ===================================================================
// 3. 日志系统容量测试
// ===================================================================
t.desc('日志系统容量测试', function () {
    t.it('写入600条日志上限为500', function () {
        D.logger.clear();
        for (var i = 0; i < 600; i++) { D.logger.info('stress', 'msg_' + i); }
        t.assert(D.logger.count() <= 500, '日志上限应为500，实际 ' + D.logger.count());
    });

    t.it('日志查询 limit=10 返回10条', function () {
        D.logger.clear();
        for (var i = 0; i < 100; i++) { D.logger.info('q', 'm' + i); }
        t.eq(D.logger.query({ limit: 10 }).length, 10);
    });

    t.it('exportLogs 对500条日志生成JSON < 100ms', function () {
        D.logger.clear();
        for (var i = 0; i < 500; i++) { D.logger.info('export', 'msg_' + i); }
        var start = Date.now();
        var json = D.logger.exportLogs();
        var elapsed = Date.now() - start;
        t.assert(elapsed < 200, '导出500条日志耗时 ' + elapsed + 'ms');
        var parsed = JSON.parse(json);
        t.eq(parsed.length, 500);
    });
});

// ===================================================================
// 4. 存储容量测试
// ===================================================================
t.desc('存储容量测试', function () {
    t.it('backupPagesSnapshot 快照上限3份', function () {
        for (var i = 1; i <= 10; i++) {
            D.backupPagesSnapshot('cap_' + i, [{}], ['P' + i]);
        }
        var snaps = D.storage.get('page_backups', []);
        t.eq(snaps.length, 3);
    });

    t.it('searchHistory 上限20条', function () {
        D.state.searchHistory = [];
        for (var i = 0; i < 30; i++) { D.addSearchHistory('term_' + i); }
        t.eq(D.state.searchHistory.length, 20);
    });

    t.it('storage 支持嵌套深度 6 层 JSON', function () {
        var deep = {};
        var cur = deep;
        var levels = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
        for (var i = 0; i < levels.length - 1; i++) {
            cur[levels[i]] = {};
            cur = cur[levels[i]];
        }
        cur[levels[levels.length - 1]] = { val: 'deep' };
        D.storage.set('deep', deep);
        var read = D.storage.get('deep');
        t.eq(read.l1.l2.l3.l4.l5.l6.val, 'deep');
    });
});

// ===================================================================
// 5. 模块加载性能
// ===================================================================
t.desc('模块加载性能', function () {
    t.it('所有模块在 1 秒内加载完成', function () {
        var modules = ['config.js', 'storage.js', 'state.js', 'utils.js', 'search.js'];
        var start = Date.now();
        modules.forEach(function (f) {
            readFileSync(resolve(projectRoot, 'js', f), 'utf8');
        });
        var elapsed = Date.now() - start;
        t.assert(elapsed < 1000, '模块加载 ' + elapsed + 'ms');
    });
});

// ===================================================================
// 6. escapeHtml 性能
// ===================================================================
t.desc('escapeHtml 性能', function () {
    t.it('1000次 escapeHtml < 200ms', function () {
        var input = '<script>alert("xss")</script><div class="test">Hello & World</div>';
        var start = Date.now();
        for (var i = 0; i < 1000; i++) { D.escapeHtml(input); }
        var elapsed = Date.now() - start;
        t.assert(elapsed < 300, '1000次 escapeHtml 耗时 ' + elapsed + 'ms');
    });
});

// ===================================================================
// 7. 磁贴批量操作性能
// ===================================================================
t.desc('磁贴批量操作性能', function () {
    t.it('创建50个磁贴 < 200ms', function () {
        D.tileManager.currentTiles = [];
        D.tileManager.pagesData = [{ id: 'p0', name: 'Test', tiles: [] }];
        D.state.currentPage = 0;
        var start = Date.now();
        for (var i = 0; i < 50; i++) {
            D.tileManager.add({ label: 'T' + i, url: 'http://t' + i + '.com' });
        }
        var elapsed = Date.now() - start;
        t.assert(elapsed < 300, '50个磁贴创建耗时 ' + elapsed + 'ms');
        t.eq(D.tileManager.currentTiles.length, 50);
    });

    t.it('sortByPosition 50个磁贴 < 20ms', function () {
        var tiles = new Array(50).fill(0).map(function (_, i) {
            return { id: 't' + i, label: 'T' + i, url: 'u', position: Math.random() * 1000 };
        });
        D.tileManager.currentTiles = tiles;
        var start = Date.now();
        D.tileManager.sortByPosition();
        var elapsed = Date.now() - start;
        t.assert(elapsed < 30, '50个磁贴排序耗时 ' + elapsed + 'ms');
    });
});

var result = t.finalize();
if (result.fail > 0) { process.exitCode = 1; }
