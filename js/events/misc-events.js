/**
 * 杂项事件模块
 * 负责磁贴交互、快速捕获、笔记列表点击/删除/搜索、笔记转任务、笔记本徽章、类型徽章、
 * 编辑器右键菜单、背景上传、数据导入、文件配置选择、自动保存
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindMiscEvents = function () {
let state = ns.state;
let dom = ns.dom;
let storage = ns.storage;

        // 磁贴滚轮翻页
        dom.tilesContainer.addEventListener('wheel', ns.handleWheelScroll, { passive: false });
        dom.tilesContainer.addEventListener('click', ns.handleTileDeleteClick);
        dom.tilesContainer.addEventListener('keydown', ns.handleTileDeleteKeydown);

        // 磁贴链接统一通过 openUrl 打开（受"新标签打开网站"设置控制）
        dom.tilesContainer.addEventListener('click', function (e) {
            var tileLink = e.target.closest('.tile');
            if (!tileLink) return;
            // 编辑模式下不拦截
            if (ns.isTileDeleteModeActive && ns.isTileDeleteModeActive()) return;
            e.preventDefault();
            ns.openUrl(tileLink.href, { type: 'tiles' });
        });

        // 空白区域右键菜单
        dom.blankContextMenu.addEventListener('click', function (e) { const item = e.target.closest('.context-menu-item'); if (item && item.dataset.action) ns.handleBlankMenuAction(item.dataset.action); });

        // 编辑器右键菜单
        _bindEditorContextMenu();

        // 背景上传
        dom.bgInput.addEventListener('change', function (e) {
let file = e.target.files[0]; if (!file) return;
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) ns.bgManager.upload(file);
            else ns.showToast('请选择图片或视频文件', 'error');
            dom.bgInput.value = '';
        });

        // 数据导入
        _bindImportEvents();

        // 文件配置目录选择
        _bindFileConfigEvents();

        // 快速捕获
        if (dom.wbCaptureInput) {
            dom.wbCaptureInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
let val = dom.wbCaptureInput.value.trim();
                    if (!val) return;
                    ns.addCapture(val).then(function () {
                        ns.renderCaptures();
                        dom.wbCaptureInput.value = '';
                    });
                }
            });
        }

        // 笔记面板事件
        _bindNotesListEvents();

        // 笔记搜索
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

        // 笔记自动保存（防抖）
        _bindAutoSave();

        // Matrix数字雨设置、搜索设置、布局/视图/图标/字体/动画设置
        // 这些已移至 settings-events.js 的 _bindSettingsEvents 中
    };

    /* ===== 编辑器右键菜单 ===== */
    function _bindEditorContextMenu() {
let editorMenu = document.getElementById('editorContextMenu');
        if (editorMenu) {
            editorMenu.addEventListener('mousedown', function (e) {
let item = e.target.closest('.context-menu-item');
                if (!item || !item.dataset.editorAction) return;
                e.preventDefault();
let action = item.dataset.editorAction;
                if (action === 'copy') document.execCommand('copy');
                else if (action === 'paste') document.execCommand('paste');
let em = document.getElementById('editorContextMenu');
                if (em) em.classList.remove('visible');
            });
        }
    }

    /* ===== 数据导入 ===== */
    function _bindImportEvents() {
let dom = ns.dom;
        if (dom.importInput) {
            dom.importInput.addEventListener('change', function (e) {
let file = e.target.files[0]; if (!file) return;
let reader = new FileReader();
                reader.onload = async function (event) {
                    try {
let data = JSON.parse(event.target.result);
                        // 尝试通过统一导入入口处理（支持 v3.0 完整快照 + 旧版磁贴备份）
                        if (typeof ns._importBackupData === 'function') {
                            const result = await ns._importBackupData(data);
                            if (result === 'full') {
                                // 完整快照导入成功 → 刷新页面以加载所有数据
                                ns.showToast('备份导入成功！即将刷新页面...', 'success');
                                setTimeout(function () { location.reload(); }, 1500);
                            } else if (result === 'tiles_only') {
                                // 旧版磁贴备份导入成功
                                await ns.tileManager.load();
                                ns.renderTiles(); ns.refreshCatRowIfVisible();
                                ns.showToast('备份导入成功！', 'success');
                            } else {
                                ns.showToast('无效的备份文件格式！', 'error');
                            }
                        } else {
                            // 降级：旧版导入逻辑
                            if (data && data.pages && Array.isArray(data.pages)) {
                                const importOk = await ns.showConfirm('导入备份将覆盖当前所有的磁贴和页面配置，确定继续吗？', { title: '导入备份' });
                                if (importOk) {
                                    ns.storage.set('pages', data.pages);
                                    ns.storage.set('page_names', data.pageNames || ['第1页']);
                                    if (data.devhome) ns.devhomeStorage.set('workbench', data.devhome);
                                    await ns.tileManager.load();
                                    ns.renderTiles(); ns.refreshCatRowIfVisible();
                                    ns.showToast('备份导入成功！', 'success');
                                }
                            } else ns.showToast('无效的备份文件格式！', 'error');
                        }
                    } catch (err) { ns.showToast('读取文件失败，请确保选择的是有效的 JSON 配置文件！', 'error'); }
                    dom.importInput.value = '';
                };
                reader.readAsText(file);
            });
        }
    }

    /* ===== 文件配置目录选择 ===== */
    function _bindFileConfigEvents() {
let state = ns.state, dom = ns.dom, storage = ns.storage;
        if (dom.configSelectDirBtn) {
            dom.configSelectDirBtn.addEventListener('click', async function () {
                if (!ns.fileConfig) return;
                // 尝试恢复读取权限
                if (ns.fileConfig._tryRecoverRead && typeof ns.fileConfig._tryRecoverRead === 'function') {
let readOk = await ns.fileConfig._tryRecoverRead();
                    if (readOk) {
                        ns.fileConfig.hideWarningBar();
                        ns.fileConfig.updateBadge('', '#ffcc66');
                        try { await ns.fileConfig.syncToFile(); } catch (_) {}
                        await _reloadAfterConfig();
                        return;
                    }
                }
                // 尝试恢复写入权限
                if (ns.fileConfig._tryRecoverWrite && typeof ns.fileConfig._tryRecoverWrite === 'function') {
let recovered = await ns.fileConfig._tryRecoverWrite();
                    if (recovered) {
                        ns.fileConfig.hideWarningBar();
                        ns.fileConfig.updateBadge('', '#e74c3c');
                        try { await ns.fileConfig.syncToFile(); } catch (_) {}
                        await _reloadAfterConfig();
                        return;
                    }
                }
                // 选择新目录
let success = await ns.fileConfig.pickDir();
                if (success) {
                    state.configReady = true;
                    ns.fileConfig.hideWarningBar();
                    ns.fileConfig.updateBadge('', '#e74c3c');
                    await _reloadAfterConfig();
                    ns.bindEvents();
                }
            });
        }
    }

    async function _reloadAfterConfig() {
let storage = ns.storage;
        ns.applyShortcutSize(storage.get('shortcut_size', ns.DEFAULT_SHORTCUT_SIZE), false);
        ns.applyShortcutColumns(storage.get('shortcut_columns', ns.DEFAULT_SHORTCUT_COLUMNS), false);
        ns.openFaviconDB();
        await ns.tileManager.load();
        ns.loadSearchHistory();
        ns.renderTiles();
        ns.refreshCatRowIfVisible();
        ns.syncSettingsControls();
    }

    /* ===== 笔记列表事件 ===== */
    function _bindNotesListEvents() {
let state = ns.state, dom = ns.dom;
        if (dom.wbNotesList) {
            dom.wbNotesList.addEventListener('click', function (e) {
let delBtn = e.target.closest('.wb-note-list-del');
                if (delBtn) {
                    e.stopPropagation();
let delId = delBtn.dataset.delId, delKind = delBtn.dataset.delKind;
let item = delKind === 'capture'
                        ? (state.captures.find(function(c){return c.id===delId;}) || null)
                        : (state.notes.find(function(n){return n.id===delId;}) || null);
                    if (!item) return;
                    ns.deleteWithUndo(item, delKind);
                }
let item = e.target.closest('.wb-note-list-item');
                if (!item) return;
let noteId = item.dataset.noteId, kind = item.dataset.kind;
let target;
                if (kind === 'capture') {
                    target = state.captures.find(function (c) { return c.id === noteId; });
                    if (target) target = Object.assign({ _kind: 'capture' }, target);
                } else {
                    target = state.notes.find(function (n) { return n.id === noteId; });
                }
                if (target) ns.openNoteEditor(target);
            });
        }
    }

    /* ===== 笔记转任务按钮 ===== */
    function _bindNoteToTaskEvents() {
let state = ns.state;
let noteToTaskBtn = document.getElementById('wbNoteToTaskBtn');
let quadrantPicker = document.getElementById('wbQuadrantPicker');
        if (!noteToTaskBtn || !quadrantPicker) return;

        noteToTaskBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!state.currentNote) return;
