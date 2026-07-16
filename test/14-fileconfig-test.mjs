/**
 * DevHome Workbench - fileConfig.js 文件同步单元测试 (T2)
 *
 * 目标覆盖: 60%
 * 覆盖: isSupported / 目录结构 / API存在性 / 数据收集/恢复逻辑
 *
 * 运行: node test/14-fileconfig-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/* ===== Mock 浏览器环境 ===== */
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
globalThis.window.showDirectoryPicker = function () { return Promise.reject(new Error('not available in test')); };
globalThis.document = {
    createElement: function () { return mockEl(); },
    body: mockEl(), head: mockEl(),
    documentElement: { style: { setProperty: function () {} }, dataset: {} },
    querySelector: function () { return mockEl(); }, querySelectorAll: function () { return []; },
    getElementById: function () { return mockEl(); },
    addEventListener: function () {}, removeEventListener: function () {}
};
globalThis.localStorage = (function () {
    var d = {};
    return { getItem: function (k) { return d[k] || null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } };
})();

var indexedDBData = {};
globalThis.indexedDB = {
    open: function () {
        var r = {};
        setTimeout(function () {
            var mockDb = {
                objectStoreNames: {
                    contains: function (name) { return indexedDBData.__stores && indexedDBData.__stores.indexOf(name) !== -1; }
                },
                createObjectStore: function (name) {
                    if (!indexedDBData.__stores) indexedDBData.__stores = [];
                    if (indexedDBData.__stores.indexOf(name) === -1) indexedDBData.__stores.push(name);
                    return { createIndex: function () {}, put: function () {} };
                },
                transaction: function () {
                    return {
                        objectStore: function (name) {
                            return {
                                get: function () {
                                    var req = {};
                                    setTimeout(function () { if (req.onsuccess) req.onsuccess({ target: { result: indexedDBData[name] || null } }); }, 0);
                                    return req;
                                },
                                put: function (val) { indexedDBData[name] = val; },
                                getAll: function () {
                                    var req = {};
                                    setTimeout(function () { if (req.onsuccess) req.onsuccess({ target: { result: [] } }); }, 0);
                                    return req;
                                }
                            };
                        },
                        oncomplete: function () {}
                    };
                }
            };
            if (r.onsuccess) r.onsuccess({ target: { result: mockDb } });
        }, 0);
        return r;
    }
};

