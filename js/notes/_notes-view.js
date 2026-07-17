/**
 * notes 子模块 — 笔记列表渲染
 * 职责：笔记/捕获混合列表的筛选、搜索、日期分组与 DOM 渲染
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const NOTE_TYPES = ns.NOTE_TYPES;
    const EMPTY_STATE_MESSAGES = ns.EMPTY_STATE_MESSAGES;

    /**
     * 获取中文日期标签（今天/昨天/星期几/月日）
     */
    function getDateGroupLabel(dateStr) {
        if (!dateStr) return '';
        const today = new Date();
        const target = new Date(dateStr);
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

        if (dateStr === todayStr) return '今天';
        if (dateStr === yesterdayStr) return '昨天';
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return target.getMonth() + 1 + '月' + target.getDate() + '日 ' + weekdays[target.getDay()];
    }

    /** 相对时间格式化 */
    function formatRelativeTime(ts) {
        if (!ts) return '';
        const now = Date.now();
        const diff = now - ts;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        const d = new Date(ts);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    /** 判断标签是否为日期标签（格式: YYYY-MM-DD，防御非字符串/超长输入避免正则栈溢出） */
    function isDateTag(tag) {
        if (typeof tag !== 'string' || tag.length > 10) return false;
        return /^\d{4}-\d{2}-\d{2}$/.test(tag);
    }

    /** 渲染笔记侧边栏列表（笔记 + 捕获合并显示，按日期分组） */
    ns.renderNotesList = function (filter, search) {
        if (!dom.wbNotesList) return;
        const typeFilter = filter || 'all';
        const searchTerm = (search || '').toLowerCase();

        // 收集所有条目（笔记 + 捕获）
        let items = [];
        state.notes.filter(function (n) { return n.status === 'active'; }).forEach(function (n) {
            items.push({ id: n.id, type: n.type, title: n.title, content: n.content, tags: n.tags,
                createdAt: n.createdAt, updatedAt: n.updatedAt, notebookId: n.notebookId, sourceUrl: n.sourceUrl, _kind: 'note', _data: n });
        });
        state.captures.forEach(function (c) {
            items.push({ id: c.id, type: 'capture', title: c.content.slice(0, 40), content: c.content,
                tags: c.tags || [], createdAt: c.createdAt, updatedAt: c.createdAt, _kind: 'capture', _data: c });
        });

        // 按笔记本筛选（顶层筛选，仅对笔记生效，捕获不受笔记本体系影响）
        const notebookFilter = state._notebookFilter;
        if (notebookFilter) {
            items = items.filter(function (item) {
                if (item._kind === 'capture') return false;
                return item.notebookId === notebookFilter;
            });
        }

        // 按类型筛选：支持多标签匹配（如 type = "note,idea"）
        if (typeFilter === 'uncategorized') {
            items = items.filter(function (item) { return item._kind !== 'capture' && (item.type === 'note' || !item.type || item.type === ''); });
        } else if (typeFilter !== 'all') {
            items = items.filter(function (item) {
                if (item._kind === typeFilter) return true;
                const itemTypes = (item.type || 'note').split(',').filter(Boolean);
                return itemTypes.indexOf(typeFilter) !== -1;
            });
        }
        // 按搜索词筛选
        if (searchTerm) {
            items = items.filter(function (item) {
                let contentText = item._kind === 'note'
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
        const groups = [];
        let currentDate = null;
        let currentGroup = null;
        items.forEach(function (item) {
            const d = new Date(item.updatedAt || item.createdAt);
            const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (dateStr !== currentDate) {
                currentDate = dateStr;
                currentGroup = { date: dateStr, label: getDateGroupLabel(dateStr), items: [] };
                groups.push(currentGroup);
            }
            currentGroup.items.push(item);
        });

        // 渲染分组
        let html = '';
        groups.forEach(function (group) {
            if (!searchTerm) {
                html += '<div class="wb-note-date-group">' + ns.escapeHtml(group.label) + '</div>';
            }
            group.items.forEach(function (item) {
                const isActive = state.currentNote && state.currentNote.id === item.id;
                const itemTypes = (item.type || 'note').split(',').filter(Boolean);
                const primaryType = itemTypes[0] || 'note';
                const icon = item._kind === 'capture'
                    ? '⚡'
                    : (NOTE_TYPES[primaryType]
                        ? NOTE_TYPES[primaryType].icon
                        : ((state._customTypeIcons || {})[primaryType] || '📝'));
                const timeStr = formatRelativeTime(item.updatedAt || item.createdAt);
                const typeLabels = Object.assign({
                    note: '笔记', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获'
                }, state._customTypeLabels || {});
                const typeBadgesHtml = item._kind === 'capture'
                    ? '<span class="wb-note-type-badge badge-capture">捕获</span>'
                    : itemTypes.map(function (t) {
                        const tl = typeLabels[t] || t;
                        return '<span class="wb-note-type-badge badge-' + t + '">' + tl + '</span>';
                    }).join('');
                const rowClass = 'wb-note-list-item' + (isActive ? ' active' : '') + (typeFilter === 'all' ? ' show-badge' : '');
                const displayTags = (item.tags || []).filter(function (t) { return !isDateTag(t); });
                const dateBadgeTag = (item.tags || []).filter(isDateTag)[0] || '';
                const tagsHtml = displayTags.length > 0
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

})(window.DevHome);