let isVisible = quadrantPicker.style.display === 'block';
            quadrantPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
let btnRect = noteToTaskBtn.getBoundingClientRect();
                quadrantPicker.style.position = 'fixed';
                quadrantPicker.style.top = (btnRect.bottom + 4) + 'px';
                quadrantPicker.style.left = btnRect.left + 'px';
                quadrantPicker.style.zIndex = '3100';
            }
        });

        quadrantPicker.addEventListener('click', function (e) {
let btn = e.target.closest('button');
            if (!btn || !btn.dataset.quadrant) return;
            e.stopPropagation();
let quadrant = btn.dataset.quadrant;
            quadrantPicker.style.display = 'none';
let timePicker = document.getElementById('wbTaskTimePicker');
            if (timePicker) {
let btnRect = noteToTaskBtn.getBoundingClientRect();
                timePicker.style.position = 'fixed';
                timePicker.style.top = (btnRect.bottom + 4) + 'px';
                timePicker.style.left = btnRect.left + 'px';
                timePicker.style.zIndex = '3100';
                timePicker.style.display = 'block';
                timePicker._quadrant = quadrant;
let dateInput = document.getElementById('wbTaskTimeDate'), timeInput = document.getElementById('wbTaskTimeTime');
                if (dateInput) dateInput.value = '';
                if (timeInput) timeInput.value = '';
                if (dateInput) setTimeout(function () { dateInput.focus(); }, 50);
            }
        });

