/**
 * DevHome Workbench v2 - 笔记管理（编排层）
 *
 * 架构说明：
 *   本文件为笔记模块的编排入口，所有业务逻辑已拆分到 js/notes/ 私有子目录：
 *     _notes-crud.js     — 笔记 CRUD + 数据迁移 + 字数统计
 *     _notes-notebook.js — 笔记本 CRUD + 下拉菜单/徽章渲染
 *     _notes-capture.js  — 快速捕获 CRUD/渲染 + 删除撤销队列
 *     _notes-view.js     — 笔记列表渲染（筛选/搜索/日期分组）
 *     _notes-editor.js   — Tiptap 编辑器生命周期 + 自动保存
 *     _notes-filter.js   — 自定义标签/类型筛选器 + 类型选择器
 *
 *  所有子模块通过 window.DevHome 命名空间（IIFE 注入）共享状态与方法。
 *  本文件仅暴露 notesManager API 聚合对象，不包含任何业务逻辑。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== notesManager API 聚合 ===== */
    ns.notesManager = {
        // 笔记 CRUD
        load: ns.loadNotes,
        save: ns.saveNotes,
        create: ns.createNote,
        update: ns.updateNote,
        delete: ns.deleteNote,
        // 笔记本
        loadNotebooks: ns.loadNotebooks,
        createNotebook: ns.createNotebook,
        renameNotebook: ns.renameNotebook,
        deleteNotebook: ns.deleteNotebook,
        renderNotebookDropdown: ns.renderNotebookDropdown,
        renderNotebookBadge: ns.renderNotebookBadge,
        // 捕获
        loadCaptures: ns.loadCaptures,
        addCapture: ns.addCapture,
        renderCaptures: ns.renderCaptures,
        // 渲染与编辑器
        renderList: ns.renderNotesList,
        openEditor: ns.openNoteEditor,
        closeEditor: ns.closeEditor,
        saveCurrent: ns.saveCurrentNote
    };

})(window.DevHome);
