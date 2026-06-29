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
 * 懒初始化设计：
 *   模块导出时不依赖 window.PM，所有 PM 操作在 pmCreateEditor 首次调用时懒初始化。
 *   这解决了 Chrome 扩展 newtab 页面中脚本加载顺序不确定的问题。
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

    // ================================================================
    // 获取 PM 引用（延迟求值，每次调用都检查 window.PM）
    // ================================================================
    function _getPM() {
        return window.PM || null;
    }

    // ================================================================
    // 懒初始化：schema 和插件只在首次调用 pmCreateEditor 时构建
    // ================================================================
    var _lazySchema = null;
    var _lazyPlugins = null;
    var _pmLoadPromise = null; // 动态加载 PM bundle 的 Promise

    /**
     * 确保 PM 和 Schema 已就绪（返回 Promise）
     * - 如果已初始化，立即 resolve(true)
     * - 如果 PM 可用，同步初始化并 resolve(true)
     * - 如果 PM 不可用，动态加载 pm.bundle.js 并等待加载完成后初始化
     */
    function _ensureInit() {
        if (_lazySchema) return Promise.resolve(true);

        var PM = _getPM();
        if (PM) {
            // PM 已就绪，同步初始化
            try {
                _lazySchema = _buildSchema(PM);
                _lazyPlugins = _createPlugins(PM, _lazySchema);
                console.log('[PM编辑器] 懒初始化完成 schema=' + Object.keys(_lazySchema.nodes).length + '节点');
                return Promise.resolve(true);
            } catch (e) {
                console.error('[PM编辑器] 初始化失败', e);
                return Promise.resolve(false);
            }
        }

        // PM 不可用，动态加载
        if (!_pmLoadPromise) {
            _pmLoadPromise = _loadPMBundle();
        }
        return _pmLoadPromise.then(function () {
            PM = _getPM();
            if (!PM) {
                console.error('[PM编辑器] 动态加载 PM bundle 后仍不可用');
                return false;
            }
            try {
                _lazySchema = _buildSchema(PM);
                _lazyPlugins = _createPlugins(PM, _lazySchema);
                console.log('[PM编辑器] 懒初始化完成（动态加载） schema=' + Object.keys(_lazySchema.nodes).length + '节点');
                return true;
            } catch (e) {
                console.error('[PM编辑器] 动态加载后初始化失败', e);
                return false;
            }
        });
    }

    /**
     * 加载 pm.bundle.js
     *
     * Chrome 扩展 newtab 页面 (chrome://newtab/) 中，相对路径 <script src> 可能无法正
     * 确映射到扩展文件。使用 chrome.runtime.getURL() 获取扩展文件的绝对路径
     * (chrome-extension://[id]/js/lib/pm.bundle.js)，确保 CSP 'self' 正确匹配。
     *
     * - 如果 window.PM 已就绪，直接 resolve
     * - 否则创建 <script> 标签加载，onload 后轮询确认 window.PM 可用
     */
    function _loadPMBundle() {
        return new Promise(function (resolve, reject) {
            if (window.PM) {
                resolve();
                return;
            }
            // 如果已有脚本标签存在但 PM 仍未就绪（极端情况），轮询等待
            var existing = document.querySelector('script[data-pm-loaded]');
            if (existing) {
                console.warn('[PM编辑器] pm.bundle.js 脚本标签已存在，src=' + existing.src + ' 轮询等待 window.PM...');
                _pollUntilPMReady(function () { resolve(); }, function () { reject(new Error('PM timeout (existing)')); });
                return;
            }

            // 使用 chrome.runtime.getURL() 获取扩展文件的绝对路径
            var scriptUrl;
            try {
                scriptUrl = chrome.runtime.getURL('js/lib/pm.bundle.js');
            } catch (_) {
                // 降级：非扩展环境使用相对路径
                scriptUrl = 'js/lib/pm.bundle.js';
            }
            console.log('[PM编辑器] window.PM 未就绪，动态加载: ' + scriptUrl);

            var script = document.createElement('script');
            script.src = scriptUrl;
            script.setAttribute('data-pm-loaded', '1');
            script.onload = function () {
                console.log('[PM编辑器] pm.bundle.js onload 触发，src=' + scriptUrl + ' 检查 window.PM...');
                // onload 触发后，PM 仍可能未赋值（bundle 内部 IIFE 还在执行）
                _pollUntilPMReady(function () {
                    console.log('[PM编辑器] pm.bundle.js 加载成功，window.PM 就绪');
                    resolve();
                }, function () {
                    console.error('[PM编辑器] pm.bundle.js onload 后 window.PM 仍不可用，src=' + scriptUrl);
                    reject(new Error('PM timeout after onload'));
                });
            };
            script.onerror = function (err) {
                console.error('[PM编辑器] pm.bundle.js 加载失败（onerror）src=' + scriptUrl, err);
                reject(new Error('pm.bundle.js load failed (onerror)'));
            };
            document.head.appendChild(script);
        });
    }

    /** 轮询直到 window.PM 可用（最多 5 秒） */
    function _pollUntilPMReady(onReady, onTimeout) {
        var attempts = 0;
        var maxAttempts = 100; // 50ms × 100 = 5s
        function check() {
            if (window.PM) {
                onReady();
                return;
            }
            if (++attempts >= maxAttempts) {
                onTimeout();
                return;
            }
            setTimeout(check, 50);
        }
        check();
    }

    // ================================================================
    // Schema 定义
    // ================================================================

    function _buildSchema(PM) {
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

    // ================================================================
    // 所有插件（懒构建）
    // ================================================================

    function _createPlugins(PM, schema) {
        return [
            PM.keymap(PM.baseKeymap),
            _buildKeymap(PM, schema),
            _buildInputRules(PM, schema),
            PM.history(),
            PM.dropCursor(),
            PM.gapCursor(),
            _bubbleToolbarPlugin(PM, schema)
        ];
    }

    // ================================================================
    // 输入规则（Markdown 快捷键）
    // ================================================================

    function _buildInputRules(PM, schema) {
        return PM.inputRules({ rules: [
            new PM.InputRule(/^# $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.heading, { level: 1 });
                return tr;
            }),
            new PM.InputRule(/^## $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.heading, { level: 2 });
                return tr;
            }),
            new PM.InputRule(/^### $/, function (state, match, from, to) {
                var tr = state.tr;
                tr.deleteRange(from, to);
                tr.setBlockType(from, from, schema.nodes.heading, { level: 3 });
                return tr;
            }),
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

    function _buildKeymap(PM, schema) {
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
    // 编辑器状态
    // ================================================================
    var editorView = null;
    var editorCallbacks = {};
    var wordCountEl = null;

    /**
     * 创建 ProseMirror 编辑器并挂载到 DOM
     * 返回 Promise<EditorView|null>，可能等待动态加载 PM bundle
     * @param {Element} domParent - 挂载父节点
     * @param {object} note - 笔记数据对象
     * @param {object} callbacks - { onChange, onFocus }
     */
    ns.pmCreateEditor = function (domParent, note, callbacks) {
        // 幂等：销毁旧实例
        ns.pmDestroyEditor();

        // 确保 PM 和 Schema 已就绪（可能等待动态加载），then 创建编辑器
        var self = this;
        return _ensureInit().then(function (ready) {
            if (!ready) {
                console.error('[PM编辑器] 无法创建编辑器：ProseMirror 未就绪');
                return null;
            }
            return _createEditorSync(domParent, note, callbacks);
        });
    };

    /**
     * 同步创建编辑器（_ensureInit 已确认完成后调用）
     */
    function _createEditorSync(domParent, note, callbacks) {

        var PM = _getPM();
        var schema = _lazySchema;

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
            docNode = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
        }

        // 清空父节点
        domParent.innerHTML = '';

        // 创建编辑器
        var state = PM.EditorState.create({
            schema: schema,
            doc: docNode,
            plugins: _lazyPlugins
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

                if (editorCallbacks.onChange) {
                    editorCallbacks.onChange();
                }

                updateWordCountUI();
            }
        });

        // 添加容器类名
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
     * @returns {object|null}
     */
    ns.pmGetDocJSON = function () {
        if (!editorView) return null;
        return editorView.state.doc.toJSON();
    };

    /**
     * 获取当前文档 HTML（向后兼容）
     * @returns {string}
     */
    ns.pmGetDocHTML = function () {
        if (!editorView || !_lazySchema) return '';
        var PM = _getPM();
        if (!PM) return '';
        var serializer = PM.DOMSerializer.fromSchema(_lazySchema);
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
     * 设置文档内容
     * @param {object} docJSON
     */
    ns.pmSetContent = function (docJSON) {
        if (!editorView || !docJSON || !_lazySchema) return;
        var PM = _getPM();
        if (!PM) return;
        try {
            var doc = PM.Node.fromJSON(_lazySchema, docJSON);
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
     * 从 PM doc 节点计算字数
     * @param {Node} doc
     * @returns {number}
     */
    ns._countWordsFromDoc = function (doc) {
        var text = doc.textContent || '';
        return ns.countWords(text);
    };

    ns.pmIsActive = function () {
        return editorView !== null;
    };

    ns.pmGetView = function () {
        return editorView;
    };

    // ================================================================
    // 字数统计 UI 更新
    // ================================================================

    function updateWordCountUI() {
        var el = wordCountEl || document.getElementById('wbNoteWordCount');
        if (!el) return;
        wordCountEl = el;
        if (!editorView) return;
        var count = ns._countWordsFromDoc(editorView.state.doc);
        el.textContent = count + ' 字';
    }

    console.log('[PM编辑器] 模块注册完成（懒初始化模式） window.PM=' + typeof window.PM + ' _lazySchema=' + (_lazySchema ? 'ready' : 'pending'));

    // 模块加载时立即触发 PM bundle 加载（使用 chrome.runtime.getURL 获取绝对路径）
    // 这样在用户点击笔记之前，PM 已经就绪，消除首次打开延迟
    if (!window.PM && !_pmLoadPromise) {
        _pmLoadPromise = _loadPMBundle();
    }

    // ================================================================
    // 代码块 NodeView
    // ================================================================

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

    function CodeBlockView(node, view, getPos) {
        this._node = node;
        this._view = view;
        this._getPos = getPos;
        this._editing = false;

        this.dom = document.createElement('div');
        this.dom.className = 'wb-codeblock';
        this.dom.setAttribute('contenteditable', 'false');

        var toolbar = document.createElement('div');
        toolbar.className = 'wb-codeblock-toolbar';

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

        this._pre = document.createElement('pre');
        this._pre.className = 'wb-codeblock-pre';
        this._code = document.createElement('code');
        this._code.className = 'hljs';
        this._code.textContent = node.textContent;
        this._pre.appendChild(this._code);
        this.dom.appendChild(this._pre);

        this._textarea = document.createElement('textarea');
        this._textarea.className = 'wb-codeblock-textarea';
        this._textarea.style.display = 'none';
        this._textarea.value = node.textContent;
        this.dom.appendChild(this._textarea);

        this._highlight();

        var _this = this;
        this._pre.addEventListener('dblclick', function () {
            _this._startEdit();
        });

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

    CodeBlockView.prototype._startEdit = function () {
        this._editing = true;
        this._pre.style.display = 'none';
        this._textarea.style.display = 'block';
        this._textarea.value = this._node.textContent;
        this._textarea.focus();
    };

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
        var sel = this.dom.querySelector('.wb-codeblock-lang');
        if (sel && sel.value !== node.attrs.language) {
            sel.value = node.attrs.language || '';
        }
        return true;
    };

    CodeBlockView.prototype.destroy = function () {
        this.dom = null;
        this._view = null;
    };

    CodeBlockView.prototype.ignoreMutation = function () { return true; };
    CodeBlockView.prototype.stopEvent = function () { return false; };

    // ================================================================
    // 气泡工具栏
    // ================================================================

    var bubbleToolbarDom = null;
    var bubbleHideTimer = null;

    function _bubbleToolbarPlugin(PM, schema) {
        return new PM.Plugin({
            view: function (editorView) {
                var initSel = editorView.state.selection;
                if (initSel instanceof PM.TextSelection && !initSel.empty) {
                    _showBubble(PM, editorView);
                }
                return {
                    update: function (view, prevState) {
                        var sel = view.state.selection;
                        if (!(sel instanceof PM.TextSelection) || sel.empty) {
                            _hideBubble();
                            return;
                        }
                        clearTimeout(bubbleHideTimer);
                        bubbleHideTimer = setTimeout(function () {
                            _showBubble(PM, view);
                        }, 50);
                    }
                };
            }
        });
    }

    function _showBubble(PM, view) {
        bubbleToolbarDom = bubbleToolbarDom || document.getElementById('wbBubbleToolbar');
        if (!bubbleToolbarDom) return;

        var state = view.state;
        var sel = state.selection;

        if (!(sel instanceof PM.TextSelection) || sel.empty) {
            _hideBubble();
            return;
        }

        var startCoords = view.coordsAtPos(sel.from);
        var endCoords = view.coordsAtPos(sel.to);
        if (!startCoords || !endCoords) return;

        var tbHeight = bubbleToolbarDom.offsetHeight || 34;
        var tbWidth = bubbleToolbarDom.offsetWidth || 260;

        var top = Math.min(startCoords.top, endCoords.top) - tbHeight - 6;
        var left = (startCoords.left + endCoords.right) / 2 - tbWidth / 2;

        if (top < 8) top = Math.max(startCoords.bottom, endCoords.bottom) + 6;
        left = Math.max(8, Math.min(left, window.innerWidth - tbWidth - 8));

        bubbleToolbarDom.style.top = top + 'px';
        bubbleToolbarDom.style.left = left + 'px';
        bubbleToolbarDom.style.display = 'flex';

        _syncBubbleState(state);

        console.log('[气泡工具栏] 显示 选区=' + sel.from + '-' + sel.to + ' 坐标=(' + Math.round(left) + ',' + Math.round(top) + ')');
    }

    function _hideBubble() {
        bubbleToolbarDom = bubbleToolbarDom || document.getElementById('wbBubbleToolbar');
        if (bubbleToolbarDom && bubbleToolbarDom.style.display !== 'none') {
            bubbleToolbarDom.style.display = 'none';
            console.log('[气泡工具栏] 隐藏');
        }
    }

    /** 同步按钮激活状态 */
    ns._syncBubbleToolbarState = function (state) {
        if (!bubbleToolbarDom || !_lazySchema) return;
        var schema = _lazySchema;

        var marks = {
            bold: schema.marks.strong,
            italic: schema.marks.em,
            underline: schema.marks.underline
        };
        Object.keys(marks).forEach(function (key) {
            var btn = bubbleToolbarDom.querySelector('[data-pm-action="' + key + '"]');
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

        var headingSel = bubbleToolbarDom.querySelector('[data-pm-action="heading"]');
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

    /** 同步气泡工具栏状态（适配旧调用方式，直接用内部函数） */
    function _syncBubbleState(state) {
        ns._syncBubbleToolbarState(state);
    }

    /** 执行气泡工具栏命令 */
    ns._executeBubbleAction = function (action, value) {
        var view = ns.pmGetView();
        if (!view) return;
        view.focus();

        var PM = _getPM();
        var schema = _lazySchema;
        if (!PM || !schema) return;

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
                var codeBlockCmd = PM.setBlockType(schema.nodes.code_block, { language: value || '' });
                codeBlockCmd(view.state, function (tr) {
                    var pos = tr.selection.from;
                    var placeholder = schema.text('在此输入代码...');
                    tr.insert(pos + 1, placeholder);
                    view.dispatch(tr);
                });
                return;
            case 'pasteText':
                navigator.clipboard.readText().then(function (plainText) {
                    if (plainText) {
                        view.focus();
                        view.pasteText(plainText);
                    } else {
                        console.log('[交互] 纯文本粘贴 剪贴板为空');
                    }
                }).catch(function (err) {
                    console.warn('[警告] 读取剪贴板失败', err);
                });
                return;
            case 'pasteHtml':
                navigator.clipboard.read().then(function (items) {
                    var htmlFound = false;
                    for (var i = 0; i < items.length; i++) {
                        if (items[i].types.indexOf('text/html') !== -1) {
                            items[i].getType('text/html').then(function (blob) {
                                blob.text().then(function (html) {
                                    view.focus();
                                    view.pasteHTML(html);
                                });
                            });
                            htmlFound = true;
                            break;
                        }
                    }
                    if (!htmlFound) {
                        navigator.clipboard.readText().then(function (plainText) {
                            if (plainText) {
                                view.focus();
                                view.pasteText(plainText);
                            }
                        });
                    }
                }).catch(function (err) {
                    console.warn('[警告] 读取剪贴板失败', err);
                });
                return;
        }
        _hideBubble();
    };

})(window.DevHome);
