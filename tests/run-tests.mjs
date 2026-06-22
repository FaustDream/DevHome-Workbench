/**
 * DevHome Workbench - TDD 测试套件
 * 
 * 基于 BDD Example Mapping，测试纯逻辑层（不依赖 DOM/Chrome API）。
 * 模块通过 IIFE + window.DevHome 命名空间交互。
 * 
 * 运行: node tests/run-tests.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ===== 模拟最小浏览器环境 =====
function mockEl() {
    const el = {
        innerHTML: '', value: '', style: {}, href: '', src: '',
        dataset: {}, checked: false, disabled: false, title: '', type: '',
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() { }, toString() { return ''; } },
        setAttribute() { }, appendChild(c) { return c; },
        addEventListener() { }, removeEventListener() { },
        querySelector() { return null; }, querySelectorAll() { return []; },
        closest() { return null; },
        getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
        focus() { }, blur() { }, scrollIntoView() { }, click() { }, toString() { return '[mock]'; }
    };
    // 模拟 textContent -> innerHTML 的 HTML 转义行为
    let _text = '';
    Object.defineProperty(el, 'textContent', {
        get() { return _text; },
        set(v) {
            _text = v;
            el.innerHTML = String(v)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
        configurable: true, enumerable: true
    });
    return el;
}

globalThis.window = globalThis;
globalThis.location = { search: '' };
globalThis.performance = { now() { return 0; } };
globalThis.requestAnimationFrame = function () { };
globalThis.fetch = () => Promise.reject(new Error('not available'));
globalThis.Blob = class { };
globalThis.FileReader = class { };
globalThis.MutationObserver = class { observe() { } disconnect() { } };
globalThis.indexedDB = { open() { const r = {}; setTimeout(() => { if (r.onsuccess) r.onsuccess({ target: { result: { objectStoreNames: { contains() { return true; } }, transaction() { return { objectStore() { const s = { get() { const g = {}; setTimeout(() => { if (g.onsuccess) g.onsuccess({ target: { result: null } }); }, 0); return g; }, put() { }, count() { const c = {}; setTimeout(() => { if (c.onsuccess) c.onsuccess({ target: { result: 0 } }); }, 0); return c; }, index() { return { openCursor() { const cc = {}; setTimeout(() => { if (cc.onsuccess) cc.onsuccess({ target: { result: null } }); }, 0); return cc; } } }, getAll() { const a = {}; setTimeout(() => { if (a.onsuccess) a.onsuccess({ target: { result: [] } }); }, 0); return a; } }; return s; }, oncomplete() { } }; } } } }); }, 0); return r; } };
globalThis.document = {
    createElement(tag) { return mockEl(); }, createDocumentFragment() { return { appendChild(c) { return c; } }; },
    body: mockEl(), head: mockEl(), documentElement: { style: { setProperty() { }, getPropertyValue() { return ''; } }, dataset: {} },
    querySelector() { return mockEl(); }, querySelectorAll() { return [mockEl()]; }, getElementById() { return mockEl(); },
    addEventListener() { }, removeEventListener() { }
};
globalThis.localStorage = (() => { const d = {}; return { getItem(k) { return d[k] || null; }, setItem(k, v) { d[k] = String(v); }, removeItem(k) { delete d[k]; } }; })();

// ===== 加载模块（按依赖顺序） =====
function loadModule(filename) {
    const code = readFileSync(resolve(projectRoot, 'js', filename), 'utf8');
    // 移除最后的自动调用: if (document.readyState ... boot()
    // 以及 main.js 底部的 auto-focus 逻辑和 boot 调用
    let patched = code;
    if (filename === 'main.js') {
        // 移除底部自动启动逻辑，只保留函数定义
        patched = code.replace(
            /\/\* ===== 自动聚焦[\s\S]*$/,
            '// boot() suppressed for testing\n})(window.DevHome);\n'
        );
    }
    try {
        const fn = new Function(patched);
        fn();
    } catch (e) {
        console.error(`  ERROR loading ${filename}:`, e.message.split('\n')[0]);
    }
}

['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'theme.js', 'pageManager.js',
    'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'workbench.js', 'events.js', 'main.js'
].forEach(f => loadModule(f));

const D = globalThis.DevHome || {};

// ===== 测试框架 =====
let total = 0, pass = 0, fail = 0;
function describe(n, fn) { console.log('\n' + '─'.repeat(58)); console.log('  ' + n); console.log('─'.repeat(58)); fn(); }
function it(n, fn) {
    total++; try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + n); }
    catch (e) { fail++; console.log('  \x1b[31m✗\x1b[0m ' + n); console.log('    \x1b[31m' + String(e.message).split('\n')[0] + '\x1b[0m'); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + '\n      expected: ' + JSON.stringify(b) + '\n      actual:   ' + JSON.stringify(a)); };

console.log('\n' + '█'.repeat(58));
console.log('  DevHome Workbench — BDD/TDD Test Suite');
console.log('█'.repeat(58));

// ===================================================================
// 1. config.js — 常量配置
// ===================================================================
describe('config.js: 常量配置', () => {
    it('SHORTCUT_SIZE_OPTIONS 三档尺寸', () => {
        const c = D.SHORTCUT_SIZE_OPTIONS;
        assert(c.small && c.standard && c.large);
        eq(c.standard.container, '80px'); eq(c.standard.icon, '48px');
    });
    it('engines 5个，百度用 badge 而非 icon', () => {
        eq(Object.keys(D.engines).length, 5);
        eq(D.engines.baidu.badge, '百');
        assert(!D.engines.baidu.icon);
    });
    it('DEFAULTS_VERSION 非空', () => assert(typeof D.DEFAULTS_VERSION === 'string' && D.DEFAULTS_VERSION.length > 0));
    it('defaultWorkbenchState 原型链接指向 docs/prototype.html', () => {
        const p = D.defaultWorkbenchState.projects[0];
        const pl = p.links.find(l => l.label === '原型');
        assert(pl); eq(pl.url, 'docs/prototype.html');
    });
    it('INLINE_DEFAULT_CATEGORY_NAMES 11个分类', () => eq(D.INLINE_DEFAULT_CATEGORY_NAMES.length, 11));
});

// ===================================================================
// 2. storage.js — 存储 CRUD
// ===================================================================
describe('storage.js: localStorage CRUD', () => {
    it('set/get 读写一致', () => { D.storage.set('test', 42); eq(D.storage.get('test'), 42); });
    it('get 不存在返回 fallback', () => { eq(D.storage.get('ghost', 'fb'), 'fb'); });
    it('clear 清除后回退到 fallback', () => { D.storage.set('tmp', 1); D.storage.clear('tmp'); eq(D.storage.get('tmp', 'X'), 'X'); });
    it('devhomeStorage 使用 devhome_ 前缀', () => {
        D.devhomeStorage.set('x', 'val');
        eq(localStorage.getItem('devhome_x'), '"val"');
    });
    it('backupPagesSnapshot 最多 3 份', () => {
        for (let i = 1; i <= 5; i++) D.backupPagesSnapshot('s' + i, [{ n: i }], ['p' + i]);
        eq(D.storage.get('page_backups', []).length, 3);
    });
});

// ===================================================================
// 3. utils.js — 工具函数
// ===================================================================
describe('utils.js: 工具函数', () => {
    it('escapeHtml 转义 < > &', () => {
        const r = D.escapeHtml('<script>alert(1)</script>');
        assert(r.includes('&lt;script&gt;')); assert(!r.includes('<script>'));
    });
    it('getTileIdentity: label|url', () => { eq(D.getTileIdentity({ label: 'Hi', url: 'http://x' }), 'Hi|http://x'); eq(D.getTileIdentity(null), '|'); });
    it('normalizeShortcutSize: 无效回退 standard', () => { eq(D.normalizeShortcutSize('bad'), 'standard'); eq(D.normalizeShortcutSize('large'), 'large'); });
    it('normalizeShortcutColumns: 无效回退 6', () => { eq(D.normalizeShortcutColumns(99), '6'); eq(D.normalizeShortcutColumns(8), '8'); });
    it('createDefaultTile 正确结构', () => {
        const t = D.createDefaultTile({ name: 'X', url: 'http://x' }, 3, 999);
        eq(t.label, 'X'); eq(t.type, 'fa'); eq(t.position, 3); assert(t.id.startsWith('tile_999_'));
    });
    it('getPageTileSignature 排序后拼接', () => {
        const sig = D.getPageTileSignature({ tiles: [{ label: 'B', url: 'b' }, { label: 'A', url: 'a' }] });
        eq(sig, 'A|a||B|b');
    });
    it('repairDefaultCategoryContent 无错位时不变', () => {
        const defs = [{ name: 'A', tiles: [{ label: 'a1', url: 'u1', position: 0 }] }];
        const r = D.repairDefaultCategoryContent([{ name: 'A', tiles: [] }], ['A'], defs);
        assert(!r.changed);
    });
    it('normalizePageState 修复不一致', () => {
        const r = D.normalizePageState([{ name: 'AI', tiles: [] }, { name: '', tiles: [] }], ['AI', '视频']);
        eq(r.pageNames[1], '视频'); assert(r.changed);
    });
});

// ===================================================================
// 4. pageManager.js — 分类 CRUD
// ===================================================================
describe('pageManager.js: 分类 CRUD', () => {
    function reset() { D.state.totalPages = 1; D.state.currentPage = 0; D.state.pageNames = ['常用']; }
    reset();
    it('addPage 新增后计数+1', () => {
        reset(); const r = D.pageManager.addPage([{ id: 'p0', name: '常用', tiles: [] }]);
        eq(r.length, 2); eq(D.state.totalPages, 2); eq(D.state.pageNames[1], '第2页');
    });
    it('removePage 不删最后一个', () => {
        reset(); const r = D.pageManager.removePage([{ id: 'p0', name: '常用', tiles: [] }], 0);
        eq(r.length, 1);
    });
    it('removePageWithStrategy moveToCommon 迁移磁贴', () => {
        D.state.totalPages = 2; D.state.pageNames = ['常用', 'AI'];
        const r = D.pageManager.removePageWithStrategy([
            { id: 'p0', name: '常用', tiles: [] },
            { id: 'p1', name: 'AI', tiles: [{ id: 't1', label: 'M', url: 'u', position: 0 }] }
        ], 1, 'moveToCommon');
        eq(r.length, 1); eq(r[0].tiles.length, 1); eq(r[0].tiles[0].label, 'M');
    });
    it('reorderPage 交换后更新 currentPage', () => {
        D.state.totalPages = 2; D.state.pageNames = ['A', 'B']; D.state.currentPage = 0;
        D.pageManager.reorderPage([{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }], 0, 1);
        eq(D.state.pageNames[0], 'B'); eq(D.state.currentPage, 1);
    });
    it('renamePage 修改分类名', () => {
        D.state.pageNames = ['旧']; D.pageManager.renamePage(0, '新'); eq(D.state.pageNames[0], '新');
    });
});

// ===================================================================
// 5. tileManager.js — 磁贴 CRUD
// ===================================================================
describe('tileManager.js: 磁贴 CRUD', () => {
    function reset() { D.tileManager.currentTiles = [{ id: 't0', label: 'Base', url: 'http://b', position: 0 }]; }
    it('add 追加到末尾', () => {
        reset(); const t = D.tileManager.add({ label: 'New', url: 'http://n', color: '#333' });
        eq(D.tileManager.currentTiles.length, 2); eq(t.position, 1);
    });
    it('remove 删除存在的磁贴', () => { reset(); assert(D.tileManager.remove('t0')); eq(D.tileManager.currentTiles.length, 0); });
    it('remove 不存在返回 false', () => { reset(); assert(!D.tileManager.remove('ghost')); });
    it('update 部分更新保留未修改字段', () => {
        reset(); D.tileManager.update('t0', { label: 'Updated', color: '#fff' });
        eq(D.tileManager.currentTiles[0].label, 'Updated'); eq(D.tileManager.currentTiles[0].url, 'http://b');
    });
    it('reorder 位置交换', () => {
        reset(); D.tileManager.add({ label: '2nd', url: 'u2' }); D.tileManager.reorder(0, 1);
        eq(D.tileManager.currentTiles[0].label, '2nd'); eq(D.tileManager.currentTiles[1].label, 'Base');
    });
    it('sortByPosition 按 position 升序', () => {
        D.tileManager.currentTiles = [{ id: 'b', label: 'B', url: 'b', position: 1 }, { id: 'a', label: 'A', url: 'a', position: 0 }];
        D.tileManager.sortByPosition(); eq(D.tileManager.currentTiles[0].id, 'a'); eq(D.tileManager.currentTiles[1].id, 'b');
    });
});

// ===================================================================
// 6. search.js — 搜索联想
// ===================================================================
describe('search.js: 搜索建议', () => {
    it('buildSuggestions 空输入返回历史', () => {
        D.state.searchHistory = ['react', 'vue']; D.tileManager.currentTiles = [];
        const r = D.buildSuggestions(''); eq(r.length, 2); eq(r[0].type, 'history');
    });
    it('buildSuggestions 关键词过滤', () => {
        D.state.searchHistory = ['react doc', 'hooks']; D.tileManager.currentTiles = [];
        eq(D.buildSuggestions('react').length, 1);
    });
    it('buildSuggestions 匹配磁贴', () => {
        D.state.searchHistory = [];
        D.tileManager.currentTiles = [{ label: 'GitHub', url: 'https://github.com', type: 'favicon', icon: '' }];
        const r = D.buildSuggestions('hub'); eq(r.length, 1); eq(r[0].type, 'tile');
    });
    it('addSearchHistory 去重+上限20', () => {
        D.state.searchHistory = [];
        for (let i = 0; i < 25; i++) D.addSearchHistory('t' + i);
        D.addSearchHistory('t24');
        eq(D.state.searchHistory.length, 20); eq(D.state.searchHistory[0], 't24');
    });
    it('clearSearchHistory 清空', () => {
        D.state.searchHistory = ['a', 'b']; D.clearSearchHistory(); eq(D.state.searchHistory.length, 0);
    });
});

// ===================================================================
// 7. workbench.js — 工作台状态
// ===================================================================
describe('workbench.js: 工作台状态', () => {
    it('getWorkbenchState 空存储返回默认值', () => {
        D.devhomeStorage.set('workbench', null);
        const s = D.getWorkbenchState();
        assert(Array.isArray(s.projects) && s.projects.length >= 3);
    });
    it('getWorkbenchState 合并已保存数据', () => {
        D.devhomeStorage.set('workbench', { inbox: [{ title: 'T' }] });
        const s = D.getWorkbenchState();
        eq(s.inbox.length, 1); assert(s.projects.length >= 3);
    });
    it('saveWorkbenchState 持久化并读取', () => {
        D.saveWorkbenchState({ lastProject: 'Test', inbox: [{ title: 'N' }] });
        const s = D.getWorkbenchState(); eq(s.lastProject, 'Test');
    });
});

// ===================================================================
// 8. 模块完整性检查
// ===================================================================
describe('模块完整性: 所有关键导出已加载', () => {
    const keys = ['engines', 'storage', 'devhomeStorage', 'state', 'dom', '$', '$$',
        'escapeHtml', 'getDefaultPagesData', 'openFaviconDB', 'loadFavicon', 'bgManager',
        'pageManager', 'tileManager', 'renderTiles', 'updatePageIndicator', 'changePageWithAnimation',
        'openSettingsPanel', 'openUploadModal', 'loadSearchHistory', 'doSearch', 'buildSuggestions',
        'getWorkbenchState', 'openWorkbenchPanel', 'bindEvents', 'boot'];
    keys.forEach(k => it(`DevHome.${k} 已导出`, () => assert(typeof D[k] !== 'undefined', k + ' 未找到')));
});

// ===== 结果 =====
console.log('\n' + '█'.repeat(58));
const pct = total ? Math.round(pass / total * 100) : 0;
console.log(`  总计: ${total} | ✓ ${pass} | ✗ ${fail} | 通过率: ${pct}%`);
console.log('█'.repeat(58));
if (fail > 0) process.exitCode = 1;
else console.log('\n  ✅ 所有测试通过\n');
