/**
 * DevHome Workbench - AI 供应商注册表
 *
 * 每个供应商定义：id、名称、默认端点、默认模型、API Key、请求/响应格式适配器。
 * 所有供应商共享统一的调用接口，上层模块无需关心底层格式差异。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /** 内置 AI 供应商清单 */
    ns.AI_PROVIDERS = [
        {
            id: 'hunyuan',
            name: '腾讯混元',
            badge: '腾讯混元',
            endpoint: 'https://hunyuan.tencentcloudapi.com',
            model: 'hunyuan-lite',
            // API Key 来自本地密钥配置文件（js/secrets.js，已 gitignore），缺失则需手动配置
            apiKey: (ns.SECRETS && ns.SECRETS.hunyuan) || '',
            /** 请求格式适配器：标准 messages → 供应商请求 body */
            buildBody: function (model, messages) {
                return {
                    Model: model,
                    Messages: messages.map(function (m) { return { Role: m.role, Content: m.content }; })
                };
            },
            /** 响应格式适配器：供应商响应 → 纯文本内容 */
            extractContent: function (data) {
                if (data.Response && data.Response.Choices && data.Response.Choices[0]) {
                    return data.Response.Choices[0].Message.Content;
                }
                return null;
            }
        },
        {
            id: 'deepseek',
            name: 'DeepSeek V4',
            badge: 'DeepSeek',
            endpoint: 'https://new-api.rugao.me/v1/chat/completions',
            model: 'deepseek-v4-flash',
            // API Key 来自本地密钥配置文件（js/secrets.js，已 gitignore），缺失则需手动配置
            apiKey: (ns.SECRETS && ns.SECRETS.deepseek) || '',
            /** OpenAI 兼容格式 */
            buildBody: function (model, messages) {
                return {
                    model: model,
                    messages: messages
                };
            },
            extractContent: function (data) {
                if (data.choices && data.choices[0]) {
                    return data.choices[0].message.content;
                }
                return null;
            }
        }
    ];

    /**
     * 根据 ID 查找供应商配置
     * @param {string} providerId
     * @returns {object|null}
     */
    ns.getProviderById = function (providerId) {
        return ns.AI_PROVIDERS.find(function (p) { return p.id === providerId; }) || null;
    };

    /**
     * 为自定义（OpenAI 兼容）供应商创建适配器。
     * 自定义供应商在设置中保存的是 { name, apiKey, endpoint, model } 等字段，
     * 统一按 OpenAI Chat Completions 标准格式构建请求与解析响应，
     * 使 ai-chat.js / workbench.js 无需关心是否为内置供应商。
     * @param {string} id - 供应商 ID（通常为 custom_ 前缀）
     * @param {object} cfg - 该供应商在配置中的字段
     */
    ns.createOpenAIProvider = function (id, cfg) {
        cfg = cfg || {};
        return {
            id: id,
            name: cfg.name || id,
            badge: cfg.name || id,
            endpoint: cfg.endpoint,
            model: cfg.model,
            apiKey: cfg.apiKey,
            buildBody: function (model, messages) {
                return { model: model, messages: messages };
            },
            extractContent: function (data) {
                if (data && data.choices && data.choices[0]) {
                    return data.choices[0].message.content;
                }
                return null;
            }
        };
    };

    console.log('[AI] 供应商注册完成，内置 ' + ns.AI_PROVIDERS.length + ' 个供应商');

    /**
     * 启动时检查所有内置供应商的 Key 状态，输出警告日志
     * 由 main.js 在 AI 模块加载后调用
     */
    ns.checkProviderKeyStatus = function () {
        ns.AI_PROVIDERS.forEach(function (p) {
            if (!p.apiKey) {
                console.warn('[AI] ' + p.name + ' 未配置 API Key，请在设置中填写后使用');
            } else {
                console.log('[AI] ' + p.name + ' API Key 已配置');
            }
        });
    };
})(window.DevHome);
