/**
 * notes 子模块 — 笔记编辑器
 * 职责：Tiptap 富文本编辑器生命周期管理、自动保存、内容清理
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;

    /** Tiptap 编辑器实例 ID，用于在 open/close 间传递 */
    let _tiptapInstanceId = null;

    /** 清理 HTML 中的空白标签，解决复制笔记产生大量空白行的问题 */
    ns.cleanEmptyHTML = function (html) {
        if (!html || typeof html !== 'string') return html || '';
        let cleaned = html.replace(/<p>\s*<\/p>/gi, '');
        cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
        cleaned = cleaned.replace(/^(<p>\s*<\/p>)+/i, '');
        cleaned = cleaned.replace(/(<p>\s*<\/p>)+$/i, '');
        cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>\s*)*\s*<\/p>/gi, '');
        return cleaned;
    };

    /** 打开笔记/捕获进行编辑（使用 Tiptap 富文本编辑器） */
    ns.openNoteEditor = function (note) {
        state.currentNote = note;
        const isCapture = note._kind === 'capture' || note.type === 'capture';
        console.log('[编辑] 打开笔记 id=' + note.id + ' 标题=' + (note.title || '(无)').slice(0, 30) + ' 捕获=' + isCapture);

        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'none';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'flex';
        const toTaskWrap = document.getElementById('wbNoteToTaskWrap');
        if (toTaskWrap) toTaskWrap.style.display = isCapture ? 'none' : '';

        // 标题
        if (dom.wbNoteTitle) {
            dom.wbNoteTitle.value = note.title || '';
            dom.wbNoteTitle.readOnly = isCapture;
            dom.wbNoteTitle.style.opacity = isCapture ? '0.7' : '';
        }
        state._currentNoteType = note.type || 'note';
        ns.renderNoteTypeBadge();
        ns.renderNotebookBadge();

        // 使用 Tiptap 富文本编辑器
        if (dom.wbNoteContent && ns.tiptapEditor) {
            // 销毁旧实例（确保切换笔记前清理上一个编辑器实例，避免内存泄漏）
            if (_tiptapInstanceId) { ns.tiptapEditor.destroy(_tiptapInstanceId); _tiptapInstanceId = null; }

            let content = note.content || '';
            if (isCapture) {
                content = ns.escapeHtml(content || '').replace(/\n/g, '<br>');
            }

            _tiptapInstanceId = ns.tiptapEditor.create('#wbNoteContent', content, {
                id: 'note_editor',
                editable: !isCapture,
                onUpdate: function () {
                    if (ns._triggerAutoSave) ns._triggerAutoSave();
                    const wcEl = document.getElementById('wbNoteWordCount');
                    if (wcEl) {
                        let html = ns.tiptapEditor.getHTML(_tiptapInstanceId);
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
        // 销毁 Tiptap 实例，释放编辑器内存
        if (_tiptapInstanceId && ns.tiptapEditor) {
            ns.tiptapEditor.destroy(_tiptapInstanceId);
            _tiptapInstanceId = null;
        }
        state.currentNote = null;
        if (dom.wbNotesEditorEmpty) dom.wbNotesEditorEmpty.style.display = 'flex';
        if (dom.wbNotesEditorActive) dom.wbNotesEditorActive.style.display = 'none';
        const toTaskWrap = document.getElementById('wbNoteToTaskWrap');
        if (toTaskWrap) toTaskWrap.style.display = 'none';
        const picker = document.getElementById('wbQuadrantPicker');
        if (picker) picker.style.display = 'none';
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    /** 保存当前编辑的笔记/捕获（从 Tiptap 获取内容） */
    ns.saveCurrentNote = async function () {
        if (!state.currentNote) return;
        const isCapture = state.currentNote._kind === 'capture' || state.currentNote.type === 'capture';

        if (isCapture) {
            let capContent = (_tiptapInstanceId && ns.tiptapEditor) ? ns.tiptapEditor.getHTML(_tiptapInstanceId) : '';
            capContent = ns.cleanEmptyHTML(capContent);
            await ns.updateCapture(state.currentNote.id, capContent);
            ns.renderCaptures();
            ns.renderNotesList(state._notesFilter, state._notesSearch);
            return;
        }

        let title = dom.wbNoteTitle ? dom.wbNoteTitle.value.trim() : '';
        const type = state._currentNoteType || 'note';
        // 防御：过滤非字符串/超长输入，避免正则引擎栈溢出
        let existingDateTags = (state.currentNote.tags || []).filter(function (t) { return typeof t === 'string' && t.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(t); });
        if (existingDateTags.length === 0) {
            const dateTagFn = ns._notesDateTag || function (ts) {
                const d = new Date(ts || Date.now());
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            };
            existingDateTags = [dateTagFn(state.currentNote.createdAt || Date.now())];
        }

        let docHTML = (_tiptapInstanceId && ns.tiptapEditor) ? ns.tiptapEditor.getHTML(_tiptapInstanceId) : '';
        docHTML = ns.cleanEmptyHTML(docHTML);
        let wordCount = ns.countWords(docHTML);

        if (!docHTML && state.currentNote.content) {
            docHTML = ns.cleanEmptyHTML(state.currentNote.content);
            wordCount = ns.countWords(docHTML);
        }

        const noteId = state.currentNote ? state.currentNote.id : null;
        if (!noteId) return;

        await ns.updateNote(noteId, {
            title: title || '无标题',
            content: docHTML,
            wordCount: wordCount,
            type: type,
            tags: existingDateTags,
            notebookId: state.currentNote.notebookId !== undefined ? state.currentNote.notebookId : null
        });

        const updated = state.notes.find(function (n) { return n.id === noteId; });
        if (updated) state.currentNote = updated;
        console.log('[编辑] 保存笔记 id=' + noteId + ' 类型=' + type + ' 字数=' + wordCount);
    };

})(window.DevHome);