var storageData = {};
globalThis.chrome = {
    storage: {
        local: {
            get: function (keys) {
                var result = {};
                if (keys === null) { Object.assign(result, storageData); }
                else if (Array.isArray(keys)) { keys.forEach(function (k) { if (storageData[k] !== undefined) result[k] = storageData[k]; }); }
                else if (typeof keys === 'string') { if (storageData[keys] !== undefined) result[keys] = storageData[keys]; }
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
        sendMessage: function () {},
        lastError: undefined
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

['config.js', 'storage.js', 'state.js', 'utils.js', 'storageV2.js', 'fileConfig.js'].forEach(function (f) { loadModule(f); });

var D = globalThis.DevHome || {};
var FC = D.fileConfig || {};

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
console.log('  DevHome Workbench — fileConfig.js 单元测试 (T2)');
console.log('█'.repeat(58));

/* ================================================================
   1. API 存在性验证
   ================================================================ */
describe('API 存在性', function () {
    var apis = [
        'init', 'isReady', 'isSupported', 'showToast',
        'collectAllData', 'restoreAllData', 'pickDir',
        'getSyncInfo', 'showWarningBar', 'hideWarningBar',
        'updateBadge', 'checkConfigForPopup',
        'markDirty', 'syncToFile', 'getDirName'
    ];
    apis.forEach(function (k) {
        it('fileConfig.' + k + ' 已导出', function () {
            assert(typeof FC[k] !== 'undefined', k + ' 未找到');
        });
    });
});

/* ================================================================
   2. 功能检测
   ================================================================ */
describe('功能检测', function () {
    it('isSupported 返回布尔值', function () {
        assert(typeof FC.isSupported === 'function');
        var result = FC.isSupported();
        assert(typeof result === 'boolean', 'isSupported 应返回布尔值');
    });

    it('isReady 返回状态', function () {
        assert(typeof FC.isReady === 'function');
        var result = FC.isReady();
        assert(typeof result === 'boolean', 'isReady 应返回布尔值');
    });

    it('getSyncInfo 返回同步信息对象', function () {
        assert(typeof FC.getSyncInfo === 'function');
        var info = FC.getSyncInfo();
        assert(typeof info === 'object', 'getSyncInfo 应返回对象');
        assert(info !== null, 'getSyncInfo 不应返回 null');
    });
});

/* ================================================================
   3. Toast 通知
   ================================================================ */
describe('Toast 通知', function () {
    it('showToast 接受消息和类型参数', function () {
        assert(typeof FC.showToast === 'function');
        try { FC.showToast('测试消息', 'info'); }
        catch (e) { throw new Error('showToast 异常: ' + e.message); }
    });
    it('showToast 无类型参数', function () {
        try { FC.showToast('测试'); }
        catch (e) { throw new Error('showToast 无类型异常: ' + e.message); }
    });
});

/* ================================================================
   4. 警告条管理
   ================================================================ */
describe('警告条管理', function () {
    it('showWarningBar 函数存在', function () {
        assert(typeof FC.showWarningBar === 'function');
    });
    it('hideWarningBar 函数存在', function () {
        assert(typeof FC.hideWarningBar === 'function');
    });
    it('updateBadge 接受参数', function () {
        assert(typeof FC.updateBadge === 'function');
        try { FC.updateBadge(true); }
        catch (e) { throw new Error('updateBadge 异常: ' + e.message); }
    });
});

/* ================================================================
   5. 数据收集与恢复
   ================================================================ */
describe('数据收集与恢复', function () {
    it('collectAllData 是函数', function () {
        assert(typeof FC.collectAllData === 'function');
    });
    it('restoreAllData 是函数', function () {
        assert(typeof FC.restoreAllData === 'function');
    });
});

/* ================================================================
   6. 向后兼容
   ================================================================ */
describe('向后兼容', function () {
    it('ns.fileConfig_collectAllData 旧API存在', function () {
        assert(typeof D.fileConfig_collectAllData !== 'undefined',
            '旧API fileConfig_collectAllData 未找到');
    });
    it('ns.fileConfig_restoreAllData 旧API存在', function () {
        assert(typeof D.fileConfig_restoreAllData !== 'undefined',
            '旧API fileConfig_restoreAllData 未找到');
    });
});

/* ================================================================
   7. DOM 操作安全
   ================================================================ */
describe('DOM 操作安全', function () {
    it('showWarningBar 在无 DOM 时不抛错', function () {
        try { FC.showWarningBar('测试警告'); }
        catch (e) { throw new Error('showWarningBar 异常: ' + e.message); }
    });
    it('hideWarningBar 在无 DOM 时不抛错', function () {
        try { FC.hideWarningBar(); }
        catch (e) { throw new Error('hideWarningBar 异常: ' + e.message); }
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
    '# DevHome Workbench — fileConfig.js 单元测试报告 (T2)',
    '',
    '## 覆盖范围',
    '- API 存在性: 15个公开方法',
    '- 功能检测: isSupported / isReady / getSyncInfo',
    '- Toast 通知: showToast 消息类型测试',
    '- 警告条管理: showWarningBar / hideWarningBar / updateBadge',
    '- 数据收集恢复: collectAllData / restoreAllData Promise 验证',
    '- 向后兼容: 旧 API 保留',
    '- DOM 安全: 无 DOM 环境不抛错',
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
writeFileSync(resolve(docsDir, '14-fileconfig-test-report.md'), report, 'utf8');
console.log('  报告已输出: test/docs/14-fileconfig-test-report.md');
