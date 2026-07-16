/**
 * DevHome Workbench - 行为仪表盘 + AI 面板
 * 从 workbench.js 拆分，职责：行为数据看板、AI 调用、供应商管理
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var storageV2 = ns.storageV2;
    var DEFAULT_V2_CONFIG = ns.DEFAULT_V2_CONFIG;

    /* ===== 行为仪表盘 ===== */
    ns.renderBehaviorDashboard = async function () {
        var behavior = await storageV2.get(storageV2.KEYS.BEHAVIOR, ns.DEFAULT_BEHAVIOR_STATE);
        var sessions = await storageV2.get(storageV2.KEYS.POMODORO_SESSIONS, []);

        // 计算统计
        var todayStr = new Date().toISOString().slice(0, 10);
        var todaySessions = sessions.filter(function (s) {
            return s.startedAt && new Date(s.startedAt).toISOString().slice(0, 10) === todayStr && s.completed;
        });
        var totalFocusMin = todaySessions.reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);

        // 连续打卡
        var todayBehavior = behavior.dailyStats && behavior.dailyStats[todayStr];
        if (!todayBehavior || !todayBehavior.streakDay) {
            behavior.lastActiveDate = todayStr;
            behavior.streakDays = (behavior.streakDays || 0) + 1;
            if (!behavior.dailyStats) behavior.dailyStats = {};
            behavior.dailyStats[todayStr] = Object.assign({}, behavior.dailyStats[todayStr] || {}, { streakDay: true });
            await storageV2.set(storageV2.KEYS.BEHAVIOR, behavior);
        }

        // React 渲染：设置全局数据并触发看板刷新
        window.__dashboardData = {
            streak: behavior.streakDays || 0,
            totalCompleted: behavior.totalCompleted || 0,
            totalPomodoros: todaySessions.length,
            totalFocusMinutes: totalFocusMin,
            totalNotes: (state.notes || []).length,
            dailyStats: behavior.dailyStats || {}
        };

        var root = document.getElementById('reactDashboardRoot');
        if (root && window.ReactDOM && window.DashboardApp) {
            // 首次渲染用 createRoot，后续用 __refreshDashboard
            if (!root._reactInited) {
                var reactRoot = ReactDOM.createRoot(root);
                reactRoot.render(React.createElement(window.DashboardApp.Dashboard));
                root._reactInited = true;
                root._reactRoot = reactRoot;
            } else if (window.__refreshDashboard) {
                window.__refreshDashboard();
            }
        } else {
            // 回退：更新原 DOM（dashboard.js 未加载）
            if (dom.wbMeStreakNum) dom.wbMeStreakNum.textContent = behavior.streakDays || 0;
        }

        console.log('[面板] 行为数据看板已刷新 连续' + behavior.streakDays + '天');
    };

    /* ===== AI 调用引擎 ===== */

    /**
     * 通用 AI 调用函数
     * @param {string} moduleId - 功能模块 ID（如 'daily-summary' | 'quick-chat'）
     * @param {string} [userInput] - 快速对话时用户输入的问题（可选）
     */
    ns.generateAI = async function (moduleId, userInput) {
        var moduleDef = ns.getModuleById(moduleId);
        if (!moduleDef) {
            ns.showToast('未知 AI 模块: ' + moduleId, 'error');
            return;
        }

        // 读取配置
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var providerId = config.aiApi.activeProvider || 'hunyuan';
        var providerConfig = config.aiApi.providers && config.aiApi.providers[providerId]
            ? config.aiApi.providers[providerId]
            : {};

        // 查找供应商元数据（含 API 适配器）
        var provider = ns.getProviderById(providerId);
        // 自定义（OpenAI 兼容）供应商需使用通用适配器，否则无法发起请求
        if (!provider) {
            provider = ns.createOpenAIProvider(providerId, providerConfig);
        }

        // 合并配置（用户保存的覆盖内置默认值）
        var apiKey = providerConfig.apiKey || provider.apiKey;
        var endpoint = providerConfig.endpoint || provider.endpoint;
        var model = providerConfig.model || provider.model;

        if (!apiKey) {
            ns.showToast('请先在下方配置 API Key', 'error');
            return;
        }

        // 收集上下文内容
        var contentText = moduleDef.buildContext ? moduleDef.buildContext() : '';

        // 需要内容的模块，检查是否为空
        if (moduleDef.requireContent && !contentText.trim()) {
            ns.showToast(moduleDef.emptyMessage || '暂无可用内容', 'info');
            return;
        }

        // 需要用户输入的模块
        if (moduleDef.needUserInput && !userInput) {
            // 弹出输入框获取用户问题
            var input = await ns.showPrompt(moduleDef.inputPlaceholder || '输入问题...', {
                title: moduleDef.inputTitle || '快速对话',
                defaultValue: ''
            });
            if (!input) return; // 用户取消
            contentText = input;
        }

        // 显示加载状态
        if (dom.wbMeAiResult) dom.wbMeAiResult.style.display = 'block';
        if (dom.wbMeAiContent) dom.wbMeAiContent.innerHTML =
            '<p style="color:var(--color-text-secondary);">正在调用 ' + provider.name + '（' + model + '）...</p>';

        try {
            // 构建消息
            var messages = [{ role: 'system', content: moduleDef.systemPrompt }];
            if (contentText && contentText.trim()) {
                messages.push({ role: 'user', content: contentText.slice(0, 12000) });
            }
            if (!contentText || !contentText.trim()) {
                messages.push({ role: 'user', content: '你好' });
            }

            // 通过供应商适配器发起请求
            var response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(provider.buildBody(model, messages))
            });

            if (!response.ok) {
                var errText = await response.text().catch(function () { return ''; });
                throw new Error('API 请求失败: ' + response.status + ' ' + response.statusText + (errText ? ' - ' + errText.slice(0, 200) : ''));
            }

            var data = await response.json();
            var summary = provider.extractContent(data);

            if (!summary) {
                summary = data.choices && data.choices[0]
                    ? data.choices[0].message.content
                    : JSON.stringify(data);
            }

            if (dom.wbMeAiContent) {
                dom.wbMeAiContent.innerHTML = typeof marked !== 'undefined' && marked.parse
                    ? ns.sanitizeHtml(marked.parse(summary))
                    : '<pre>' + ns.escapeHtml(summary) + '</pre>';
            }

            console.log('[AI] 调用成功 供应商=' + providerId + ' 模块=' + moduleId + ' 模型=' + model);
        } catch (e) {
            if (dom.wbMeAiContent) {
                dom.wbMeAiContent.innerHTML =
                    '<p style="color:#ff6b6b;">生成失败：' + ns.escapeHtml(e.message) + '</p>' +
                    '<p style="color:var(--color-text-tertiary);font-size:11px;">请检查 API Key、端点地址和网络连接</p>';
            }
            console.error('[AI] 错误:', e);
        }
    };

    /** 兼容旧接口：生成每日总结 */
    ns.generateAISummary = function () {
        return ns.generateAI('daily-summary');
    };

    /* ===== 供应商管理 CRUD ===== */

    /** 获取所有供应商（内置 + 自定义）合并后的列表 */
    ns.getMergedProviders = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeProvider = config.aiApi.activeProvider || 'hunyuan';
        var savedProviders = config.aiApi.providers || {};

        // 内置供应商
        var builtinIds = ns.AI_PROVIDERS.map(function (p) { return p.id; });
        var result = [];

        // 先加内置
        ns.AI_PROVIDERS.forEach(function (p) {
            var saved = savedProviders[p.id] || {};
            result.push({
                id: p.id,
                name: saved.name || p.name,
                badge: saved.name || p.badge,
                isBuiltin: true,
                apiKey: saved.apiKey || p.apiKey,
                endpoint: saved.endpoint || p.endpoint,
                model: saved.model || p.model,
                active: p.id === activeProvider
            });
        });

        // 再加自定义（排除已存在的内置 ID）
        Object.keys(savedProviders).forEach(function (pid) {
            if (builtinIds.indexOf(pid) !== -1) return;
            var sp = savedProviders[pid];
            result.push({
                id: pid,
                name: sp.name || pid,
                badge: sp.name || pid,
                isBuiltin: false,
                apiKey: sp.apiKey || '',
                endpoint: sp.endpoint || '',
                model: sp.model || '',
                active: pid === activeProvider
            });
        });

        return result;
    };

    /** 渲染供应商列表到设置面板 */
    ns.renderProviderList = async function () {
        if (!dom.wbAiProviderList) return;
        var providers = await ns.getMergedProviders();
        var html = '';
        providers.forEach(function (p) {
            var cls = p.active ? 'ai-provider-item active' : 'ai-provider-item';
            html += '<div class="' + cls + '" data-provider-id="' + ns.escapeHtml(p.id) + '">' +
                '<div class="ai-provider-info">' +
                    '<div class="ai-provider-name">' + ns.escapeHtml(p.name) + '</div>' +
                    '<div class="ai-provider-model">' + ns.escapeHtml(p.model) + '</div>' +
                '</div>' +
                '<div class="ai-provider-actions">' +
                    '<button class="ai-provider-del-btn" title="删除">×</button>' +
                '</div>' +
            '</div>';
        });
        dom.wbAiProviderList.innerHTML = html;
    };

    /** 选择供应商 */
    ns.selectAiProvider = async function (providerId) {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        config.aiApi.activeProvider = providerId;
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        var savedProviders = config.aiApi.providers || {};
        var saved = savedProviders[providerId] || {};
        var builtin = ns.getProviderById(providerId);

        if (dom.wbAiProviderBadge) {
            var name = saved.name || (builtin ? builtin.name : providerId);
            dom.wbAiProviderBadge.textContent = name;
        }
        if (dom.wbMeAiName) dom.wbMeAiName.value = saved.name || (builtin ? builtin.name : '');
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = saved.apiKey || (builtin ? builtin.apiKey : '');
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = saved.endpoint || (builtin ? builtin.endpoint : '');
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = saved.model || (builtin ? builtin.model : '');

        ns.renderProviderList();
        console.log('[AI] 选择供应商 → ' + providerId);
    };

    /** 添加新供应商 */
    ns.addAiProvider = async function () {
        var name = await ns.showPrompt('输入新供应商名称', { title: '添加供应商', defaultValue: '' });
        if (!name) return;
        var id = 'custom_' + Date.now();
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        if (!config.aiApi.providers) config.aiApi.providers = {};
        config.aiApi.providers[id] = { name: name, apiKey: '', endpoint: '', model: '' };
        config.aiApi.activeProvider = id;
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        if (dom.wbMeAiName) dom.wbMeAiName.value = name;
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = '';
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = '';
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = '';
        if (dom.wbAiProviderBadge) dom.wbAiProviderBadge.textContent = name;

        ns.renderProviderList();
        ns.showToast('已添加供应商: ' + name, 'success');
        console.log('[AI] 添加供应商:', name, id);
    };

    /** 删除供应商（仅自定义） */
    ns.deleteAiProvider = async function (providerId) {
        var builtin = ns.getProviderById(providerId);
        if (builtin) { ns.showToast('内置供应商不可删除', 'warning'); return; }

        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        if (config.aiApi.providers) delete config.aiApi.providers[providerId];
        if (config.aiApi.activeProvider === providerId) config.aiApi.activeProvider = 'hunyuan';
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        // 切换到默认供应商
        ns.selectAiProvider('hunyuan');
        ns.showToast('已删除供应商', 'info');
    };

    /** 保存当前编辑的供应商配置，自动请求 host_permissions */
    ns.saveAiProviderConfig = async function () {
        var name = dom.wbMeAiName ? dom.wbMeAiName.value.trim() : '';
        var apiKey = dom.wbMeAiApiKey ? dom.wbMeAiApiKey.value.trim() : '';
        var endpoint = dom.wbMeAiEndpoint ? dom.wbMeAiEndpoint.value.trim() : '';
        var model = dom.wbMeAiModel ? dom.wbMeAiModel.value.trim() : '';

        if (!name) { ns.showToast('请填写供应商名称', 'error'); return; }
        if (!apiKey) { ns.showToast('请填写 API Key', 'error'); return; }

        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeProvider = config.aiApi.activeProvider || 'hunyuan';
        if (!config.aiApi.providers) config.aiApi.providers = {};
        config.aiApi.providers[activeProvider] = { name: name, apiKey: apiKey, endpoint: endpoint, model: model };
        await storageV2.set(storageV2.KEYS.CONFIG, config);

        // 自动请求 host_permissions（避免手动编辑 manifest）
        if (endpoint) {
            try {
                var urlObj = new URL(endpoint);
                var origin = urlObj.origin;
                var originPattern = origin + '/*';

                var hasPermission = await new Promise(function (resolve) {
                    chrome.permissions.contains({ origins: [originPattern] }, function (result) {
                        resolve(result);
                    });
                });

                if (!hasPermission) {
                    console.log('[AI] 请求 host_permissions:', originPattern);
                    var granted = await new Promise(function (resolve) {
                        chrome.permissions.request({ origins: [originPattern] }, function (result) {
                            resolve(result);
                        });
                    });
                    if (granted) {
                        console.log('[AI] host_permissions 已授权:', originPattern);
                    } else {
                        console.warn('[AI] 用户拒绝 host_permissions:', originPattern);
                        ns.showToast('已保存配置，但访问该域名的请求可能被拦截。可在扩展管理中手动授权。', 'warning');
                    }
                }
            } catch (e) {
                console.warn('[AI] 自动请求 host_permissions 失败:', e.message);
            }
        }

        ns.renderProviderList();
        ns.showToast('配置已保存（' + name + '）', 'success');
    };

    /* ===== 兼容旧 switchAiProvider ===== */
    ns.switchAiProvider = async function (providerId) {
        return ns.selectAiProvider(providerId);
    };

    /* ===== 加载 AI + 快捷键配置到设置面板 UI ===== */
    ns.loadMeConfig = async function () {
        var config = await storageV2.get(storageV2.KEYS.CONFIG, DEFAULT_V2_CONFIG);
        var activeProvider = config.aiApi.activeProvider || 'hunyuan';
        var savedProviders = config.aiApi.providers || {};
        var providerConfig = savedProviders[activeProvider] || {};

        var provider = ns.getProviderById(activeProvider);

        // 渲染供应商列表
        ns.renderProviderList();

        // 徽章
        if (dom.wbAiProviderBadge) {
            var name = providerConfig.name || (provider ? provider.name : activeProvider);
            dom.wbAiProviderBadge.textContent = name;
        }

        // AI 配置输入框
        if (dom.wbMeAiName) dom.wbMeAiName.value = providerConfig.name || (provider ? provider.name : '');
        if (dom.wbMeAiApiKey) dom.wbMeAiApiKey.value = providerConfig.apiKey || (provider ? provider.apiKey : '');
        if (dom.wbMeAiEndpoint) dom.wbMeAiEndpoint.value = providerConfig.endpoint || (provider ? provider.endpoint : '');
        if (dom.wbMeAiModel) dom.wbMeAiModel.value = providerConfig.model || (provider ? provider.model : '');

        // 加载快捷键到 hidden input
        var sc = config.focusShortcut || { ctrl: true, shift: false, alt: false, key: 'k' };
        state._focusShortcut = sc;
        var ctrlEl = document.getElementById('wbMeShortcutCtrl');
        var shiftEl = document.getElementById('wbMeShortcutShift');
        var altEl = document.getElementById('wbMeShortcutAlt');
        var keyEl = document.getElementById('wbMeShortcutKey');
        if (ctrlEl) ctrlEl.value = sc.ctrl ? '1' : '0';
        if (shiftEl) shiftEl.value = sc.shift ? '1' : '0';
        if (altEl) altEl.value = sc.alt ? '1' : '0';
        if (keyEl) keyEl.value = sc.key || 'k';
        // 更新显示
        var display = document.getElementById('sShortcutKeys');
        if (display) {
            var parts = [];
            if (sc.ctrl) parts.push('Ctrl');
            if (sc.shift) parts.push('Shift');
            if (sc.alt) parts.push('Alt');
            parts.push((sc.key || 'K').toUpperCase());
            display.textContent = parts.join(' + ');
        }
        ns.updateContextMenuLabel();
    };

})(window.DevHome);
