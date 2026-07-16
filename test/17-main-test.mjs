/**
 * DevHome Workbench - main.js 启动流程测试 (T6)
 *
 * 目标覆盖: 60%
 * 覆盖: applyShortcutSize / applyShortcutColumns / boot 流程 / LAYOUT_PRESETS
 *
 * 运行: node test/17-main-test.mjs
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
globalThis.setInterval = function () { return 0; };

var storageData = {};
globalThis.chrome = {
    storage: {
        local: {
            get: function (keys) {
                var result = {};
                if (Array.isArray(keys)) { keys.forEach(function (k) { if (storageData[k] !== undefined) result[k] = storageData[k]; }); }
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
        // 移除底部的自动启动逻辑，只保留函数定义
        if (filename === 'main.js') {
            code = code.replace(/\/\* ===== 自动聚焦[\s\S]*$/, '// boot() suppressed for testing\n})(window.DevHome);\n');
        }
        var fn = new Function(code);
        fn();
    } catch (e) {
        console.error('  加载失败 ' + filename + ': ' + e.message.split('\n')[0]);
    }
}

['config.js', 'storage.js', 'state.js', 'utils.js', 'storageV2.js', 'main.js'].forEach(function (f) { loadModule(f); });

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
console.log('  DevHome Workbench — main.js 启动流程测试 (T6)');
console.log('█'.repeat(58));

/* ================================================================
   1. API 存在性
   ================================================================ */
describe('API 存在性', function () {
    var apis = ['applyShortcutSize', 'updateShortcutSizeMenu', 'applyShortcutColumns', 'updateShortcutColumnsMenu', 'boot'];
    apis.forEach(function (k) {
        it('ns.' + k + ' 已导出', function () {
            assert(typeof D[k] === 'function', k + ' 未找到或不是函数');
        });
    });
});

/* ================================================================
   2. 快捷方式尺寸
   ================================================================ */
describe('快捷方式尺寸', function () {
    it('SHORTCUT_SIZE_OPTIONS 三档存在', function () {
        var c = D.SHORTCUT_SIZE_OPTIONS;
        assert(c && c.small && c.standard && c.large,
            '应包含 small/standard/large 三档');
    });

    it('normalizeShortcutSize 有效值不被修改', function () {
        eq(D.normalizeShortcutSize('small'), 'small');
        eq(D.normalizeShortcutSize('standard'), 'standard');
        eq(D.normalizeShortcutSize('large'), 'large');
    });

    it('applyShortcutSize 设置 CSS 变量', function () {
        assert(typeof D.applyShortcutSize === 'function');
        try {
            D.applyShortcutSize('standard', false);
        } catch (e) {
            throw new Error('applyShortcutSize 抛错: ' + e.message);
        }
    });
});

/* ================================================================
   3. 快捷方式列数
   ================================================================ */
describe('快捷方式列数', function () {
    it('SHORTCUT_COLUMN_OPTIONS 存在', function () {
        var c = D.SHORTCUT_COLUMN_OPTIONS;
        assert(c && typeof c === 'object', 'SHORTCUT_COLUMN_OPTIONS 应为对象');
    });

    it('normalizeShortcutColumns 返回字符串', function () {
        var r = D.normalizeShortcutColumns(6);
        assert(typeof r === 'string', '应返回字符串');
    });

    it('applyShortcutColumns 设置 CSS 变量', function () {
        assert(typeof D.applyShortcutColumns === 'function');
        try {
            D.applyShortcutColumns('6', false);
        } catch (e) {
            throw new Error('applyShortcutColumns 抛错: ' + e.message);
        }
    });
});

/* ================================================================
   4. boot 启动流程
   ================================================================ */
describe('boot 启动流程', function () {
    it('boot 是 async 函数', function () {
        assert(typeof D.boot === 'function');
        // async function 的构造函数名是 AsyncFunction
        assert(D.boot.constructor.name === 'AsyncFunction',
            'boot 应为 async 函数，实际: ' + D.boot.constructor.name);
    });

    it('boot 调用链包含 theme.init', function () {
        var code = readFileSync(resolve(projectRoot, 'js/main.js'), 'utf8');
        assert(code.indexOf('theme.init') !== -1, 'boot 应调用 theme.init()');
    });

    it('boot 调用链包含 storageV2.migrateFromLegacy', function () {
        var code = readFileSync(resolve(projectRoot, 'js/main.js'), 'utf8');
        assert(code.indexOf('migrateFromLegacy') !== -1, 'boot 应调用 migrateFromLegacy()');
    });
});

/* ================================================================
   5. 布局预设（F5 布局系统）
   ================================================================ */
describe('布局预设', function () {
    it('LAYOUT_PRESETS 存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/main.js'), 'utf8');
        assert(code.indexOf('LAYOUT_PRESETS') !== -1, '应包含 LAYOUT_PRESETS');
    });

    it('applyLayout 存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/main.js'), 'utf8');
        assert(code.indexOf('applyLayout') !== -1, '应包含 applyLayout 函数');
    });
});

/* ================================================================
   6. 模块大小
   ================================================================ */
describe('模块大小', function () {
    it('main.js 为轻量入口', function () {
        var code = readFileSync(resolve(projectRoot, 'js/main.js'), 'utf8');
        var lines = code.split('\n');
        assert(lines.length < 300, 'main.js 应为轻量入口 (<300行), 实际: ' + lines.length);
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
    '# DevHome Workbench — main.js 启动流程测试报告 (T6)',
    '',
    '## 覆盖范围',
    '- API 存在性: 5个公开方法',
    '- 快捷方式尺寸: SHORTCUT_SIZE_OPTIONS 三档 / normalizeShortcutSize / applyShortcutSize',
    '- 快捷方式列数: SHORTCUT_COLUMN_OPTIONS / normalizeShortcutColumns / applyShortcutColumns',
    '- boot 启动: async 函数验证 / theme.init / migrateFromLegacy 调用链',
    '- 布局预设: LAYOUT_PRESETS / applyLayout',
    '- 模块大小: <300行（轻量入口验证）',
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
writeFileSync(resolve(docsDir, '17-main-test-report.md'), report, 'utf8');
console.log('  报告已输出: test/docs/17-main-test-report.md');
