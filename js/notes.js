/**
 * DevHome Workbench v2 - 笔记管理
 *
 * 职责：
 *   1. 笔记 CRUD（chrome.storage.local）
 *   2. 笔记列表渲染（筛选、搜索、日期分组）
 *   3. 富文本编辑（contenteditable）与自动保存
 *   4. 快速捕获管理
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var storageV2 = ns.storageV2;
    var NOTE_TYPES = ns.NOTE_TYPES;
    var EMPTY_STATE_MESSAGES = ns.EMPTY_STATE_MESSAGES;

    /* ===== 笔记 ID 生成 ===== */
    function noteId() { return 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
    function captureId() { return 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

    /** 获取日期标签字符串（年月日格式） */
    function dateTag(ts) {
        var d = new Date(ts || Date.now());
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    /** 判断标签是否为日期标签（格式: YYYY-MM-DD） */
    function isDateTag(tag) {
        return /^\d{4}-\d{2}-\d{2}$/.test(tag);
    }

    /**
     * 统计文本字数（中文每字计1 + 英文每词计1）
     * @param {string} text - 可以是 HTML 或纯文本
     * @returns {number} 中文字数 + 英文词数的总和
     */
    ns.countWords = function (text) {
        var plain = String(text || '').replace(/<[^>]*>/g, '').trim();
        if (!plain) return 0;
        var chinese = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
        var words = (plain.match(/[a-zA-Z0-9]+/g) || []).length;
        return chinese + words;
    };

    /* ===== 笔记数据读写 ===== */

    /** 加载自定义类型标签到内存缓存，供渲染使用（避免 custom_xxxx 显示） */
    ns.loadCustomTypeLabels = async function () {
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        var customTypes = config.customNoteTypes || [];
        state._customTypeLabels = {};
        state._customTypeIcons = {};
        customTypes.forEach(function (ct) {
            state._customTypeLabels[ct.key] = ct.label;
            state._customTypeIcons[ct.key] = ct.icon || '🏷️';
        });
        console.log('[标签] 已加载 ' + customTypes.length + ' 个自定义类型');
    };

    /** 加载笔记列表（含数据迁移：补全缺失 id、wordCount，清理废弃字段） */
    ns.loadNotes = async function () {
        state.notes = await storageV2.get(storageV2.KEYS.NOTES, []);
        var migrated = false;
        var idMigrations = [];  // 记录 ID 补全日志

        (state.notes || []).forEach(function (note) {
            // 补全缺失的唯一 ID（旧版笔记可能无 id 字段，影响查找/删除/关联功能）
            if (!note.id) {
                var newId = noteId();
                idMigrations.push({ oldTitle: (note.title || '').slice(0, 30), newId: newId });
                note.id = newId;
                migrated = true;
            }
            // 为旧笔记补充 wordCount 字段（doc 字段已废弃）
            if (note.wordCount === undefined) {
                note.wordCount = ns.countWords(note.content || '');
                migrated = true;
            }
            // 清理废弃的 doc 字段
            if (note.doc !== undefined) { delete note.doc; migrated = true; }
        });

        if (idMigrations.length > 0) {
            console.log('[迁移] 为 ' + idMigrations.length + ' 条笔记补全 ID:', idMigrations);
        }
        if (migrated) {
            console.log('[迁移] 笔记数据已迁移，共修改 ' +
                (idMigrations.length > 0 ? idMigrations.length + ' 条ID补全, ' : '') +
                '若干字段。');
            await ns.saveNotes();
        }

        // 加载自定义类型标签到缓存，确保 renderNotesList 首次渲染就能显示正确业务名称
        await ns.loadCustomTypeLabels();
    };

    /** 保存笔记列表 */
    ns.saveNotes = async function () {
        await storageV2.set(storageV2.KEYS.NOTES, state.notes);
    };

    /** 创建新笔记（自动添加日期标签） */
    ns.createNote = async function (data) {
        var now = Date.now();
        var userTags = data.tags || [];
        var dt = dateTag(now);
        if (userTags.indexOf(dt) === -1) {
            userTags = [dt].concat(userTags);
        }
        var note = {
            id: data.id || noteId(),
            title: data.title || '无标题',
            content: data.content || '',
            wordCount: data.wordCount || 0,                    // 字数统计
            type: data.type || 'note',
            tags: userTags,
            sourceUrl: data.sourceUrl || '',
            sourceTitle: data.sourceTitle || '',
            status: 'active',
            createdAt: data.createdAt || now,
            updatedAt: now
        };
        state.notes.unshift(note);
        await ns.saveNotes();
        console.log('[编辑] 创建笔记 id=' + note.id + ' 标题=' + (note.title || '无标题'));
        return note;
    };

    /** 更新笔记 */
    ns.updateNote = async function (id, updates) {
        var idx = state.notes.findIndex(function (n) { return n.id === id; });
        if (idx === -1) return null;
        Object.assign(state.notes[idx], updates, { updatedAt: Date.now() });
        await ns.saveNotes();
        return state.notes[idx];
    };

    /** 删除笔记 */
    ns.deleteNote = async function (id) {
        state.notes = state.notes.filter(function (n) { return n.id !== id; });
        await ns.saveNotes();
    };

    /* ===== 删除撤销队列 ===== */

    /** 暂存被删除的笔记/捕获，供撤销使用 */
    state._deletedNotes = [];

    /**
     * 将笔记/捕获放入删除队列，执行实际删除，并弹出撤销 Toast
     * @param {object} item - 要删除的笔记或捕获对象
     * @param {string} kind - 'note' 或 'capture'
     */
    ns.deleteWithUndo = function (item, kind) {
        var id = item.id;
        var label = kind === 'capture' ? (item.content || '').slice(0, 30) : (item.title || '').slice(0, 30);
        if (!label) label = '无标题';
        console.log('[交互] 删除' + (kind === 'capture' ? '捕获' : '笔记') + ' id=' + id + ' 标签=' + label);

        // 存入删除队列
        var entry = { id: id, item: item, kind: kind };
        state._deletedNotes.push(entry);

        // 执行实际删除
        var delPromise = kind === 'capture' ? ns.deleteCapture(id) : ns.deleteNote(id);
        delPromise.then(function () {
            if (state.currentNote && state.currentNote.id === id) {
                ns.closeNoteEditor().catch(function (e) {
                    console.warn('[警告] closeNoteEditor 失败:', e.message);
                });
            }
            ns.renderNotesList(state._notesFilter, state._notesSearch);
            if (kind === 'capture') ns.renderCaptures();
        });

        // 弹出带撤销按钮的 Toast
        var labelShort = label.length > 20 ? label + '...' : label;
        ns.showActionToast('已删除' + (kind === 'capture' ? '捕获' : '笔记') + ' "' + labelShort + '"', '撤销', function () {
            // 撤销：从队列中恢复笔记
            var idx = state._deletedNotes.findIndex(function (d) { return d.id === id; });
            if (idx === -1) return;
            var deleted = state._deletedNotes[idx];
            state._deletedNotes.splice(idx, 1);
            console.log('[交互] 撤销删除 id=' + id);
            if (deleted.kind === 'capture') {
                ns.restoreCapture(deleted.item);
            } else {
                ns.restoreNote(deleted.item);
            }
            // 如果撤销的是当前查看的笔记，重新打开
            if (state.currentNote && state.currentNote.id === id) {
                // closeNoteEditor 已被调用，需要重新打开
                ns.openNoteEditor(deleted.item);
            }
        });
    };

    /** 恢复被删除的笔记 */
    ns.restoreNote = async function (note) {
        state.notes.push(note);
        state.notes.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        await ns.saveNotes();
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 恢复被删除的捕获 */
    ns.restoreCapture = async function (cap) {
        state.captures.push(cap);
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
        ns.renderCaptures();
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /* ===== 快速捕获 ===== */

    /** 加载捕获列表 */
    ns.loadCaptures = async function () {
        state.captures = await storageV2.get(storageV2.KEYS.CAPTURES, []);
    };

    /** 添加快速捕获 */
    ns.addCapture = async function (content) {
        var cap = {
            id: captureId(),
            content: content.trim(),
            doc: null,                 // 捕获不需要 ProseMirror 编辑
            wordCount: 0,              // 保持数据结构一致
            tags: [],
            createdAt: Date.now()
        };
        state.captures.unshift(cap);
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
        return cap;
    };

    /** 渲染快速捕获列表 */
    ns.renderCaptures = function () {
        if (!dom.wbCaptureRecent) return;
        var recent = state.captures.slice(0, 5);
        if (recent.length === 0) {
            dom.wbCaptureRecent.innerHTML = '<div style="color:var(--color-text-tertiary);font-size:12px;padding:8px;">' +
                (EMPTY_STATE_MESSAGES.captures[Math.floor(Math.random() * EMPTY_STATE_MESSAGES.captures.length)]) +
                '</div>';
            return;
        }
        dom.wbCaptureRecent.innerHTML = recent.map(function (c) {
            var time = new Date(c.createdAt);
            var timeStr = String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
            return '<div class="wb-capture-item">' +
                '<span class="wb-capture-item-time">' + ns.escapeHtml(timeStr) + '</span>' +
                '<span>' + ns.escapeHtml(c.content) + '</span>' +
                '</div>';
        }).join('');
    };

    /* ===== 笔记列表渲染（含捕获、日期分组） ===== */

    /**
     * 获取中文日期标签（今天/昨天/星期几/月日）
     */
    function getDateGroupLabel(dateStr) {
        if (!dateStr) return '';
        var today = new Date();
        var target = new Date(dateStr);
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        var yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        var yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

        if (dateStr === todayStr) return '今天';
        if (dateStr === yesterdayStr) return '昨天';
        var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return target.getMonth() + 1 + '月' + target.getDate() + '日 ' + weekdays[target.getDay()];
    }

    /** 渲染笔记侧边栏列表（笔记 + 捕获合并显示，按日期分组） */
    ns.renderNotesList = function (filter, search) {
        if (!dom.wbNotesList) return;
        var typeFilter = filter || 'all';
        var searchTerm = (search || '').toLowerCase();

        // 收集所有条目（笔记 + 捕获）
        var items = [];
        state.notes.filter(function (n) { return n.status === 'active'; }).forEach(function (n) {
            items.push({ id: n.id, type: n.type, title: n.title, content: n.content, tags: n.tags,
                createdAt: n.createdAt, updatedAt: n.updatedAt, sourceUrl: n.sourceUrl, _kind: 'note', _data: n });
        });
        state.captures.forEach(function (c) {
            items.push({ id: c.id, type: 'capture', title: c.content.slice(0, 40), content: c.content,
                tags: c.tags || [], createdAt: c.createdAt, updatedAt: c.createdAt, _kind: 'capture', _data: c });
        });

        // 按类型筛选：支持多标签匹配（如 type = "note,idea"）
        if (typeFilter === 'uncategorized') {
            items = items.filter(function (item) { return item._kind !== 'capture' && (item.type === 'note' || !item.type || item.type === ''); });
        } else if (typeFilter !== 'all') {
            items = items.filter(function (item) {
                if (item._kind === typeFilter) return true;
                var itemTypes = (item.type || 'note').split(',').filter(Boolean);
                return itemTypes.indexOf(typeFilter) !== -1;
            });
        }
        // 按搜索词筛选
        if (searchTerm) {
            items = items.filter(function (item) {
                // 从 HTML 内容中提取纯文本用于搜索
                var contentText = item._kind === 'note'
                    ? (item.content || '').replace(/<[^>]*>/g, '')
                    : (item.content || '');
                return item.title.toLowerCase().includes(searchTerm) ||
                       contentText.toLowerCase().includes(searchTerm);
            });
        }

        // 按时间倒序
        items.sort(function (a, b) { return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt); });

        if (items.length === 0) {
            dom.wbNotesList.innerHTML = '<div style="color:var(--color-text-tertiary);font-size:12px;padding:12px;text-align:center;">' +
                (searchTerm ? '没有找到匹配的内容' : (EMPTY_STATE_MESSAGES.notes[Math.floor(Math.random() * EMPTY_STATE_MESSAGES.notes.length)])) +
                '</div>';
            return;
        }

        // 按日期分组
        var groups = [];
        var currentDate = null;
        var currentGroup = null;
        items.forEach(function (item) {
            var d = new Date(item.updatedAt || item.createdAt);
            var dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (dateStr !== currentDate) {
                currentDate = dateStr;
                currentGroup = { date: dateStr, label: getDateGroupLabel(dateStr), items: [] };
                groups.push(currentGroup);
            }
            currentGroup.items.push(item);
        });

        // 渲染分组
        var html = '';
        groups.forEach(function (group) {
            if (!searchTerm) {
                html += '<div class="wb-note-date-group">' + ns.escapeHtml(group.label) + '</div>';
            }
            group.items.forEach(function (item) {
                var isActive = state.currentNote && state.currentNote.id === item.id;
                // 多类型支持：取第一个类型做主图标（优先内置图标，再取自定义缓存图标）
                var itemTypes = (item.type || 'note').split(',').filter(Boolean);
                var primaryType = itemTypes[0] || 'note';
                var icon = item._kind === 'capture'
                    ? '⚡'
                    : (NOTE_TYPES[primaryType]
                        ? NOTE_TYPES[primaryType].icon
                        : ((state._customTypeIcons || {})[primaryType] || '📝'));
                var timeStr = formatRelativeTime(item.updatedAt || item.createdAt);
                // 渲染所有类型徽章（合并自定义类型标签，避免 custom_xxxx 原始 key 暴露）
                var typeLabels = Object.assign({
                    note: '笔记', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获'
                }, state._customTypeLabels || {});
                var typeBadgesHtml = item._kind === 'capture'
                    ? '<span class="wb-note-type-badge badge-capture">捕获</span>'
                    : itemTypes.map(function (t) {
                        var tl = typeLabels[t] || t;
                        return '<span class="wb-note-type-badge badge-' + t + '">' + tl + '</span>';
                    }).join('');
                var rowClass = 'wb-note-list-item' + (isActive ? ' active' : '') + (typeFilter === 'all' ? ' show-badge' : '');
                // 非日期标签（用于展示）
                var displayTags = (item.tags || []).filter(function (t) { return !isDateTag(t); });
                // 日期标签只取第一个
                var dateBadgeTag = (item.tags || []).filter(isDateTag)[0] || dateTag(item.createdAt);
                var tagsHtml = displayTags.length > 0
                    ? displayTags.map(function (t) { return '<span class="wb-note-tag-chip">' + ns.escapeHtml(t) + '</span>'; }).join('')
                    : '';

                html += '<div class="' + rowClass + '" data-note-id="' + ns.escapeHtml(item.id) + '" data-kind="' + item._kind + '">' +
                    '<div class="wb-note-list-title">' +
                    '<span class="wb-note-list-title-text">' + icon + ' ' + ns.escapeHtml(item.title) + '</span>' +
                    typeBadgesHtml +
                    '</div>' +
                    '<div class="wb-note-list-meta">' +
                    '<span class="wb-note-date-badge">📅 ' + ns.escapeHtml(dateBadgeTag) + '</span>' +
                    '<span>' + ns.escapeHtml(timeStr) + '</span>' +
                    tagsHtml +
                    '</div>' +
                    '<button class="wb-note-list-del" data-del-id="' + ns.escapeHtml(item.id) + '" data-del-kind="' + item._kind + '" title="删除">✕</button>' +
                    '</div>';
            });
        });
        dom.wbNotesList.innerHTML = html;
    };

    /** 相对时间格式化 */
    function formatRelativeTime(ts) {
        if (!ts) return '';
        var now = Date.now();
        var diff = now - ts;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        var d = new Date(ts);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    /* ===== 笔记/捕获编辑器 ===== */

    /** 删除捕获 */
    ns.deleteCapture = async function (id) {
        state.captures = state.captures.filter(function (c) { return c.id !== id; });
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
    };

    /** 更新捕获 */
    ns.updateCapture = async function (id, content) {
        var cap = state.captures.find(function (c) { return c.id === id; });
        if (!cap) return;
        cap.content = content;
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
    };

    /** Tiptap 编辑器实例 ID，用于在 open/close 间传递 */
    var _tiptapInstanceId = null;

    /** 打开笔记/捕获进行编辑（使用 Tiptap 富文本编辑器） */
    ns.openNoteEditor = function (note) {
        state.currentNote = note;
        var isCapture = note._kind === 'capture' || note.type === 'capture';
        console.log('[编辑] 打开笔记 id=' + note.id + ' 标题=' + (note.title || '(无)').slice(0, 30) + ' 捕获=' + isCapture);

        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'none';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'flex';
        var toTaskWrap = document.getElementById('wbNoteToTaskWrap');
        if (toTaskWrap) toTaskWrap.style.display = isCapture ? 'none' : '';

        // 标题
        if (dom.wbNoteTitle) {
            dom.wbNoteTitle.value = note.title || '';
            dom.wbNoteTitle.readOnly = isCapture;
            dom.wbNoteTitle.style.opacity = isCapture ? '0.7' : '';
        }
        state._currentNoteType = note.type || 'note';
        ns.renderNoteTypeBadge();

        // 使用 Tiptap 富文本编辑器
        if (dom.wbNoteContent && ns.tiptapEditor) {
            // 销毁旧实例
            if (_tiptapInstanceId) { ns.tiptapEditor.destroy(_tiptapInstanceId); _tiptapInstanceId = null; }

            var content = note.content || '';
            if (isCapture) {
                // 捕获：纯文本渲染
                content = ns.escapeHtml(content || '').replace(/\n/g, '<br>');
            }

            _tiptapInstanceId = ns.tiptapEditor.create('#wbNoteContent', content, {
                id: 'note_editor',
                editable: !isCapture,
                onUpdate: function () {
                    if (ns._triggerAutoSave) ns._triggerAutoSave();
                    // 实时更新字数
                    var wcEl = document.getElementById('wbNoteWordCount');
                    if (wcEl) {
                        var html = ns.tiptapEditor.getHTML(_tiptapInstanceId);
                        wcEl.textContent = ns.countWords(html) + ' 字';
                    }
                }
            });
        }

        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 关闭笔记编辑器 */
    ns.closeNoteEditor = async function () {
        if (state.currentNote) {
            await ns.saveCurrentNote();
        }
        // 销毁 Tiptap 实例
        if (_tiptapInstanceId && ns.tiptapEditor) {
            ns.tiptapEditor.destroy(_tiptapInstanceId);
            _tiptapInstanceId = null;
        }
        state.currentNote = null;
        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'flex';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'none';
        var toTaskWrap = document.getElementById('wbNoteToTaskWrap');
        if (toTaskWrap) toTaskWrap.style.display = 'none';
        var picker = document.getElementById('wbQuadrantPicker');
        if (picker) picker.style.display = 'none';
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 保存当前编辑的笔记/捕获（从 Tiptap 获取内容） */
    ns.saveCurrentNote = async function () {
        if (!state.currentNote) return;
        var isCapture = state.currentNote._kind === 'capture' || state.currentNote.type === 'capture';

        if (isCapture) {
            var capContent = (_tiptapInstanceId && ns.tiptapEditor) ? ns.tiptapEditor.getHTML(_tiptapInstanceId) : '';
            await ns.updateCapture(state.currentNote.id, capContent);
            ns.renderCaptures();
            ns.renderNotesList(state._notesFilter, state._notesSearch);
            return;
        }

        var title = dom.wbNoteTitle ? dom.wbNoteTitle.value.trim() : '';
        var type = state._currentNoteType || 'note';
        var existingDateTags = (state.currentNote.tags || []).filter(function (t) { return /^\d{4}-\d{2}-\d{2}$/.test(t); });
        if (existingDateTags.length === 0) {
            existingDateTags = [dateTag(state.currentNote.createdAt || Date.now())];
        }

        var docHTML = (_tiptapInstanceId && ns.tiptapEditor) ? ns.tiptapEditor.getHTML(_tiptapInstanceId) : '';
        var wordCount = ns.countWords(docHTML);

        if (!docHTML && state.currentNote.content) {
            docHTML = state.currentNote.content;
            wordCount = ns.countWords(docHTML);
        }

        var noteId = state.currentNote ? state.currentNote.id : null;
        if (!noteId) return;

        await ns.updateNote(noteId, {
            title: title || '无标题',
            content: docHTML,
            wordCount: wordCount,
            type: type,
            tags: existingDateTags
        });

        var updated = state.notes.find(function (n) { return n.id === noteId; });
        if (updated) state.currentNote = updated;
        console.log('[编辑] 保存笔记 id=' + noteId + ' 类型=' + type + ' 字数=' + wordCount);
    };

    /* ===== 暴露 API ===== */

    ns.notesManager = {
        load: ns.loadNotes,
        save: ns.saveNotes,
        create: ns.createNote,
        update: ns.updateNote,
        delete: ns.deleteNote,
        loadCaptures: ns.loadCaptures,
        addCapture: ns.addCapture,
        renderCaptures: ns.renderCaptures,
        renderList: ns.renderNotesList,
        openEditor: ns.openNoteEditor,
        closeEditor: ns.closeNoteEditor,
        saveCurrent: ns.saveCurrentNote
    };

    /* ===== 自定义标签分类管理 ===== */

    /** 加载并渲染自定义筛选标签（同时缓存自定义类型图标/标签映射表） */
    ns.renderCustomFilters = async function () {
        var container = dom.wbCustomFilters;
        if (!container) return;
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        var customTypes = config.customNoteTypes || [];

        // 缓存自定义类型映射表：供 renderNotesList / renderNoteTypeBadge 使用，
        // 避免列表渲染时因 typeLabels 硬编码导致 custom_xxxx 原始 key 暴露给用户。
        state._customTypeLabels = {};
        state._customTypeIcons = {};
        customTypes.forEach(function (ct) {
            state._customTypeLabels[ct.key] = ct.label;
            state._customTypeIcons[ct.key] = ct.icon || '🏷️';
        });

        if (customTypes.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = customTypes.map(function (t) {
            return '<button class="wb-filter-chip custom" data-filter="' + ns.escapeHtml(t.key) + '">' +
                ns.escapeHtml(t.icon) + ' ' + ns.escapeHtml(t.label) + '</button>';
        }).join('');
    };

    /**
     * 行内创建自定义标签（无弹窗，直接在标签栏中插入输入框）
     * - 点击"+"后立即出现一个"未命名"的输入框
     * - 用户输入内容后失焦或回车即保存
     * - 若未修改（仍为"未命名"或为空）则自动删除
     */
    ns.startInlineCustomFilter = function () {
        var addBtn = dom.wbFilterAddBtn;
        if (!addBtn) return;

        // 创建行内编辑输入框，外观与 filter-chip 一致
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'wb-filter-chip wb-filter-chip-editing';
        input.placeholder = '未命名';
        input.value = '';
        input.title = '输入标签名称，回车保存，Esc 取消';
        console.log('[交互] 行内创建标签 开始');

        // 插入到"+"按钮之前
        addBtn.parentNode.insertBefore(input, addBtn);

        // 自动聚焦
        requestAnimationFrame(function () { input.focus(); });

        // 完成创建（保存或放弃）
        var cleanup = function (save) {
            var name = input.value.trim();
            input.remove();
            if (save && name && name !== '未命名') {
                // 保存新标签
                ns.addCustomFilter(name);
                console.log('[编辑] 行内创建标签 保存 name=' + name);
            } else {
                // 未修改 → 不保存，自动清理
                console.log('[交互] 行内创建标签 取消（未修改）');
            }
        };

        // 回车保存
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                cleanup(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
            }
        });

        // 失焦保存（若内容不为空且不等于"未命名"）
        input.addEventListener('blur', function () {
            var name = input.value.trim();
            // 失焦时有内容 → 保存；无内容 → 放弃
            cleanup(!!(name && name !== '未命名'));
        });
    };

    /** 新增自定义标签 */
    ns.addCustomFilter = async function (name, icon) {
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        var customTypes = config.customNoteTypes || [];
        var key = 'custom_' + Date.now();
        var parsed = parseIconAndName(name);
        customTypes.push({
            key: key,
            icon: icon || parsed.icon || '🏷️',
            label: parsed.name || name
        });
        config.customNoteTypes = customTypes;
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        await ns.renderCustomFilters();
    };

    /** 解析 "emoji 名称" 字符串 */
    function parseIconAndName(input) {
        if (!input) return { icon: '🏷️', name: input };
        var emojiMatch = input.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
        if (emojiMatch) {
            return {
                icon: emojiMatch[1],
                name: input.slice(emojiMatch[0].length).trim() || input
            };
        }
        return { icon: '🏷️', name: input };
    }

    /** 重命名自定义标签 */
    ns.renameFilter = async function (key, newIcon, newLabel) {
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        var customTypes = config.customNoteTypes || [];
        var found = false;
        customTypes.forEach(function (t) {
            if (t.key === key) {
                if (newIcon) t.icon = newIcon;
                if (newLabel) t.label = newLabel;
                found = true;
            }
        });
        if (!found) return;
        config.customNoteTypes = customTypes;
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        await ns.renderCustomFilters();
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 删除筛选标签（多类型兼容） */
    ns.removeFilter = async function (key) {
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        config.customNoteTypes = (config.customNoteTypes || []).filter(function (t) { return t.key !== key; });
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        // 从所有包含此类型的笔记中移除该标签
        var needsSave = false;
        state.notes.forEach(function (n) {
            var types = (n.type || 'note').split(',').filter(Boolean);
            var idx = types.indexOf(key);
            if (idx !== -1) {
                types.splice(idx, 1);
                if (types.length === 0) types = ['note'];
                n.type = types.join(',');
                needsSave = true;
            }
        });
        if (needsSave) await ns.saveNotes();
        if (state._notesFilter === key) {
            state._notesFilter = 'all';
            var chips = dom.wbNotesFilters.querySelectorAll('.wb-filter-chip');
            chips.forEach(function (c) { c.classList.toggle('active', c.dataset.filter === 'all'); });
        }
        if (state.currentNote) {
            var curTypes = (state.currentNote.type || 'note').split(',').filter(Boolean);
            if (curTypes.indexOf(key) !== -1) {
                // 已被上面的 forEach 更新，刷新显示即可
                state._currentNoteType = state.currentNote.type || 'note';
                ns.renderNoteTypeBadge();
            }
        }
        await ns.renderCustomFilters();
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    ns.removeCustomFilter = ns.removeFilter;

    /** 渲染编辑器类型徽章（支持多标签，优先使用缓存映射表） */
    ns.renderNoteTypeBadge = function () {
        var badge = dom.wbNoteTypeBadge;
        if (!badge) return;
        var typeStr = state._currentNoteType || 'note';
        var types = typeStr.split(',').filter(Boolean);
        if (types.length === 0) types = ['note'];
        var icons = Object.assign({ note: '📝', idea: '💡', bug: '🐛', meeting: '📋', webclip: '🔗', capture: '⚡' }, state._customTypeIcons || {});
        var labels = Object.assign({ note: '笔记', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获' }, state._customTypeLabels || {});
        // 如果缓存已覆盖所有类型则直接渲染，否则异步加载（兼容首次加载缓存未就绪）
        var needCustom = types.filter(function (t) { return !labels[t]; });
        if (needCustom.length > 0) {
            ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG).then(function (config) {
                (config.customNoteTypes || []).forEach(function (ct) {
                    icons[ct.key] = ct.icon;
                    labels[ct.key] = ct.label;
                });
                doRender();
            });
        } else {
            doRender();
        }
        function doRender() {
            badge.dataset.currentType = typeStr;
            badge.innerHTML = types.map(function (t) {
                return '<span class="wb-type-chip">' + ns.escapeHtml(icons[t] || '🏷️') + ' ' + ns.escapeHtml(labels[t] || t) + '<span class="wb-type-chip-del" data-type="' + ns.escapeHtml(t) + '">×</span></span>';
            }).join('') + '<span class="badge-add">+</span>';
        }
    };

    /** 渲染类型选择弹出面板（多选） */
    ns.renderTypePicker = async function () {
        var picker = document.getElementById('wbTypePickerList');
        if (!picker) return;
        var types = [
            { key: 'note', icon: '📝', label: '笔记' },
            { key: 'idea', icon: '💡', label: '想法' },
            { key: 'bug', icon: '🐛', label: 'Bug' },
            { key: 'meeting', icon: '📋', label: '会议' },
            { key: 'webclip', icon: '🔗', label: '剪藏' }
        ];
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        (config.customNoteTypes || []).forEach(function (t) {
            types.push({ key: t.key, icon: t.icon || '🏷️', label: t.label });
        });
        var currentStr = state._currentNoteType || 'note';
        var currentTypes = currentStr.split(',').filter(Boolean);
        picker.innerHTML = types.map(function (t) {
            var checked = currentTypes.indexOf(t.key) !== -1;
            return '<div class="wb-type-picker-item' + (checked ? ' active' : '') + '" data-type="' + ns.escapeHtml(t.key) + '">' +
                '<span class="wb-type-picker-check">' + (checked ? '☑' : '☐') + '</span>' +
                '<span>' + t.icon + '</span><span>' + ns.escapeHtml(t.label) + '</span></div>';
        }).join('');
    };

    /** 切换类型选择器显隐 */
    ns.toggleTypePicker = function () {
        var picker = document.getElementById('wbNoteTypePicker');
        if (!picker) return;
        if (picker.style.display === 'block') {
            picker.style.display = 'none';
        } else {
            ns.renderTypePicker();
            picker.style.display = 'block';
        }
    };

    /** 隐藏类型选择器 */
    ns.hideTypePicker = function () {
        var picker = document.getElementById('wbNoteTypePicker');
        if (picker) picker.style.display = 'none';
    };

    /** 切换单个类型（多选模式，但添加新标签时自动替换"未分类"） */
    ns.toggleNoteType = function (typeKey) {
        var currentStr = state._currentNoteType || 'note';
        var types = currentStr.split(',').filter(Boolean);
        var idx = types.indexOf(typeKey);
        if (idx !== -1) {
            // 移除该类型
            types.splice(idx, 1);
            // 如果全部移除，回退到"未分类"
            if (types.length === 0) types = ['note'];
            console.log('[交互] 移除类型 ' + typeKey + ' 当前=' + types.join(','));
        } else {
            // 如果当前只有"未分类"，用新标签替换它
            if (types.length === 1 && types[0] === 'note') {
                types = [typeKey];
            } else {
                // 过滤掉"未分类"（保持新标签优先），再添加新标签
                types = types.filter(function (t) { return t !== 'note'; });
                types.push(typeKey);
            }
            console.log('[交互] 添加类型 ' + typeKey + ' 当前=' + types.join(','));
        }
        state._currentNoteType = types.join(',');
        ns.renderNoteTypeBadge();
        ns.renderTypePicker();
        if (ns._triggerAutoSave) ns._triggerAutoSave();
    };

    /** 从徽章中移除单个类型（删到最后一个时自动保留"未分类"） */
    ns.removeNoteType = function (typeKey) {
        var currentStr = state._currentNoteType || 'note';
        var types = currentStr.split(',').filter(Boolean);
        var idx = types.indexOf(typeKey);
        if (idx !== -1) {
            types.splice(idx, 1);
        }
        // 如果全部删光，回退到"未分类"
        if (types.length === 0) types = ['note'];
        state._currentNoteType = types.join(',');
        ns.renderNoteTypeBadge();
        ns.hideTypePicker();
        if (ns._triggerAutoSave) ns._triggerAutoSave();
    };

})(window.DevHome);
