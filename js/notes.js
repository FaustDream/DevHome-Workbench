/**
 * DevHome Workbench v2 - 笔记管理
 *
 * 职责：
 *   1. 笔记 CRUD（chrome.storage.local）
 *   2. 笔记列表渲染（筛选、搜索）
 *   3. Markdown 编辑与实时预览
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

    /* ===== 笔记数据读写 ===== */

    /** 加载笔记列表 */
    ns.loadNotes = async function () {
        state.notes = await storageV2.get(storageV2.KEYS.NOTES, []);
    };

    /** 保存笔记列表 */
    ns.saveNotes = async function () {
        await storageV2.set(storageV2.KEYS.NOTES, state.notes);
    };

    /** 创建新笔记 */
    ns.createNote = async function (data) {
        var note = {
            id: data.id || noteId(),
            title: data.title || '无标题',
            content: data.content || '',
            type: data.type || 'note',
            tags: data.tags || [],
            sourceUrl: data.sourceUrl || '',
            sourceTitle: data.sourceTitle || '',
            status: 'active',
            createdAt: data.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        state.notes.unshift(note);
        await ns.saveNotes();
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
            dom.wbCaptureRecent.innerHTML = '<div style="color:var(--wb-text-tertiary);font-size:12px;padding:8px;">' +
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

    /* ===== 笔记列表渲染（含捕获） ===== */

    /** 渲染笔记侧边栏列表（笔记 + 捕获合并显示） */
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

        // 按类型筛选："未分类" = type === 'note'
        if (typeFilter === 'uncategorized') {
            items = items.filter(function (item) { return item._kind !== 'capture' && (item.type === 'note' || !item.type); });
        } else if (typeFilter !== 'all') {
            items = items.filter(function (item) { return item.type === typeFilter || item._kind === typeFilter; });
        }
        // 按搜索词筛选
        if (searchTerm) {
            items = items.filter(function (item) {
                return item.title.toLowerCase().includes(searchTerm) ||
                       item.content.toLowerCase().includes(searchTerm);
            });
        }

        // 按时间倒序
        items.sort(function (a, b) { return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt); });

        if (items.length === 0) {
            dom.wbNotesList.innerHTML = '<div style="color:var(--wb-text-tertiary);font-size:12px;padding:12px;text-align:center;">' +
                (searchTerm ? '没有找到匹配的内容' : (EMPTY_STATE_MESSAGES.notes[Math.floor(Math.random() * EMPTY_STATE_MESSAGES.notes.length)])) +
                '</div>';
            return;
        }

        dom.wbNotesList.innerHTML = items.map(function (item) {
            var isActive = state.currentNote && state.currentNote.id === item.id;
            var icon = item._kind === 'capture' ? '⚡' : (NOTE_TYPES[item.type] ? NOTE_TYPES[item.type].icon : '📝');
            var timeStr = formatRelativeTime(item.updatedAt || item.createdAt);
            var typeLabel = item._kind === 'capture' ? '捕获' : (item.type === 'note' || !item.type ? '未分类' : (NOTE_TYPES[item.type] ? NOTE_TYPES[item.type].label : item.type));
            var badgeType = item._kind === 'capture' ? 'capture' : (item.type || 'note');
            var rowClass = 'wb-note-list-item' + (isActive ? ' active' : '') + (typeFilter === 'all' ? ' show-badge' : '');
            return '<div class="' + rowClass + '" data-note-id="' + ns.escapeHtml(item.id) + '" data-kind="' + item._kind + '">' +
                '<div class="wb-note-list-title">' +
                '<span>' + icon + ' ' + ns.escapeHtml(item.title) + '</span>' +
                '<span class="wb-note-type-badge badge-' + badgeType + '">' + typeLabel + '</span>' +
                '</div>' +
                '<div class="wb-note-list-meta">' +
                '<span>' + ns.escapeHtml(timeStr) + '</span>' +
                '</div>' +
                '<button class="wb-note-list-del" data-del-id="' + ns.escapeHtml(item.id) + '" data-del-kind="' + item._kind + '" title="删除">✕</button>' +
                '</div>';
        }).join('');
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

    /** 打开笔记/捕获进行编辑 */
    ns.openNoteEditor = function (note) {
        state.currentNote = note;
        var isCapture = note._kind === 'capture' || note.type === 'capture';

        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'none';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'flex';

        // 捕获模式：标题和类型用只读样式
        if (dom.wbNoteTitle) {
            dom.wbNoteTitle.value = note.title || '';
            dom.wbNoteTitle.readOnly = isCapture;
            dom.wbNoteTitle.style.opacity = isCapture ? '0.7' : '';
        }
        // 渲染类型标签（仅显示当前选中的）
        state._currentNoteType = note.type || 'note';
        ns.renderNoteTypeBadge(state._currentNoteType);
        if (dom.wbNoteTags) {
            dom.wbNoteTags.value = (note.tags || []).join(', ');
            dom.wbNoteTags.readOnly = isCapture;
        }
        if (dom.wbNoteContent) dom.wbNoteContent.value = note.content || '';
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 关闭笔记编辑器 */
    ns.closeNoteEditor = function () {
        state.currentNote = null;
        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'flex';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'none';
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 保存当前编辑的笔记/捕获 */
    ns.saveCurrentNote = async function () {
        if (!state.currentNote) return;
        var isCapture = state.currentNote._kind === 'capture' || state.currentNote.type === 'capture';
        var content = dom.wbNoteContent ? dom.wbNoteContent.value : '';

        // 捕获类型：只更新内容
        if (isCapture) {
            await ns.updateCapture(state.currentNote.id, content);
            ns.renderCaptures();
            ns.renderNotesList(state._notesFilter, state._notesSearch);
            return;
        }

        var title = dom.wbNoteTitle ? dom.wbNoteTitle.value.trim() : '';
        var type = state._currentNoteType || 'note';
        var tagsStr = dom.wbNoteTags ? dom.wbNoteTags.value : '';
        var tags = tagsStr.split(',').map(function (t) { return t.trim(); }).filter(Boolean);

        await ns.updateNote(state.currentNote.id, {
            title: title || '无标题',
            content: content,
            type: type,
            tags: tags
        });

        // 更新当前引用
        var updated = state.notes.find(function (n) { return n.id === state.currentNote.id; });
        if (updated) state.currentNote = updated;
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

    /** 加载并渲染自定义筛选标签 */
    ns.renderCustomFilters = async function () {
        var container = dom.wbCustomFilters;
        if (!container) return;
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        var customTypes = config.customNoteTypes || [];
        if (customTypes.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = customTypes.map(function (t) {
            return '<button class="wb-filter-chip custom" data-filter="' + ns.escapeHtml(t.key) + '">' +
                t.icon + ' ' + ns.escapeHtml(t.label) +
                '<span class="filter-del">×</span></button>';
        }).join('');
    };

    /** 新增自定义标签 */
    ns.addCustomFilter = async function (name) {
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        var customTypes = config.customNoteTypes || [];
        var key = 'custom_' + Date.now();
        customTypes.push({ key: key, icon: '🏷️', label: name });
        config.customNoteTypes = customTypes;
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        await ns.renderCustomFilters();
    };

    /** 删除筛选标签（对应笔记全部变"未分类"，文章保留） */
    ns.removeFilter = async function (key) {
        // 如果是自定义类型，从配置中移除
        var config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        config.customNoteTypes = (config.customNoteTypes || []).filter(function (t) { return t.key !== key; });
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        // 该类型所有笔记 → 未分类
        var needsSave = false;
        state.notes.forEach(function (n) {
            if (n.type === key) { n.type = 'note'; needsSave = true; }
        });
        if (needsSave) await ns.saveNotes();
        // 当前筛选被删 → 切回全部
        if (state._notesFilter === key) {
            state._notesFilter = 'all';
            var chips = dom.wbNotesFilters.querySelectorAll('.wb-filter-chip');
            chips.forEach(function (c) { c.classList.toggle('active', c.dataset.filter === 'all'); });
        }
        // 当前编辑笔记类型被删 → 更新徽章
        if (state.currentNote && state.currentNote.type === key) {
            state.currentNote.type = 'note';
            state._currentNoteType = 'note';
            ns.renderNoteTypeBadge('note');
        }
        await ns.renderCustomFilters();
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    // 兼容旧名称
    ns.removeCustomFilter = ns.removeFilter;

    /**
     * 渲染编辑器类型徽章（仅显示当前选中类型，× 内嵌删除）
     */
    ns.renderNoteTypeBadge = function (type) {
        var badge = dom.wbNoteTypeBadge;
        if (!badge) return;
        type = type || 'note';
        var icons = { note: '📌', idea: '💡', bug: '🐛', meeting: '📋', webclip: '🔗', capture: '⚡' };
        var labels = { note: '未分类', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获' };
        badge.innerHTML = (icons[type] || '📝') + ' ' + (labels[type] || type) +
            '<span class="badge-remove">×</span>';
    };

})(window.DevHome);
