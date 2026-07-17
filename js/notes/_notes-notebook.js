/**
 * notes 子模块 — 笔记本 CRUD 与渲染
 * 职责：笔记本的创建、读取、更新、删除，以及下拉菜单/徽章渲染
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const storageV2 = ns.storageV2;

    /** 生成笔记本唯一 ID */
    function notebookId() {
        return 'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    /* ===== 笔记本 CRUD ===== */

    /** 加载笔记本列表 */
    ns.loadNotebooks = async function () {
        state.notebooks = await storageV2.get(storageV2.KEYS.NOTEBOOKS, []);
        // 迁移旧数据：确保每个笔记本都有 order 字段
        let migrated = false;
        state.notebooks.forEach(function (nb, i) {
            if (!nb.order) { nb.order = Date.now() + i; migrated = true; }
        });
        if (migrated) await ns.saveNotebooks();
        console.log('[笔记本] 加载了 ' + state.notebooks.length + ' 个笔记本');
    };

    /** 保存笔记本列表 */
    ns.saveNotebooks = async function () {
        await storageV2.set(storageV2.KEYS.NOTEBOOKS, state.notebooks);
    };

    /** 创建笔记本 */
    ns.createNotebook = async function (name) {
        const now = Date.now();
        const nb = { id: notebookId(), name: name, createdAt: now, updatedAt: now, order: now };
        state.notebooks.push(nb);
        state.notebooks.sort(function (a, b) { return a.order - b.order; });
        await ns.saveNotebooks();
        console.log('[笔记本] 创建 id=' + nb.id + ' 名称=' + name);
        return nb;
    };

    /** 重命名笔记本 */
    ns.renameNotebook = async function (id, newName) {
        const nb = state.notebooks.find(function (n) { return n.id === id; });
        if (!nb) return;
        nb.name = newName;
        nb.updatedAt = Date.now();
        await ns.saveNotebooks();
        console.log('[笔记本] 重命名 id=' + id + ' → ' + newName);
    };

    /** 删除笔记本（笔记 notebookId 置 null，不删除笔记） */
    ns.deleteNotebook = async function (id) {
        const nb = state.notebooks.find(function (n) { return n.id === id; });
        if (!nb) return;
        // 将该笔记本下的所有笔记移到未分类
        let count = 0;
        state.notes.forEach(function (n) {
            if (n.notebookId === id) { n.notebookId = null; count++; }
        });
        if (count > 0) await ns.saveNotes();
        // 删除笔记本
        state.notebooks = state.notebooks.filter(function (n) { return n.id !== id; });
        await ns.saveNotebooks();
        // 如果当前筛选的是被删除的笔记本，重置筛选
        if (state._notebookFilter === id) {
            state._notebookFilter = null;
            ns.renderNotebookChips();
            ns.renderNotesList(state._notesFilter, state._notesSearch);
        }
        ns.showToast('笔记本「' + nb.name + '」已删除，' + count + ' 条笔记移回未分类', 'success');
        console.log('[笔记本] 删除 id=' + id + ' 名称=' + nb.name + ' 笔记数=' + count);
    };

    /* ===== 笔记本 UI 渲染 ===== */

    /** 渲染笔记本下拉菜单 + 更新按钮标签 */
    ns.renderNotebookDropdown = function () {
        if (dom.wbNotebookDropdownLabel) {
            if (state._notebookFilter) {
                const currentNb = state.notebooks.find(function (n) { return n.id === state._notebookFilter; });
                dom.wbNotebookDropdownLabel.textContent = currentNb ? currentNb.name : '未知笔记本';
            } else {
                dom.wbNotebookDropdownLabel.textContent = '全部笔记';
            }
        }
        const menu = dom.wbNotebookDropdownMenu;
        if (!menu) return;
        state.notebooks.sort(function (a, b) { return a.order - b.order; });
        let html = '<div class="wb-notebook-dropdown-item' + (!state._notebookFilter ? ' active' : '') + '" data-notebook-id="">' + ns.icon('folder', 'dh-icon--md') + ' 全部笔记</div>';
        state.notebooks.forEach(function (nb) {
            html += '<div class="wb-notebook-dropdown-item' + (state._notebookFilter === nb.id ? ' active' : '') + '" data-notebook-id="' + nb.id + '">' + ns.icon('notebook', 'dh-icon--md') + ' ' + ns.escapeHtml(nb.name) + '</div>';
        });
        menu.innerHTML = html;
    };

    /** 渲染编辑器内笔记本归属徽章 */
    ns.renderNotebookBadge = function () {
        const badge = dom.wbNotebookBadge;
        if (!badge) return;
        const note = state.currentNote;
        if (!note || (note._kind === 'capture' || note.type === 'capture')) {
            badge.style.display = 'none';
            return;
        }
        badge.style.display = '';
        const notebookId = note.notebookId;
        if (notebookId) {
            const nb = state.notebooks.find(function (n) { return n.id === notebookId; });
            badge.innerHTML = ns.icon('notebook', 'dh-icon--md') + ' ' + ns.escapeHtml(nb ? nb.name : '未知笔记本');
            badge.dataset.notebookId = notebookId;
        } else {
            badge.innerHTML = ns.icon('notebook', 'dh-icon--md') + ' 未分类';
            badge.dataset.notebookId = '';
        }
    };

})(window.DevHome);
