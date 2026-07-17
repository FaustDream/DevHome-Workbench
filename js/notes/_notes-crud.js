/**
 * notes 子模块 — 笔记 CRUD 与数据迁移
 * 职责：笔记的创建、读取、更新、删除，以及旧数据字段迁移
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const storageV2 = ns.storageV2;
    const NOTE_TYPES = ns.NOTE_TYPES;

    /* ===== 笔记 ID 生成 ===== */
    function noteId() { return 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

    /** 获取日期标签字符串（年月日格式） */
    function dateTag(ts) {
        const d = new Date(ts || Date.now());
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    /** 判断标签是否为日期标签（格式: YYYY-MM-DD，防御非字符串/超长输入避免正则栈溢出） */
    function isDateTag(tag) {
        if (typeof tag !== 'string' || tag.length > 10) return false;
        return /^\d{4}-\d{2}-\d{2}$/.test(tag);
    }

    /**
     * 统计文本字数（中文每字计1 + 英文每词计1）
     * @param {string} text - 可以是 HTML 或纯文本
     * @returns {number} 中文字数 + 英文词数的总和
     */
    ns.countWords = function (text) {
        const plain = String(text || '').replace(/<[^>]*>/g, '').trim();
        if (!plain) return 0;
        const chinese = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
        const words = (plain.match(/[a-zA-Z0-9]+/g) || []).length;
        return chinese + words;
    };

    /* ===== 笔记数据读写 ===== */

    /** 加载自定义类型标签到内存缓存，供渲染使用（避免 custom_xxxx 显示） */
    ns.loadCustomTypeLabels = async function () {
        const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        const customTypes = config.customNoteTypes || [];
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
        let migrated = false;
        const idMigrations = [];  // 记录 ID 补全日志

        (state.notes || []).forEach(function (note) {
            if (!note.id) {
                const newId = noteId();
                idMigrations.push({ oldTitle: (note.title || '').slice(0, 30), newId: newId });
                note.id = newId;
                migrated = true;
            }
            if (note.wordCount === undefined) {
                note.wordCount = ns.countWords(note.content || '');
                migrated = true;
            }
            if (!note.updatedAt) {
                note.updatedAt = note.createdAt || Date.now();
                migrated = true;
            }
            if (note.notebookId === undefined) {
                note.notebookId = null;
                migrated = true;
            }
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

        await ns.loadCustomTypeLabels();
    };

    /** 保存笔记列表 */
    ns.saveNotes = async function () {
        await storageV2.set(storageV2.KEYS.NOTES, state.notes);
    };

    /** 创建新笔记（自动添加日期标签，继承当前笔记本筛选或上次选择的笔记本） */
    ns.createNote = async function (data) {
        const now = Date.now();
        let userTags = data.tags || [];
        const dt = dateTag(now);
        if (userTags.indexOf(dt) === -1) {
            userTags = [dt].concat(userTags);
        }
        const notebookId = data.notebookId !== undefined ? data.notebookId
            : (state._notebookFilter || state._lastNotebookId || null);
        const note = {
            id: data.id || noteId(),
            title: data.title || '无标题',
            content: data.content || '',
            wordCount: data.wordCount || 0,
            type: data.type || 'note',
            tags: userTags,
            sourceUrl: data.sourceUrl || '',
            sourceTitle: data.sourceTitle || '',
            status: 'active',
            notebookId: notebookId,
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
        const idx = state.notes.findIndex(function (n) { return n.id === id; });
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

    // 导出 dateTag/isDateTag 供其他子模块复用（过滤/编辑器模块需要）
    ns._notesDateTag = dateTag;
    ns._notesIsDateTag = isDateTag;
    ns._notesNoteId = noteId;

})(window.DevHome);
