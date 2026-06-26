/**
 * DevHome Workbench v2 — ProseMirror 编辑器模块
 *
 * 职责：
 *   1. 封装 ProseMirror 编辑器创建、销毁、状态同步全生命周期
 *   2. 定义 Schema、插件、输入规则
 *   3. 代码块 NodeView 注册（Phase 3）
 *   4. 气泡工具栏位置计算（Phase 4）
 *   5. 字数统计实时更新
 *
 * 暴露 API（挂载到 window.DevHome）:
 *   pmCreateEditor(domParent, note, callbacks)
 *   pmDestroyEditor()
 *   pmGetDocJSON()
 *   pmGetDocHTML()
 *   pmGetWordCount()
 *   pmSetContent(docJSON)
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var PM = window.PM;
    if (!PM) {
        console.error('[PM编辑器] ProseMirror bundle 未加载');
        return;
    }

    // ================================================================
    // Schema 定义（与 migrateNoteDoc 共用节点结构，新增 textColor mark）
    // ================================================================

    function buildSchema() {
        return new PM.Schema({
            nodes: {
                doc: { content: 'block+' },
                paragraph: {
                    group: 'block', content: 'inline*',
                    parseDOM: [{ tag: 'p' }],
                    toDOM: function () { return ['p', 0]; }
                },
                heading: {
                    group: 'block', content: 'inline*',
                    attrs: { level: { default: 1 } },
                    parseDOM: [
                        { tag: 'h1', attrs: { level: 1 } },
                        { tag: 'h2', attrs: { level: 2 } },
                        { tag: 'h3', attrs: { level: 3 } },
                        { tag: 'h4', attrs: { level: 4 } },
                        { tag: 'h5', attrs: { level: 5 } },
                        { tag: 'h6', attrs: { level: 6 } }
                    ],
                    toDOM: function (node) { return ['h' + node.attrs.level, 0]; }
                },
                code_block: {
                    group: 'block', content: 'text*',
                    attrs: { language: { default: '' } },
                    isolating: true,
                    parseDOM: [{
                        tag: 'pre',
                        getAttrs: function (dom) { return { language: dom.getAttribute('data-lang') || '' }; }
                    }],
                    toDOM: function (node) { return ['pre', { 'data-lang': node.attrs.language }, ['code', 0]]; }
                },
                bullet_list: {
                    group: 'block', content: 'list_item+',
                    parseDOM: [{ tag: 'ul' }],
                    toDOM: function () { return ['ul', 0]; }
                },
                ordered_list: {
                    group: 'block', content: 'list_item+',
                    attrs: { order: { default: 1 } },
                    parseDOM: [{ tag: 'ol' }],
                    toDOM: function () { return ['ol', 0]; }
                },
                list_item: {
                    content: 'paragraph+',
                    parseDOM: [{ tag: 'li' }],
                    toDOM: function () { return ['li', 0]; }
                },
                blockquote: {
                    group: 'block', content: 'block+',
                    parseDOM: [{ tag: 'blockquote' }],
                    toDOM: function () { return ['blockquote', 0]; }
                },
                horizontal_rule: {
                    group: 'block',
                    parseDOM: [{ tag: 'hr' }],
                    toDOM: function () { return ['hr']; }
                },
                text: {
                    group: 'inline'
                }
            },
            marks: {
                em: {
                    parseDOM: [{ tag: 'em' }, { tag: 'i' }],
                    toDOM: function () { return ['em', 0]; }
                },
                strong: {
                    parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
                    toDOM: function () { return ['strong', 0]; }
                },
                underline: {
                    parseDOM: [{ tag: 'u' }],
                    toDOM: function () { return ['u', 0]; }
                },
                link: {
                    attrs: { href: { default: '' } },
                    parseDOM: [{ tag: 'a[href]', getAttrs: function (dom) { return { href: dom.getAttribute('href') }; } }],
                    toDOM: function (node) { return ['a', { href: node.attrs.href }, 0]; }
                },
                code: {
                    parseDOM: [{ tag: 'code' }],
                    toDOM: function () { return ['code', 0]; }
                },
                textColor: {
                    attrs: { color: { default: '' } },
                    parseDOM: [{ style: 'color', getAttrs: function (value) { return { color: value }; } }],
                    toDOM: function (node) { return ['span', { style: 'color:' + node.attrs.color }, 0]; }
                }
            }
        });
    }

    var schema = buildSchema();

    // ================================================================
    // 输入规则（Markdown 快捷键）
    // ================================================================

    function buildInputRules() {
        return PM.inputRules({ rules: [
            // # 空格 → heading 1
            new PM.InputRule(/^# $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.heading, { level: 1 });
                return tr;
            }),
            // ## 空格 → heading 2
            new PM.InputRule(/^## $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.heading, { level: 2 });
                return tr;
            }),
            // ### 空格 → heading 3
            new PM.InputRule(/^### $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.heading, { level: 3 });
                return tr;
            }),
            // - 或 * 空格 → bullet_list
            new PM.InputRule(/^[-*] $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                var $pos = tr.doc.resolve(from);
                var range = $pos.blockRange();
                if (range) {
                    tr.lift(range, 0);
                    PM.wrapIn(schema.nodes.bullet_list)(state, function (innerTr) { tr = innerTr; });
                }
                return tr;
            }),
            // 1. 空格 → ordered_list
            new PM.InputRule(/^1\. $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                var $pos = tr.doc.resolve(from);
                var range = $pos.blockRange();
                if (range) {
                    tr.lift(range, 0);
                    PM.wrapIn(schema.nodes.ordered_list)(state, function (innerTr) { tr = innerTr; });
                }
                return tr;
            }),
            // > 空格 → blockquote
            new PM.InputRule(/^> $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                var $pos = tr.doc.resolve(from);
                var range = $pos.blockRange();
                if (range) {
                    PM.wrapIn(schema.nodes.blockquote)(state, function (innerTr) { tr = innerTr; });
                }
                return tr;
            }),
            // ``` 空格 → code_block
            new PM.InputRule(/^``` $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.code_block, { language: '' });
                return tr;
            })
        ]});
    }

    // ================================================================
    // 自定义快捷键
    // ================================================================

    function buildKeymap() {
        var map = {};
        var mac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false;
        var mod = mac ? 'Cmd' : 'Ctrl';

        function bind(key, cmd) {
            map[mod + '-' + key] = cmd;
        }

        bind('b', PM.toggleMark(schema.marks.strong));
        bind('i', PM.toggleMark(schema.marks.em));
        bind('u', PM.toggleMark(schema.marks.underline));

        return PM.keymap(map);
    }

    // ================================================================
    // 所有插件
    // ================================================================

    function createPlugins() {
        return [
            PM.keymap(PM.baseKeymap),
            buildKeymap(),
            buildInputRules(),
            PM.history(),
            PM.dropCursor(),
            PM.gapCursor(),
            bubbleToolbarPlugin()
        ];
    }

    // ================================================================
    // 编辑器状态
    // ================================================================
    var editorView = null;
    var editorCallbacks = {};
    var wordCountEl = null;

    /**
     * 创建 ProseMirror 编辑器并挂载到 DOM
     * @param {Element} domParent - 挂载父节点（替换旧的 contenteditable div）
     * @param {object} note - 笔记数据对象
     * @param {object} callbacks - { onChange, onFocus }
     */
    ns.pmCreateEditor = function (domParent, note, callbacks) {
        // 幂等：销毁旧实例
        ns.pmDestroyEditor();

        editorCallbacks = callbacks || {};

        // 解析笔记 doc JSON 为 ProseMirror Node
        var docNode;
        if (note.doc && note.doc.type === 'doc') {
            try {
                docNode = PM.Node.fromJSON(schema, note.doc);
            } catch (e) {
                console.warn('[PM编辑器] doc JSON 解析失败，使用空文档', e.message);
                docNode = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
            }
        } else {
            // 无 doc 字段时创建空文档
            docNode = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
        }

        // 清空父节点
        domParent.innerHTML = '';

        // 创建编辑器
        var state = PM.EditorState.create({
            schema: schema,
            doc: docNode,
            plugins: createPlugins()
        });

        editorView = new PM.EditorView(domParent, {
            state: state,
            nodeViews: {
                code_block: function (node, view, getPos) {
                    return new CodeBlockView(node, view, getPos);
                }
            },
            dispatchTransaction: function (tr) {
                var newState = editorView.state.apply(tr);
                editorView.updateState(newState);

                // 触发 onChange 回调（自动保存）
                if (editorCallbacks.onChange) {
                    editorCallbacks.onChange();
                }

                // 实时更新字数统计
                updateWordCountUI();
            }
        });

        // 添加 ProseMirror 容器类名（与 CSS 样式对接）
        editorView.dom.classList.add('wb-prosemirror-editor');

        // 初始化字数统计 UI
        wordCountEl = document.getElementById('wbNoteWordCount');
        updateWordCountUI();

        console.log('[PM编辑器] 创建完成 id=' + note.id);
        return editorView;
    };

    /**
     * 销毁当前编辑器实例
     */
    ns.pmDestroyEditor = function () {
        if (editorView) {
            editorView.destroy();
            editorView = null;
            editorCallbacks = {};
            wordCountEl = null;
            console.log('[PM编辑器] 已销毁');
        }
    };

    /**
     * 获取当前文档 JSON（用于存储）
     * @returns {object|null} ProseMirror doc JSON
     */
    ns.pmGetDocJSON = function () {
        if (!editorView) return null;
        return editorView.state.doc.toJSON();
    };

    /**
     * 获取当前文档 HTML（向后兼容列表搜索和预览）
     * @returns {string} HTML 字符串
     */
    ns.pmGetDocHTML = function () {
        if (!editorView) return '';
        var serializer = PM.DOMSerializer.fromSchema(schema);
        var frag = serializer.serializeFragment(editorView.state.doc.content);
        var div = document.createElement('div');
        div.appendChild(frag);
        return div.innerHTML;
    };

    /**
     * 获取当前文档字数
     * @returns {number}
     */
    ns.pmGetWordCount = function () {
        if (!editorView) return 0;
        return ns._countWordsFromDoc(editorView.state.doc);
    };

    /**
     * 设置文档内容（用于加载笔记时初始化）
     * @param {object} docJSON - ProseMirror doc JSON
     */
    ns.pmSetContent = function (docJSON) {
        if (!editorView || !docJSON) return;
        try {
            var doc = PM.Node.fromJSON(schema, docJSON);
            var tr = editorView.state.tr.replaceWith(
                0, editorView.state.doc.content.size,
                doc.content
            );
            editorView.dispatch(tr);
        } catch (e) {
            console.error('[PM编辑器] setContent 失败', e);
        }
    };

    /**
     * 从 ProseMirror doc 节点计算字数
     * @param {Node} doc - ProseMirror doc 节点
     * @returns {number}
     */
    ns._countWordsFromDoc = function (doc) {
        var text = doc.textContent || '';
        return ns.countWords(text);
    };

    /**
     * 获取编辑器当前是否活跃
     * @returns {boolean}
     */
    ns.pmIsActive = function () {
        return editorView !== null;
    };

    /**
     * 获取 EditorView 引用（供气泡工具栏等使用）
     * @returns {EditorView|null}
     */
    ns.pmGetView = function () {
        return editorView;
    };

    // ================================================================
    // 字数统计 UI 更新
    // ================================================================

    function updateWordCountUI() {
        if (!wordCountEl || !editorView) return;
        var count = ns._countWordsFromDoc(editorView.state.doc);
        wordCountEl.textContent = count + ' 字';
    }

    console.log('[PM编辑器] 模块加载完成');

    // ================================================================
    // Phase 3: 代码块 NodeView
    // ================================================================

    /** 支持的语言列表（与 highlight.js 注册的一致） */
    var CODE_LANGUAGES = [
        { key: '', label: '纯文本' },
        { key: 'javascript', label: 'JavaScript' },
        { key: 'typescript', label: 'TypeScript' },
        { key: 'python', label: 'Python' },
        { key: 'java', label: 'Java' },
        { key: 'cpp', label: 'C++' },
        { key: 'csharp', label: 'C#' },
        { key: 'go', label: 'Go' },
        { key: 'rust', label: 'Rust' },
        { key: 'ruby', label: 'Ruby' },
        { key: 'php', label: 'PHP' },
        { key: 'swift', label: 'Swift' },
        { key: 'kotlin', label: 'Kotlin' },
        { key: 'sql', label: 'SQL' },
        { key: 'html', label: 'HTML' },
        { key: 'css', label: 'CSS' },
        { key: 'json', label: 'JSON' },
        { key: 'yaml', label: 'YAML' },
        { key: 'bash', label: 'Bash' },
        { key: 'markdown', label: 'Markdown' }
    ];

    /**
     * CodeBlockView — ProseMirror NodeView
     * 渲染带语言下拉+复制按钮+编辑模式的代码块
     */
    function CodeBlockView(node, view, getPos) {
        this._node = node;
        this._view = view;
        this._getPos = getPos;
        this._editing = false;

        // 构建 DOM
        this.dom = document.createElement('div');
        this.dom.className = 'wb-codeblock';
        this.dom.setAttribute('contenteditable', 'false');

        // 工具栏
        var toolbar = document.createElement('div');
        toolbar.className = 'wb-codeblock-toolbar';

        // 语言下拉
        var sel = document.createElement('select');
        sel.className = 'wb-codeblock-lang';
        CODE_LANGUAGES.forEach(function (l) {
            var opt = document.createElement('option');
            opt.value = l.key;
            opt.textContent = l.label;
            if (l.key === node.attrs.language) opt.selected = true;
            sel.appendChild(opt);
        });
        var self = this;
        sel.addEventListener('change', function () {
            var tr = view.state.tr.setNodeMarkup(getPos(), null, { language: sel.value });
            view.dispatch(tr);
        });

        // 复制按钮
        var copyBtn = document.createElement('button');
        copyBtn.className = 'wb-codeblock-copy';
        copyBtn.title = '复制代码';
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(node.textContent).then(function () {
                copyBtn.textContent = '✅ 已复制';
                setTimeout(function () { copyBtn.textContent = '📋'; }, 1500);
            }).catch(function () {
                copyBtn.textContent = '❌';
                setTimeout(function () { copyBtn.textContent = '📋'; }, 1500);
            });
        });

        toolbar.appendChild(sel);
        toolbar.appendChild(copyBtn);
        this.dom.appendChild(toolbar);

        // 代码显示区
        this._pre = document.createElement('pre');
        this._pre.className = 'wb-codeblock-pre';
        this._code = document.createElement('code');
        this._code.className = 'hljs';
        this._code.textContent = node.textContent;
        this._pre.appendChild(this._code);
        this.dom.appendChild(this._pre);

        // 编辑 textarea（默认隐藏）
        this._textarea = document.createElement('textarea');
        this._textarea.className = 'wb-codeblock-textarea';
        this._textarea.style.display = 'none';
        this._textarea.value = node.textContent;
        this.dom.appendChild(this._textarea);

        // 高亮代码
        this._highlight();

        // 双击进入编辑模式
        var _this = this;
        this._pre.addEventListener('dblclick', function () {
            _this._startEdit();
        });

        // textarea 失焦或 Ctrl+Enter 保存
        this._textarea.addEventListener('blur', function () {
            _this._finishEdit();
        });
        this._textarea.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                _this._finishEdit();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                _this._textarea.value = _this._node.textContent;
                _this._finishEdit();
            }
        });
    }

    /** 语法高亮 */
    CodeBlockView.prototype._highlight = function () {
        if (window.hljs && this._node.attrs.language) {
            this._code.className = 'hljs language-' + this._node.attrs.language;
            this._code.innerHTML = window.hljs.highlight(this._node.textContent, { language: this._node.attrs.language }).value;
        } else if (window.hljs) {
            this._code.className = 'hljs';
            this._code.innerHTML = window.hljs.highlightAuto(this._node.textContent).value;
        } else {
            this._code.textContent = this._node.textContent;
        }
    };

    /** 开始编辑 */
    CodeBlockView.prototype._startEdit = function () {
        this._editing = true;
        this._pre.style.display = 'none';
        this._textarea.style.display = 'block';
        this._textarea.value = this._node.textContent;
        this._textarea.focus();
    };

    /** 完成编辑 */
    CodeBlockView.prototype._finishEdit = function () {
        if (!this._editing) return;
        this._editing = false;
        var newText = this._textarea.value;
        this._pre.style.display = '';
        this._textarea.style.display = 'none';
        if (newText !== this._node.textContent) {
            var tr = this._view.state.tr;
            var pos = this._getPos();
            tr.replaceWith(pos + 1, pos + this._node.nodeSize - 1,
                this._node.type.schema.text(newText));
            this._view.dispatch(tr);
        }
    };

    /** ProseMirror update 回调 */
    CodeBlockView.prototype.update = function (node) {
        if (node.type !== this._node.type) return false;
        this._node = node;
        if (node.attrs.language !== this._node.attrs.language ||
            node.textContent !== this._code.textContent) {
            if (!this._editing) {
                this._code.textContent = node.textContent;
                this._textarea.value = node.textContent;
                this._highlight();
            }
        }
        // 更新下拉选中
        var sel = this.dom.querySelector('.wb-codeblock-lang');
        if (sel && sel.value !== node.attrs.language) {
            sel.value = node.attrs.language || '';
        }
        return true;
    };

    /** 清理 */
    CodeBlockView.prototype.destroy = function () {
        this.dom = null;
        this._view = null;
    };

    /** NodeView 忽略子节点事件（让 PM 处理内部光标） */
    CodeBlockView.prototype.ignoreMutation = function () { return true; };
    CodeBlockView.prototype.stopEvent = function () { return false; };

    // ================================================================
    // Phase 4: 气泡工具栏插件
    // ================================================================

    var bubbleToolbar = null;
    var bubbleHideTimer = null;

    /**
     * 气泡工具栏插件 — 选中文字时浮现格式按钮
     */
    function bubbleToolbarPlugin() {
        return new PM.Plugin({
            view: function () {
                return {
                    update: function (view, prevState) {
                        var sel = view.state.selection;
                        // 只处理 TextSelection
                        if (!(sel instanceof PM.TextSelection) || sel.empty) {
                            hideBubbleToolbar();
                            return;
                        }
                        // 延迟显示（避免快速连续选区变化抖动）
                        clearTimeout(bubbleHideTimer);
                        bubbleHideTimer = setTimeout(function () {
                            showBubbleToolbar(view);
                        }, 50);
                    }
                };
            }
        });
    }

    /** 显示气泡工具栏 */
    function showBubbleToolbar(view) {
        bubbleToolbar = bubbleToolbar || document.getElementById('wbBubbleToolbar');
        if (!bubbleToolbar) return;

        var sel = view.state.selection;
        if (!(sel instanceof PM.TextSelection) || sel.empty) return;
        if (!view.hasFocus()) return;

        // 获取选区 DOM 位置
        var domSel = window.getSelection();
        if (!domSel || domSel.rangeCount === 0) return;
        var range = domSel.getRangeAt(0);
        if (!range || range.collapsed) return;

        var rect = range.getBoundingClientRect();
        if (!rect || rect.width === 0) return;

        // 计算位置（选区上方居中）
        var top = rect.top - bubbleToolbar.offsetHeight - 6;
        var left = rect.left + rect.width / 2 - bubbleToolbar.offsetWidth / 2;

        // 视口边界翻转
        if (top < 8) top = rect.bottom + 6;
        if (left < 8) left = 8;
        if (left + bubbleToolbar.offsetWidth > window.innerWidth - 8) {
            left = window.innerWidth - bubbleToolbar.offsetWidth - 8;
        }

        bubbleToolbar.style.top = top + 'px';
        bubbleToolbar.style.left = left + 'px';
        bubbleToolbar.style.display = 'flex';

        // 同步按钮激活状态
        ns._syncBubbleToolbarState(view.state);
    }

    /** 隐藏气泡工具栏 */
    function hideBubbleToolbar() {
        bubbleToolbar = bubbleToolbar || document.getElementById('wbBubbleToolbar');
        if (bubbleToolbar) {
            bubbleToolbar.style.display = 'none';
        }
    }

    /**
     * 同步气泡工具栏按钮激活状态
     * 供外部 events.js 调用
     */
    ns._syncBubbleToolbarState = function (state) {
        if (!bubbleToolbar) return;

        // Mark 状态按钮
        var marks = {
            bold: schema.marks.strong,
            italic: schema.marks.em,
            underline: schema.marks.underline
        };
        Object.keys(marks).forEach(function (key) {
            var btn = bubbleToolbar.querySelector('[data-pm-action="' + key + '"]');
            if (!btn) return;
            var active = false;
            state.doc.nodesBetween(state.selection.from, state.selection.to, function (node) {
                if (node.marks && node.marks.some(function (m) { return m.type === marks[key]; })) {
                    active = true;
                    return false;
                }
            });
            btn.classList.toggle('active', active);
        });

        // 标题下拉状态
        var headingSel = bubbleToolbar.querySelector('[data-pm-action="heading"]');
        if (headingSel) {
            var $from = state.selection.$from;
            var parentNode = $from.node($from.depth);
            if (parentNode && parentNode.type === schema.nodes.heading) {
                headingSel.value = String(parentNode.attrs.level);
            } else {
                headingSel.value = '';
            }
        }
    };

    /** 执行气泡工具栏命令（供 events.js 调用） */
    ns._executeBubbleAction = function (action, value) {
        var view = ns.pmGetView();
        if (!view) return;
        view.focus();

        switch (action) {
            case 'bold':
                PM.toggleMark(schema.marks.strong)(view.state, view.dispatch);
                break;
            case 'italic':
                PM.toggleMark(schema.marks.em)(view.state, view.dispatch);
                break;
            case 'underline':
                PM.toggleMark(schema.marks.underline)(view.state, view.dispatch);
                break;
            case 'heading':
                if (value) {
                    PM.setBlockType(schema.nodes.heading, { level: parseInt(value, 10) })(view.state, view.dispatch);
                } else {
                    PM.setBlockType(schema.nodes.paragraph)(view.state, view.dispatch);
                }
                break;
            case 'bulletList':
                PM.wrapIn(schema.nodes.bullet_list)(view.state, view.dispatch);
                break;
            case 'orderedList':
                PM.wrapIn(schema.nodes.ordered_list)(view.state, view.dispatch);
                break;
            case 'color':
                if (value) {
                    PM.toggleMark(schema.marks.textColor, { color: value })(view.state, view.dispatch);
                }
                break;
            case 'blockquote':
                PM.wrapIn(schema.nodes.blockquote)(view.state, view.dispatch);
                break;
            case 'codeBlock':
                PM.setBlockType(schema.nodes.code_block, { language: value || '' })(view.state, view.dispatch);
                break;
        }
        hideBubbleToolbar();
    };

})(window.DevHome);
