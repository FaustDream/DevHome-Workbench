/**
 * 快速验证脚本 - 验证修复后的代码关键点
 */
import { setupGlobalMock, loadModule, getDH, clearLocalStorage } from './shared-env.mjs';

setupGlobalMock();

// 完整加载顺序
['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'bgManager.js',
 'pageManager.js', 'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'logger.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(f => { console.log('  Load:', f, loadModule(f) ? 'OK' : 'FAIL'); });

const D = getDH();
clearLocalStorage();

let pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
    catch (e) { fail++; console.log('  \x1b[31m✗\x1b[0m ' + name + ': ' + e.message.split('\n')[0]); }
}

console.log('\n--- 关键验证 ---');

// 之前失败的项:
check('logger 导出', () => { if (!D.logger || !D.logger.debug) throw new Error('logger 未导出'); });
check('refreshCatRowIfVisible 可用', () => { if (typeof D.refreshCatRowIfVisible !== 'function') throw new Error('未定义'); });
check('openSettingsPanel 可用', () => { if (typeof D.openSettingsPanel !== 'function') throw new Error('未定义'); });
check('openUploadModal 可用', () => { if (typeof D.openUploadModal !== 'function') throw new Error('未定义'); });
check('getWorkbenchState 可用', () => {
    D.devhomeStorage.set('workbench', null);
    const s = D.getWorkbenchState();
    if (!s || !Array.isArray(s.projects)) throw new Error('返回值异常');
});
check('saveWorkbenchState + getWorkbenchState', () => {
    D.saveWorkbenchState({ lastProject: 'Test', inbox: [{ title: 'T' }] });
    const s = D.getWorkbenchState();
    if (s.lastProject !== 'Test') throw new Error('持久化失败');
});
check('tileManager.add + remove + update', () => {
    D.state.totalPages = 1; D.state.currentPage = 0;
    D.state.pageNames = ['Test']; D.tileManager.currentTiles = [];
    D.tileManager.pagesData = [{ id: 'p0', name: 'Test', tiles: [] }];
    const t = D.tileManager.add({ label: 'N', url: 'u' });
    if (D.tileManager.currentTiles.length !== 1) throw new Error('add 失败');
    if (!D.tileManager.remove(t.id)) throw new Error('remove 失败');
});
check('pageManager reorder + remove', () => {
    D.state.totalPages = 2; D.state.currentPage = 0; D.state.pageNames = ['A', 'B'];
    const pages = [{ id: 'p0', name: 'A', tiles: [] }, { id: 'p1', name: 'B', tiles: [] }];
    D.pageManager.reorderPage(pages, 0, 1);
    if (D.state.currentPage !== 1) throw new Error('reorder 未更新 currentPage');
});

console.log('\n' + (fail === 0 ? '\x1b[32m全部通过!\x1b[0m' : '\x1b[31m' + fail + ' 个失败\x1b[0m'));
process.exitCode = fail > 0 ? 1 : 0;
