/**
 * notes 子模块 — 快速捕获 + 删除撤销
 * 职责：快速捕获的 CRUD、渲染，以及笔记/捕获的删除撤销队列
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const storageV2 = ns.storageV2;
    const EMPTY_STATE_MESSAGES = ns.EMPTY_STATE_MESSAGES;

    function captureId() { return 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

    /* ===== 删除撤销队列 ===== */

    /** 暂存被删除的笔记/捕获，供撤销使用 */
    state._deletedNotes = [];

    /**
     * 将笔记/捕获放入删除队列，执行实际删除，并弹出撤销 Toast
     * @param {object} item - 要删除的笔记或捕获对象
     * @param {string} kind - 'note' 或 'capture'
     */
    ns.deleteWithUndo = function (item, kind) {
        const id = item.id;
        let label = kind === 'capture' ? (item.content || '').slice(0, 30) : (item.title || '').slice(0, 30);
        if (!label) label = '无标题';
        console.log('[交互] 删除' + (kind === 'capture' ? '捕获' : '笔记') + ' id=' + id + ' 标签=' + label);

        const entry = { id: id, item: item, kind: kind };
        state._deletedNotes.push(entry);

        const delPromise = kind === 'capture' ? ns.deleteCapture(id) : ns.deleteNote(id);
        delPromise.then(function () {
            if (state.currentNote && state.currentNote.id === id) {
                ns.closeNoteEditor().catch(function (e) {
                    console.warn('[警告] closeNoteEditor 失败:', e.message);
                });
            }
            ns.renderNotesList(state._notesFilter, state._notesSearch);
            if (kind === 'capture') ns.renderCaptures();
            // 刷新四象限看板（清理已删除笔记的任务关联计数）
            if (kind === 'note' && typeof ns.renderQuadrantBoard === 'function') {
                ns.renderQuadrantBoard();
            }
        });

        const labelShort = label.length > 20 ? label + '...' : label;
        ns.showActionToast('已删除' + (kind === 'capture' ? '捕获' : '笔记') + ' "' + labelShort + '"', '撤销', function () {
            const idx = state._deletedNotes.findIndex(function (d) { return d.id === id; });
            if (idx === -1) return;
            const deleted = state._deletedNotes[idx];
            state._deletedNotes.splice(idx, 1);
            console.log('[交互] 撤销删除 id=' + id);
            if (deleted.kind === 'capture') {
                ns.restoreCapture(deleted.item);
            } else {
                ns.restoreNote(deleted.item);
            }
            if (state.currentNote && state.currentNote.id === id) {
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

    /* ===== 快速捕获 CRUD ===== */

    /** 加载捕获列表 */
    ns.loadCaptures = async function () {
        state.captures = await storageV2.get(storageV2.KEYS.CAPTURES, []);
    };

    /** 添加快速捕获 */
    ns.addCapture = async function (content) {
        const now = Date.now();
        const cap = {
            id: captureId(),
            content: content.trim(),
            doc: null,
            wordCount: 0,
            tags: [],
            createdAt: now,
            updatedAt: now
        };
        state.captures.unshift(cap);
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
        return cap;
    };

    /** 删除捕获 */
    ns.deleteCapture = async function (id) {
        state.captures = state.captures.filter(function (c) { return c.id !== id; });
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
    };

    /** 更新捕获 */
    ns.updateCapture = async function (id, content) {
        const cap = state.captures.find(function (c) { return c.id === id; });
        if (!cap) return;
        cap.content = content;
        cap.updatedAt = Date.now();
        await storageV2.set(storageV2.KEYS.CAPTURES, state.captures);
    };

    /** 渲染快速捕获列表 */
    ns.renderCaptures = function () {
        if (!dom.wbCaptureRecent) return;
        const recent = state.captures.slice(0, 5);
        if (recent.length === 0) {
            dom.wbCaptureRecent.innerHTML = '<div style="color:var(--color-text-tertiary);font-size:12px;padding:8px;">' +
                (EMPTY_STATE_MESSAGES.captures[Math.floor(Math.random() * EMPTY_STATE_MESSAGES.captures.length)]) +
                '</div>';
            return;
        }
        dom.wbCaptureRecent.innerHTML = recent.map(function (c) {
            const time = new Date(c.createdAt);
            const timeStr = String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
            return '<div class="wb-capture-item">' +
                '<span class="wb-capture-item-time">' + ns.escapeHtml(timeStr) + '</span>' +
                '<span>' + ns.escapeHtml(c.content) + '</span>' +
                '</div>';
        }).join('');
    };

})(window.DevHome);
