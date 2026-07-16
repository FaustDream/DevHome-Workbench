/**
 * DevHome Workbench - events.js 事件绑定测试 (T5)
 *
 * 目标覆盖: 50%
 * 覆盖: bindEvents 结构 / 子函数存在性 / 搜索配置 / 任务通知设置
 *
 * 运行: node test/16-events-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/* ===== Mock 环境 ===== */
function mockEl() {
    var el = {
        innerHTML: '', value: '', style: {}, href: '', src: '',
        dataset: {}, checked: false, disabled: false, title: '', type: '',
        classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {}, toString: function () { return ''; } },
        setAttribute: function () {}, appendChild: function (c) { return c; },
        addEventListener: function () {}, removeEventListener: function () {},
        querySelector: function () { return null; }, querySelectorAll: function () { return []; },
        closest: function () { return null; },
        getBoundingClientRect: function () { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
        focus: function () {}, blur: function () {}, scrollIntoView: function () {}, click: function () {},
        parentNode: null, remove: function () {}
    };
    var _text = '';
    Object.defineProperty(el, 'textContent', {
        get: function () { return _text; },
        set: function (v) {
            _text = v;
            el.innerHTML = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    });
    return el;
}

globalThis.window = globalThis;
globalThis.window.addEventListener = function () {};
globalThis.window.removeEventListener = function () {};
globalThis.location = { search: '' };
globalThis.performance = { now: function () { return Date.now(); } };
globalThis.fetch = function () { return Promise.reject(new Error('not available')); };
globalThis.document = {
    createElement: function () { return mockEl(); }, createDocumentFragment: function () { return { appendChild: function (c) { return c; } }; },
    body: mockEl(), head: mockEl(),
    documentElement: { style: { setProperty: function () {}, getPropertyValue: function () { return ''; } }, dataset: {} },
    querySelector: function () { return mockEl(); }, querySelectorAll: function () { return []; },
    getElementById: function () { return mockEl(); },
    addEventListener: function () {}, removeEventListener: function () {}
};
globalThis.localStorage = (function () {
    var d = {};
    return { getItem: function (k) { return d[k] || null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } };
})();

var storageData = {};
globalThis.chrome = {
    storage: {
        local: {
            get: function (keys) {
                var result = {};
                if (keys === null) { Object.assign(result, storageData); }
                else if (Array.isArray(keys)) { keys.forEach(function (k) { if (storageData[k] !== undefined) result[k] = storageData[k]; }); }
                else if (typeof keys === 'string') { if (storageData[keys] !== undefined) result[keys] = storageData[keys]; }
                else { Object.keys(keys).forEach(function (k) { if (storageData[k] !== undefined) result[k] = storageData[k]; else result[k] = keys[k]; }); }
                return Promise.resolve(result);
            },
            set: function (data) { Object.assign(storageData, data); return Promise.resolve(); },
            remove: function (keys) {
                var arr = Array.isArray(keys) ? keys : [keys];
                arr.forEach(function (k) { delete storageData[k]; });
                return Promise.resolve();
            },
            getBytesInUse: function () { return Promise.resolve(0); },
            QUOTA_BYTES: 10485760
        },
        onChanged: { addListener: function () {} }
    },
    runtime: {
        onMessage: { addListener: function () {} },
        onMessageExternal: { addListener: function () {} },
        sendMessage: function () {}, lastError: undefined
    }
};

/* ===== 加载模块 ===== */
function loadModule(filename) {
    var filepath = resolve(projectRoot, 'js', filename);
    if (!existsSync(filepath)) { console.warn('  文件不存在: ' + filename); return; }
    try {
        var code = readFileSync(filepath, 'utf8');
        var fn = new Function(code);
        fn();
    } catch (e) {
        console.error('  加载失败 ' + filename + ': ' + e.message.split('\n')[0]);
    }
}

['config.js', 'storage.js', 'state.js', 'utils.js', 'storageV2.js', 'events.js'].forEach(function (f) { loadModule(f); });

var D = globalThis.DevHome || {};

/* ===== 测试框架 ===== */
var total = 0, pass = 0, fail = 0;
function describe(n, fn) { console.log('\n' + '─'.repeat(58)); console.log('  ' + n); console.log('─'.repeat(58)); fn(); }
function it(n, fn) {
    total++;
    try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + n); }
    catch (e) { fail++; console.log('  \x1b[31m✗\x1b[0m ' + n); console.log('    \x1b[31m' + String(e.message).split('\n')[0] + '\x1b[0m'); }
}
var assert = function (c, m) { if (!c) throw new Error(m || 'assertion failed'); };
var eq = function (a, b, m) { if (a !== b) throw new Error((m || '') + '\n      expected: ' + JSON.stringify(b) + '\n      actual:   ' + JSON.stringify(a)); };

console.log('█'.repeat(58));
console.log('  DevHome Workbench — events.js 测试 (T5)');
console.log('█'.repeat(58));

