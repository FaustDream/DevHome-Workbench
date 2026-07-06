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
            apiKey: 'sk-KVgtp3GV6gMAvEV2dowFilqMCSc07jQUlc0pHx5I94XWZ',
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
            apiKey: 'sk-u0W6YLj0vb9Bcc1jiPkAAT96FU185GqE7P9p2w3Djd48asDu',
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

    console.log('[AI] 供应商注册完成，内置 ' + ns.AI_PROVIDERS.length + ' 个供应商');
})(window.DevHome);
