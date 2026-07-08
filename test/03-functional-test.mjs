/**
 * DevHome Workbench - 功能测试
 * 验证核心业务功能的完整工作流
 */
import { setupGlobalMock, loadModule, createReporter, getDH, clearLocalStorage, projectRoot } from './shared-env.mjs';
import { resolve } from 'node:path';

setupGlobalMock();

const reportPath = resolve(projectRoot, 'test', 'docs', '03-functional-test-report.md');
const t = createReporter('功能测试 (Functional Tests)', reportPath);

['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'bgManager.js',
 'pageManager.js', 'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'logger.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(f => loadModule(f));

const D = getDH();
clearLocalStorage();

// ===================================================================
// 1. 搜索功能
// ===================================================================
t.desc('搜索功能', () => {
    function setup() {
        D.state.searchHistory = [];
        D.state.currentEngine = 'google';
        D.state.engineUrl = D.engines.google.url;
        D.tileManager.currentTiles = [];
    }

    t.it('搜索词添加到历史记录', () => {
        setup();
        D.addSearchHistory('JavaScript tips');
        t.eq(D.state.searchHistory[0], 'JavaScript tips');
        t.eq(D.state.searchHistory.length, 1);
    });

    t.it('重复搜索词去重并移到最前', () => {
        setup();
        D.addSearchHistory('react');
        D.addSearchHistory('vue');
        D.addSearchHistory('react');
        t.eq(D.state.searchHistory[0], 'react');
        t.eq(D.state.searchHistory[1], 'vue');
        t.eq(D.state.searchHistory.length, 2);
    });

    t.it('搜索建议包含历史 + 磁贴匹配', () => {
        setup();
        D.state.searchHistory = ['GitHub', 'VSCode'];
        D.tileManager.currentTiles = [
            { label: 'GitHub Actions', url: 'https://github.com/features/actions' },
            { label: 'Google Drive', url: 'https://drive.google.com' }
        ];
        const suggestions = D.buildSuggestions('github');
        t.assert(suggestions.length > 0);
        t.assert(suggestions.some(s => s.type === 'tile' || s.type === 'history'));
    });

    t.it('搜索引擎切换正确更新状态', () => {
        setup();
        D.setEngine('baidu', false);
        t.eq(D.state.currentEngine, 'baidu');
        t.assert(D.state.engineUrl.includes('baidu.com'));
    });

    t.it('setEngine 无效引擎不更改状态', () => {
        setup();
        const prevEngine = D.state.currentEngine;
        D.setEngine('invalid_engine', false);
        t.eq(D.state.currentEngine, prevEngine);
    });
});

// ===================================================================
// 2. 磁贴管理功能
// ===================================================================
t.desc('磁贴管理功能', () => {
    function setupTiles() {
        D.state.currentPage = 0;
        D.state.totalPages = 1;
        D.state.pageNames = ['常用'];
        D.tileManager.currentTiles = [
            { id: 't0', label: 'Base', url: 'http://b.com', position: 0 }
        ];
        D.tileManager.pagesData = [
            { id: 'p0', name: '常用', tiles: [
                { id: 't0', label: 'Base', url: 'http://b.com', position: 0 }
            ]}
        ];
    }

    t.it('添加磁贴并验证列表更新', () => {
        setupTiles();
        D.tileManager.add({ label: 'New Tile', url: 'http://n.com', color: '#f00' });
        t.eq(D.tileManager.currentTiles.length, 2);
        const last = D.tileManager.currentTiles[1];
        t.eq(last.label, 'New Tile');
    });

    t.it('删除磁贴并验证列表减少', () => {
        setupTiles();
        D.tileManager.add({ label: 'Temp', url: 'http://t.com' });
        t.eq(D.tileManager.currentTiles.length, 2);
        D.tileManager.remove('t0');
        t.eq(D.tileManager.currentTiles.length, 1);
    });

    t.it('更新磁贴属性', () => {
        setupTiles();
        D.tileManager.update('t0', { label: 'Updated', color: '#0f0' });
        const tile = D.tileManager.currentTiles[0];
        t.eq(tile.label, 'Updated');
        t.eq(tile.url, 'http://b.com'); // 未修改字段保留
    });

    t.it('拖拽排序：磁贴位置交换', () => {
        setupTiles();
        D.tileManager.add({ label: 'A', url: 'a' });
        D.tileManager.add({ label: 'B', url: 'b' });
        D.tileManager.reorder(0, 2); // Base 移到 B 的位置
        t.eq(D.tileManager.currentTiles[2].label, 'Base');
    });

    t.it('移动磁贴到另一分类', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [{ id: 't0', label: 'MoveMe', url: 'm', position: 0 }] },
            { id: 'p1', name: 'B', tiles: [] }
        ];
        D.tileManager.currentTiles = [{ id: 't0', label: 'MoveMe', url: 'm', position: 0 }];
        const moved = D.tileManager.moveTileToPage('t0', 1);
        t.assert(moved, '移动操作应成功');
        t.eq(D.tileManager.pagesData[1].tiles.length, 1);
        t.eq(D.tileManager.pagesData[0].tiles.length, 0);
    });

    t.it('复制磁贴到另一分类', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [{ id: 't0', label: 'CopyMe', url: 'c', position: 0 }] },
            { id: 'p1', name: 'B', tiles: [] }
        ];
        D.tileManager.currentTiles = [{ id: 't0', label: 'CopyMe', url: 'c', position: 0 }];
        const copied = D.tileManager.copyTileToPage('t0', 1);
        t.assert(copied, '复制操作应成功');
        t.eq(D.tileManager.pagesData[1].tiles.length, 1);
        t.eq(D.tileManager.pagesData[0].tiles.length, 1); // 原分类保留
        t.assert(D.tileManager.pagesData[1].tiles[0].id !== 't0'); // 新 ID
    });
});

