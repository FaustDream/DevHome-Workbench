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

    /* ===== 笔记数据读写 ===== */

    /** 加载笔记列表 */
    ns.loadNotes = async function () {
        state.notes = await storageV2.get(storageV2.KEYS.NOTES, []);
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
            dom.wbNotesList.innerHTML = '<div style="color:var(--wb-text-tertiary);font-size:12px;padding:12px;text-align:center;">' +
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
                // 多类型支持：取第一个类型做主图标
                var itemTypes = (item.type || 'note').split(',').filter(Boolean);
                var primaryType = itemTypes[0] || 'note';
                var icon = item._kind === 'capture' ? '⚡' : (NOTE_TYPES[primaryType] ? NOTE_TYPES[primaryType].icon : '📝');
                var timeStr = formatRelativeTime(item.updatedAt || item.createdAt);
                // 渲染所有类型徽章
                var typeLabels = { note: '未分类', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获' };
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

    /** 打开笔记/捕获进行编辑 */
    ns.openNoteEditor = function (note) {
        state.currentNote = note;
        var isCapture = note._kind === 'capture' || note.type === 'capture';
        console.log('[编辑] 打开笔记 id=' + note.id + ' 标题=' + (note.title || '(无)').slice(0, 30) + ' 捕获=' + isCapture);

        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'none';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'flex';

        // 控制工具栏显隐：捕获模式隐藏
        var toolbar = document.getElementById('wbNotesToolbar');
        if (toolbar) toolbar.style.display = isCapture ? 'none' : 'flex';

        // 捕获模式：标题和类型用只读样式
        if (dom.wbNoteTitle) {
            dom.wbNoteTitle.value = note.title || '';
            dom.wbNoteTitle.readOnly = isCapture;
            dom.wbNoteTitle.style.opacity = isCapture ? '0.7' : '';
        }
        // 渲染类型标签（支持多标签逗号分隔）
        state._currentNoteType = note.type || 'note';
        ns.renderNoteTypeBadge();
        // 富文本内容（contenteditable div）
        if (dom.wbNoteContent) {
            var content = note.content || '';
            // 如果内容是纯文本（没有 HTML 标签），转为 HTML
            if (content.trim() && !/<[a-zA-Z][^>]*>/.test(content) && !/&[a-z]+;/.test(content)) {
                dom.wbNoteContent.innerHTML = '<p>' + ns.escapeHtml(content).replace(/\n/g, '<br>') + '</p>';
            } else {
                dom.wbNoteContent.innerHTML = content || '';
            }
        }
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 关闭笔记编辑器 */
    ns.closeNoteEditor = function () {
        state.currentNote = null;
        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'flex';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'none';
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 保存当前编辑的笔记/捕获（contenteditable 版本） */
    ns.saveCurrentNote = async function () {
        if (!state.currentNote) return;
        var isCapture = state.currentNote._kind === 'capture' || state.currentNote.type === 'capture';
        // 获取富文本内容（innerHTML）
        var content = dom.wbNoteContent ? dom.wbNoteContent.innerHTML : '';

        // 捕获类型：只更新内容
        if (isCapture) {
            await ns.updateCapture(state.currentNote.id, content);
            ns.renderCaptures();
            ns.renderNotesList(state._notesFilter, state._notesSearch);
            return;
        }

        var title = dom.wbNoteTitle ? dom.wbNoteTitle.value.trim() : '';
        // 多标签逗号分隔（如 "note,idea"）
        var type = state._currentNoteType || 'note';
        // 只保留日期标签，不再从输入框读取用户标签
        var existingDateTags = (state.currentNote.tags || []).filter(function (t) { return /^\d{4}-\d{2}-\d{2}$/.test(t); });
        if (existingDateTags.length === 0) {
            existingDateTags = [dateTag(state.currentNote.createdAt || Date.now())];
        }
        var tags = existingDateTags;

        await ns.updateNote(state.currentNote.id, {
            title: title || '无标题',
            content: content,
            type: type,
            tags: tags
        });

        // 更新当前引用
        var updated = state.notes.find(function (n) { return n.id === state.currentNote.id; });
        if (updated) state.currentNote = updated;
        console.log('[编辑] 保存笔记 id=' + state.currentNote.id + ' 类型=' + type);
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

    /** 渲染编辑器类型徽章（支持多标签） */
    ns.renderNoteTypeBadge = function () {
        var badge = dom.wbNoteTypeBadge;
        if (!badge) return;
        var typeStr = state._currentNoteType || 'note';
        var types = typeStr.split(',').filter(Boolean);
        if (types.length === 0) types = ['note'];
        var icons = { note: '📝', idea: '💡', bug: '🐛', meeting: '📋', webclip: '🔗', capture: '⚡' };
        var labels = { note: '未分类', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获' };
        // 加载自定义类型的 icon/label
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
                return '<span class="wb-type-chip">' + (icons[t] || '🏷️') + ' ' + (labels[t] || t) + '<span class="wb-type-chip-del" data-type="' + t + '">×</span></span>';
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

    /** 切换单个类型（多选模式） */
    ns.toggleNoteType = function (typeKey) {
        var currentStr = state._currentNoteType || 'note';
        var types = currentStr.split(',').filter(Boolean);
        var idx = types.indexOf(typeKey);
        if (idx !== -1) {
            if (types.length > 1) types.splice(idx, 1);
            console.log('[交互] 移除类型 ' + typeKey + ' 当前=' + types.join(','));
        } else {
            types.push(typeKey);
            console.log('[交互] 添加类型 ' + typeKey + ' 当前=' + types.join(','));
        }
        state._currentNoteType = types.join(',');
        ns.renderNoteTypeBadge();
        ns.renderTypePicker();
        if (ns._triggerAutoSave) ns._triggerAutoSave();
    };

    /** 从徽章中移除单个类型 */
    ns.removeNoteType = function (typeKey) {
        var currentStr = state._currentNoteType || 'note';
        var types = currentStr.split(',').filter(Boolean);
        var idx = types.indexOf(typeKey);
        if (idx !== -1 && types.length > 1) {
            types.splice(idx, 1);
        }
        state._currentNoteType = types.join(',');
        ns.renderNoteTypeBadge();
        ns.hideTypePicker();
        if (ns._triggerAutoSave) ns._triggerAutoSave();
    };

})(window.DevHome);
