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

window.DevHome = window.DevHome || {};

(function (ns) {
    'use strict';

    /** 编辑器实例注册表 */
    var _instances = {};

    /** 默认扩展集（可覆盖） */
    var DEFAULT_EXTENSIONS = [
        StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            codeBlock: { HTMLAttributes: { class: 'tiptap-code-block' } },
            blockquote: { HTMLAttributes: { class: 'tiptap-blockquote' } },
            bulletList: { HTMLAttributes: { class: 'tiptap-list' } },
            orderedList: { HTMLAttributes: { class: 'tiptap-list' } }
        }),
        Placeholder.configure({
            placeholder: '在此编写内容...'
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
            { label: '•',  title: '无序列表', action: function () { editor.chain().focus().toggleBulletList().run(); },     isActive: function () { return editor.isActive('bulletList'); } },
            { label: '1.', title: '有序列表', action: function () { editor.chain().focus().toggleOrderedList().run(); },    isActive: function () { return editor.isActive('orderedList'); } },
            { label: '❝', title: '引用块',   action: function () { editor.chain().focus().toggleBlockquote().run(); },     isActive: function () { return editor.isActive('blockquote'); } },
            { label: '⌨', title: '代码块',   action: function () { editor.chain().focus().toggleCodeBlock().run(); },       isActive: function () { return editor.isActive('codeBlock'); } }
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

        var headingSelect = document.createElement('select');
        headingSelect.className = 'tiptap-fixed-heading-select';
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
            this.value = ''; // 重置选择器
        });
        container.appendChild(headingSelect);

        var sep1 = document.createElement('span');
        sep1.className = 'tiptap-fixed-sep';
        container.appendChild(sep1);

        // 按钮组定义
        var groups = [
            // 行内格式
            [
                { label: '<b>B</b>', title: '加粗 (Ctrl+B)',     action: function () { editor.chain().focus().toggleBold().run(); },          isActive: function () { return editor.isActive('bold'); } },
                { label: '<i>I</i>', title: '斜体 (Ctrl+I)',     action: function () { editor.chain().focus().toggleItalic().run(); },        isActive: function () { return editor.isActive('italic'); } },
                { label: '<u>U</u>', title: '下划线 (Ctrl+U)',   action: function () { editor.chain().focus().toggleUnderline().run(); },     isActive: function () { return editor.isActive('underline'); } },
                { label: '<s>S</s>', title: '删除线',           action: function () { editor.chain().focus().toggleStrike().run(); },        isActive: function () { return editor.isActive('strike'); } }
            ],
            // 块级格式
            [
                { label: '•≡', title: '无序列表',    action: function () { editor.chain().focus().toggleBulletList().run(); },      isActive: function () { return editor.isActive('bulletList'); } },
                { label: '1.≡',title: '有序列表',    action: function () { editor.chain().focus().toggleOrderedList().run(); },     isActive: function () { return editor.isActive('orderedList'); } },
                { label: '❝', title: '引用块',       action: function () { editor.chain().focus().toggleBlockquote().run(); },      isActive: function () { return editor.isActive('blockquote'); } },
                { label: '⌨', title: '代码块',       action: function () { editor.chain().focus().toggleCodeBlock().run(); },        isActive: function () { return editor.isActive('codeBlock'); } },
                { label: '─', title: '水平分割线',    action: function () { editor.chain().focus().setHorizontalRule().run(); },       isActive: function () { return false; } }
            ],
            // 历史
            [
                { label: '↶', title: '撤销 (Ctrl+Z)', action: function () { editor.chain().focus().undo().run(); },  isActive: function () { return false; }, disabled: function () { return !editor.can().undo(); } },
                { label: '↷', title: '重做 (Ctrl+Y)', action: function () { editor.chain().focus().redo().run(); },  isActive: function () { return false; }, disabled: function () { return !editor.can().redo(); } }
            ]
        ];

        // 非捕获笔记时追加"转为任务"操作按钮
        var currentNote = ns.state && ns.state.currentNote;
        var isCapture = currentNote && (currentNote._kind === 'capture' || currentNote.type === 'capture');
        if (currentNote && !isCapture) {
            groups.push([
                { label: '☑', title: '转为四象限任务', action: function () {
                    var toTaskBtn = document.getElementById('wbNoteToTaskBtn');
                    if (toTaskBtn) toTaskBtn.click();
                    console.log('[交互] 工具栏 转为任务');
                }, isActive: function () { return false; } }
            ]);
        }

        var allBtns = [];

        groups.forEach(function (group, gIdx) {
            if (gIdx > 0) {
                var sep = document.createElement('span');
                sep.className = 'tiptap-fixed-sep';
                container.appendChild(sep);
            }
            group.forEach(function (def) {
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
                    btn.classList.toggle('active', def.isActive());
                    if (def.disabled) btn.disabled = def.disabled();
                };
                btn._update();
                container.appendChild(btn);
                allBtns.push(btn);
            });
        });

        // 监听编辑器状态 → 同步所有按钮
        function syncAll() {
            allBtns.forEach(function (b) { if (b._update) b._update(); });
            // 同步标题选择器
            var activeHeadings = [1, 2, 3].filter(function (l) { return editor.isActive('heading', { level: l }); });
            headingSelect.value = activeHeadings.length > 0 ? String(activeHeadings[0]) : '';
        }

        editor.on('selectionUpdate', syncAll);
        editor.on('transaction', syncAll);

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
        }
    };

})(window.DevHome);