// ===================================================================
// 3. 分类管理功能
// ===================================================================
t.desc('分类管理功能', () => {
    function setupPages() {
        D.state.totalPages = 1;
        D.state.currentPage = 0;
        D.state.pageNames = ['首页'];
        D.tileManager.pagesData = [{ id: 'p0', name: '首页', tiles: [] }];
    }

    t.it('新增分类后自动跳转', () => {
        setupPages();
        D.tileManager.addNewPage();
        t.eq(D.state.totalPages, 2);
        t.eq(D.state.currentPage, 1);
    });

    t.it('删除分类（非最后一个）', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B'];
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [] },
            { id: 'p1', name: 'B', tiles: [{ id: 't1', label: 'X', url: 'x', position: 0 }] }
        ];
        D.tileManager.currentTiles = [];
        const removed = D.tileManager.removePageAt(1, 'moveToCommon');
        t.assert(removed);
        t.eq(D.state.totalPages, 1);
        t.eq(D.tileManager.pagesData[0].tiles.length, 1); // 磁贴迁移
    });

    t.it('最后一个分类不可删除', () => {
        setupPages();
        t.assert(!D.tileManager.removeCurrentPage());
    });

    t.it('重命名分类', () => {
        setupPages();
        D.tileManager.renameCurrentPage('新首页');
        t.eq(D.state.pageNames[0], '新首页');
        t.eq(D.tileManager.pagesData[0].name, '新首页');
    });

    t.it('分类拖拽排序', () => {
        D.state.totalPages = 3;
        D.state.currentPage = 0;
        D.state.pageNames = ['A', 'B', 'C'];
        D.tileManager.pagesData = [
            { id: 'p0', name: 'A', tiles: [] },
            { id: 'p1', name: 'B', tiles: [] },
            { id: 'p2', name: 'C', tiles: [] }
        ];
        D.tileManager.reorderPage(0, 2);
        t.eq(D.state.pageNames[0], 'B');
        t.eq(D.state.pageNames[2], 'A');
    });

    t.it('页面切换正确更新 currentTiles', () => {
        D.state.totalPages = 2;
        D.state.currentPage = 0;
        D.state.pageNames = ['Page1', 'Page2'];
        D.tileManager.pagesData = [
            { id: 'p0', name: 'Page1', tiles: [{ id: 'a', label: 'A1', url: 'a1', position: 0 }] },
            { id: 'p1', name: 'Page2', tiles: [{ id: 'b', label: 'B1', url: 'b1', position: 0 }] }
        ];
        D.tileManager.currentTiles = [{ id: 'a', label: 'A1', url: 'a1', position: 0 }];
        D.tileManager.changePage(1);
        t.eq(D.state.currentPage, 1);
        t.eq(D.tileManager.currentTiles[0].id, 'b');
    });
});

// ===================================================================
// 4. 工作台状态管理
// ===================================================================
t.desc('工作台状态管理', () => {
    t.it('保存并读取工作台状态', () => {
        const state = {
            lastProject: 'MyProject',
            inbox: [{ title: 'Task 1', done: false }, { title: 'Task 2', done: true }],
            projects: []
        };
        D.saveWorkbenchState(state);
        const loaded = D.getWorkbenchState();
        t.eq(loaded.lastProject, 'MyProject');
        t.eq(loaded.inbox.length, 2);
        t.eq(loaded.inbox[0].done, false);
    });

    t.it('工作台状态合并默认四象限', () => {
        D.devhomeStorage.set('workbench', null);
        const loaded = D.getWorkbenchState();
        t.assert(loaded.quadrants);
        t.eq(loaded.quadrants.q1.title, '重要且紧急');
        t.eq(loaded.quadrants.q2.title, '重要不紧急');
        t.eq(loaded.quadrants.q3.title, '紧急不重要');
        t.eq(loaded.quadrants.q4.title, '不紧急不重要');
    });
});

// ===================================================================
// 5. 番茄钟配置验证
// ===================================================================
t.desc('番茄钟配置', () => {
    t.it('预设时长合理 (25/30/45/60 分钟)', () => {
        D.POMODORO_PRESETS.forEach(m => t.assert(m >= 1 && m <= 120));
    });

    t.it('休息时长合理 (5/10/15 分钟)', () => {
        D.POMODORO_REST_PRESETS.forEach(m => t.assert(m >= 1 && m <= 30));
    });

    t.it('state.pomodoroDuration 默认 25', () => {
        t.eq(D.state.pomodoroDuration, 25);
    });

    t.it('state.pomodoroRestDuration 默认 5', () => {
        t.eq(D.state.pomodoroRestDuration, 5);
    });

    t.it('state.pomodoroMode 默认 default', () => {
        t.eq(D.state.pomodoroMode, 'default');
    });

    t.it('state.pomodoroAutoCycle 默认 true', () => {
        t.eq(D.state.pomodoroAutoCycle, true);
    });
});

// ===================================================================
// 6. 笔记类型配置
// ===================================================================
t.desc('笔记类型配置', () => {
    t.it('五种笔记类型各有 label 和 icon', () => {
        Object.values(D.NOTE_TYPES).forEach(type => {
            t.isType(type.label, 'string');
            t.isType(type.icon, 'string');
            t.assert(type.label.length > 0);
        });
    });

    t.it('默认当前笔记类型为 note', () => {
        t.eq(D.state._currentNoteType, 'note');
    });
});

const result = t.finalize();
if (result.fail > 0) process.exitCode = 1;
