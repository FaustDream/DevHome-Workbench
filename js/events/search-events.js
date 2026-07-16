/**
 * 搜索事件模块
 * 负责搜索引擎下拉、搜索按钮、搜索输入框的键盘/输入/焦点事件
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindSearchEvents = function () {
        var dom = ns.dom;

        dom.engineSelector.addEventListener('click', function (e) { e.stopPropagation(); ns.toggleEngineDropdown(); });
        dom.engineDropdown.addEventListener('click', function (e) { var opt = e.target.closest('.engine-option'); if (opt) { ns.setEngine(opt.dataset.engine); ns.hideEngineDropdown(); } });

        dom.searchButton.addEventListener('click', ns.doSearch);
        dom.searchInput.addEventListener('keydown', ns.handleSearchKeydown);
        dom.searchInput.addEventListener('input', ns.handleSearchInput);
        dom.searchInput.addEventListener('focus', ns.handleSearchFocus);
        dom.searchInput.addEventListener('blur', ns.handleSearchBlur);
    };

})(window.DevHome);
