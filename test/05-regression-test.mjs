/**
 * DevHome Workbench - 回归测试
 * 验证已有功能在代码变更后仍然正确工作。
 * 基于已知的 bug 修复和关键业务路径。
 */
import { setupGlobalMock, loadModule, createReporter, getDH, clearLocalStorage, projectRoot } from './shared-env.mjs';
import { resolve } from 'node:path';

setupGlobalMock();

const reportPath = resolve(projectRoot, 'test', 'docs', '05-regression-test-report.md');
const t = createReporter('回归测试 (Regression Tests)', reportPath);

['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'bgManager.js',
 'pageManager.js', 'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'logger.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(f => loadModule(f));

const D = getDH();
clearLocalStorage();

// ===================================================================
// 1. 原有测试套件全部覆盖
// ===================================================================
t.desc('原有 TDD 测试套件回归', () => {
    // 这些测试验证原有 tests/run-tests.mjs 中已通过的功能依然正常

    t.it('SHORTCUT_SIZE_OPTIONS 三档尺寸不变', () => {
        const c = D.SHORTCUT_SIZE_OPTIONS;
        t.assert(c.small && c.standard && c.large);
        t.eq(c.standard.container, '100px');
        t.eq(c.standard.icon, '56px');
    });

    t.it('engines 仍是5个，百度用 badge 而非 icon', () => {
        t.eq(Object.keys(D.engines).length, 5);
        t.eq(D.engines.baidu.badge, '百');
        t.assert(!D.engines.baidu.icon);
    });

    t.it('INLINE_DEFAULT_CATEGORY_NAMES 仍是11个', () => {
        t.eq(D.INLINE_DEFAULT_CATEGORY_NAMES.length, 11);
    });

    t.it('storage set/get 行为未变', () => {
        D.storage.set('regression_key', 42);
        t.eq(D.storage.get('regression_key'), 42);
        D.storage.clear('regression_key');
        t.eq(D.storage.get('regression_key', 'fb'), 'fb');
    });

    t.it('createDefaultTile 结构不变', () => {
        const tile = D.createDefaultTile({ name: 'X', url: 'http://x' }, 3, 999);
        t.eq(tile.label, 'X');
        t.eq(tile.type, 'favicon');
        t.eq(tile.position, 3);
        t.assert(tile.id.startsWith('tile_999_'));
    });

    t.it('getPageTileSignature 排序拼接不变', () => {
        const sig = D.getPageTileSignature({
            tiles: [{ label: 'B', url: 'b' }, { label: 'A', url: 'a' }]
        });
        t.eq(sig, 'A|a||B|b');
    });

    t.it('repairDefaultCategoryContent 无错位时不变', () => {
        const defs = [{ name: 'A', tiles: [{ label: 'a1', url: 'u1', position: 0 }] }];
        const r = D.repairDefaultCategoryContent(
            [{ name: 'A', tiles: [] }], ['A'], defs
        );
        t.assert(!r.changed);
    });

    t.it('normalizePageState 修复不一致行为不变', () => {
        const r = D.normalizePageState(
            [{ name: 'AI', tiles: [] }, { name: '', tiles: [] }],
            ['AI', '视频']
        );
        t.eq(r.pageNames[1], '视频');
        t.assert(r.changed);
    });
});

// ===================================================================
// 2. 分类 CRUD 回归
// ===================================================================
t.desc('分类 CRUD 回归', () => {
    function reset() {
        D.state.totalPages = 1;
        D.state.currentPage = 0;
        D.state.pageNames = ['常用'];
    }

    t.it('addPage 新增后计数+1', () => {
        reset();
        const r = D.pageManager.addPage([{ id: 'p0', name: '常用', tiles: [] }]);
        t.eq(r.length, 2);
        t.eq(D.state.totalPages, 2);
        t.eq(D.state.pageNames[1], '第2页');
    });

    t.it('removePage 不删最后一个', () => {
        reset();
        const r = D.pageManager.removePage([{ id: 'p0', name: '常用', tiles: [] }], 0);
        t.eq(r.length, 1);
    });

    t.it('removePageWithStrategy moveToCommon 迁移磁贴', () => {
        D.state.totalPages = 2;
        D.state.pageNames = ['常用', 'AI'];
        const r = D.pageManager.removePageWithStrategy([
            { id: 'p0', name: '常用', tiles: [] },
            { id: 'p1', name: 'AI', tiles: [{ id: 't1', label: 'M', url: 'u', position: 0 }] }
        ], 1, 'moveToCommon');
        t.eq(r.length, 1);
        t.eq(r[0].tiles.length, 1);
        t.eq(r[0].tiles[0].label, 'M');
    });

    t.it('reorderPage 交换后 currentPage 跟随', () => {
        D.state.totalPages = 2;
        D.state.pageNames = ['A', 'B'];
        D.state.currentPage = 0;
        D.pageManager.reorderPage(
            [{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }], 0, 1
        );
        t.eq(D.state.pageNames[0], 'B');
        t.eq(D.state.currentPage, 1);
    });

    t.it('renamePage 修改分类名', () => {
        D.state.pageNames = ['旧'];
        D.pageManager.renamePage(0, '新');
        t.eq(D.state.pageNames[0], '新');
    });
});

// ===================================================================
// 3. 磁贴 CRUD 回归
// ===================================================================
t.desc('磁贴 CRUD 回归', () => {
    function reset() {
        D.state.currentPage = 0;
        D.tileManager.currentTiles = [{ id: 't0', label: 'Base', url: 'http://b', position: 0 }];
        D.tileManager.pagesData = [{ id: 'p0', name: 'Test', tiles: [{ id: 't0', label: 'Base', url: 'http://b', position: 0 }] }];
    }

    t.it('add 追加到末尾', () => {
        reset();
        const t = D.tileManager.add({ label: 'New', url: 'http://n' });
        t.eq(D.tileManager.currentTiles.length, 2);
        t.eq(t.position, 1);
    });

    t.it('remove 删除存在返回 true', () => {
        reset();
        t.assert(D.tileManager.remove('t0'));
        t.eq(D.tileManager.currentTiles.length, 0);
    });

    t.it('remove 不存在返回 false', () => {
        reset();
        t.assert(!D.tileManager.remove('ghost'));
    });

    t.it('update 部分更新', () => {
        reset();
        D.tileManager.update('t0', { label: 'Updated' });
        t.eq(D.tileManager.currentTiles[0].label, 'Updated');
        t.eq(D.tileManager.currentTiles[0].url, 'http://b');
    });

    t.it('reorder 位置交换', () => {
        reset();
        D.tileManager.add({ label: '2nd', url: 'u2' });
        D.tileManager.reorder(0, 1);
        t.eq(D.tileManager.currentTiles[0].label, '2nd');
        t.eq(D.tileManager.currentTiles[1].label, 'Base');
    });

    t.it('sortByPosition 按 position 升序', () => {
        D.tileManager.currentTiles = [
            { id: 'b', label: 'B', url: 'b', position: 1 },
            { id: 'a', label: 'A', url: 'a', position: 0 }
        ];
        D.tileManager.sortByPosition();
        t.eq(D.tileManager.currentTiles[0].id, 'a');
        t.eq(D.tileManager.currentTiles[1].id, 'b');
    });
});

// ===================================================================
// 4. 搜索功能回归
// ===================================================================
t.desc('搜索功能回归', () => {
    function setup() {
        D.state.searchHistory = [];
        D.tileManager.currentTiles = [];
    }

    t.it('buildSuggestions 空输入返回历史', () => {
        setup();
        D.state.searchHistory = ['react', 'vue'];
        const r = D.buildSuggestions('');
        t.eq(r.length, 2);
        t.eq(r[0].type, 'history');
    });

    t.it('buildSuggestions 关键词过滤', () => {
        setup();
        D.state.searchHistory = ['react doc', 'hooks'];
        t.eq(D.buildSuggestions('react').length, 1);
    });

    t.it('buildSuggestions 匹配磁贴', () => {
        setup();
        D.tileManager.currentTiles = [{ label: 'GitHub', url: 'https://github.com' }];
        const r = D.buildSuggestions('hub');
        t.eq(r.length, 1);
        t.eq(r[0].type, 'tile');
    });

    t.it('addSearchHistory 去重+上限20', () => {
        setup();
        for (let i = 0; i < 25; i++) D.addSearchHistory('t' + i);
        D.addSearchHistory('t24');
        t.eq(D.state.searchHistory.length, 20);
        t.eq(D.state.searchHistory[0], 't24');
    });

    t.it('clearSearchHistory 清空', () => {
        D.state.searchHistory = ['a', 'b'];
        D.clearSearchHistory();
        t.eq(D.state.searchHistory.length, 0);
    });
});

// ===================================================================
// 5. 工作台回归
// ===================================================================
t.desc('工作台状态回归', () => {
    t.it('getWorkbenchState 空存储返回默认值', () => {
        D.devhomeStorage.set('workbench', null);
        const s = D.getWorkbenchState();
        t.assert(s.projects && s.projects.length >= 0);
    });

    t.it('getWorkbenchState 合并已保存数据', () => {
        D.devhomeStorage.set('workbench', { inbox: [{ title: 'T' }] });
        const s = D.getWorkbenchState();
        t.eq(s.inbox.length, 1);
        t.assert(s.projects.length >= 0);
    });

    t.it('saveWorkbenchState 持久化并读取', () => {
        D.saveWorkbenchState({ lastProject: 'Test', inbox: [{ title: 'N' }] });
        const s = D.getWorkbenchState();
        t.eq(s.lastProject, 'Test');
    });
});

// ===================================================================
// 6. 关键 bug 修复回归
// ===================================================================
t.desc('关键 bug 修复回归', () => {
    t.it('空磁贴分类不崩溃 (NULL tile 处理)', () => {
        D.tileManager.currentTiles = [];
        t.eq(D.tileManager.currentTiles.length, 0);
        const sig = D.getPageTileSignature({ tiles: [] });
        t.eq(sig, '');
    });

    t.it('getTileIdentity null/undefined 处理', () => {
        t.eq(D.getTileIdentity(null), '|');
        t.eq(D.getTileIdentity(undefined), '|');
        t.eq(D.getTileIdentity({ label: null, url: null }), '|');
    });

    t.it('sanitizeHtml 空输入不崩溃', () => {
        t.eq(D.sanitizeHtml(''), '');
        t.eq(D.sanitizeHtml(null), '');
        t.eq(D.sanitizeHtml(undefined), '');
    });

    t.it('escapeHtml 已转义内容不二次转义风险低', () => {
        const safe = D.escapeHtml('hello');
        const double = D.escapeHtml(safe);
        t.eq(double, safe);
    });

    t.it('无效搜索引擎不崩溃', () => {
        const prev = D.state.currentEngine;
        D.setEngine('not_found', false);
        t.eq(D.state.currentEngine, prev); // 不变
    });

    t.it('无效 shortcutSize 回退 standard', () => {
        t.eq(D.normalizeShortcutSize('invalid'), 'standard');
        t.eq(D.normalizeShortcutSize(''), 'standard');
    });

    t.it('addSearchHistory 空字符串不变历史', () => {
        D.state.searchHistory = ['a'];
        D.addSearchHistory('');
        t.eq(D.state.searchHistory.length, 1);
    });

    t.it('removePageAt 仅一页时返回 false', () => {
        D.state.totalPages = 1;
        D.state.currentPage = 0;
        D.tileManager.pagesData = [{ id: 'p0', name: 'Only', tiles: [] }];
        t.assert(!D.tileManager.removePageAt(0));
    });
});

const result = t.finalize();
if (result.fail > 0) process.exitCode = 1;
