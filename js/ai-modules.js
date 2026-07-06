/**
 * DevHome Workbench - AI 功能模块注册表
 *
 * 每个模块定义了：ID、名称、描述、System Prompt、上下文构建函数。
 * 通过模块化设计支持灵活扩展新的 AI 功能（代码审查、翻译、头脑风暴等）。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;

    /**
     * AI 功能模块清单
     *
     * 添加新模块只需在此数组中新增一个对象，无需修改调用方代码。
     */
    ns.AI_MODULES = [
        {
            id: 'daily-summary',
            name: '每日总结',
            description: '基于今日笔记和捕获生成结构化工作总结',
            systemPrompt: '你是一个专业的工作总结助手。请将以下工作记录整理为结构化的每日总结，包括：\n1) 今日完成的任务\n2) 遇到的问题\n3) 关键收获\n4) 明日计划\n\n用 Markdown 格式输出，语言简洁专业。',
            /** 构建模块所需的上下文内容 */
            buildContext: function () {
                var todayStr = new Date().toISOString().slice(0, 10);
                var todayNotes = (state.notes || []).filter(function (n) {
                    return new Date(n.createdAt).toISOString().slice(0, 10) === todayStr;
                });
                var todayCaptures = (state.captures || []).filter(function (c) {
                    return new Date(c.createdAt).toISOString().slice(0, 10) === todayStr;
                });

                var text = '';
                todayNotes.forEach(function (n) {
                    text += '## ' + n.title + '\n' + n.content + '\n\n';
                });
                todayCaptures.forEach(function (c) {
                    text += '- ' + c.content + '\n';
                });
                return text;
            },
            /** 内容为空时的提示 */
            emptyMessage: '今天还没有任何记录',
            /** 是否需要内容才能调用 */
            requireContent: true
        },
        {
            id: 'quick-chat',
            name: '快速对话',
            description: '自由提问，AI 即时回答',
            systemPrompt: '你是一个智能助手，请用简洁清晰的中文回答用户的问题。如果问题涉及代码，请使用 Markdown 代码块格式输出。',
            buildContext: function () { return ''; },
            emptyMessage: null,
            requireContent: false,
            /** 快速对话需要用户输入问题 */
            needUserInput: true,
            inputPlaceholder: '输入你的问题...',
            inputTitle: '快速对话'
        }
    ];

    /**
     * 根据 ID 查找模块
     * @param {string} moduleId
     * @returns {object|null}
     */
    ns.getModuleById = function (moduleId) {
        return ns.AI_MODULES.find(function (m) { return m.id === moduleId; }) || null;
    };

    console.log('[AI] 功能模块注册完成，共 ' + ns.AI_MODULES.length + ' 个模块');
})(window.DevHome);