let confirmBtn = document.getElementById('wbTimePickerConfirm');
        if (confirmBtn) confirmBtn.addEventListener('click', function () {
let timePicker = document.getElementById('wbTaskTimePicker');
let quadrant = timePicker && timePicker._quadrant;
            if (!quadrant || !state.currentNote) return;
let plannedAt = _readTimePickerValue('wbTaskTimeDate', 'wbTaskTimeTime');
            ns.convertNoteToTask(state.currentNote.id, quadrant, plannedAt);
            if (timePicker) timePicker.style.display = 'none';
            ns.showToast('已转至' + ({ q1:'重要且紧急',q2:'重要不紧急',q3:'紧急不重要',q4:'不紧急不重要' })[quadrant] + '象限', 'success');
        });

let skipBtn = document.getElementById('wbTimePickerSkip');
        if (skipBtn) skipBtn.addEventListener('click', function () {
let timePicker = document.getElementById('wbTaskTimePicker');
let quadrant = timePicker && timePicker._quadrant;
            if (!quadrant || !state.currentNote) return;
            ns.convertNoteToTask(state.currentNote.id, quadrant, null);
            if (timePicker) timePicker.style.display = 'none';
            ns.showToast('已转至' + ({ q1:'重要且紧急',q2:'重要不紧急',q3:'紧急不重要',q4:'不紧急不重要' })[quadrant] + '象限', 'success');
        });

        document.addEventListener('click', function hidePicker(e) {
let pickerVisible = quadrantPicker.style.display === 'block';
let timePicker = document.getElementById('wbTaskTimePicker');
let timePickerVisible = timePicker && timePicker.style.display === 'block';
            if (!pickerVisible && !timePickerVisible) return;
            if (!e.target.closest('#wbNoteToTaskWrap')) {
                quadrantPicker.style.display = 'none';
                if (timePicker) timePicker.style.display = 'none';
            }
        });
    }

    function _readTimePickerValue(dateId, timeId) {
let dateEl = document.getElementById(dateId), timeEl = document.getElementById(timeId);
        if (!dateEl || !dateEl.value) return null;
let dateStr = dateEl.value, timeStr = timeEl && timeEl.value ? timeEl.value : '23:59';
let dt = new Date(dateStr + 'T' + timeStr + ':00');
        if (isNaN(dt.getTime())) return null;
        return dt.getTime();
    }

    /* ===== 笔记本徽章事件 ===== */
    function _bindNotebookBadgeEvents() {
let state = ns.state;
let notebookBadge = document.getElementById('wbNotebookBadge');
        if (!notebookBadge) return;
        notebookBadge.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (!state.currentNote) return;
let options = [{ id: '', label: '未分类' }];
            state.notebooks.forEach(function (nb) { options.push({ id: nb.id, label: nb.name }); });
let html = '<div style="max-height:300px;overflow-y:auto;">';
            options.forEach(function (opt) {
let isCurrent = (state.currentNote.notebookId || '') === opt.id;
                html += '<div class="wb-notebook-pick-item' + (isCurrent ? ' active' : '') + '" data-nb-id="' + opt.id + '" style="padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;' + (isCurrent ? 'background:var(--color-accent);color:var(--color-text-inverse);' : '') + '">' + (opt.id ? '\uD83D\uDCD3 ' : '\uD83D\uDCC2 ') + ns.escapeHtml(opt.label) + '</div>';
            });
            html += '</div>';
let pop = document.getElementById('wbNotebookPickPop');
            if (!pop) {
                pop = document.createElement('div');
                pop.id = 'wbNotebookPickPop';
                pop.style.cssText = 'position:fixed;background:var(--color-bg-elevated);border:1px solid var(--color-border-active);border-radius:12px;padding:8px;z-index:3100;box-shadow:var(--shadow-lg);min-width:180px;';
                document.body.appendChild(pop);
            }
            pop.innerHTML = html;
let badgeRect = notebookBadge.getBoundingClientRect();
            pop.style.top = (badgeRect.bottom + 4) + 'px';
            pop.style.left = badgeRect.left + 'px';
            pop.style.display = 'block';
            pop.onclick = function (ev) {
let item = ev.target.closest('.wb-notebook-pick-item');
                if (!item) return;
let nbId = item.dataset.nbId || null;
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
let dom = ns.dom;
        if (dom.wbNoteTypeBadge) {
            dom.wbNoteTypeBadge.addEventListener('click', function (e) {
let delChip = e.target.closest('.wb-type-chip-del');
                if (delChip) { e.preventDefault(); e.stopPropagation(); const typeKey = delChip.dataset.type; if (typeKey) ns.removeNoteType(typeKey); return; }
                if (e.target.closest('.badge-add')) { e.preventDefault(); e.stopPropagation(); ns.toggleTypePicker(); return; }
                e.preventDefault(); e.stopPropagation(); ns.toggleTypePicker();
            });
        }
let typePicker = document.getElementById('wbTypePickerList');
        if (typePicker) {
            typePicker.addEventListener('click', function (e) {
let item = e.target.closest('.wb-type-picker-item');
                if (!item) return; e.preventDefault(); e.stopPropagation();
let typeKey = item.dataset.type; if (typeKey) ns.toggleNoteType(typeKey);
            });
        }
        document.addEventListener('click', function (e) {
let picker = document.getElementById('wbNoteTypePicker');
            if (!picker || picker.style.display === 'none') return;
            if (!e.target.closest('#wbNoteTypeBadge') && !e.target.closest('#wbNoteTypePicker')) ns.hideTypePicker();
        });
    }

    /* ===== 自动保存（防抖） ===== */
    function _bindAutoSave() {
let state = ns.state, dom = ns.dom;
let noteAutoSaveTimer = null;
        ns._triggerAutoSave = function () {
            if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
            noteAutoSaveTimer = setTimeout(function () {
                if (state.currentNote) {
                    ns.saveCurrentNote().then(function () { ns.renderNotesList(state._notesFilter, state._notesSearch); });
                }
            }, 400);
        };
        if (dom.wbNoteTitle) dom.wbNoteTitle.addEventListener('input', function () {
            if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
            noteAutoSaveTimer = setTimeout(function () {
                if (state.currentNote) {
                    ns.saveCurrentNote().then(function () { ns.renderNotesList(state._notesFilter, state._notesSearch); });
                }
            }, 800);
        });
    }

})(window.DevHome);