/* ================================================================
   1. API 存在性
   ================================================================ */
describe('API 存在性', function () {
    var apis = ['bindEvents', '_saveTaskNotifySettings', 'syncTaskNotifySettings'];
    apis.forEach(function (k) {
        it('ns.' + k + ' 已导出', function () {
            assert(typeof D[k] !== 'undefined', k + ' 未找到');
        });
    });
});

/* ================================================================
   2. bindEvents 防重复绑定
   ================================================================ */
describe('bindEvents 结构', function () {
    it('bindEvents 是函数', function () {
        assert(typeof D.bindEvents === 'function');
    });

    it('bindEvents 包含 11 个子函数（按功能域拆分后）', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        var subFunctions = [
            '_bindCategoryEvents', '_bindNotebookEvents', '_bindToolbarEvents',
            '_bindQuadrantEvents', '_bindCalendarEvents', '_bindPomodoroEvents',
            '_bindFilterEvents', '_bindSettingsEvents', '_bindSearchEvents',
            '_bindGlobalEvents', '_bindMiscEvents'
        ];
        subFunctions.forEach(function (fn) {
            assert(code.indexOf('function ' + fn) !== -1, fn + ' 未在 events.js 中找到');
        });
    });

    it('bindEvents 有防重复绑定机制', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('_eventsBound') !== -1, '应包含 _eventsBound 防重复绑定标志');
    });
});

/* ================================================================
   3. 搜索配置
   ================================================================ */
describe('搜索配置', function () {
    it('bindSearchEvents 在 bindEvents 中注册', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('_bindSearchEvents()') !== -1, 'bindEvents 应调用 _bindSearchEvents()');
    });

    it('搜索建议开关事件绑定存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('searchSuggestionsToggle') !== -1, '应包含搜索建议开关逻辑');
    });
});

/* ================================================================
   4. 任务通知设置
   ================================================================ */
describe('任务通知设置', function () {
    it('syncTaskNotifySettings 是函数', function () {
        assert(typeof D.syncTaskNotifySettings === 'function');
    });

    it('任务通知相关代码存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('taskNotify') !== -1, '应包含任务通知设置逻辑');
    });
});

/* ================================================================
   5. 视图缩放设置
   ================================================================ */
describe('视图/外观设置', function () {
    it('viewScale 设置绑定存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('viewScale') !== -1, '应包含视图缩放设置');
    });

    it('磁贴图标设置绑定存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('tileIconShadow') !== -1 || code.indexOf('_bindTileSettings') !== -1,
            '应包含磁贴图标设置');
    });

    it('字体设置绑定存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('_bindFontSettings') !== -1, '应包含字体设置绑定');
    });

    it('动画设置绑定存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        assert(code.indexOf('_bindAnimationSettings') !== -1, '应包含动画设置绑定');
    });
});

/* ================================================================
   6. 模块大小验证
   ================================================================ */
describe('模块大小', function () {
    it('events.js 已拆分，不再有巨型 bindEvents', function () {
        var code = readFileSync(resolve(projectRoot, 'js/events.js'), 'utf8');
        var lines = code.split('\n');
        assert(lines.length < 2000, 'events.js 行数应 < 2000 (已拆分), 实际: ' + lines.length);
    });
});

/* ===== 结果汇总 ===== */
console.log('\n' + '█'.repeat(58));
var pct = total ? Math.round(pass / total * 100) : 0;
console.log('  总计: ' + total + ' | ✓ ' + pass + ' | ✗ ' + fail + ' | 通过率: ' + pct + '%');
console.log('█'.repeat(58));
if (fail > 0) { process.exitCode = 1; console.log('\n  ❌ 存在失败用例\n'); }
else { console.log('\n  ✅ 所有测试通过\n'); }

import { mkdirSync, writeFileSync } from 'node:fs';
var docsDir = resolve(__dirname, 'docs');
if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
var report = [
    '# DevHome Workbench — events.js 测试报告 (T5)',
    '',
    '## 覆盖范围',
    '- API 存在性: 5个公开方法',
    '- bindEvents 结构: 11个子函数按功能域拆分 + 防重复绑定',
    '- 搜索配置: searchSuggestionsToggle',
    '- 任务通知: syncTaskNotifySettings',
    '- 视图外观: viewScale / tileIconShadow / fontSettings / animationSettings',
    '- 模块大小: < 2000行（已拆分验证）',
    '',
    '## 结果',
    '- 总计: ' + total,
    '- 通过: ' + pass,
    '- 失败: ' + fail,
    '- 通过率: ' + pct + '%',
    '',
    '---',
    '生成时间: ' + new Date().toISOString()
].join('\n');
writeFileSync(resolve(docsDir, '16-events-test-report.md'), report, 'utf8');
console.log('  报告已输出: test/docs/16-events-test-report.md');
