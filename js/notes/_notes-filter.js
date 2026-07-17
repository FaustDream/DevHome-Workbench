/**
 * notes 子模块 — 自定义标签筛选与类型选择器
 * 职责：自定义筛选标签的 CRUD、类型徽章/选择器渲染、多类型切换
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;

    /** 解析 "emoji 名称" 字符串 */
    function parseIconAndName(input) {
        if (!input) return { icon: '🏷️', name: input };
        const emojiMatch = input.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
        if (emojiMatch) {
            return {
                icon: emojiMatch[1],
                name: input.slice(emojiMatch[0].length).trim() || input
            };
        }
        return { icon: '🏷️', name: input };
    }

    /* ===== 自定义标签筛选管理 ===== */

    /** 加载并渲染自定义筛选标签（同时缓存自定义类型图标/标签映射表） */
    ns.renderCustomFilters = async function () {
        const container = dom.wbCustomFilters;
        if (!container) return;
        const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        const customTypes = config.customNoteTypes || [];

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
     */
    ns.startInlineCustomFilter = function () {
        const addBtn = dom.wbFilterAddBtn;
        if (!addBtn) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'wb-filter-chip wb-filter-chip-editing';
        input.placeholder = '未命名';
        input.value = '';
        input.title = '输入标签名称，回车保存，Esc 取消';
        console.log('[交互] 行内创建标签 开始');

        addBtn.parentNode.insertBefore(input, addBtn);
        requestAnimationFrame(function () { input.focus(); });

        const cleanup = function (save) {
            const name = input.value.trim();
            input.remove();
            if (save && name && name !== '未命名') {
                ns.addCustomFilter(name);
                console.log('[编辑] 行内创建标签 保存 name=' + name);
            } else {
                console.log('[交互] 行内创建标签 取消（未修改）');
            }
        };

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
            else if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
        });

        input.addEventListener('blur', function () {
            const name = input.value.trim();
            cleanup(!!(name && name !== '未命名'));
        });
    };

    /** 新增自定义标签 */
    ns.addCustomFilter = async function (name, icon) {
        const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        const customTypes = config.customNoteTypes || [];
        const key = 'custom_' + Date.now();
        const parsed = parseIconAndName(name);
        customTypes.push({
            key: key,
            icon: icon || parsed.icon || '🏷️',
            label: parsed.name || name
        });
        config.customNoteTypes = customTypes;
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        await ns.renderCustomFilters();
    };

    /** 重命名自定义标签 */
    ns.renameFilter = async function (key, newIcon, newLabel) {
        const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        const customTypes = config.customNoteTypes || [];
        let found = false;
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
        const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        config.customNoteTypes = (config.customNoteTypes || []).filter(function (t) { return t.key !== key; });
        await ns.storageV2.set(ns.storageV2.KEYS.CONFIG, config);
        let needsSave = false;
        state.notes.forEach(function (n) {
            let types = (n.type || 'note').split(',').filter(Boolean);
            const idx = types.indexOf(key);
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
            const chips = dom.wbNotesFilters.querySelectorAll('.wb-filter-chip');
            chips.forEach(function (c) { c.classList.toggle('active', c.dataset.filter === 'all'); });
        }
        if (state.currentNote) {
            const curTypes = (state.currentNote.type || 'note').split(',').filter(Boolean);
            if (curTypes.indexOf(key) !== -1) {
                state._currentNoteType = state.currentNote.type || 'note';
                ns.renderNoteTypeBadge();
            }
        }
        await ns.renderCustomFilters();
        ns.renderNotesList(state._notesFilter, state._notesSearch);
    };

    ns.removeCustomFilter = ns.removeFilter;

    /* ===== 类型徽章与选择器 ===== */

    /** 渲染编辑器类型徽章（支持多标签，优先使用缓存映射表） */
    ns.renderNoteTypeBadge = function () {
        const badge = dom.wbNoteTypeBadge;
        if (!badge) return;
        const typeStr = state._currentNoteType || 'note';
        let types = typeStr.split(',').filter(Boolean);
        if (types.length === 0) types = ['note'];
        const icons = Object.assign({ note: '📝', idea: '💡', bug: '🐛', meeting: '📋', webclip: '🔗', capture: '⚡' }, state._customTypeIcons || {});
        const labels = Object.assign({ note: '笔记', idea: '想法', bug: 'Bug', meeting: '会议', webclip: '剪藏', capture: '捕获' }, state._customTypeLabels || {});
        const needCustom = types.filter(function (t) { return !labels[t]; });
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
        const picker = document.getElementById('wbTypePickerList');
        if (!picker) return;
        let types = [
            { key: 'note', icon: '📝', label: '笔记' },
            { key: 'idea', icon: '💡', label: '想法' },
            { key: 'bug', icon: '🐛', label: 'Bug' },
            { key: 'meeting', icon: '📋', label: '会议' },
            { key: 'webclip', icon: '🔗', label: '剪藏' }
        ];
        const config = await ns.storageV2.get(ns.storageV2.KEYS.CONFIG, ns.DEFAULT_V2_CONFIG);
        (config.customNoteTypes || []).forEach(function (t) {
            types.push({ key: t.key, icon: t.icon || '🏷️', label: t.label });
        });
        const currentStr = state._currentNoteType || 'note';
        const currentTypes = currentStr.split(',').filter(Boolean);
        picker.innerHTML = types.map(function (t) {
            const checked = currentTypes.indexOf(t.key) !== -1;
            return '<div class="wb-type-picker-item' + (checked ? ' active' : '') + '" data-type="' + ns.escapeHtml(t.key) + '">' +
                '<span class="wb-type-picker-check">' + (checked ? '☑' : '☐') + '</span>' +
                '<span>' + t.icon + '</span><span>' + ns.escapeHtml(t.label) + '</span></div>';
        }).join('');
    };

    /** 切换类型选择器显隐 */
    ns.toggleTypePicker = function () {
        const picker = document.getElementById('wbNoteTypePicker');
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
        const picker = document.getElementById('wbNoteTypePicker');
        if (picker) picker.style.display = 'none';
    };

    /** 切换单个类型（多选模式） */
    ns.toggleNoteType = function (typeKey) {
        const currentStr = state._currentNoteType || 'note';
        let types = currentStr.split(',').filter(Boolean);
        const idx = types.indexOf(typeKey);
        if (idx !== -1) {
            types.splice(idx, 1);
            if (types.length === 0) types = ['note'];
            console.log('[交互] 移除类型 ' + typeKey + ' 当前=' + types.join(','));
        } else {
            if (types.length === 1 && types[0] === 'note') {
                types = [typeKey];
            } else {
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

    /** 从徽章中移除单个类型 */
    ns.removeNoteType = function (typeKey) {
        const currentStr = state._currentNoteType || 'note';
        let types = currentStr.split(',').filter(Boolean);
        const idx = types.indexOf(typeKey);
        if (idx !== -1) { types.splice(idx, 1); }
        if (types.length === 0) types = ['note'];
        state._currentNoteType = types.join(',');
        ns.renderNoteTypeBadge();
        ns.hideTypePicker();
        if (ns._triggerAutoSave) ns._triggerAutoSave();
    };

})(window.DevHome);
