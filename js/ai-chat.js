/**
 * DevHome Workbench - AI 内联对话面板
 *
 * 职责：
 * - 页面底部内嵌对话面板的显示/折叠/关闭
 * - 消息历史管理（用户/AI 消息气泡）
 * - 调用 generateAI() 发送消息并渲染 Markdown 回复
 * - 对话保存为笔记
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var dom = ns.dom;
    var state = ns.state;
    var storageV2 = ns.storageV2;
    var DEFAULT_V2_CONFIG = ns.DEFAULT_V2_CONFIG;

    /** 对话历史（会话内，不持久化） */
    var chatMessages = [];

    /** 面板 DOM 引用（懒初始化） */
    var panelEl = null;
    var messagesEl = null;
    var inputEl = null;
    var sendBtn = null;
    var headerBadge = null;
    var modelSelect = null;
    var modelDropdown = null;

    /* ================================================================
       DOM 构建
       ================================================================ */

    /** 创建面板 DOM（首次调用时惰性创建） */
    function ensurePanel() {
        if (panelEl) return;

        panelEl = document.createElement('div');
        panelEl.id = 'aiChatPanel';
        panelEl.className = 'ai-chat-panel minimized';

        panelEl.innerHTML =
            '<div class="ai-chat-header" id="aiChatHeader">' +
                '<div class="ai-chat-header-left">' +
                    '<span class="ai-chat-header-dot"></span>' +
                    '<span class="ai-chat-header-title">AI 对话</span>' +
                    '<span class="ai-chat-model-select" id="aiChatModelSelect" title="切换模型">' +
                        '<span class="ai-chat-header-badge" id="aiChatBadge">混元</span>' +
                        '<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 3l2 2 2-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' +
                    '</span>' +
                '</div>' +
                '<div class="ai-chat-header-actions">' +
                    '<button class="ai-chat-save-btn" id="aiChatSaveBtn" title="保存对话">💾 保存</button>' +
                    '<button class="ai-chat-header-btn" id="aiChatClearBtn" title="清空对话">🗑</button>' +
                    '<button class="ai-chat-header-btn" id="aiChatMinBtn" title="最小化">−</button>' +
                    '<button class="ai-chat-header-btn close" id="aiChatCloseBtn" title="关闭">&times;</button>' +
                '</div>' +
            '</div>' +
            '<div class="ai-chat-model-dropdown" id="aiChatModelDropdown" style="display:none;"></div>' +
            '<div class="ai-chat-messages" id="aiChatMessages">' +
                '<div class="ai-chat-empty">开始对话，向 AI 提问任何问题</div>' +
            '</div>' +
            '<div class="ai-chat-input-area">' +
                '<textarea class="ai-chat-input" id="aiChatInput" placeholder="输入问题，Enter 发送..." rows="1"></textarea>' +
                '<button class="ai-chat-send-btn" id="aiChatSendBtn" title="发送">' +
                    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 6-12 6 3-6-3-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor"/></svg>' +
                '</button>' +
            '</div>';

        document.body.appendChild(panelEl);

        // 缓存子元素引用
        messagesEl = panelEl.querySelector('#aiChatMessages');
        inputEl = panelEl.querySelector('#aiChatInput');
        sendBtn = panelEl.querySelector('#aiChatSendBtn');
        headerBadge = panelEl.querySelector('#aiChatBadge');
        modelSelect = panelEl.querySelector('#aiChatModelSelect');
        modelDropdown = panelEl.querySelector('#aiChatModelDropdown');

        bindPanelEvents();
    }

    /* ================================================================
       事件绑定
       ================================================================ */

    function bindPanelEvents() {
        // 头部点击 → 展开/折叠
        var header = panelEl.querySelector('#aiChatHeader');
        if (header) {
            header.addEventListener('click', function (e) {
                if (e.target.closest('button')) return; // 不拦截按钮点击
                toggleChat();
            });
        }

        // 最小化按钮
        var minBtn = panelEl.querySelector('#aiChatMinBtn');
        if (minBtn) minBtn.addEventListener('click', function (e) { e.stopPropagation(); closeChat(); });
        // 关闭按钮（完全隐藏）
        var closeBtn = panelEl.querySelector('#aiChatCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); hideChat(); });

        // 模型选择器
        if (modelSelect) {
            modelSelect.addEventListener('click', function (e) { e.stopPropagation(); toggleModelDropdown(); });
        }
        if (modelDropdown) {
            // 下拉菜单点击事件委托
            modelDropdown.addEventListener('click', function (e) {
                e.stopPropagation();
                var item = e.target.closest('.ai-chat-model-item');
                if (item && item.dataset.providerId) {
                    switchChatProvider(item.dataset.providerId);
                }
            });
            // 点击外部关闭
            document.addEventListener('click', function (e) {
                if (modelDropdown && !modelDropdown.contains(e.target) && e.target !== modelSelect && !modelSelect.contains(e.target)) {
                    modelDropdown.style.display = 'none';
                }
            });
        }

        // 清空按钮
        var clearBtn = panelEl.querySelector('#aiChatClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', function (e) { e.stopPropagation(); clearChat(); });

        // 保存按钮
        var saveBtn = panelEl.querySelector('#aiChatSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', function (e) { e.stopPropagation(); saveChatAsNote(); });

        // 发送按钮
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);

        // Enter 发送，Shift+Enter 换行
        if (inputEl) {
            inputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            });
            // 自动调整高度
            inputEl.addEventListener('input', function () {
                inputEl.style.height = 'auto';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
            });
        }
    }

    /* ================================================================
       面板控制
       ================================================================ */

    function toggleChat() {
        ensurePanel();
        if (panelEl.classList.contains('expanded')) {
            panelEl.classList.remove('expanded');
            panelEl.classList.add('minimized');
        } else {
            panelEl.classList.remove('minimized');
            panelEl.classList.add('expanded');
            updateBadge();
            setTimeout(function () { if (inputEl) inputEl.focus(); }, 300);
        }
    }

    function openChat() {
        ensurePanel();
        // 关闭设置面板
        if (typeof ns.closeSettingsPanel === 'function') ns.closeSettingsPanel();
        panelEl.classList.remove('minimized');
        panelEl.classList.remove('hidden');
        panelEl.classList.add('expanded');
        updateBadge();
        setTimeout(function () { if (inputEl) inputEl.focus(); }, 300);
        console.log('[面板] 打开 AI 对话面板');
    }

    function closeChat() {
        if (!panelEl) return;
        panelEl.classList.remove('expanded');
        panelEl.classList.add('minimized');
        console.log('[面板] 折叠 AI 对话面板（点击标题栏可重新展开）');
    }

    /** 完全隐藏对话面板 */
    function hideChat() {
        if (!panelEl) return;
        panelEl.classList.remove('expanded');
        panelEl.classList.remove('minimized');
        panelEl.classList.add('hidden');
        console.log('[面板] 隐藏 AI 对话面板');
    }

    function clearChat() {
        chatMessages = [];
        renderMessages();
        panelEl.classList.remove('has-messages');
        console.log('[面板] 清空对话');
    }

    /** 渲染模型下拉菜单 */
    async function renderModelDropdown() {
        if (!modelDropdown) return;
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeId = config.aiApi.activeProvider || 'hunyuan';
        var savedProviders = config.aiApi.providers || {};

        // 收集所有可用供应商
        var items = [];
        ns.AI_PROVIDERS.forEach(function (p) {
            var saved = savedProviders[p.id] || {};
            items.push({
                id: p.id, name: p.name, badge: p.badge,
                model: saved.model || p.model,
                active: p.id === activeId
            });
        });
        // 自定义供应商
        Object.keys(savedProviders).forEach(function (pid) {
            if (ns.AI_PROVIDERS.some(function (p) { return p.id === pid; })) return;
            var sp = savedProviders[pid];
            items.push({ id: pid, name: sp.name || pid, badge: sp.name || pid, model: sp.model || '', active: pid === activeId });
        });

        var html = '';
        items.forEach(function (item) {
            html += '<div class="ai-chat-model-item' + (item.active ? ' active' : '') + '" data-provider-id="' + ns.escapeHtml(item.id) + '">' +
                '<span class="ai-chat-model-name">' + ns.escapeHtml(item.name) + '</span>' +
                '<span class="ai-chat-model-tag">' + ns.escapeHtml(item.model) + '</span>' +
                (item.active ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L5 8l-3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
            '</div>';
        });
        modelDropdown.innerHTML = html;
    }

    /** 切换下拉菜单显隐 */
    async function toggleModelDropdown() {
        if (!modelDropdown) return;
        if (modelDropdown.style.display === 'block') {
            modelDropdown.style.display = 'none';
            return;
        }
        await renderModelDropdown();
        modelDropdown.style.display = 'block';
    }

    /** 切换聊天供应商 */
    async function switchChatProvider(providerId) {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        config.aiApi.activeProvider = providerId;
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        // 更新徽章
        var provider = ns.getProviderById(providerId);
        if (headerBadge && provider) headerBadge.textContent = provider.badge || provider.name;

        // 更新下拉菜单
        await renderModelDropdown();
        modelDropdown.style.display = 'none';

        // 同步设置面板
        try { if (typeof ns.renderProviderList === 'function') ns.renderProviderList(); } catch (_) {}
        try { if (typeof ns.switchAiProvider === 'function') ns.selectAiProvider(providerId); } catch (_) {}

        console.log('[AI Chat] 切换模型 → ' + (provider ? provider.name : providerId));
    }

    /** 更新供应商徽章 */
    async function updateBadge() {
        if (!headerBadge) return;
        try {
            var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
            var providerId = config.aiApi.activeProvider || 'hunyuan';
            var provider = ns.getProviderById(providerId);
            if (provider) headerBadge.textContent = provider.badge || provider.name;
        } catch (_) { headerBadge.textContent = 'AI'; }
    }

    /* ================================================================
       消息渲染
       ================================================================ */

    function renderMessages() {
        if (!messagesEl) return;

        if (chatMessages.length === 0) {
            messagesEl.innerHTML = '<div class="ai-chat-empty">开始对话，向 AI 提问任何问题</div>';
            return;
        }

        var html = '';
        chatMessages.forEach(function (msg) {
            var role = msg.role === 'user' ? 'user' : 'assistant';
            var avatar = role === 'user' ? '我' : 'AI';
            var content = role === 'assistant' && typeof marked !== 'undefined' && marked.parse
                ? marked.parse(msg.content || '')
                : ns.escapeHtml(msg.content || '');
            html += '<div class="ai-chat-msg ' + role + '">' +
                '<div class="ai-chat-msg-avatar">' + avatar + '</div>' +
                '<div class="ai-chat-msg-bubble">' + content + '</div>' +
                '</div>';
        });

        messagesEl.innerHTML = html;
        messagesEl.scrollTop = messagesEl.scrollHeight;
        panelEl.classList.toggle('has-messages', chatMessages.length > 0);
    }

    function showLoading() {
        if (!messagesEl) return;
        var loadingEl = document.createElement('div');
        loadingEl.className = 'ai-chat-loading';
        loadingEl.id = 'aiChatLoading';
        loadingEl.innerHTML = '<div class="ai-chat-loading-dots"><span></span><span></span><span></span></div>';
        messagesEl.appendChild(loadingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideLoading() {
        var el = document.getElementById('aiChatLoading');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    /* ================================================================
       消息发送
       ================================================================ */

    async function sendMessage() {
        if (!inputEl) return;
        var text = inputEl.value.trim();
        if (!text) return;

        // 确保面板展开
        if (!panelEl.classList.contains('expanded')) {
            panelEl.classList.remove('minimized');
            panelEl.classList.add('expanded');
        }

        // 添加用户消息
        chatMessages.push({ role: 'user', content: text });
        inputEl.value = '';
        inputEl.style.height = 'auto';
        renderMessages();
        showLoading();

        // 禁用发送按钮
        if (sendBtn) sendBtn.disabled = true;

        try {
            // 读取配置
            var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
            var providerId = config.aiApi.activeProvider || 'hunyuan';
            var providerConfig = config.aiApi.providers && config.aiApi.providers[providerId]
                ? config.aiApi.providers[providerId]
                : {};
            var provider = ns.getProviderById(providerId);
            if (!provider) throw new Error('未找到供应商: ' + providerId);

            var apiKey = providerConfig.apiKey || provider.apiKey;
            var endpoint = providerConfig.endpoint || provider.endpoint;
            var model = providerConfig.model || provider.model;

            if (!apiKey) {
                hideLoading();
                chatMessages.push({ role: 'assistant', content: '请先在设置中配置 API Key' });
                renderMessages();
                return;
            }

            // 构建对话消息（取最近 20 条作为上下文）
            var recentMessages = chatMessages.slice(-21); // user + assistant of last N
            var contextMessages = recentMessages.slice(0, -1); // exclude latest user msg (just sent)
            var apiMessages = [
                { role: 'system', content: '你是一个智能助手，请用简洁清晰的中文回答用户的问题。如果问题涉及代码，请使用 Markdown 代码块格式输出。' }
            ];
            contextMessages.forEach(function (m) { apiMessages.push({ role: m.role, content: m.content }); });

            var response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(provider.buildBody(model, apiMessages))
            });

            if (!response.ok) {
                var errText = await response.text().catch(function () { return ''; });
                throw new Error('请求失败: ' + response.status + ' ' + errText.slice(0, 200));
            }

            var data = await response.json();
            var reply = provider.extractContent(data);
            if (!reply) {
                reply = data.choices && data.choices[0] ? data.choices[0].message.content : JSON.stringify(data);
            }

            hideLoading();
            chatMessages.push({ role: 'assistant', content: reply });
        } catch (e) {
            hideLoading();
            chatMessages.push({
                role: 'assistant',
                content: '**抱歉，发生了错误**\n\n' + ns.escapeHtml(e.message) + '\n\n请检查 API 配置'
            });
            console.error('[AI Chat] 错误:', e);
        }

        renderMessages();
        if (sendBtn) sendBtn.disabled = false;
    }

    /* ================================================================
       保存对话
       ================================================================ */

    function saveChatAsNote() {
        if (chatMessages.length === 0) { ns.showToast('暂无对话内容', 'info'); return; }

        var content = chatMessages.map(function (m) {
            var prefix = m.role === 'user' ? '**我：**' : '**AI：**';
            return prefix + '\n' + m.content;
        }).join('\n\n---\n\n');

        var title = 'AI 对话 - ' + new Date().toLocaleDateString('zh-CN') + ' ' +
            new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        ns.createNote({ title: title, content: content, type: 'note', tags: ['AI对话'] }).then(function () {
            ns.showToast('对话已保存为笔记', 'success');
        });
    }

    /* ================================================================
       公开 API
       ================================================================ */

    ns.aiChat = {
        open: openChat,
        close: closeChat,
        hide: hideChat,
        toggle: toggleChat,
        clear: clearChat,
        send: function (text) {
            openChat();
            if (text && inputEl) {
                inputEl.value = text;
                setTimeout(function () { sendMessage(); }, 200);
            }
        }
    };

    console.log('[AI Chat] 面板模块已就绪');
})(window.DevHome);
