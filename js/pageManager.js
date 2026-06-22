/**
 * DevHome Workbench - 页面（分类）管理
 * 负责分类页的增删改查、重排、重命名。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var storage = ns.storage;
    var backupPagesSnapshot = ns.backupPagesSnapshot;
    var normalizePageState = ns.normalizePageState;
    var repairDefaultCategoryContent = ns.repairDefaultCategoryContent;
    var getDefaultPagesData = ns.getDefaultPagesData;
    var getDefaultPageNames = ns.getDefaultPageNames;

    ns.pageManager = {
        load: async function () {
            var pagesData = storage.get('pages', null) || await getDefaultPagesData();
            var storedPageNames = storage.get('page_names', getDefaultPageNames());
            var normalized = normalizePageState(pagesData, storedPageNames);
            var defaultPagesData = await getDefaultPagesData();
            var repaired = repairDefaultCategoryContent(normalized.pagesData, normalized.pageNames, defaultPagesData);
            pagesData = repaired.pagesData;
            state.totalPages = pagesData.length;
            state.pageNames = normalizePageState(pagesData, normalized.pageNames).pageNames;
            if (repaired.changed) backupPagesSnapshot('repair_default_category_content', normalized.pagesData, normalized.pageNames);
            if (normalized.changed || repaired.changed) {
                storage.set('pages', pagesData);
                storage.set('page_names', state.pageNames);
            }
            return pagesData;
        },
        save: function (pagesData) {
            var normalized = normalizePageState(pagesData, state.pageNames);
            state.pageNames = normalized.pageNames;
            state.totalPages = normalized.pagesData.length;
            storage.set('pages', normalized.pagesData);
            storage.set('page_names', state.pageNames);
        },
        getCurrentPageData: function (pagesData) {
            return pagesData[state.currentPage] || pagesData[0];
        },
        updateCurrentPage: function (pagesData, tiles) {
            if (pagesData[state.currentPage]) {
                pagesData[state.currentPage].tiles = tiles;
            } else {
                pagesData[state.currentPage] = { id: 'page_' + state.currentPage, name: state.pageNames[state.currentPage] || '第' + (state.currentPage + 1) + '页', tiles: tiles };
            }
            return pagesData;
        },
        addPage: function (pagesData) {
            var newPageId = 'page_' + state.totalPages;
            var newPageName = '第' + (state.totalPages + 1) + '页';
            pagesData.push({ id: newPageId, name: newPageName, tiles: [] });
            state.pageNames.push(newPageName);
            state.totalPages++;
            return pagesData;
        },
        removePage: function (pagesData, pageIndex) {
            if (state.totalPages <= 1) return pagesData;
            pagesData.splice(pageIndex, 1);
            state.pageNames.splice(pageIndex, 1);
            state.totalPages--;
            if (state.currentPage >= state.totalPages) state.currentPage = state.totalPages - 1;
            return pagesData;
        },
        reorderPage: function (pagesData, fromIndex, toIndex) {
            if (fromIndex === toIndex) return pagesData;
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= pagesData.length || toIndex >= pagesData.length) return pagesData;
            var page = pagesData.splice(fromIndex, 1)[0];
            pagesData.splice(toIndex, 0, page);
            var name = state.pageNames.splice(fromIndex, 1)[0];
            state.pageNames.splice(toIndex, 0, name);
            if (state.currentPage === fromIndex) state.currentPage = toIndex;
            else if (fromIndex < state.currentPage && toIndex >= state.currentPage) state.currentPage--;
            else if (fromIndex > state.currentPage && toIndex <= state.currentPage) state.currentPage++;
            return pagesData;
        },
        removePageWithStrategy: function (pagesData, pageIndex, strategy) {
            strategy = strategy || 'moveToCommon';
            if (state.totalPages <= 1) return pagesData;
            if (pageIndex < 0 || pageIndex >= pagesData.length) return pagesData;
            var removedPage = pagesData.splice(pageIndex, 1)[0];
            state.pageNames.splice(pageIndex, 1);
            state.totalPages--;
            if (strategy === 'moveToCommon' && removedPage && Array.isArray(removedPage.tiles) && removedPage.tiles.length) {
                var commonIndex = pageIndex === 0 ? 0 : Math.max(0, state.pageNames.indexOf('常用'));
                var targetPage = pagesData[commonIndex] || pagesData[0];
                if (targetPage) {
                    var baseLength = Array.isArray(targetPage.tiles) ? targetPage.tiles.length : 0;
                    targetPage.tiles = (targetPage.tiles || []).concat(removedPage.tiles.map(function (tile, idx) {
                        return Object.assign({}, tile, { position: baseLength + idx });
                    }));
                }
            }
            if (state.currentPage >= state.totalPages) state.currentPage = state.totalPages - 1;
            else if (pageIndex < state.currentPage) state.currentPage--;
            return pagesData;
        },
        renamePage: function (pageIndex, newName) {
            if (pageIndex >= 0 && pageIndex < state.pageNames.length) state.pageNames[pageIndex] = newName;
        }
    };

})(window.DevHome);
