/**
 * DevHome Workbench - 事件绑定
 * 集中管理所有 DOM 事件监听，是整个应用的事件中枢。
 *
 * bindEvents() 已拆分为多个子函数，按功能域组织：
 *   - _bindCategoryEvents()   分类按钮行事件
 *   - _bindNotebookEvents()   笔记本下拉菜单 + 右键菜单事件
 *   - _bindToolbarEvents()    工具栏按钮事件（新建笔记/笔记本/标签）
 *   - _bindQuadrantEvents()   四象限任务面板事件
 *   - _bindCalendarEvents()   日历导航事件
 *   - _bindPomodoroEvents()   番茄钟控制事件
 *   - _bindFilterEvents()     筛选标签事件（长按删除、重命名、点击筛选）
 *   - _bindSettingsEvents()   设置面板事件
 *   - _bindSearchEvents()     搜索相关事件
 *   - _bindGlobalEvents()     全局键盘/右键/文档事件
 *   - _bindViewScale()        F4 视图缩放
 *   - _bindTileSettings()     F6 图标设置
 *   - _bindFontSettings()     F8 字体设置
 *   - _bindAnimationSettings() F9 动画效果
 *   - _bindLayoutSettings()  F5 布局系统
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var storage = ns.storage;
    var $$ = ns.$$;
    var engines = ns.engines;
    var escapeHtml = ns.escapeHtml;

    /* ===== 主入口 ===== */
    ns.bindEvents = function () {
        // 防重复绑定：配置目录选择后再次调用 bindEvents() 时避免累加重复监听器
        if (state._eventsBound) {
            console.log('[事件] bindEvents 已绑定，跳过重复调用');
            return;
        }
        state._eventsBound = true;
        console.log('[事件] bindEvents 首次绑定');

        _bindCategoryEvents();
        _bindNotebookEvents();
        _bindToolbarEvents();
        _bindQuadrantEvents();
        _bindCalendarEvents();
        _bindPomodoroEvents();
        _bindFilterEvents();
        _bindSettingsEvents();
        _bindSearchEvents();
        _bindGlobalEvents();
        _bindMiscEvents();
    };

    /* ===== 分类按钮行事件 ===== */
    function _bindCategoryEvents() {
        if (dom.catRow) {
            dom.catRow.addEventListener('click', function (e) {
                var addBtn = e.target.closest('.cat-add-btn');
                if (addBtn) { e.preventDefault(); e.stopPropagation(); ns.addNewPage(); ns.resetCategoryDragState(); state.categoryEditMode = true; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', true); return; }
                var deleteBtn = e.target.closest('.cat-delete-btn');
                if (deleteBtn) { e.preventDefault(); e.stopPropagation(); var pi = parseInt(deleteBtn.dataset.catDelete, 10); if (!isNaN(pi)) ns.deleteCategoryByIndex(pi); return; }
                var btn = e.target.closest('.cat-btn');
                if (!btn) return;
                e.preventDefault(); e.stopPropagation();
                if (state.preventNextCategoryClick) { state.preventNextCategoryClick = false; return; }
                var pageIdx = parseInt(btn.dataset.page, 10);
                if (!isNaN(pageIdx) && pageIdx !== state.currentPage) ns.changePageWithAnimation(pageIdx);
            });
            dom.catRow.addEventListener('mousedown', function (e) {
                var btn = e.target.closest('.cat-btn');
                if (!btn || e.target.closest('.cat-delete-btn') || e.button !== 0) return;
                ns.prepareCategoryPointer(btn, e.clientX, e.clientY);
                document.addEventListener('mousemove', ns.doCategoryDrag);
                document.addEventListener('mouseup', ns.stopCategoryDrag);
            });
        }
    }

    /* ===== 笔记本下拉菜单事件 ===== */
    function _bindNotebookEvents() {
        if (dom.wbNotebookDropdownBtn) {
            // 点击下拉按钮 → 展开/收起菜单
            dom.wbNotebookDropdownBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var menu = dom.wbNotebookDropdownMenu;
                if (!menu) return;
                var isOpen = menu.style.display === 'block';
                if (isOpen) {
                    menu.style.display = 'none';
                } else {
                    ns.renderNotebookDropdown();
                    var btnRect = dom.wbNotebookDropdownBtn.getBoundingClientRect();
                    menu.style.position = 'fixed';
                    menu.style.top = (btnRect.bottom + 4) + 'px';
                    menu.style.left = btnRect.left + 'px';
                    menu.style.zIndex = '3100';
                    menu.style.display = 'block';
                }
                console.log('[交互] 笔记本下拉 ' + (isOpen ? '关闭' : '打开'));
            });
            // 菜单项点击 → 切换笔记本 + 长按菜单
            if (dom.wbNotebookDropdownMenu) {
                dom.wbNotebookDropdownMenu.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var item = e.target.closest('.wb-notebook-dropdown-item');
                    if (!item) return;
                    var notebookId = item.dataset.notebookId || null;
                    state._notebookFilter = notebookId;
                    if (notebookId) state._lastNotebookId = notebookId;
                    // 持久化
                    ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG).then(function (config) {
                        config.lastNotebookId = notebookId;
                        ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                    });
                    ns.renderNotebookDropdown();
                    dom.wbNotebookDropdownMenu.style.display = 'none';
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                    // 如果当前编辑的笔记不属于新笔记本，关闭编辑器
                    if (notebookId && state.currentNote && state.currentNote.notebookId !== notebookId) {
                        ns.closeNoteEditor();
                        console.log('[交互] 笔记本筛选 关闭编辑器（笔记不在本笔记本）');
                    }
                    console.log('[交互] 笔记本筛选 ' + (notebookId || '全部'));
                });
                // 长按 → 重命名/删除
                var nbMenuLongPress = null;
                dom.wbNotebookDropdownMenu.addEventListener('pointerdown', function (e) {
                    var item = e.target.closest('.wb-notebook-dropdown-item:not([data-notebook-id=""])');
                    if (!item) return;
                    nbMenuLongPress = setTimeout(function () {
                        var nbId = item.dataset.notebookId;
                        var nb = state.notebooks.find(function (n) { return n.id === nbId; });
                        if (!nb) return;
                        dom.wbNotebookDropdownMenu.style.display = 'none';
                        // 弹出操作菜单
                        var ctxMenu = document.getElementById('wbNotebookCtxMenu');
                        if (!ctxMenu) {
                            ctxMenu = document.createElement('div');
                            ctxMenu.id = 'wbNotebookCtxMenu';
                            ctxMenu.style.cssText = 'position:fixed;background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:8px;padding:4px;z-index:3100;box-shadow:var(--shadow-lg);min-width:140px;';
                            document.body.appendChild(ctxMenu);
                        }
                        ctxMenu.innerHTML = [
                            { label: '✏️ 重命名', action: function () {
                                var overlay = document.createElement('div');
                                overlay.style.cssText = 'position:fixed;inset:0;z-index:2900;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
                                var dialog = document.createElement('div');
                                dialog.style.cssText = 'background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:20px;padding:20px;width:min(90vw,380px);box-shadow:var(--shadow-lg);';
                                var title = document.createElement('h3');
                                title.textContent = '重命名笔记本';
                                title.style.cssText = 'font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 8px;';
                                var input = document.createElement('input');
                                input.type = 'text'; input.value = nb.name;
                                input.style.cssText = 'width:100%;padding:10px 14px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-input-bg);color:var(--color-text);font-size:14px;font-family:var(--font-sans);outline:none;margin:8px 0 12px;box-sizing:border-box;';
                                var footer = document.createElement('div');
                                footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding-top:12px;border-top:1px solid var(--color-border);';
                                [['取消', false], ['确定', true]].forEach(function (cfg) {
                                    var btn = document.createElement('button');
                                    btn.textContent = cfg[0];
                                    btn.style.cssText = cfg[1]
                                        ? 'padding:8px 16px;border:none;border-radius:10px;background:var(--color-accent);color:var(--color-text-inverse);font-size:13px;cursor:pointer;'
                                        : 'padding:8px 16px;border:1px solid var(--color-border);border-radius:10px;background:transparent;color:var(--color-text);font-size:13px;cursor:pointer;';
                                    btn.addEventListener('click', function () {
                                        document.body.removeChild(overlay);
                                        if (cfg[1] && input.value.trim() && input.value.trim() !== nb.name) {
                                            ns.renameNotebook(nbId, input.value.trim());
                                            ns.renderNotebookDropdown();
                                        }
                                    });
                                    footer.appendChild(btn);
                                });
                                input.addEventListener('keydown', function (ev) {
                                    if (ev.key === 'Enter') { footer.querySelectorAll('button')[1].click(); }
                                    if (ev.key === 'Escape') { footer.querySelectorAll('button')[0].click(); }
                                });
                                overlay.addEventListener('click', function (ev) {
                                    if (ev.target === overlay) footer.querySelectorAll('button')[0].click();
                                });
                                dialog.appendChild(title); dialog.appendChild(input); dialog.appendChild(footer);
                                overlay.appendChild(dialog);
                                document.body.appendChild(overlay);
                                setTimeout(function () { input.focus(); input.select(); }, 50);
                            }},
                            { label: '🗑️ 删除', action: function () {
                                ns.showConfirm('删除笔记本「' + nb.name + '」，笔记将移回未分类。确定？', { title: '删除笔记本' }).then(function (ok) {
                                    if (ok) { ns.deleteNotebook(nbId); ns.renderNotebookDropdown(); }
                                });
                            }}
                        ].map(function (a) {
                            return '<div class="wb-menu-item" style="padding:8px 12px;cursor:pointer;border-radius:4px;font-size:13px;color:var(--color-text);">' + ns.escapeHtml(a.label) + '</div>';
                        }).join('');
                        // 定位菜单
                        var ir = item.getBoundingClientRect();
                        ctxMenu.style.top = (ir.top) + 'px';
                        ctxMenu.style.left = (ir.right + 4) + 'px';
                        ctxMenu.style.display = 'block';
                        // 绑定菜单操作
                        var items = ctxMenu.querySelectorAll('.wb-menu-item');
                        items[0].addEventListener('click', function () { ctxMenu.style.display = 'none'; });
                        items[1].addEventListener('click', function () { ctxMenu.style.display = 'none'; });
                        console.log('[交互] 笔记本长按 ' + nb.name);
                    }, 800);
                });
                dom.wbNotebookDropdownMenu.addEventListener('pointerup', function () {
                    if (nbMenuLongPress) { clearTimeout(nbMenuLongPress); nbMenuLongPress = null; }
                });
            }
        }

        // 点击外部关闭下拉菜单
        document.addEventListener('click', function (e) {
            var nbMenu = dom.wbNotebookDropdownMenu;
            if (nbMenu && nbMenu.style.display === 'block' &&
                !e.target.closest('#wbNotebookDropdown') && !e.target.closest('#wbNotebookCtxMenu')) {
                nbMenu.style.display = 'none';
            }
            var ctxMenu = document.getElementById('wbNotebookCtxMenu');
            if (ctxMenu && ctxMenu.style.display === 'block' && !e.target.closest('#wbNotebookCtxMenu')) {
                ctxMenu.style.display = 'none';
            }
        });
    }

    /* ===== 工具栏操作按钮 ===== */
    function _bindToolbarEvents() {
        if (dom.devhomeBackHome) dom.devhomeBackHome.addEventListener('click', ns.showDailyMode);

        // 清空历史按钮
        var taskClearBtn = document.getElementById('wbTaskClearBtn');
        if (taskClearBtn) taskClearBtn.addEventListener('click', function () { ns.clearCompletedTasks(); });

        // 活跃/全部切换
        var taskFilterBtn = document.getElementById('wbTaskFilterBtn');
        if (taskFilterBtn) taskFilterBtn.addEventListener('click', function () {
            ns.toggleQuadrantFilter();
            console.log('[交互] 过滤切换 ' + (state._quadrantFilter || 'active'));
        });

        // 侧边栏折叠/展开按钮
        var quadToggleBtn = document.getElementById('wbQuadrantToggle');
        if (quadToggleBtn) quadToggleBtn.addEventListener('click', function () { ns.toggleQuadrantSidebar(); });

        var rightbarToggleBtn = document.getElementById('wbRightbarToggle');
        if (rightbarToggleBtn) rightbarToggleBtn.addEventListener('click', function () { ns.toggleRightSidebar(); });

        // 新建笔记
        var wbNotesAddBtn = document.getElementById('wbNotesAddBtn');
        if (wbNotesAddBtn) {
            wbNotesAddBtn.addEventListener('click', function () {
                ns.createNote({ title: '新笔记', content: '', type: 'note', tags: [] }).then(function (note) {
                    ns.openNoteEditor(note);
                    ns.renderNotesList(state._notesFilter, state._notesSearch);
                    console.log('[交互] 工具栏 新建笔记');
                });
            });
        }

        // 新建笔记本
        var wbNotebookAddBtn = document.getElementById('wbNotebookAddBtn');
        if (wbNotebookAddBtn) {
            if (wbNotebookAddBtn._nbEventBound) { console.log('[诊断] 新建笔记本按钮已绑定，跳过'); }
            wbNotebookAddBtn._nbEventBound = true;
            wbNotebookAddBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                console.log('[交互] 工具栏 新建笔记本 (click count check)');
                if (document.getElementById('nbPlainPrompt')) return;
                var overlay = document.createElement('div');
                overlay.id = 'nbPlainPrompt';
                overlay.style.cssText = 'position:fixed;inset:0;z-index:2900;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
                var dialog = document.createElement('div');
                dialog.style.cssText = 'background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:20px;padding:20px;width:min(90vw,380px);box-shadow:var(--shadow-lg);';
                var title = document.createElement('h3');
                title.textContent = '新建笔记本';
                title.style.cssText = 'font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 8px;';
                var input = document.createElement('input');
                input.type = 'text';
                input.placeholder = '请输入笔记本名称';
                input.style.cssText = 'width:100%;padding:10px 14px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-input-bg);color:var(--color-text);font-size:14px;font-family:var(--font-sans);outline:none;margin:8px 0 12px;box-sizing:border-box;';
                var footer = document.createElement('div');
                footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding-top:12px;border-top:1px solid var(--color-border);';
                [['取消', 'outline'], ['确定', 'default']].forEach(function (cfg) {
                    var btn = document.createElement('button');
                    btn.textContent = cfg[0];
                    btn.style.cssText = cfg[1] === 'default'
                        ? 'padding:8px 16px;border:none;border-radius:10px;background:var(--color-accent);color:var(--color-text-inverse);font-size:13px;cursor:pointer;'
                        : 'padding:8px 16px;border:1px solid var(--color-border);border-radius:10px;background:transparent;color:var(--color-text);font-size:13px;cursor:pointer;';
                    btn.addEventListener('click', function () {
                        document.body.removeChild(overlay);
                        if (cfg[0] === '确定') {
                            var name = input.value.trim();
                            if (name) { ns.createNotebook(name).then(function () { ns.renderNotebookDropdown(); }); }
                        }
                    });
                    footer.appendChild(btn);
                });
                input.addEventListener('keydown', function (ev) {
                    if (ev.key === 'Enter') { footer.querySelectorAll('button')[1].click(); }
                    if (ev.key === 'Escape') { footer.querySelectorAll('button')[0].click(); }
                });
                overlay.addEventListener('click', function (ev) {
                    if (ev.target === overlay) footer.querySelectorAll('button')[0].click();
                });
                dialog.appendChild(title); dialog.appendChild(input); dialog.appendChild(footer);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                setTimeout(function () { input.focus(); input.select(); }, 50);
            });
        }

        // 新建标签
        var wbTagAddBtn = document.getElementById('wbTagAddBtn');
        if (wbTagAddBtn) {
            wbTagAddBtn.addEventListener('click', function () {
                if (typeof ns.startInlineCustomFilter === 'function') {
                    ns.startInlineCustomFilter();
                    console.log('[交互] 工具栏 新建标签');
                }
            });
        }
    }

    /* ===== 四象限任务面板事件 ===== */
    function _bindQuadrantEvents() {
        var quadrantNav = document.getElementById('wbQuadrantNav');
        if (quadrantNav) {
            quadrantNav.addEventListener('click', function (e) {
                var check = e.target.closest('.wb-task-check');
                if (check) {
                    e.stopPropagation();
                    ns.completeQuadrantTask(check.dataset.quadrant, check.dataset.taskId);
                    return;
                }
                var moreBtn = e.target.closest('.wb-task-more-btn');
                if (moreBtn) {
                    e.stopPropagation();
                    ns.showTaskContextMenu(moreBtn.dataset.taskId, moreBtn.dataset.quadrant, e);
                    return;
                }
                var addBtn = e.target.closest('.wb-quadrant-group-add');
                if (addBtn) {
                    e.stopPropagation();
                    ns.showQuadrantInput(addBtn.dataset.quadrant, addBtn);
                    console.log('[交互] 点击象限添加任务 ' + addBtn.dataset.quadrant);
                    return;
                }
            });
        }

        // 浮动菜单操作（在 document 上委托）
        document.addEventListener('click', function (e) {
            var menuItem = e.target.closest('.wb-task-context-menu button');
            if (!menuItem) return;
            e.stopPropagation();
            var action = menuItem.dataset.action;
            var taskId = menuItem.dataset.taskId;
            var quadrant = menuItem.dataset.quadrant;

            if (action === 'move') {
                ns.changeTaskQuadrant(taskId, menuItem.dataset.from, menuItem.dataset.to);
                ns.hideTaskContextMenu();
            } else if (action === 'edit') {
                ns.hideTaskContextMenu();
                ns.editQuadrantTask(taskId, quadrant);
            } else if (action === 'set-time') {
                ns.hideTaskContextMenu();
                ns.setTaskTime(taskId, quadrant);
            } else if (action === 'delete') {
                ns.cancelQuadrantTask(quadrant, taskId);
                ns.hideTaskContextMenu();
            } else if (action === 'link-notes') {
                ns.showTaskLinkNotesPopup(taskId);
                ns.hideTaskContextMenu();
            } else if (action === 'view-linked-notes') {
                ns.showTaskLinkedNotesView(taskId);
                ns.hideTaskContextMenu();
            }
        });
    }

    /* ===== 日历事件 ===== */
    function _bindCalendarEvents() {
        var miniCalPrev = document.getElementById('wbMiniCalPrev');
        var miniCalNext = document.getElementById('wbMiniCalNext');
        if (miniCalPrev) miniCalPrev.addEventListener('click', function () { ns.navigateCalendar(-1); });
        if (miniCalNext) miniCalNext.addEventListener('click', function () { ns.navigateCalendar(1); });

        document.querySelectorAll('.wb-cal-view-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { ns.switchCalendarView(btn.dataset.view); });
        });

        var calPrev = document.getElementById('wbCalendarPrev');
        var calNext = document.getElementById('wbCalendarNext');
        var calToday = document.getElementById('wbCalendarToday');
        if (calPrev) calPrev.addEventListener('click', function () { ns.navigateCalendar(-1); });
        if (calNext) calNext.addEventListener('click', function () { ns.navigateCalendar(1); });
        if (calToday) calToday.addEventListener('click', function () { ns.renderCalendar(new Date()); });
    }

    /* ===== 番茄钟事件 ===== */
    function _bindPomodoroEvents() {
        var pomoSideStart = document.getElementById('wbPomodoroSideStart');
        var pomoSideReset = document.getElementById('wbPomodoroSideReset');
        if (pomoSideStart) {
            pomoSideStart.addEventListener('click', function () {
                if (pomoSideStart.classList.contains('is-running')) {
                    ns.pausePomodoro();
                } else {
                    ns.startPomodoro();
                }
            });
        }
        if (pomoSideReset) pomoSideReset.addEventListener('click', function () { ns.resetPomodoro(); });

        document.querySelectorAll('.wb-pomodoro-mode-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { ns.togglePomodoroMode(btn.dataset.mode); });
        });

        var restInput = document.getElementById('wbPomodoroRestInput');
        if (restInput) restInput.addEventListener('change', function () { ns.setPomodoroRestDuration(this.value); });

        var autoCycleBtn = document.getElementById('wbPomodoroAutoCycleBtn');
        if (autoCycleBtn) autoCycleBtn.addEventListener('click', function () { ns.togglePomodoroAutoCycle(); });

        document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var duration = parseInt(btn.dataset.duration);
                ns.setPomodoroDuration(duration);
            });
        });

        // 旧版番茄钟按钮
        var pomoStart = document.getElementById('wbPomodoroStart');
        var pomoPause = document.getElementById('wbPomodoroPause');
        var pomoReset = document.getElementById('wbPomodoroReset');
        if (pomoStart) pomoStart.addEventListener('click', ns.startPomodoro);
        if (pomoPause) pomoPause.addEventListener('click', ns.pausePomodoro);
        if (pomoReset) pomoReset.addEventListener('click', ns.resetPomodoro);

        var pomoPresets = document.querySelectorAll('.wb-pomodoro-preset');
        pomoPresets.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var duration = parseInt(btn.dataset.duration, 10);
                if (!isNaN(duration)) ns.setPomodoroDuration(duration);
            });
        });

        var pomoCustom = document.getElementById('wbPomodoroCustom');
        if (pomoCustom) {
            pomoCustom.addEventListener('change', function () {
                var val = parseInt(pomoCustom.value, 10);
                if (val > 0 && val <= 180) ns.setPomodoroDuration(val);
            });
        }

        var modeDefault = document.getElementById('wbPomodoroModeDefault');
        var modeFocus = document.getElementById('wbPomodoroModeFocus');
        if (modeDefault) modeDefault.addEventListener('click', function () { ns.setPomodoroMode('default'); });
        if (modeFocus) modeFocus.addEventListener('click', function () { ns.setPomodoroMode('focus'); });

        var restBtns = document.querySelectorAll('.wb-pomodoro-rest-btn');
        restBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var rest = parseInt(btn.dataset.rest, 10);
                if (!isNaN(rest)) {
                    state.pomodoroRestDuration = rest;
                    restBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
                }
            });
        });
    }

    /* ===== 筛选标签事件 ===== */
    function _bindFilterEvents() {
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
                        span.textContent = '×';
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
                    var name = chip.textContent.replace('×', '').trim();
                    ns.showConfirm('将"' + name + '"类型的全部笔记变为未分类，标签本身也会移除。确定继续？', { title: '删除标签' }).then(function (ok) {
                        if (ok) { ns.removeFilter(filter); exitFilterDeleteMode(); }
                    });
                    return;
                }
                if (filterDeleteMode) {
                    var chipClicked = e.target.closest('.wb-filter-chip');
                    if (chipClicked && chipClicked.classList.contains('custom')) {
                        var filterKey = chipClicked.dataset.filter;
                        var oldText = chipClicked.textContent.replace('×', '').trim();
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
    }

    /* ===== 设置面板事件 ===== */
    function _bindSettingsEvents() {
        if (dom.settingsGearBtn) dom.settingsGearBtn.addEventListener('click', ns.openSettingsPanel);
        if (dom.settingsCloseBtn) dom.settingsCloseBtn.addEventListener('click', ns.closeSettingsPanel);
        if (dom.settingsOverlay) dom.settingsOverlay.addEventListener('click', function (e) { if (e.target === dom.settingsOverlay) ns.closeSettingsPanel(); });
        if (dom.changelogBtn) dom.changelogBtn.addEventListener('click', function () { ns.closeSettingsPanel(); ns.openChangelog(); });

        if (dom.settingsPanel) {
            dom.settingsPanel.addEventListener('click', function (e) {
                var navItem = e.target.closest('.s-nav-item');
                if (navItem) { ns.switchSettingsTab(navItem.dataset.sTab); return; }
                var segBtn = e.target.closest('.s-seg-btn');
                if (segBtn) {
                    e.preventDefault();
                    if (segBtn.dataset.shortcutSize) applyShortcutSizeFn(segBtn.dataset.shortcutSize);
                    else if (segBtn.dataset.shortcutColumns) applyShortcutColumnsFn(segBtn.dataset.shortcutColumns);
                    ns.syncSettingsControls();
                    return;
                }
                var schemeCard = e.target.closest('.s-theme-card');
                if (schemeCard && schemeCard.dataset.scheme && ns.theme) {
                    ns.theme.setScheme(schemeCard.dataset.scheme);
                    ns.syncSettingsControls();
                    return;
                }
                var settingBtn = e.target.closest('[data-setting-action]');
                if (settingBtn) { e.preventDefault(); ns.handleSettingsAction(settingBtn.dataset.settingAction); return; }
                var exportFilter = e.target.closest('[data-export-filter]');
                if (exportFilter && typeof ns.setExportFilter === 'function') { ns.setExportFilter(exportFilter.dataset.exportFilter); return; }
                var aiKeyIcon = e.target.closest('#sToggleAiKey');
                if (aiKeyIcon) {
                    var input = document.getElementById('wbMeAiApiKey');
                    if (input) {
                        var isPass = input.type === 'password';
                        input.type = isPass ? 'text' : 'password';
                        aiKeyIcon.textContent = isPass ? '🙈' : '👁';
                    }
                }
            });

            dom.settingsPanel.addEventListener('change', function (e) {
                var cb = e.target;
                if (cb.id === 'remindBeforeSelect') {
                    // 任务通知提前时间选择
                    ns._saveTaskNotifySettings();
                    return;
                }
                if (!cb || cb.type !== 'checkbox') return;
                if (cb.id === 'matrixRainToggle') {
                    var params = document.getElementById('matrixRainParams');
                    if (cb.checked && ns.matrixRain) { ns.matrixRain.start(); if (params) params.style.display = ''; }
                    else { if (ns.matrixRain) ns.matrixRain.stop(); if (params) params.style.display = 'none'; }
                    return;
                }
                if (cb.closest('#sToggleAutoFocus')) { ns.handleSettingsAction('toggleAutoFocus'); return; }
                if (cb.closest('#sToggleCategoryMemory')) { ns.handleSettingsAction('toggleCategoryMemory'); return; }
                var toggleStrict = cb.closest('#sToggleStrict');
                if (toggleStrict) { ns._saveStrictMode(cb.checked); return; }
                var toggleFileSync = cb.closest('#sToggleFileSync');
                if (toggleFileSync) { ns._saveFileSync(cb.checked); return; }
                // 任务到期通知开关
                if (cb.id === 'taskNotifyToggle') {
                    ns._saveTaskNotifySettings();
                    return;
                }
            });
        }

        var shortcutCapture = document.getElementById('sShortcutCapture');
        if (shortcutCapture) {
            var _scKeys = [];
            shortcutCapture.addEventListener('keydown', function (e) {
                e.preventDefault();
                var parts = [];
                if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
                if (e.shiftKey) parts.push('Shift');
                if (e.altKey) parts.push('Alt');
                if (e.key && e.key.length === 1 && !['Control','Shift','Alt','Meta'].includes(e.key)) parts.push(e.key.toUpperCase());
                if (parts.length > 0) {
                    _scKeys = parts;
                    var display = document.getElementById('sShortcutKeys');
                    if (display) display.textContent = parts.join(' + ');
                    shortcutCapture.classList.add('recording');
                }
            });
            shortcutCapture.addEventListener('blur', function () {
                shortcutCapture.classList.remove('recording');
                if (_scKeys.length > 0) {
                    var ctrlEl = document.getElementById('wbMeShortcutCtrl');
                    var shiftEl = document.getElementById('wbMeShortcutShift');
                    var altEl = document.getElementById('wbMeShortcutAlt');
                    var keyEl = document.getElementById('wbMeShortcutKey');
                    if (ctrlEl) ctrlEl.value = _scKeys.includes('Ctrl') ? '1' : '0';
                    if (shiftEl) shiftEl.value = _scKeys.includes('Shift') ? '1' : '0';
                    if (altEl) altEl.value = _scKeys.includes('Alt') ? '1' : '0';
                    if (keyEl) keyEl.value = (_scKeys.filter(function(k){return k.length===1;})[0] || 'K').toLowerCase();
                }
            });
            shortcutCapture.addEventListener('click', function () { shortcutCapture.focus(); });
        }

        var shortcutSave = document.getElementById('wbMeShortcutSave');
        if (shortcutSave) shortcutSave.addEventListener('click', function () { ns._saveShortcut(); });

        // AI 事件
        if (dom.wbAiProviderList) {
            dom.wbAiProviderList.addEventListener('click', function (e) {
                var item = e.target.closest('.ai-provider-item');
                if (!item) return;
                var delBtn = e.target.closest('.ai-provider-del-btn');
                if (delBtn) { e.stopPropagation(); ns.deleteAiProvider(item.dataset.providerId); return; }
                ns.selectAiProvider(item.dataset.providerId);
            });
        }
        if (dom.wbAiAddProvider) dom.wbAiAddProvider.addEventListener('click', function () { ns.addAiProvider(); });

        var aiSaveKey = document.getElementById('wbMeAiSaveKey');
        if (aiSaveKey) aiSaveKey.addEventListener('click', function () { ns.saveAiProviderConfig(); });

        var aiGenerate = document.getElementById('wbMeAiGenerate');
        if (aiGenerate) aiGenerate.addEventListener('click', function () { ns.generateAISummary(); });

        var aiQuickChat = document.getElementById('wbMeAiQuickChat');
        if (aiQuickChat) aiQuickChat.addEventListener('click', function () { if (ns.aiChat) ns.aiChat.open(); });

        var aiSaveNote = document.getElementById('wbMeAiSaveNote');
        if (aiSaveNote) {
            aiSaveNote.addEventListener('click', function () {
                if (!dom.wbMeAiContent) return;
                var content = dom.wbMeAiContent.textContent || dom.wbMeAiContent.innerText || '';
                var title = 'AI 每日总结 - ' + new Date().toLocaleDateString('zh-CN');
                ns.createNote({ title: title, content: content, type: 'note', tags: ['AI总结'] }).then(function () {
                    ns.showToast('AI 总结已保存为笔记', 'success');
                });
            });
        }

        var exportFilters = document.querySelectorAll('#wbSettingsExportFilters [data-export-filter]');
        exportFilters.forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.exportFilter = btn.dataset.exportFilter;
                exportFilters.forEach(function (b) { b.classList.toggle('active', b === btn); });
                ns.renderExportList(state.exportFilter);
            });
        });

        var selectAllBtn = document.getElementById('wbMeSelectAll');
        if (selectAllBtn) selectAllBtn.addEventListener('click', ns.toggleSelectAllExport);
        var exportBtn = document.getElementById('wbMeExportSelected');
        if (exportBtn) exportBtn.addEventListener('click', ns.exportSelected);

        if (dom.wbMeToggleStrict) {
            dom.wbMeToggleStrict.addEventListener('change', async function () {
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.behavior.strictMode = dom.wbMeToggleStrict.checked;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
            });
        }
        if (dom.wbMeToggleFileSync) {
            dom.wbMeToggleFileSync.addEventListener('change', async function () {
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.fileSync.enabled = dom.wbMeToggleFileSync.checked;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast(
                    config.fileSync.enabled ? '文件自动同步已开启' : '文件自动同步已关闭', 'success'
                );
            });
        }
        if (dom.wbMeShortcutSave) {
            dom.wbMeShortcutSave.addEventListener('click', async function () {
                var sc = {
                    ctrl: dom.wbMeShortcutCtrl ? dom.wbMeShortcutCtrl.checked : true,
                    shift: dom.wbMeShortcutShift ? dom.wbMeShortcutShift.checked : false,
                    alt: dom.wbMeShortcutAlt ? dom.wbMeShortcutAlt.checked : false,
                    key: dom.wbMeShortcutKey ? dom.wbMeShortcutKey.value.trim().toLowerCase() : 'k'
                };
                if (!sc.key) { ns.showToast('请输入快捷键字母', 'error'); return; }
                state._focusShortcut = sc;
                var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
                config.focusShortcut = sc;
                await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
                ns.updateContextMenuLabel();
                ns.fileConfig && ns.fileConfig.showToast && ns.fileConfig.showToast('快捷键已保存', 'success');
            });
        }

        function applyShortcutSizeFn(size) { ns.applyShortcutSize(size); }
        function applyShortcutColumnsFn(cols) { ns.applyShortcutColumns(cols); }
    }

    /* ===== 搜索事件 ===== */
    function _bindSearchEvents() {
        dom.engineSelector.addEventListener('click', function (e) { e.stopPropagation(); ns.toggleEngineDropdown(); });
        dom.engineDropdown.addEventListener('click', function (e) { var opt = e.target.closest('.engine-option'); if (opt) { ns.setEngine(opt.dataset.engine); ns.hideEngineDropdown(); } });

        dom.searchButton.addEventListener('click', ns.doSearch);
        dom.searchInput.addEventListener('keydown', ns.handleSearchKeydown);
        dom.searchInput.addEventListener('input', ns.handleSearchInput);
        dom.searchInput.addEventListener('focus', ns.handleSearchFocus);
        dom.searchInput.addEventListener('blur', ns.handleSearchBlur);
    }

    /* ===== 全局事件（键盘、右键、文档） ===== */
    function _bindGlobalEvents() {
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.search-engine-selector') && !e.target.closest('.engine-dropdown')) ns.hideEngineDropdown();
            if (state.tileEditMode && !e.target.closest('.tile') && !e.target.closest('.tile-delete-btn')) ns.setTileEditMode(false);
            if (state.categoryEditMode && !e.target.closest('.cat-row')) { state.categoryEditMode = false; if (dom.catRow) dom.catRow.classList.toggle('category-edit-mode', false); }
            if (!e.target.closest('.search-container')) ns.hideSuggestions();
        });

        document.addEventListener('mouseup', clearLongPressTimer);
        document.addEventListener('mouseup', clearCatLongPressTimer);
        document.addEventListener('touchend', clearLongPressTimer);
        document.addEventListener('touchend', clearCatLongPressTimer);
        function clearLongPressTimer() { if (state.dragLongPressTimer) { clearTimeout(state.dragLongPressTimer); state.dragLongPressTimer = null; } }
        function clearCatLongPressTimer() { if (state.categoryLongPressTimer) { clearTimeout(state.categoryLongPressTimer); state.categoryLongPressTimer = null; } }

        document.addEventListener('keydown', function (e) {
            if (e.key === '/' && document.activeElement !== dom.searchInput) { e.preventDefault(); dom.searchInput.focus(); }
            if (state.currentDevhomeMode === 'workbench' && (e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                return;
            }
            if (e.key === 'Escape') {
                var isFocusMode = state.currentDevhomeMode !== 'daily';
                var hasEngineDropdown = dom.engineDropdown && dom.engineDropdown.classList.contains('visible');
                var hasSuggestions = state.suggestionsVisible;
                var isSearchFocused = document.activeElement === dom.searchInput;
                var hasSettingsOpen = dom.settingsOverlay && dom.settingsOverlay.classList.contains('visible');
                if (isFocusMode || hasEngineDropdown || hasSuggestions || isSearchFocused || hasSettingsOpen) e.preventDefault();
                if (isFocusMode) ns.exitFocusMode();
                ns.hideEngineDropdown(); ns.hideSuggestions(); ns.closeSettingsPanel();
                if (isSearchFocused) dom.searchInput.blur();
            }
            if (ns.isFocusModeShortcut(e)) { e.preventDefault(); ns.toggleFocusMode(); }
            if (e.ctrlKey && e.key === 'i' && !e.shiftKey && !e.altKey && !e.metaKey) {
                if (!isEditing) { e.preventDefault(); if (ns.aiChat) ns.aiChat.open(); }
            }
            var activeEl = document.activeElement;
            var isEditing = activeEl === dom.wbNoteTitle
                || activeEl === dom.wbNoteContent
                || activeEl === dom.wbNotesSearch
                || activeEl === dom.wbCaptureInput
                || activeEl === dom.wbMeAiApiKey
                || activeEl === dom.wbMeAiEndpoint
                || activeEl === dom.wbMeAiModel
                || activeEl === dom.wbMeShortcutKey
                || (activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT'));
            if (!isEditing && activeEl !== dom.searchInput) {
                var num = parseInt(e.key), engineKeys = Object.keys(engines);
                if (num >= 1 && num <= engineKeys.length) { e.preventDefault(); ns.setEngine(engineKeys[num - 1]); dom.searchInput.focus(); }
            }
            if (e.altKey && e.key >= '1' && e.key <= '5') {
                e.preventDefault(); var num2 = parseInt(e.key), ek2 = Object.keys(engines);
                if (num2 >= 1 && num2 <= ek2.length) { ns.setEngine(ek2[num2 - 1]); dom.searchInput.focus(); }
            }
            // F4 视图缩放快捷键 Ctrl+Plus / Ctrl+Minus
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === '-')) {
                if (!isEditing && activeEl !== dom.searchInput) {
                    e.preventDefault();
                    var currentScale = parseFloat(localStorage.getItem('tabpage_view_scale') || '1.0');
                    var newScale = e.key === '-' ? currentScale - 0.05 : currentScale + 0.05;
                    newScale = Math.max(0.6, Math.min(1.5, Math.round(newScale * 100) / 100));
                    document.documentElement.style.setProperty('--view-scale', newScale);
                    localStorage.setItem('tabpage_view_scale', newScale);
                    console.log('[设置] 视图缩放 Ctrl+' + (e.key === '-' ? '-' : '+') + ' ' + newScale.toFixed(2));
                }
            }
        });

        // 右键菜单 (磁贴)
        dom.contextMenu.addEventListener('click', function (e) {
            if (e.target.closest('.ctx-has-submenu')) return;
            var item = e.target.closest('.context-menu-item');
            if (item && item.dataset.action) ns.handleContextMenuAction(item.dataset.action);
        });

        // 分类子菜单事件
        var ctxSubMenu = document.getElementById('ctxCategorySubMenu');
        if (ctxSubMenu) {
            ctxSubMenu.addEventListener('mouseenter', function () {
                if (ns.cancelSubMenuTimer) ns.cancelSubMenuTimer();
                clearTimeout(ctxSubMenu._hideTimer);
            });
            ctxSubMenu.addEventListener('mouseleave', function () {
                ctxSubMenu._hideTimer = setTimeout(function () { ctxSubMenu.classList.remove('visible'); }, 200);
            });
            ctxSubMenu.addEventListener('click', function (e) {
                var item = e.target.closest('.context-menu-item');
                if (!item) return;
                var pageIdx = parseInt(item.dataset.page, 10);
                if (!isNaN(pageIdx)) ns.handleSubMenuClick(pageIdx);
            });
        }

        document.addEventListener('contextmenu', function (e) {
            if (e.target.closest('.tile')) { e.preventDefault(); }
            else if (dom.wbNoteContent && dom.wbNoteContent.contains(e.target) && state.currentDevhomeMode === 'workbench') {
                var sel = window.getSelection();
                if (sel.rangeCount && dom.wbNoteContent.contains(sel.anchorNode)) {
                    state._savedSelection = sel.getRangeAt(0).cloneRange();
                }
                e.preventDefault();
                ns.showEditorContextMenu(e);
            }
            else if (!e.target.closest('.search-container') && !e.target.closest('.engine-selector') && !e.target.closest('.engine-dropdown') && !e.target.closest('.modal')) {
                e.preventDefault(); ns.showBlankContextMenu(e);
            }
        });
    }

    /* ===== 其他事件（磁贴、捕获、笔记、编辑器、文件配置等） ===== */
    function _bindMiscEvents() {
        // 磁贴滚轮翻页
        dom.tilesContainer.addEventListener('wheel', ns.handleWheelScroll, { passive: false });
        dom.tilesContainer.addEventListener('click', ns.handleTileDeleteClick);
        dom.tilesContainer.addEventListener('keydown', ns.handleTileDeleteKeydown);

        // 空白区域右键菜单
        dom.blankContextMenu.addEventListener('click', function (e) { var item = e.target.closest('.context-menu-item'); if (item && item.dataset.action) ns.handleBlankMenuAction(item.dataset.action); });

        // 编辑器右键菜单
        var editorMenu = document.getElementById('editorContextMenu');
        if (editorMenu) {
            editorMenu.addEventListener('mousedown', function (e) {
                var item = e.target.closest('.context-menu-item');
                if (!item || !item.dataset.editorAction) return;
                e.preventDefault();
                var action = item.dataset.editorAction;
                if (action === 'copy') document.execCommand('copy');
                else if (action === 'paste') document.execCommand('paste');
                var em = document.getElementById('editorContextMenu');
                if (em) em.classList.remove('visible');
            });
        }

        // 背景上传
        dom.bgInput.addEventListener('change', function (e) {
            var file = e.target.files[0]; if (!file) return;
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) ns.bgManager.upload(file);
            else ns.showToast('请选择图片或视频文件', 'error');
            dom.bgInput.value = '';
        });

        // Matrix 数字雨参数
        _bindMatrixParams();

        // 数据导入
        if (dom.importInput) {
            dom.importInput.addEventListener('change', function (e) {
                var file = e.target.files[0]; if (!file) return;
                var reader = new FileReader();
                reader.onload = async function (event) {
                    try {
                        var data = JSON.parse(event.target.result);
                        if (data && data.pages && Array.isArray(data.pages)) {
                            var importOk = await ns.showConfirm('导入备份将覆盖当前所有的磁贴和页面配置，确定继续吗？', { title: '导入备份' });
                            if (importOk) {
                                storage.set('pages', data.pages);
                                storage.set('page_names', data.pageNames || ['第1页']);
                                if (data.devhome) ns.devhomeStorage.set('workbench', data.devhome);
                                await ns.tileManager.load();
                                ns.renderTiles(); ns.refreshCatRowIfVisible();
                                ns.showToast('备份导入成功！', 'success');
                            }
                        } else ns.showToast('无效的备份文件格式！', 'error');
                    } catch (err) { ns.showToast('读取文件失败，请确保选择的是有效的 JSON 配置文件！', 'error'); }
                    dom.importInput.value = '';
                };
                reader.readAsText(file);
            });
        }

        // 文件配置目录选择
        if (dom.configSelectDirBtn) {
            dom.configSelectDirBtn.addEventListener('click', async function () {
                if (!ns.fileConfig) return;
                if (ns.fileConfig._tryRecoverRead && typeof ns.fileConfig._tryRecoverRead === 'function') {
                    var readOk = await ns.fileConfig._tryRecoverRead();
                    if (readOk) {
                        ns.fileConfig.hideWarningBar();
                        ns.fileConfig.updateBadge('', '#ffcc66');
                        try { await ns.fileConfig.syncToFile(); } catch (_) {}
                        ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
                        ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
                        ns.openFaviconDB();
                        await ns.tileManager.load();
                        ns.loadSearchHistory();
                        ns.renderTiles();
                        ns.refreshCatRowIfVisible();
                        ns.syncSettingsControls();
                        return;
                    }
                }
                if (ns.fileConfig._tryRecoverWrite && typeof ns.fileConfig._tryRecoverWrite === 'function') {
                    var recovered = await ns.fileConfig._tryRecoverWrite();
                    if (recovered) {
                        ns.fileConfig.hideWarningBar();
                        ns.fileConfig.updateBadge('', '#e74c3c');
                        try { await ns.fileConfig.syncToFile(); } catch (_) {}
                        ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
                        ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
                        ns.openFaviconDB();
                        await ns.tileManager.load();
                        ns.loadSearchHistory();
                        ns.renderTiles();
                        ns.refreshCatRowIfVisible();
                        ns.syncSettingsControls();
                        return;
                    }
                }
                var success = await ns.fileConfig.pickDir();
                if (success) {
                    state.configReady = true;
                    ns.fileConfig.hideWarningBar();
                    ns.fileConfig.updateBadge('', '#e74c3c');
                    ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
                    ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
                    ns.openFaviconDB();
                    await ns.tileManager.load();
                    ns.loadSearchHistory();
                    ns.renderTiles();
                    ns.refreshCatRowIfVisible();
                    ns.syncSettingsControls();
                    ns.bindEvents();
                }
            });
        }

        // v2 快速捕获
        if (dom.wbCaptureInput) {
            dom.wbCaptureInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var val = dom.wbCaptureInput.value.trim();
                    if (!val) return;
                    ns.addCapture(val).then(function () {
                        ns.renderCaptures();
                        dom.wbCaptureInput.value = '';
                    });
                }
            });
        }

        // v2 笔记面板事件
        if (dom.wbNotesList) {
            dom.wbNotesList.addEventListener('click', function (e) {
                var delBtn = e.target.closest('.wb-note-list-del');
                if (delBtn) {
                    e.stopPropagation();
                    var delId = delBtn.dataset.delId;
                    var delKind = delBtn.dataset.delKind;
                    var item = delKind === 'capture'
                        ? (state.captures.find(function(c){return c.id===delId;}) || null)
                        : (state.notes.find(function(n){return n.id===delId;}) || null);
                    if (!item) return;
                    ns.deleteWithUndo(item, delKind);
                }
                var item = e.target.closest('.wb-note-list-item');
                if (!item) return;
                var noteId = item.dataset.noteId;
                var kind = item.dataset.kind;
                var target;
                if (kind === 'capture') {
                    target = state.captures.find(function (c) { return c.id === noteId; });
                    if (target) target = Object.assign({ _kind: 'capture' }, target);
                } else {
                    target = state.notes.find(function (n) { return n.id === noteId; });
                }
                if (target) ns.openNoteEditor(target);
            });
        }
        if (dom.wbNotesSearch) {
            dom.wbNotesSearch.addEventListener('input', function () {
                state._notesSearch = dom.wbNotesSearch.value;
                ns.renderNotesList(state._notesFilter, state._notesSearch);
            });
        }

        // 笔记转任务按钮
        _bindNoteToTaskEvents();

        // 笔记本徽章点击
        _bindNotebookBadgeEvents();

        // 类型徽章点击
        _bindTypeBadgeEvents();

        // 笔记自动保存
        var noteAutoSaveTimer = null;
        ns._triggerAutoSave = function () {
            if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
            noteAutoSaveTimer = setTimeout(function () {
                if (state.currentNote) {
                    ns.saveCurrentNote().then(function () {
                        ns.renderNotesList(state._notesFilter, state._notesSearch);
                    });
                }
            }, 400);
        };
        if (dom.wbNoteTitle) dom.wbNoteTitle.addEventListener('input', function () {
            if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
            noteAutoSaveTimer = setTimeout(function () {
                if (state.currentNote) {
                    ns.saveCurrentNote().then(function () {
                        ns.renderNotesList(state._notesFilter, state._notesSearch);
                    });
                }
            }, 800);
        });
    }

    /* ===== 笔记转任务按钮事件 ===== */
    function _bindNoteToTaskEvents() {
        var noteToTaskBtn = document.getElementById('wbNoteToTaskBtn');
        var quadrantPicker = document.getElementById('wbQuadrantPicker');
        if (!noteToTaskBtn || !quadrantPicker) return;

        noteToTaskBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!state.currentNote) return;
            var isVisible = quadrantPicker.style.display === 'block';
            quadrantPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                var btnRect = noteToTaskBtn.getBoundingClientRect();
                quadrantPicker.style.position = 'fixed';
                quadrantPicker.style.top = (btnRect.bottom + 4) + 'px';
                quadrantPicker.style.left = btnRect.left + 'px';
                quadrantPicker.style.zIndex = '3100';
            }
        });

        quadrantPicker.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn || !btn.dataset.quadrant) return;
            e.stopPropagation();
            var quadrant = btn.dataset.quadrant;
            quadrantPicker.style.display = 'none';
            var timePicker = document.getElementById('wbTaskTimePicker');
            if (timePicker) {
                var btnRect = noteToTaskBtn.getBoundingClientRect();
                timePicker.style.position = 'fixed';
                timePicker.style.top = (btnRect.bottom + 4) + 'px';
                timePicker.style.left = btnRect.left + 'px';
                timePicker.style.zIndex = '3100';
                timePicker.style.display = 'block';
                timePicker._quadrant = quadrant;
                var dateInput = document.getElementById('wbTaskTimeDate');
                var timeInput = document.getElementById('wbTaskTimeTime');
                if (dateInput) dateInput.value = '';
                if (timeInput) timeInput.value = '';
                if (dateInput) setTimeout(function () { dateInput.focus(); }, 50);
            }
        });

        var confirmBtn = document.getElementById('wbTimePickerConfirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                var timePicker = document.getElementById('wbTaskTimePicker');
                var quadrant = timePicker && timePicker._quadrant;
                if (!quadrant || !state.currentNote) return;
                var plannedAt = ns._readTimePickerValue('wbTaskTimeDate', 'wbTaskTimeTime');
                ns.convertNoteToTask(state.currentNote.id, quadrant, plannedAt);
                if (timePicker) timePicker.style.display = 'none';
                ns.showToast('已转至' + ({ q1:'重要且紧急',q2:'重要不紧急',q3:'紧急不重要',q4:'不紧急不重要' })[quadrant] + '象限', 'success');
            });
        }

        var skipBtn = document.getElementById('wbTimePickerSkip');
        if (skipBtn) {
            skipBtn.addEventListener('click', function () {
                var timePicker = document.getElementById('wbTaskTimePicker');
                var quadrant = timePicker && timePicker._quadrant;
                if (!quadrant || !state.currentNote) return;
                ns.convertNoteToTask(state.currentNote.id, quadrant, null);
                if (timePicker) timePicker.style.display = 'none';
                ns.showToast('已转至' + ({ q1:'重要且紧急',q2:'重要不紧急',q3:'紧急不重要',q4:'不紧急不重要' })[quadrant] + '象限', 'success');
            });
        }

        ns._readTimePickerValue = function (dateId, timeId) {
            var dateEl = document.getElementById(dateId);
            var timeEl = document.getElementById(timeId);
            if (!dateEl || !dateEl.value) return null;
            var dateStr = dateEl.value;
            var timeStr = timeEl && timeEl.value ? timeEl.value : '23:59';
            var dt = new Date(dateStr + 'T' + timeStr + ':00');
            if (isNaN(dt.getTime())) return null;
            return dt.getTime();
        };

        document.addEventListener('click', function hidePicker(e) {
            var pickerVisible = quadrantPicker.style.display === 'block';
            var timePicker = document.getElementById('wbTaskTimePicker');
            var timePickerVisible = timePicker && timePicker.style.display === 'block';
            if (!pickerVisible && !timePickerVisible) return;
            if (!e.target.closest('#wbNoteToTaskWrap')) {
                quadrantPicker.style.display = 'none';
                if (timePicker) timePicker.style.display = 'none';
            }
        });
    }

    /* ===== 笔记本徽章事件 ===== */
    function _bindNotebookBadgeEvents() {
        var notebookBadge = document.getElementById('wbNotebookBadge');
        if (!notebookBadge) return;
        notebookBadge.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (!state.currentNote) return;
            var options = [{ id: '', label: '未分类' }];
            state.notebooks.forEach(function (nb) { options.push({ id: nb.id, label: nb.name }); });
            var html = '<div style="max-height:300px;overflow-y:auto;">';
            options.forEach(function (opt) {
                var isCurrent = (state.currentNote.notebookId || '') === opt.id;
                html += '<div class="wb-notebook-pick-item' + (isCurrent ? ' active' : '') + '" data-nb-id="' + opt.id + '" style="padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;' + (isCurrent ? 'background:var(--color-accent);color:var(--color-text-inverse);' : '') + '">' + (opt.id ? '📓 ' : '📂 ') + ns.escapeHtml(opt.label) + '</div>';
            });
            html += '</div>';
            var pop = document.getElementById('wbNotebookPickPop');
            if (!pop) {
                pop = document.createElement('div');
                pop.id = 'wbNotebookPickPop';
                pop.style.cssText = 'position:fixed;background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:12px;padding:8px;z-index:3100;box-shadow:var(--shadow-lg);min-width:180px;';
                document.body.appendChild(pop);
            }
            pop.innerHTML = html;
            var badgeRect = notebookBadge.getBoundingClientRect();
            pop.style.top = (badgeRect.bottom + 4) + 'px';
            pop.style.left = badgeRect.left + 'px';
            pop.style.display = 'block';
            pop.onclick = function (ev) {
                var item = ev.target.closest('.wb-notebook-pick-item');
                if (!item) return;
                var nbId = item.dataset.nbId || null;
                state.currentNote.notebookId = nbId || null;
                ns.renderNotebookBadge();
                ns._triggerAutoSave();
                pop.style.display = 'none';
            };
            setTimeout(function () {
                document.addEventListener('click', function hidePop(ev) {
                    if (!pop.contains(ev.target) && ev.target !== notebookBadge) {
                        pop.style.display = 'none';
                        document.removeEventListener('click', hidePop);
                    }
                });
            }, 0);
        });
    }

    /* ===== 类型徽章事件 ===== */
    function _bindTypeBadgeEvents() {
        if (dom.wbNoteTypeBadge) {
            dom.wbNoteTypeBadge.addEventListener('click', function (e) {
                var delChip = e.target.closest('.wb-type-chip-del');
                if (delChip) {
                    e.preventDefault(); e.stopPropagation();
                    var typeKey = delChip.dataset.type;
                    if (typeKey) ns.removeNoteType(typeKey);
                    return;
                }
                if (e.target.closest('.badge-add')) {
                    e.preventDefault(); e.stopPropagation();
                    ns.toggleTypePicker();
                    return;
                }
                e.preventDefault(); e.stopPropagation();
                ns.toggleTypePicker();
            });
        }
        var typePicker = document.getElementById('wbTypePickerList');
        if (typePicker) {
            typePicker.addEventListener('click', function (e) {
                var item = e.target.closest('.wb-type-picker-item');
                if (!item) return;
                e.preventDefault(); e.stopPropagation();
                var typeKey = item.dataset.type;
                if (typeKey) ns.toggleNoteType(typeKey);
            });
        }
        document.addEventListener('click', function (e) {
            var picker = document.getElementById('wbNoteTypePicker');
            if (!picker || picker.style.display === 'none') return;
            if (!e.target.closest('#wbNoteTypeBadge') && !e.target.closest('#wbNoteTypePicker')) {
                ns.hideTypePicker();
            }
        });
    }

    /* ===== Matrix 数字雨参数事件 ===== */
    function _bindMatrixParams() {
        var charSizeSlider = document.getElementById('charSizeSlider');
        var charSizeValue = document.getElementById('charSizeValue');
        if (charSizeSlider) {
            charSizeSlider.value = storage.get('char_size', 8);
            if (charSizeValue) charSizeValue.textContent = charSizeSlider.value + 'px';
            charSizeSlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_char_size', this.value);
                if (charSizeValue) charSizeValue.textContent = this.value + 'px';
                window.dispatchEvent(new Event('resize'));
            });
        }
        var flowSpeedSlider = document.getElementById('flowSpeedSlider');
        var flowSpeedValue = document.getElementById('flowSpeedValue');
        if (flowSpeedSlider) {
            flowSpeedSlider.value = storage.get('flow_speed', 2);
            if (flowSpeedValue) flowSpeedValue.textContent = flowSpeedSlider.value + '×';
            flowSpeedSlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_flow_speed', this.value);
                if (flowSpeedValue) flowSpeedValue.textContent = this.value + '×';
                window.dispatchEvent(new Event('resize'));
            });
        }
        var charDensitySlider = document.getElementById('charDensitySlider');
        var charDensityValue = document.getElementById('charDensityValue');
        if (charDensitySlider) {
            charDensitySlider.value = storage.get('char_density', 3);
            if (charDensityValue) charDensityValue.textContent = Math.round(charDensitySlider.value / 5 * 100) + '%';
            charDensitySlider.addEventListener('input', function () {
                localStorage.setItem('tabpage_char_density', this.value);
                if (charDensityValue) charDensityValue.textContent = Math.round(this.value / 5 * 100) + '%';
            });
        }
        var matrixRainToggle = document.getElementById('matrixRainToggle');
        var matrixRainParams = document.getElementById('matrixRainParams');
        if (matrixRainToggle && ns.matrixRain) {
            var isOn = ns.matrixRain.isRunning();
            matrixRainToggle.checked = isOn;
            if (matrixRainParams) matrixRainParams.style.display = isOn ? '' : 'none';
            matrixRainToggle.addEventListener('change', function () {
                var params = document.getElementById('matrixRainParams');
                if (this.checked) { ns.matrixRain.start(); if (params) params.style.display = ''; }
                else { ns.matrixRain.stop(); if (params) params.style.display = 'none'; }
            });
        }

        /* ===== 搜索框设置绑定 ===== */
        _bindSearchSettings();

        /* ===== F5 布局系统绑定 ===== */
        _bindLayoutSettings();

        /* ===== F4 视图缩放绑定 ===== */
        _bindViewScale();

        /* ===== F6 图标设置绑定 ===== */
        _bindTileSettings();

        /* ===== F8 字体设置绑定 ===== */
        _bindFontSettings();

        /* ===== F9 动画效果绑定 ===== */
        _bindAnimationSettings();
    }

    function _bindSearchSettings() {
        var sc = ns.getSearchConfig ? ns.getSearchConfig() : ns.DEFAULT_SEARCH_CONFIG;

        // 搜索建议开关
        var sst = document.getElementById('searchSuggestionsToggle');
        if (sst) {
            sst.checked = sc.showSuggestions;
            sst.addEventListener('change', function () {
                sc.showSuggestions = this.checked;
                ns.storage.set('searchConfig', sc);
                console.log('[设置] 搜索建议', this.checked ? '开启' : '关闭');
            });
        }
        // 保留内容开关
        var srt = document.getElementById('searchRetainToggle');
        if (srt) {
            srt.checked = sc.retainContent;
            srt.addEventListener('change', function () {
                sc.retainContent = this.checked;
                ns.storage.set('searchConfig', sc);
                console.log('[设置] 保留搜索内容', this.checked ? '开启' : '关闭');
            });
        }
        // 隐藏搜索按钮
        var shb = document.getElementById('searchHideBtnToggle');
        if (shb) {
            shb.checked = sc.hideSearchButton;
            shb.addEventListener('change', function () {
                sc.hideSearchButton = this.checked;
                ns.storage.set('searchConfig', sc);
                ns.applySearchConfig(sc);
                console.log('[设置] 隐藏搜索按钮', this.checked ? '开启' : '关闭');
            });
        }
        // 搜索框宽度滑块
        var sws = document.getElementById('searchWidthSlider');
        var swv = document.getElementById('searchWidthValue');
        if (sws) {
            sws.value = sc.searchWidth || 560;
            if (swv) swv.textContent = sws.value + 'px';
            sws.addEventListener('input', function () {
                sc.searchWidth = parseInt(this.value);
                if (swv) swv.textContent = this.value + 'px';
                ns.storage.set('searchConfig', sc);
                ns.applySearchConfig(sc);
            });
        }
        // 搜索框圆角滑块
        var srs = document.getElementById('searchRadiusSlider');
        var srv = document.getElementById('searchRadiusValue');
        if (srs) {
            srs.value = sc.searchRadius || 24;
            if (srv) srv.textContent = srs.value + 'px';
            srs.addEventListener('input', function () {
                sc.searchRadius = parseInt(this.value);
                if (srv) srv.textContent = this.value + 'px';
                ns.storage.set('searchConfig', sc);
                ns.applySearchConfig(sc);
            });
        }
        // 搜索框不透明度滑块
        var sos = document.getElementById('searchOpacitySlider');
        var sov = document.getElementById('searchOpacityValue');
        if (sos) {
            sos.value = (sc.searchOpacity || 1) * 100;
            if (sov) sov.textContent = (sos.value / 100).toFixed(2);
            sos.addEventListener('input', function () {
                sc.searchOpacity = parseInt(this.value) / 100;
                if (sov) sov.textContent = sc.searchOpacity.toFixed(2);
                ns.storage.set('searchConfig', sc);
                ns.applySearchConfig(sc);
            });
        }

        // 启动时应用保存的搜索配置
        ns.applySearchConfig(sc);
    }

    /* ===== 任务到期通知设置 ===== */

    /**
     * 保存任务通知设置到 chrome.storage.local（供 Service Worker 读取）
     * 同时同步到 localStorage 缓存
     */
    ns._saveTaskNotifySettings = function () {
        var toggle = document.getElementById('taskNotifyToggle');
        var select = document.getElementById('remindBeforeSelect');
        var remindRow = document.getElementById('taskNotifyRemindRow');

        var settings = {
            enabled: toggle ? toggle.checked : false,
            remindBefore: select ? parseInt(select.value) : 15
        };

        // 显示/隐藏提醒时间选择行
        if (remindRow) {
            remindRow.style.display = settings.enabled ? '' : 'none';
        }

        // 保存到 localStorage（页面端使用）
        try {
            localStorage.setItem('taskNotifySettings', JSON.stringify(settings));
        } catch (_) {}

        // 保存到 chrome.storage.local（Service Worker 端读取）
        if (ns.storageV2 && ns.storageV2.isAvailable()) {
            chrome.storage.local.set({ 'v2/taskNotifySettings': settings }).catch(function () {});
        }

        console.log('[设置] 任务通知 ' + (settings.enabled ? '开启' : '关闭') + ' 提前' + settings.remindBefore + '分钟');
    };

    /**
     * 同步任务通知设置到面板 UI（页面加载时调用）
     */
    ns.syncTaskNotifySettings = function () {
        var toggle = document.getElementById('taskNotifyToggle');
        var select = document.getElementById('remindBeforeSelect');
        var remindRow = document.getElementById('taskNotifyRemindRow');

        if (!toggle) return;

        // 读取已保存设置
        var settings = null;
        try {
            var raw = localStorage.getItem('taskNotifySettings');
            if (raw) settings = JSON.parse(raw);
        } catch (_) {}

        if (!settings) {
            settings = ns.DEFAULT_TASK_NOTIFY_CONFIG || { enabled: false, remindBefore: 15 };
        }

        toggle.checked = settings.enabled;
        if (select) select.value = String(settings.remindBefore || 15);
        if (remindRow) {
            remindRow.style.display = settings.enabled ? '' : 'none';
        }
    };

    /* ===== F4 视图缩放绑定 ===== */
    function _bindViewScale() {
        var slider = document.getElementById('viewScaleSlider');
        var valueEl = document.getElementById('viewScaleValue');
        if (!slider) return;

        // 从 localStorage 恢复保存的缩放值
        var savedScale = parseFloat(localStorage.getItem('tabpage_view_scale') || String(ns.DEFAULT_VIEW_SCALE));
        slider.value = savedScale;
        if (valueEl) valueEl.textContent = savedScale.toFixed(2);
        document.documentElement.style.setProperty('--view-scale', savedScale);
        console.log('[设置] 视图缩放 初始化 ' + savedScale.toFixed(2));

        slider.addEventListener('input', function () {
            var scale = parseFloat(this.value);
            document.documentElement.style.setProperty('--view-scale', scale);
            localStorage.setItem('tabpage_view_scale', scale);
            if (valueEl) valueEl.textContent = scale.toFixed(2);
            console.log('[设置] 视图缩放 ' + scale.toFixed(2));
        });
    }

    /* ===== F6 图标设置绑定 ===== */
    function _bindTileSettings() {
        // 从 localStorage 恢复磁贴设置
        var tileSettings = {};
        try {
            tileSettings = JSON.parse(localStorage.getItem('tabpage_tile_settings') || '{}');
        } catch (e) { tileSettings = {}; }

        // 默认值
        var defaults = {
            hideLabel: false,
            iconShadow: false,
            enterAnim: false,
            radius: 0,       // 0 表示 auto（使用 CSS 变量默认值）
            opacity: 1.0
        };
        var ts = Object.assign({}, defaults, tileSettings);

        // 应用初始状态
        _applyTileSettings(ts);

        // 隐藏名称开关
        var hideLabelToggle = document.getElementById('tileHideLabelToggle');
        if (hideLabelToggle) {
            hideLabelToggle.checked = ts.hideLabel;
            hideLabelToggle.addEventListener('change', function () {
                ts.hideLabel = this.checked;
                _applyTileSettings(ts);
                _saveTileSettings(ts);
                console.log('[设置] 图标名称 ' + (this.checked ? '隐藏' : '显示'));
            });
        }

        // 图标阴影开关
        var iconShadowToggle = document.getElementById('tileIconShadowToggle');
        if (iconShadowToggle) {
            iconShadowToggle.checked = ts.iconShadow;
            iconShadowToggle.addEventListener('change', function () {
                ts.iconShadow = this.checked;
                _applyTileSettings(ts);
                _saveTileSettings(ts);
                console.log('[设置] 图标阴影 ' + (this.checked ? '开启' : '关闭'));
            });
        }

        // 启动动画开关
        var enterAnimToggle = document.getElementById('tileEnterAnimToggle');
        if (enterAnimToggle) {
            enterAnimToggle.checked = ts.enterAnim;
            enterAnimToggle.addEventListener('change', function () {
                ts.enterAnim = this.checked;
                _applyTileSettings(ts);
                _saveTileSettings(ts);
                console.log('[设置] 磁贴启动动画 ' + (this.checked ? '开启' : '关闭'));
                if (this.checked) _triggerTileEnterAnim();
            });
        }

        // 磁贴圆角滑块
        var radiusSlider = document.getElementById('tileRadiusSlider');
        var radiusValue = document.getElementById('tileRadiusValue');
        if (radiusSlider) {
            radiusSlider.value = ts.radius;
            if (radiusValue) radiusValue.textContent = ts.radius === 0 ? 'auto' : ts.radius + 'px';
            radiusSlider.addEventListener('input', function () {
                ts.radius = parseInt(this.value);
                if (radiusValue) radiusValue.textContent = ts.radius === 0 ? 'auto' : ts.radius + 'px';
                _applyTileSettings(ts);
                _saveTileSettings(ts);
            });
        }

        // 磁贴不透明度滑块
        var opacitySlider = document.getElementById('tileOpacitySlider');
        var opacityValue = document.getElementById('tileOpacityValue');
        if (opacitySlider) {
            opacitySlider.value = Math.round(ts.opacity * 100);
            if (opacityValue) opacityValue.textContent = ts.opacity.toFixed(1);
            opacitySlider.addEventListener('input', function () {
                ts.opacity = parseInt(this.value) / 100;
                if (opacityValue) opacityValue.textContent = ts.opacity.toFixed(1);
                _applyTileSettings(ts);
                _saveTileSettings(ts);
            });
        }
    }

    /** 应用磁贴设置到 CSS 变量 */
    function _applyTileSettings(settings) {
        document.documentElement.style.setProperty('--tile-label-display', settings.hideLabel ? 'none' : 'block');
        document.documentElement.style.setProperty('--tile-icon-shadow', settings.iconShadow ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : 'none');
        document.documentElement.style.setProperty('--tile-radius-override', settings.radius > 0 ? settings.radius + 'px' : 'auto');
        document.documentElement.style.setProperty('--tile-opacity', settings.opacity);
    }

    /** 保存磁贴设置到 localStorage */
    function _saveTileSettings(settings) {
        localStorage.setItem('tabpage_tile_settings', JSON.stringify(settings));
    }

    /** 触发磁贴入场动画（F6 启动动画） */
    function _triggerTileEnterAnim() {
        var tiles = document.querySelectorAll('.tile');
        tiles.forEach(function (tile, i) {
            tile.classList.add('tile-enter-anim');
            tile.style.animationDelay = (i * 0.04) + 's';
            // 动画结束后清理
            tile.addEventListener('animationend', function handler() {
                tile.classList.remove('tile-enter-anim');
                tile.style.animationDelay = '';
                tile.removeEventListener('animationend', handler);
            }, { once: true });
        });
    }

    /* ===== F8 字体设置绑定 ===== */
    function _bindFontSettings() {
        // 从 localStorage 恢复字体设置
        var fontSettings = {};
        try {
            fontSettings = JSON.parse(localStorage.getItem('tabpage_font_settings') || '{}');
        } catch (e) { fontSettings = {}; }

        var defaults = {
            textShadow: false,
            shadowStrength: 4,
            fontSize: 1.0,
            fontColor: 'theme',
            customColor: '#ffffff'
        };
        var fs = Object.assign({}, defaults, fontSettings);

        // 应用初始状态
        _applyFontSettings(fs);

        // 文字阴影开关
        var shadowToggle = document.getElementById('fontTextShadowToggle');
        var shadowRow = document.getElementById('fontShadowStrengthRow');
        if (shadowToggle) {
            shadowToggle.checked = fs.textShadow;
            if (shadowRow) shadowRow.style.display = fs.textShadow ? '' : 'none';
            shadowToggle.addEventListener('change', function () {
                fs.textShadow = this.checked;
                if (shadowRow) shadowRow.style.display = this.checked ? '' : 'none';
                _applyFontSettings(fs);
                _saveFontSettings(fs);
                console.log('[设置] 文字阴影 ' + (this.checked ? '开启' : '关闭'));
            });
        }

        // 阴影强度滑块
        var shadowStrengthSlider = document.getElementById('fontShadowStrengthSlider');
        var shadowStrengthValue = document.getElementById('fontShadowStrengthValue');
        if (shadowStrengthSlider) {
            shadowStrengthSlider.value = fs.shadowStrength;
            if (shadowStrengthValue) shadowStrengthValue.textContent = fs.shadowStrength + 'px';
            shadowStrengthSlider.addEventListener('input', function () {
                fs.shadowStrength = parseInt(this.value);
                if (shadowStrengthValue) shadowStrengthValue.textContent = this.value + 'px';
                _applyFontSettings(fs);
                _saveFontSettings(fs);
            });
        }

        // 字号预设分段按钮
        var fontSizeSeg = document.getElementById('fontSizePresetSeg');
        if (fontSizeSeg) {
            var segBtns = fontSizeSeg.querySelectorAll('.s-seg-btn');
            segBtns.forEach(function (btn) {
                if (parseFloat(btn.dataset.fontSize) === fs.fontSize) btn.classList.add('active');
                btn.addEventListener('click', function () {
                    segBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    fs.fontSize = parseFloat(btn.dataset.fontSize);
                    _applyFontSettings(fs);
                    _saveFontSettings(fs);
                    console.log('[设置] 字号大小 ' + fs.fontSize);
                });
            });
        }

        // 文字颜色预设分段按钮
        var fontColorSeg = document.getElementById('fontColorPresetSeg');
        var customColorRow = document.getElementById('fontCustomColorRow');
        if (fontColorSeg) {
            var colorBtns = fontColorSeg.querySelectorAll('.s-seg-btn');
            colorBtns.forEach(function (btn) {
                if (btn.dataset.fontColor === fs.fontColor) btn.classList.add('active');
                btn.addEventListener('click', function () {
                    colorBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    fs.fontColor = btn.dataset.fontColor;
                    if (customColorRow) customColorRow.style.display = (fs.fontColor === 'custom') ? '' : 'none';
                    _applyFontSettings(fs);
                    _saveFontSettings(fs);
                    console.log('[设置] 文字颜色 ' + fs.fontColor);
                });
            });
        }

        // 初始化时显示/隐藏自定义颜色选择器
        if (customColorRow) customColorRow.style.display = (fs.fontColor === 'custom') ? '' : 'none';

        // 自定义颜色选择器
        var customColorPicker = document.getElementById('fontCustomColorPicker');
        var customColorValue = document.getElementById('fontCustomColorValue');
        if (customColorPicker) {
            customColorPicker.value = fs.customColor;
            if (customColorValue) customColorValue.textContent = fs.customColor;
            customColorPicker.addEventListener('input', function () {
                fs.customColor = this.value;
                if (customColorValue) customColorValue.textContent = this.value;
                _applyFontSettings(fs);
                _saveFontSettings(fs);
            });
        }
    }

    /** 应用字体设置到 CSS 变量 */
    function _applyFontSettings(settings) {
        // 文字阴影
        if (settings.textShadow) {
            var strength = settings.shadowStrength;
            document.documentElement.style.setProperty('--text-shadow-strength', '0 0 ' + strength + 'px rgba(0,0,0,0.3)');
        } else {
            document.documentElement.style.setProperty('--text-shadow-strength', 'none');
        }

        // 字号倍率
        document.documentElement.style.setProperty('--font-size-multiplier', settings.fontSize);

        // 文字颜色（应用到 .time-main, .date-display, .greeting-main）
        var textColor = '';
        switch (settings.fontColor) {
            case 'white': textColor = '#ffffff'; break;
            case 'lightgray': textColor = '#d0d0d0'; break;
            case 'custom': textColor = settings.customColor; break;
            default: textColor = ''; break; // 跟随主题
        }
        document.documentElement.style.setProperty('--font-color-override', textColor);
    }

    /** 保存字体设置到 localStorage */
    function _saveFontSettings(settings) {
        localStorage.setItem('tabpage_font_settings', JSON.stringify(settings));
    }

    /* ===== F9 动画效果绑定 ===== */
    function _bindAnimationSettings() {
        // 从 localStorage 恢复动画设置
        var animSettings = {};
        try {
            animSettings = JSON.parse(localStorage.getItem('tabpage_anim_settings') || '{}');
        } catch (e) { animSettings = {}; }

        var defaults = {
            animType: 'fade',
            animSpeed: 1.0,
            reduceMotion: false
        };
        var as = Object.assign({}, defaults, animSettings);

        // 应用初始状态
        _applyAnimationSettings(as);

        // 动画类型分段按钮
        var animTypeSeg = document.getElementById('animTypeSeg');
        if (animTypeSeg) {
            var typeBtns = animTypeSeg.querySelectorAll('.s-seg-btn');
            typeBtns.forEach(function (btn) {
                if (btn.dataset.animType === as.animType) btn.classList.add('active');
                btn.addEventListener('click', function () {
                    typeBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    as.animType = btn.dataset.animType;
                    _applyAnimationSettings(as);
                    _saveAnimSettings(as);
                    console.log('[设置] 动画类型 ' + as.animType);
                });
            });
        }

        // 动画速度滑块
        var animSpeedSlider = document.getElementById('animSpeedSlider');
        var animSpeedValue = document.getElementById('animSpeedValue');
        if (animSpeedSlider) {
            animSpeedSlider.value = as.animSpeed;
            if (animSpeedValue) animSpeedValue.textContent = as.animSpeed.toFixed(1) + 'x';
            animSpeedSlider.addEventListener('input', function () {
                as.animSpeed = parseFloat(this.value);
                if (animSpeedValue) animSpeedValue.textContent = as.animSpeed.toFixed(1) + 'x';
                _applyAnimationSettings(as);
                _saveAnimSettings(as);
            });
        }

        // 减少动画开关
        var reduceToggle = document.getElementById('animReduceToggle');
        if (reduceToggle) {
            reduceToggle.checked = as.reduceMotion;
            reduceToggle.addEventListener('change', function () {
                as.reduceMotion = this.checked;
                _applyAnimationSettings(as);
                _saveAnimSettings(as);
                console.log('[设置] 减少动画 ' + (this.checked ? '开启' : '关闭'));
            });
        }
    }

    /** 应用动画设置 */
    function _applyAnimationSettings(settings) {
        // 动画速度
        document.documentElement.style.setProperty('--animation-speed-multiplier', settings.animSpeed);

        // 减少动画：添加/移除 body class
        if (settings.reduceMotion) {
            document.body.classList.add('reduce-motion');
        } else {
            document.body.classList.remove('reduce-motion');
        }
    }

    /** 保存动画设置到 localStorage */
    function _saveAnimSettings(settings) {
        localStorage.setItem('tabpage_anim_settings', JSON.stringify(settings));
    }

    /* ===== F5 布局系统绑定 ===== */
    function _bindLayoutSettings() {
        var config = _getLayoutConfig();

        // 初始化模式 seg 按钮
        var segBtns = document.querySelectorAll('#layoutModeSeg .s-seg-btn');
        segBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.layoutMode === config.mode);
        });

        // 初始化预设下拉
        var presetSelect = document.getElementById('layoutPresetSelect');
        if (presetSelect) {
            presetSelect.value = config.preset;
        }

        // 初始化自定义滑块值
        _initCustomSliders(config.custom);

        // 显示对应模式面板
        _toggleLayoutModeUI(config.mode);

        // 应用当前布局
        _applyLayout(config);

        // 模式切换按钮点击
        var modeSeg = document.getElementById('layoutModeSeg');
        if (modeSeg) {
            modeSeg.addEventListener('click', function (e) {
                var btn = e.target.closest('.s-seg-btn');
                if (!btn || !btn.dataset.layoutMode) return;
                e.stopPropagation(); // 防止冒泡到 settingsPanel 的 segBtn 处理
                var mode = btn.dataset.layoutMode;
                config.mode = mode;
                // 更新 seg 按钮状态
                segBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.layoutMode === mode); });
                _toggleLayoutModeUI(mode);
                _applyLayout(config);
                _saveLayoutConfig(config);
                console.log('[布局] 切换模式 → ' + mode);
            });
        }

        // 预设下拉变更
        if (presetSelect) {
            presetSelect.addEventListener('change', function () {
                config.preset = this.value;
                _applyLayout(config);
                _saveLayoutConfig(config);
                console.log('[布局] 预设布局 → ' + this.value);
            });
        }

        // 自定义滑块变更
        var customSliders = {
            cols:  { slider: 'layoutColsSlider',  val: 'layoutColsVal',  key: 'columns', unit: '' },
            rows:  { slider: 'layoutRowsSlider',  val: 'layoutRowsVal',  key: 'rows',    unit: '' },
            colGap:{ slider: 'layoutColGapSlider', val: 'layoutColGapVal', key: 'colGap',  unit: 'px' },
            rowGap:{ slider: 'layoutRowGapSlider', val: 'layoutRowGapVal', key: 'rowGap',  unit: 'px' },
            icon:  { slider: 'layoutIconSlider',   val: 'layoutIconVal',   key: 'iconSize', unit: 'px' }
        };

        Object.keys(customSliders).forEach(function (k) {
            var meta = customSliders[k];
            var slider = document.getElementById(meta.slider);
            if (!slider) return;
            slider.addEventListener('input', function () {
                var val = parseInt(this.value);
                config.custom[meta.key] = val;
                // 更新显示值
                var valueEl = document.getElementById(meta.val);
                if (valueEl) valueEl.textContent = val + meta.unit;
                _applyLayout(config);
                _saveLayoutConfig(config);
            });
        });

        console.log('[布局] 初始化完成 模式=' + config.mode + ' 预设=' + config.preset);
    }

    /** 初始化自定义滑块显示值 */
    function _initCustomSliders(custom) {
        var pairs = [
            ['layoutColsSlider',  'layoutColsVal',  'columns',  ''  ],
            ['layoutRowsSlider',  'layoutRowsVal',  'rows',     ''  ],
            ['layoutColGapSlider','layoutColGapVal', 'colGap',   'px'],
            ['layoutRowGapSlider','layoutRowGapVal', 'rowGap',   'px'],
            ['layoutIconSlider',  'layoutIconVal',   'iconSize', 'px']
        ];
        pairs.forEach(function (pair) {
            var slider = document.getElementById(pair[0]);
            var valueEl = document.getElementById(pair[1]);
            if (slider) slider.value = custom[pair[2]];
            if (valueEl) valueEl.textContent = custom[pair[2]] + pair[3];
        });
    }

    /** 切换布局模式面板显示 */
    function _toggleLayoutModeUI(mode) {
        var presetWrap = document.getElementById('layoutPresetWrap');
        var customWrap = document.getElementById('layoutCustomWrap');
        if (presetWrap) presetWrap.style.display = (mode === 'preset') ? '' : 'none';
        if (customWrap) customWrap.style.display = (mode === 'custom') ? '' : 'none';
    }

    /** 从 localStorage 读取布局配置 */
    function _getLayoutConfig() {
        try {
            var raw = localStorage.getItem('tabpage_layout_config');
            if (raw) {
                var parsed = JSON.parse(raw);
                // 合并默认值，防止旧配置缺少字段
                return Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG, parsed, {
                    custom: Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG.custom, parsed.custom || {})
                });
            }
        } catch (e) { /* 忽略解析错误 */ }
        return Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG, {
            custom: Object.assign({}, ns.DEFAULT_LAYOUT_CONFIG.custom)
        });
    }

    /** 保存布局配置到 localStorage */
    function _saveLayoutConfig(config) {
        localStorage.setItem('tabpage_layout_config', JSON.stringify(config));
    }

    /** 应用布局配置到 CSS 变量 */
    function _applyLayout(config) {
        var root = document.documentElement;

        if (config.mode === 'preset') {
            var preset = ns.LAYOUT_PRESETS[config.preset] || ns.LAYOUT_PRESETS['2x6'];
            // 预设模式：列数由预设决定，行数不限（auto-fill）
            root.style.setProperty('--shortcut-columns', preset.columns);
            root.style.setProperty('--shortcut-rows-mode', 'auto');
            root.style.setProperty('--shortcut-max-rows', 'auto');
            // 预设模式下图标大小由 CSS 1fr 自动约束，使用默认值
            // 列间距和行间距使用默认值（不覆盖，让 base.css 默认值生效）
        } else {
            // 自定义模式：用户手动控制所有参数
            var c = config.custom;
            root.style.setProperty('--shortcut-columns', c.columns);
            root.style.setProperty('--shortcut-gap', c.colGap + 'px');
            root.style.setProperty('--shortcut-row-gap', c.rowGap + 'px');
            root.style.setProperty('--shortcut-icon', c.iconSize + 'px');
            root.style.setProperty('--shortcut-rows-mode', 'manual');
        }
    }

})(window.DevHome);
