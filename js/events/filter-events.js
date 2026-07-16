/**
 * 筛选标签事件模块
 * 负责笔记类型筛选标签的点击切换、长按删除、重命名、新建自定义标签
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindFilterEvents = function () {
        var state = ns.state;
        var dom = ns.dom;

        var filterLongPressTimer = null;
        var filterDeleteMode = false;
        var filterLongPressTarget = null;
        var filterSuppressNextClick = false;

        function exitFilterDeleteMode() {
            filterDeleteMode = false;
            filterSuppressNextClick = false;
            if (dom.wbNotesFilters) dom.wbNotesFilters.classList.remove('delete-mode');
            if (dom.wbNotesFilters) {
                var dels = dom.wbNotesFilters.querySelectorAll('.filter-del');
                dels.forEach(function (d) { d.remove(); });
            }
        }

        function enterFilterDeleteMode() {
            filterDeleteMode = true;
            filterSuppressNextClick = true;
            if (dom.wbNotesFilters) dom.wbNotesFilters.classList.add('delete-mode');
            if (dom.wbNotesFilters) {
                var chips = dom.wbNotesFilters.querySelectorAll('.wb-filter-chip:not(.always)');
                chips.forEach(function (c) {
                    if (!c.querySelector('.filter-del')) {
                        var span = document.createElement('span');
                        span.className = 'filter-del';
                        span.textContent = '\u00D7';
                        c.appendChild(span);
                    }
                });
            }
        }

        function cancelFilterLongPress() {
            if (filterLongPressTimer) { clearTimeout(filterLongPressTimer); filterLongPressTimer = null; }
            filterLongPressTarget = null;
        }

        if (dom.wbNotesFilters) {
            dom.wbNotesFilters.addEventListener('pointerdown', function (e) {
                var chip = e.target.closest('.wb-filter-chip:not(.always)');
                if (!chip) return;
                filterLongPressTarget = chip;
                chip.style.opacity = '0.7';
                filterLongPressTimer = setTimeout(function () {
                    chip.style.opacity = '';
                    enterFilterDeleteMode();
                    filterLongPressTarget = null;
                }, 800);
            });

            dom.wbNotesFilters.addEventListener('pointerup', function (e) {
                if (filterLongPressTarget) filterLongPressTarget.style.opacity = '';
                cancelFilterLongPress();
            });

            dom.wbNotesFilters.addEventListener('pointerleave', function () {
                if (filterLongPressTarget) filterLongPressTarget.style.opacity = '';
                cancelFilterLongPress();
            });

            dom.wbNotesFilters.addEventListener('pointermove', function (e) {
                if (!filterLongPressTimer || !filterLongPressTarget) return;
                var dx = e.clientX - (filterLongPressTarget.getBoundingClientRect().left + filterLongPressTarget.offsetWidth / 2);
                var dy = e.clientY - (filterLongPressTarget.getBoundingClientRect().top + filterLongPressTarget.offsetHeight / 2);
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    filterLongPressTarget.style.opacity = '';
                    cancelFilterLongPress();
                }
            });

            dom.wbNotesFilters.addEventListener('click', function (e) {
                if (filterSuppressNextClick) { filterSuppressNextClick = false; return; }
                var delBtn = e.target.closest('.filter-del');
                if (delBtn && filterDeleteMode) {
                    e.preventDefault(); e.stopPropagation();
                    var chip = delBtn.closest('.wb-filter-chip');
                    if (!chip || chip.classList.contains('always')) return;
                    var filter = chip.dataset.filter;
                    var name = chip.textContent.replace('\u00D7', '').trim();
                    ns.showConfirm('将"' + name + '"类型的全部笔记变为未分类，标签本身也会移除。确定继续？', { title: '删除标签' }).then(function (ok) {
                        if (ok) { ns.removeFilter(filter); exitFilterDeleteMode(); }
                    });
                    return;
                }
                if (filterDeleteMode) {
                    var chipClicked = e.target.closest('.wb-filter-chip');
                    if (chipClicked && chipClicked.classList.contains('custom')) {
                        var filterKey = chipClicked.dataset.filter;
                        var oldText = chipClicked.textContent.replace('\u00D7', '').trim();
                        ns.showPrompt('重命名标签（可用 "emoji 名称" 格式）：', { title: '重命名标签', defaultValue: oldText }).then(function (newVal) {
                            if (newVal && newVal.trim()) {
                                var parsed = (function (input) {
                                    var m = input.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
                                    if (m) return { icon: m[1], name: input.slice(m[0].length).trim() || input };
                                    return { icon: '', name: input.trim() };
                                })(newVal.trim());
                                ns.renameFilter(filterKey, parsed.icon || '', parsed.name);
                            }
                        });
                    }
                    exitFilterDeleteMode();
                    return;
                }
                var chip = e.target.closest('.wb-filter-chip');
                if (!chip) return;
                var filter = chip.dataset.filter;
                state._notesFilter = filter;
                dom.wbNotesFilters.querySelectorAll('.wb-filter-chip').forEach(function (c) {
                    c.classList.toggle('active', c.dataset.filter === filter);
                });
                ns.renderNotesList(filter, state._notesSearch);
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && filterDeleteMode) exitFilterDeleteMode();
        });

        if (dom.wbFilterAddBtn) {
            dom.wbFilterAddBtn.addEventListener('click', function () {
                if (document.querySelector('.wb-filter-chip-editing')) return;
                ns.startInlineCustomFilter();
            });
        }
    };

})(window.DevHome);
