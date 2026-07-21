/**
 * DevHome Workbench - Tiptap 富文本编辑器（命名空间：ns.tiptapEditor）
 *
 * 构建方式: node build.mjs → js/tiptap-bundle.js
 * 引入方式: <script src="js/tiptap-bundle.js"></script>
 *
 * 暴露 API:
 *   ns.tiptapEditor.create(selector, content, opts)   → 创建编辑器
 *   ns.tiptapEditor.getHTML(id)                        → 获取 HTML 内容
 *   ns.tiptapEditor.getText(id)                        → 获取纯文本
 *   ns.tiptapEditor.setContent(id, html)               → 设置内容
 *   ns.tiptapEditor.destroy(id)                        → 销毁实例
 *   ns.tiptapEditor.getEditor(id)                      → 获取原生 Editor 实例
 *
 * 工具栏:
 *   内置浮动气泡工具栏（加粗/斜体/下划线/删除线/标题/列表/引用/代码），
 *   通过 CSS 变量 --bubble-toolbar-* 控制样式，支持完全自定义。
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
// TextStyle 是 Color / FontSize 的载体标记，三者需同时注册
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';

window.DevHome = window.DevHome || {};

(function (ns) {
    'use strict';

    /** 编辑器实例注册表 */
    var _instances = {};

    /**
     * 判断剪贴板选区里是否包含任务列表节点。
     * 只在任务列表复制时接管文本序列化，普通笔记段落继续使用 Tiptap 默认规则。
     */
    function hasTaskNode(fragment) {
        var found = false;
        fragment.forEach(function (node) {
            if (found) return;
            if (node.type && (node.type.name === 'taskList' || node.type.name === 'taskItem')) {
                found = true;
                return;
            }
            if (node.content && node.content.size) found = hasTaskNode(node.content);
        });
        return found;
    }

    /** 将段落、标题等块级内容压缩为单行任务标题文本 */
    function normalizeInlineText(node) {
        return (node.textContent || '').trim().replace(/\s+/g, ' ');
    }

    /** 剪贴板 HTML 转义，避免任务标题中的特殊字符破坏粘贴结构 */
    function escapeClipboardHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** 提取任务项自身标题，排除嵌套任务列表内容 */
    function getTaskItemTitle(node) {
        var textParts = [];
        node.forEach(function (child) {
            if (child.type && child.type.name === 'taskList') return;
            if (child.isBlock) {
                var text = normalizeInlineText(child);
                if (text) textParts.push(text);
            }
        });
        return textParts.join(' ').trim();
    }

    /**
     * 序列化单个任务项。
     * 任务项首行保留完成状态；嵌套任务列表另起一行并增加两个空格缩进。
     */
    function serializeTaskItemText(node, level) {
        var checkbox = node.attrs && node.attrs.checked ? '[x]' : '[ ]';
        var nestedParts = [];
        var indent = new Array(level + 1).join('  ');

        node.forEach(function (child) {
            var typeName = child.type && child.type.name;
            if (typeName === 'taskList') {
                nestedParts.push(serializeTaskListText(child, level + 1));
                return;
            }
        });

        var line = indent + '- ' + checkbox;
        var title = getTaskItemTitle(node);
        if (title) line += ' ' + title;
        return [line].concat(nestedParts.filter(Boolean)).join('\n');
    }

    /** 将一个任务列表序列化为每个任务一行，避免 taskList/taskItem/paragraph 多层 block 叠加空行 */
    function serializeTaskListText(node, level) {
        var lines = [];
        node.forEach(function (child) {
            if (child.type && child.type.name === 'taskItem') {
                lines.push(serializeTaskItemText(child, level || 0));
            }
        });
        return lines.join('\n');
    }

    /** 将任务项写成紧凑 HTML，防止富文本目标把 li/div/p 默认 margin 粘贴成大量空白 */
    function serializeTaskItemHtml(node) {
        var checked = !!(node.attrs && node.attrs.checked);
        var checkedAttr = checked ? ' checked="checked"' : '';
        var nestedHtml = [];
        node.forEach(function (child) {
            if (child.type && child.type.name === 'taskList') nestedHtml.push(serializeTaskListHtml(child));
        });
        return '<li data-type="taskItem" data-checked="' + checked + '" class="tiptap-task-item" style="margin:0;padding:0;">' +
            '<label contenteditable="false" style="margin:0 6px 0 0;padding:0;vertical-align:middle;">' +
            '<input type="checkbox" disabled="disabled"' + checkedAttr + '><span></span></label>' +
            '<div style="display:inline;margin:0;padding:0;"><p style="display:inline;margin:0;padding:0;">' +
            escapeClipboardHtml(getTaskItemTitle(node)) + '</p></div>' +
            nestedHtml.join('') +
            '</li>';
    }

    /** 将任务列表写成紧凑 HTML，保留 data-type/data-checked 供回粘到 Tiptap 时识别 */
    function serializeTaskListHtml(node) {
        var items = [];
        node.forEach(function (child) {
            if (child.type && child.type.name === 'taskItem') items.push(serializeTaskItemHtml(child));
        });
        return '<ul data-type="taskList" class="tiptap-task-list" style="margin:0;padding-left:1.4em;">' + items.join('') + '</ul>';
    }

    /** 将包含任务列表的选区写成紧凑 HTML，其它块级内容只保留纯文本段落 */
    function serializeTaskClipboardHtml(slice) {
        if (!slice || !slice.content || !hasTaskNode(slice.content)) return '';

        var blocks = [];
        slice.content.forEach(function appendNode(node) {
            var typeName = node.type && node.type.name;
            if (typeName === 'taskList') {
                blocks.push(serializeTaskListHtml(node));
                return;
            }
            if (typeName === 'taskItem') {
                blocks.push('<ul data-type="taskList" class="tiptap-task-list" style="margin:0;padding-left:1.4em;">' + serializeTaskItemHtml(node) + '</ul>');
                return;
            }
            if (node.isBlock) {
                var text = normalizeInlineText(node);
                if (text) blocks.push('<p style="margin:0;">' + escapeClipboardHtml(text) + '</p>');
                return;
            }
            if (node.content && node.content.size) node.forEach(appendNode);
        });
        return blocks.join('');
    }

    /** 将包含任务列表的剪贴板选区序列化为紧凑纯文本 */
    function serializeTaskClipboardText(slice) {
        if (!slice || !slice.content || !hasTaskNode(slice.content)) {
            return slice && slice.content ? slice.content.textBetween(0, slice.content.size, '\n\n') : '';
        }

        var blocks = [];
        slice.content.forEach(function appendNode(node) {
            var typeName = node.type && node.type.name;
            if (typeName === 'taskList') {
                blocks.push(serializeTaskListText(node, 0));
                return;
            }
            if (typeName === 'taskItem') {
                blocks.push(serializeTaskItemText(node, 0));
                return;
            }
            if (node.isBlock) {
                var text = normalizeInlineText(node);
                if (text) blocks.push(text);
                return;
            }
            if (node.content && node.content.size) node.forEach(appendNode);
        });

        return blocks.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    /**
     * 复制任务列表时主动写入剪贴板。
     * text/plain 解决纯文本粘贴空行；text/html 解决富文本目标继承默认 p/div margin 的空白。
     */
    function handleTaskClipboardCopy(view, event) {
        if (!view || !view.state || !view.state.selection || !event || !event.clipboardData) return false;
        var slice = view.state.selection.content();
        if (!slice || !slice.content || !hasTaskNode(slice.content)) return false;

        event.clipboardData.setData('text/plain', serializeTaskClipboardText(slice));
        event.clipboardData.setData('text/html', serializeTaskClipboardHtml(slice));
        event.preventDefault();
        console.log('[编辑] 复制任务列表 已压缩剪贴板空白行');
        return true;
    }

    /** 合并外部 editorProps，并在任务列表复制时添加空白压缩兜底 */
    function buildEditorProps(opts) {
        var userProps = (opts && opts.editorProps) || {};
        var userEvents = userProps.handleDOMEvents || {};
        var userCopy = userEvents.copy;
        var editorProps = Object.assign({}, userProps);

        editorProps.clipboardTextSerializer = editorProps.clipboardTextSerializer || serializeTaskClipboardText;
        editorProps.handleDOMEvents = Object.assign({}, userEvents, {
            copy: function (view, event) {
                if (typeof userCopy === 'function' && userCopy(view, event)) return true;
                return handleTaskClipboardCopy(view, event);
            }
        });
        return editorProps;
    }


    /** 默认扩展集（可覆盖） */
    var DEFAULT_EXTENSIONS = [
        StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            codeBlock: { HTMLAttributes: { class: 'tiptap-code-block' } },
            blockquote: { HTMLAttributes: { class: 'tiptap-blockquote' } },
            bulletList: { HTMLAttributes: { class: 'tiptap-list' } },
            orderedList: { HTMLAttributes: { class: 'tiptap-list' } },
            // StarterKit v3 已内置 Link，此处仅配置：不自动跳转、新窗口打开
            link: {
                openOnClick: false,
                autolink: true,
                HTMLAttributes: { class: 'tiptap-link', rel: 'noopener noreferrer', target: '_blank' }
            }
        }),
        // 文字颜色 / 字号：均依赖 TextStyle 标记
        TextStyle,
        Color,
        FontSize,
        // 背景高亮（多色）
        Highlight.configure({ multicolor: true, HTMLAttributes: { class: 'tiptap-highlight' } }),
        // 段落 / 标题对齐
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({
            placeholder: '在此编写内容...'
        }),
        TaskList.configure({
            HTMLAttributes: { class: 'tiptap-task-list' },
            /**
             * 任务列表整块复制时按任务行输出。
             * 避免默认遍历继续进入 taskItem/paragraph，造成每个任务项前叠加多个空行。
             */
            renderText: function (_a) {
                return serializeTaskListText(_a.node, 0);
            }
        }),
        TaskItem.configure({
            HTMLAttributes: { class: 'tiptap-task-item' },
            nested: true,
            /**
             * 自定义任务列表项的剪贴板文本序列化
             * 修复复制任务列表时每个任务项之间产生大量空白行的格式错误。
             * 默认行为会将 <li> 内的 <p> 渲染为多行，导致任务项之间出现双倍换行。
             */
            renderText: function (_a) {
                return serializeTaskItemText(_a.node, 0);
            }
        })
    ];

    /* ===== 气泡工具栏（纯 DOM 实现，无框架依赖） ===== */

    /**
     * 创建并挂载浮动气泡工具栏
     * @param {Editor} editor - Tiptap Editor 实例
     * @returns {HTMLElement} 工具栏 DOM 元素
     */
    function createBubbleToolbar(editor) {
        var toolbar = document.createElement('div');
        toolbar.className = 'tiptap-bubble-toolbar';
        toolbar.style.display = 'none';

        var buttons = [
            { label: 'B',  title: '加粗',     action: function () { editor.chain().focus().toggleBold().run(); },         isActive: function () { return editor.isActive('bold'); } },
            { label: 'I',  title: '斜体',     action: function () { editor.chain().focus().toggleItalic().run(); },       isActive: function () { return editor.isActive('italic'); } },
            { label: 'U',  title: '下划线',   action: function () { editor.chain().focus().toggleUnderline().run(); },    isActive: function () { return editor.isActive('underline'); } },
            { label: 'S',  title: '删除线',   action: function () { editor.chain().focus().toggleStrike().run(); },       isActive: function () { return editor.isActive('strike'); } },
            null,
            { label: 'H1', title: '标题1',    action: function () { editor.chain().focus().toggleHeading({ level: 1 }).run(); }, isActive: function () { return editor.isActive('heading', { level: 1 }); } },
            { label: 'H2', title: '标题2',    action: function () { editor.chain().focus().toggleHeading({ level: 2 }).run(); }, isActive: function () { return editor.isActive('heading', { level: 2 }); } },
            { label: 'H3', title: '标题3',    action: function () { editor.chain().focus().toggleHeading({ level: 3 }).run(); }, isActive: function () { return editor.isActive('heading', { level: 3 }); } },
            null,
            { label: '•',  title: '无序列表',   action: function () { editor.chain().focus().toggleBulletList().run(); },     isActive: function () { return editor.isActive('bulletList'); } },
            { label: '1.', title: '有序列表',   action: function () { editor.chain().focus().toggleOrderedList().run(); },    isActive: function () { return editor.isActive('orderedList'); } },
            { label: '☑', title: '任务列表',   action: function () { editor.chain().focus().toggleTaskList().run(); },       isActive: function () { return editor.isActive('taskList'); } },
            { label: '❝', title: '引用块',     action: function () { editor.chain().focus().toggleBlockquote().run(); },     isActive: function () { return editor.isActive('blockquote'); } },
            { label: '⌨', title: '代码块',     action: function () { editor.chain().focus().toggleCodeBlock().run(); },       isActive: function () { return editor.isActive('codeBlock'); } }
        ];

        buttons.forEach(function (def) {
            if (!def) {
                var sep = document.createElement('span');
                sep.className = 'tiptap-bubble-sep';
                toolbar.appendChild(sep);
                return;
            }
            var btn = document.createElement('button');
            btn.className = 'tiptap-bubble-btn';
            btn.textContent = def.label;
            btn.title = def.title;
            btn.type = 'button';
            // 点击执行操作
            btn.addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                def.action();
            });
            // 定期更新激活状态（通过 MutationObserver）
            btn._update = function () {
                btn.classList.toggle('active', def.isActive());
                if (def.disabled) btn.disabled = def.disabled();
            };
            btn._update();
            toolbar.appendChild(btn);
        });

        // 监听编辑器状态变化，更新按钮状态
        editor.on('selectionUpdate', function () {
            toolbar.querySelectorAll('.tiptap-bubble-btn').forEach(function (btn) {
                if (btn._update) btn._update();
            });
        });
        editor.on('transaction', function () {
            toolbar.querySelectorAll('.tiptap-bubble-btn').forEach(function (btn) {
                if (btn._update) btn._update();
            });
        });

        // 监听选区变化→显示/隐藏气泡
        editor.on('selectionUpdate', function () {
            updateBubblePosition(editor, toolbar);
        });

        document.body.appendChild(toolbar);
        return toolbar;
    }

    /**
     * 根据当前选区计算气泡位置并显隐
     */
    function updateBubblePosition(editor, toolbar) {
        var _isEditing = false;
        if (typeof ns !== 'undefined' && ns.state && ns.state.currentNote) {
            _isEditing = true;
        }

        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !_isEditing) {
            toolbar.style.display = 'none';
            return;
        }

        var range = sel.getRangeAt(0);
        var editorDom = editor.view.dom;
        if (!editorDom.contains(range.commonAncestorContainer)) {
            toolbar.style.display = 'none';
            return;
        }

        var rect = range.getBoundingClientRect();
        if (!rect || rect.width === 0) {
            toolbar.style.display = 'none';
            return;
        }

        var editorRect = editorDom.getBoundingClientRect();
        // 固定定位：相对编辑器容器
        toolbar.style.position = 'fixed';
        toolbar.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - toolbar.offsetWidth / 2, window.innerWidth - toolbar.offsetWidth - 8)) + 'px';
        toolbar.style.top = Math.max(8, rect.top - toolbar.offsetHeight - 8) + 'px';
        toolbar.style.zIndex = '2800';
        toolbar.style.display = 'flex';
    }

    /* ===== 颜色 / 高亮调色板（供工具栏弹层复用） ===== */
    var TEXT_COLORS = ['#e03131', '#f08c00', '#f59f00', '#2f9e44', '#1971c2', '#7048e8', '#e64980', '#343a40'];
    var HL_COLORS = ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#f3d9fa', '#ffe8cc'];

    /** 构建色块弹层：点击色块回调 onPick，点击底部按钮回调 onClear */
    function buildColorPopover(colors, onPick, onClear, clearLabel) {
        var pop = document.createElement('div');
        pop.className = 'tiptap-color-popover';
        var grid = document.createElement('div');
        grid.className = 'tiptap-color-grid';
        colors.forEach(function (c) {
            var sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'tiptap-color-swatch';
            sw.style.background = c;
            sw.title = c;
            sw.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); onPick(c); });
            grid.appendChild(sw);
        });
        pop.appendChild(grid);
        var clr = document.createElement('button');
        clr.type = 'button';
        clr.className = 'tiptap-color-clear';
        clr.textContent = clearLabel || '清除';
        clr.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); onClear(); });
        pop.appendChild(clr);
        return pop;
    }

    /**
     * 创建带下拉弹层的工具栏按钮（颜色 / 高亮）。
     * @param {HTMLElement} container 工具栏容器
     * @param {object} def { label, title, buildPopover(close) }
     */
    function createPopoverButton(container, def) {
        var wrap = document.createElement('span');
        wrap.className = 'tiptap-fixed-popover-wrap';
        var btn = document.createElement('button');
        btn.className = 'tiptap-fixed-btn';
        btn.innerHTML = def.label;
        btn.title = def.title;
        btn.type = 'button';
        var pop = null;
        function closePop() {
            if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', onOutside); }
        }
        function onOutside(e) { if (!wrap.contains(e.target)) closePop(); }
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (pop) { closePop(); return; }
            pop = def.buildPopover(closePop);
            wrap.appendChild(pop);
            setTimeout(function () { document.addEventListener('mousedown', onOutside); }, 0);
            console.log('[面板] 打开' + def.title + '弹层');
        });
        wrap.appendChild(btn);
        container.appendChild(wrap);
        return btn;
    }

    /**
     * 处理插入 / 编辑 / 移除超链接。
     * 已在链接上时直接移除；否则弹出输入框（禁用原生 prompt，改用 ns.showPrompt）。
     * @param {Editor} editor - Tiptap Editor 实例
     */
    function promptLink(editor) {
        // 光标已落在链接内 → 视为“取消链接”
        if (editor.isActive('link')) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            console.log('[编辑] 移除超链接');
            return;
        }
        var prev = editor.getAttributes('link').href || '';
        var applyLink = function (url) {
            if (url === null || url === undefined) return; // 用户取消
            url = String(url).trim();
            if (!url) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
            // 自动补全协议，避免相对路径失效
            if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) url = 'https://' + url;
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            console.log('[编辑] 设置超链接 ' + url);
        };
        // ns.showPrompt 返回 Promise<string|null>；用 Promise.resolve 兼容同步兜底
        if (ns.showPrompt) {
            Promise.resolve(ns.showPrompt('请输入链接地址', { defaultValue: prev, placeholder: 'https://' })).then(applyLink);
        } else if (ns.showToast) {
            ns.showToast('链接输入组件不可用', 'error');
        }
    }

    /* ===== 固定置顶工具栏（始终可见，更丰富功能） ===== */

    /**
     * 创建固定置顶工具栏，挂载到指定容器
     * 与气泡工具栏共享同一 Editor 实例，通过事件自动同步按钮状态。
     */
    function createFixedToolbar(editor) {
        var container = document.getElementById('tiptapFixedToolbar');
        if (!container) return null;
        // 清除旧的按钮（防止不同编辑器实例残留）
        container.innerHTML = '';

        var allBtns = [];

        /** 追加分隔符 */
        function addSep() {
            var sep = document.createElement('span');
            sep.className = 'tiptap-fixed-sep';
            container.appendChild(sep);
        }

        /** 追加一个普通切换按钮，并登记到 allBtns 供状态同步 */
        function addButton(def) {
            var btn = document.createElement('button');
            btn.className = 'tiptap-fixed-btn';
            btn.innerHTML = def.label;
            btn.title = def.title;
            btn.type = 'button';
            btn.addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                def.action();
            });
            btn._update = function () {
                btn.classList.toggle('active', def.isActive ? def.isActive() : false);
                if (def.disabled) btn.disabled = def.disabled();
            };
            btn._update();
            container.appendChild(btn);
            allBtns.push(btn);
            return btn;
        }

        // ---- 标题级别选择 ----
        var headingSelect = document.createElement('select');
        headingSelect.className = 'tiptap-fixed-heading-select';
        headingSelect.title = '段落 / 标题级别';
        headingSelect.innerHTML =
            '<option value="">正文</option>' +
            '<option value="1">标题 1</option>' +
            '<option value="2">标题 2</option>' +
            '<option value="3">标题 3</option>';
        headingSelect.addEventListener('change', function () {
            var level = this.value;
            if (level) {
                editor.chain().focus().toggleHeading({ level: parseInt(level) }).run();
            } else {
                editor.chain().focus().setParagraph().run();
            }
        });
        container.appendChild(headingSelect);

        // ---- 字号选择 ----
        var fontSizeSelect = document.createElement('select');
        fontSizeSelect.className = 'tiptap-fixed-fontsize-select';
        fontSizeSelect.title = '字号';
        fontSizeSelect.innerHTML =
            '<option value="">字号</option>' +
            ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'].map(function (s) {
                return '<option value="' + s + '">' + parseInt(s, 10) + '</option>';
            }).join('');
        fontSizeSelect.addEventListener('change', function () {
            var size = this.value;
            if (size) {
                editor.chain().focus().setFontSize(size).run();
                console.log('[编辑] 应用字号 ' + size);
            } else {
                editor.chain().focus().unsetFontSize().run();
                console.log('[编辑] 清除字号');
            }
        });
        container.appendChild(fontSizeSelect);

        addSep();

        // ---- 行内格式 ----
        addButton({ label: '<b>B</b>', title: '加粗 (Ctrl+B)', action: function () { editor.chain().focus().toggleBold().run(); }, isActive: function () { return editor.isActive('bold'); } });
        addButton({ label: '<i>I</i>', title: '斜体 (Ctrl+I)', action: function () { editor.chain().focus().toggleItalic().run(); }, isActive: function () { return editor.isActive('italic'); } });
        addButton({ label: '<u>U</u>', title: '下划线 (Ctrl+U)', action: function () { editor.chain().focus().toggleUnderline().run(); }, isActive: function () { return editor.isActive('underline'); } });
        addButton({ label: '<s>S</s>', title: '删除线', action: function () { editor.chain().focus().toggleStrike().run(); }, isActive: function () { return editor.isActive('strike'); } });
        addButton({ label: '&lt;/&gt;', title: '行内代码', action: function () { editor.chain().focus().toggleCode().run(); }, isActive: function () { return editor.isActive('code'); } });

        // ---- 文字颜色 / 高亮（下拉调色板）----
        var colorBtn = createPopoverButton(container, {
            label: '<span class="tiptap-ico-color">A</span>',
            title: '文字颜色',
            buildPopover: function (close) {
                return buildColorPopover(TEXT_COLORS, function (c) {
                    editor.chain().focus().setColor(c).run();
                    console.log('[编辑] 应用文字颜色 ' + c);
                    close();
                }, function () {
                    editor.chain().focus().unsetColor().run();
                    console.log('[编辑] 清除文字颜色');
                    close();
                }, '清除颜色');
            }
        });
        var hlBtn = createPopoverButton(container, {
            label: '<span class="tiptap-ico-hl">A</span>',
            title: '高亮',
            buildPopover: function (close) {
                return buildColorPopover(HL_COLORS, function (c) {
                    editor.chain().focus().toggleHighlight({ color: c }).run();
                    console.log('[编辑] 应用高亮 ' + c);
                    close();
                }, function () {
                    editor.chain().focus().unsetHighlight().run();
                    console.log('[编辑] 清除高亮');
                    close();
                }, '清除高亮');
            }
        });

        addSep();

        // ---- 段落对齐（CSS 绘制图标，跟随主题色）----
        addButton({ label: '<span class="tiptap-ico-align tiptap-ico-align-left"></span>', title: '左对齐', action: function () { editor.chain().focus().setTextAlign('left').run(); }, isActive: function () { return editor.isActive({ textAlign: 'left' }); } });
        addButton({ label: '<span class="tiptap-ico-align tiptap-ico-align-center"></span>', title: '居中对齐', action: function () { editor.chain().focus().setTextAlign('center').run(); }, isActive: function () { return editor.isActive({ textAlign: 'center' }); } });
        addButton({ label: '<span class="tiptap-ico-align tiptap-ico-align-right"></span>', title: '右对齐', action: function () { editor.chain().focus().setTextAlign('right').run(); }, isActive: function () { return editor.isActive({ textAlign: 'right' }); } });

        addSep();

        // ---- 块级格式 ----
        addButton({ label: '•≡', title: '无序列表', action: function () { editor.chain().focus().toggleBulletList().run(); }, isActive: function () { return editor.isActive('bulletList'); } });
        addButton({ label: '1.≡', title: '有序列表', action: function () { editor.chain().focus().toggleOrderedList().run(); }, isActive: function () { return editor.isActive('orderedList'); } });
        addButton({ label: '☑≡', title: '任务列表', action: function () { editor.chain().focus().toggleTaskList().run(); }, isActive: function () { return editor.isActive('taskList'); } });
        addButton({ label: '❝', title: '引用块', action: function () { editor.chain().focus().toggleBlockquote().run(); }, isActive: function () { return editor.isActive('blockquote'); } });
        addButton({ label: '⌨', title: '代码块', action: function () { editor.chain().focus().toggleCodeBlock().run(); }, isActive: function () { return editor.isActive('codeBlock'); } });
        addButton({ label: '─', title: '水平分割线', action: function () { editor.chain().focus().setHorizontalRule().run(); }, isActive: function () { return false; } });

        addSep();

        // ---- 链接 / 清除格式 ----
        addButton({ label: '🔗', title: '插入 / 编辑链接', action: function () { promptLink(editor); }, isActive: function () { return editor.isActive('link'); } });
        addButton({ label: '🧹', title: '清除格式', action: function () { editor.chain().focus().unsetAllMarks().run(); console.log('[编辑] 清除行内格式'); }, isActive: function () { return false; } });

        addSep();

        // ---- 历史 ----
        addButton({ label: '↶', title: '撤销 (Ctrl+Z)', action: function () { editor.chain().focus().undo().run(); }, isActive: function () { return false; }, disabled: function () { return !editor.can().undo(); } });
        addButton({ label: '↷', title: '重做 (Ctrl+Y)', action: function () { editor.chain().focus().redo().run(); }, isActive: function () { return false; }, disabled: function () { return !editor.can().redo(); } });

        addSep();

        // ---- 任务列表视图：隐藏已完成 ----
        // 落点为“笔记任务列表分组折叠”：勾选后隐藏 data-checked=true 的任务项，
        // 让未完成任务保持聚焦，方便持续追加，避免任务过多难以处理。
        var HIDE_DONE_KEY = 'note_hide_completed_tasks';
        var hideDoneOn = false;
        try { hideDoneOn = !!(ns.storage && ns.storage.get(HIDE_DONE_KEY, false)); } catch (e) { hideDoneOn = false; }

        var hideDoneBtn = document.createElement('button');
        hideDoneBtn.className = 'tiptap-fixed-btn tiptap-fixed-hidedone';
        hideDoneBtn.type = 'button';
        container.appendChild(hideDoneBtn);

        /** 应用 / 取消“隐藏已完成任务”视图，同步按钮态与已完成计数徽标 */
        function applyHideDone() {
            var dom = editor.view && editor.view.dom;
            if (!dom) return;
            dom.classList.toggle('wb-hide-completed', hideDoneOn);
            hideDoneBtn.classList.toggle('active', hideDoneOn);
            hideDoneBtn.title = hideDoneOn ? '点击显示已完成任务' : '点击隐藏已完成任务';
            var doneCount = dom.querySelectorAll('li[data-type="taskItem"][data-checked="true"]').length;
            var badge = doneCount > 0 ? '<span class="tiptap-hidedone-count">' + doneCount + '</span>' : '';
            hideDoneBtn.innerHTML = (hideDoneOn ? '☑' : '☐') + '<span class="tiptap-hidedone-label">已完成</span>' + badge;
        }
        hideDoneBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            hideDoneOn = !hideDoneOn;
            try { if (ns.storage) ns.storage.set(HIDE_DONE_KEY, hideDoneOn); } catch (err) { /* 存储不可用时忽略 */ }
            applyHideDone();
            console.log('[编辑] 切换隐藏已完成任务 = ' + hideDoneOn);
        });

        // 监听编辑器状态 → 同步所有按钮 + 两个下拉选择器 + 已完成计数
        function syncAll() {
            allBtns.forEach(function (b) { if (b._update) b._update(); });
            // 同步标题选择器
            var activeHeadings = [1, 2, 3].filter(function (l) { return editor.isActive('heading', { level: l }); });
            headingSelect.value = activeHeadings.length > 0 ? String(activeHeadings[0]) : '';
            // 同步字号选择器（无匹配时回落到占位项）
            var curStyle = editor.getAttributes('textStyle') || {};
            fontSizeSelect.value = curStyle.fontSize || '';
            // 刷新已完成任务计数（勾选/取消勾选会触发 transaction）
            applyHideDone();
        }

        editor.on('selectionUpdate', syncAll);
        editor.on('transaction', syncAll);

        // 初始应用持久化的“隐藏已完成”状态
        applyHideDone();

        console.log('[Tiptap] 固定置顶工具栏已创建');
        return { container: container, btns: allBtns, syncFn: syncAll };
    }

    /* ===== 公开 API ===== */

    ns.tiptapEditor = {
        /**
         * 创建 Tiptap 编辑器
         * @param {string} selector - CSS 选择器（如 '#wbNoteContent'）
         * @param {string} content - 初始 HTML 内容
         * @param {object} [opts] - 可选配置 { extensions, placeholder, editable, onUpdate }
         * @returns {string} 编辑器实例 ID
         */
        create: function (selector, content, opts) {
            var el = document.querySelector(selector);
            if (!el) { console.warn('[Tiptap] 目标元素未找到: ' + selector); return null; }

            opts = opts || {};
            var id = opts.id || ('tiptap_' + Date.now());

            // 销毁同名旧实例
            if (_instances[id]) {
                _instances[id].editor.destroy();
                if (_instances[id].toolbar) _instances[id].toolbar.remove();
                delete _instances[id];
            }

            var extensions = opts.extensions || DEFAULT_EXTENSIONS;
            var editor = new Editor({
                element: el,
                content: content || '',
                editable: opts.editable !== false,
                extensions: extensions,
                editorProps: buildEditorProps(opts),
                onUpdate: function () {
                    if (opts.onUpdate) opts.onUpdate();
                }
            });

            // 创建气泡工具栏（浮动的）和固定置顶工具栏
            var bubbleToolbar = createBubbleToolbar(editor);
            var fixedToolbar = createFixedToolbar(editor);

            // 点击编辑器外部区域时隐藏气泡
            document.addEventListener('mousedown', function hideBubble(e) {
                if (!bubbleToolbar.contains(e.target) && !el.contains(e.target)) {
                    bubbleToolbar.style.display = 'none';
                }
            });

            _instances[id] = {
                editor: editor,
                bubbleToolbar: bubbleToolbar,
                fixedToolbar: fixedToolbar,
                el: el
            };
            console.log('[Tiptap] 编辑器已创建 id=' + id);
            return id;
        },

        /** 获取 HTML 内容 */
        getHTML: function (id) {
            var inst = _instances[id];
            return inst ? inst.editor.getHTML() : '';
        },

        /** 获取纯文本内容 */
        getText: function (id) {
            var inst = _instances[id];
            return inst ? inst.editor.getText() : '';
        },

        /** 设置内容 */
        setContent: function (id, html) {
            var inst = _instances[id];
            if (inst) inst.editor.commands.setContent(html || '');
        },

        /** 销毁编辑器 */
        destroy: function (id) {
            var inst = _instances[id];
            if (!inst) return;
            inst.editor.destroy();
            if (inst.bubbleToolbar && inst.bubbleToolbar.parentNode) inst.bubbleToolbar.remove();
            // 固定工具栏的 DOM 不清除（容器 #tiptapFixedToolbar 保留，下次 open 时复用）
            delete _instances[id];
            console.log('[Tiptap] 编辑器已销毁 id=' + id);
        },

        /** 获取原生 Editor 实例（高级自定义） */
        getEditor: function (id) {
            var inst = _instances[id];
            return inst ? inst.editor : null;
        },

        /** 测试辅助：验证任务列表剪贴板文本不会产生多余空行 */
        _serializeTaskClipboardText: serializeTaskClipboardText,

        /** 测试辅助：验证任务列表剪贴板 HTML 不继承默认空白 */
        _serializeTaskClipboardHtml: serializeTaskClipboardHtml
    };

})(window.DevHome);
