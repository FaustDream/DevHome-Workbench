/**
 * DevHome Workbench - 共享测试环境
 * 为所有测试模块提供 mock 浏览器环境、模块加载器和断言框架
 */
import { readFileSync, existsSync, writeFileSync as _writeFileSync, mkdirSync as _mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/* ===== DOM Mock 工厂 ===== */
export function mockEl() {
    const el = {
        innerHTML: '', value: '', style: {}, href: '', src: '',
        dataset: {}, checked: false, disabled: false, title: '', type: '',
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() {}, toString() { return ''; } },
        setAttribute() {}, appendChild(c) { return c; },
        addEventListener() {}, removeEventListener() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
        closest() { return null; },
        getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
        focus() {}, blur() {}, scrollIntoView() {}, click() {}, toString() { return '[mock]'; },
        parentNode: null, remove() {}
    };
    let _text = '';
    Object.defineProperty(el, 'textContent', {
        get() { return _text; },
        set(v) {
            _text = v;
            el.innerHTML = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
        configurable: true, enumerable: true
    });
    return el;
}

/* ===== 初始化全局 Mock 环境 ===== */
export function setupGlobalMock() {
    if (globalThis.__mockSetup) return; // 防重复初始化
    globalThis.__mockSetup = true;

    globalThis.window = globalThis;
    globalThis.location = { search: '' };
    globalThis.performance = { now() { return Date.now(); } };
    globalThis.requestAnimationFrame = function (cb) { setTimeout(cb, 16); };
    globalThis.fetch = () => Promise.reject(new Error('fetch not available in test'));
    globalThis.Blob = class {
        constructor(parts, opts) { this._parts = parts; this.type = (opts && opts.type) || ''; }
    };
    globalThis.FileReader = class {
        readAsDataURL() {} readAsText() {} readAsArrayBuffer() {}
    };
    globalThis.MutationObserver = class {
        constructor(cb) { this._cb = cb; }
        observe() {} disconnect() {}
    };
    globalThis.URL = globalThis.URL || { createObjectURL() { return 'blob:mock'; }, revokeObjectURL() {} };
    globalThis.indexedDB = {
        open() {
            const r = {};
            const makeAsyncResult = function (resultVal) {
                const req = {};
                setTimeout(function () {
                    if (req.onsuccess) req.onsuccess({ target: { result: resultVal } });
                }, 0);
                return req;
            };
            setTimeout(function () {
                const mockDb = {
                    objectStoreNames: { contains: function () { return true; } },
                    transaction: function () {
                        return {
                            objectStore: function () {
                                return {
                                    get: function () { return makeAsyncResult(null); },
                                    put: function () {},
                                    count: function () { return makeAsyncResult(0); },
                                    index: function () {
                                        return { openCursor: function () { return makeAsyncResult(null); } };
                                    },
                                    getAll: function () { return makeAsyncResult([]); }
                                };
                            },
                            oncomplete: function () { }
                        };
                    }
                };
                if (r.onsuccess) r.onsuccess({ target: { result: mockDb } });
            }, 0);
            return r;
        }
    };
    globalThis.document = {
        createElement(tag) { return mockEl(); },
        createDocumentFragment() {
            return {
                appendChild(c) { return c; },
                childNodes: [], children: [],
                querySelector() { return null; },
                querySelectorAll() { return []; }
            };
        },
        body: mockEl(), head: mockEl(),
        documentElement: { style: { setProperty() {}, getPropertyValue() { return ''; } }, dataset: {} },
        querySelector() { return mockEl(); },
        querySelectorAll() { return [mockEl()]; },
        getElementById() { return mockEl(); },
        addEventListener() {}, removeEventListener() {}
    };
    globalThis.localStorage = (() => {
        const d = {};
        return {
            getItem(k) { return d[k] || null; },
            setItem(k, v) { d[k] = String(v); },
            removeItem(k) { delete d[k]; },
            clear() { Object.keys(d).forEach(k => delete d[k]); },
            get length() { return Object.keys(d).length; }
        };
    })();
    globalThis.setTimeout = setTimeout;
    globalThis.clearTimeout = clearTimeout;
    globalThis.setInterval = setInterval;
    globalThis.clearInterval = clearInterval;
}

/* ===== 模块加载器 ===== */
export function loadModule(filename) {
    const filePath = resolve(projectRoot, 'js', filename);
    if (!existsSync(filePath)) {
        console.error(`  [SKIP] ${filename} — 文件不存在`);
        return false;
    }
    const code = readFileSync(filePath, 'utf8');
    let patched = code;
    if (filename === 'main.js') {
        patched = code.replace(/\/\* ===== 自动聚焦[\s\S]*$/, '// boot() suppressed for testing\n})(window.DevHome);\n');
    }
    try {
        const fn = new Function(patched);
        fn();
        return true;
    } catch (e) {
        console.error(`  [ERROR] 加载 ${filename}:`, e.message.split('\n')[0]);
        return false;
    }
}

/* ===== 断言框架 ===== */
export function createReporter(testName, reportPath) {
    const startTime = Date.now();
    let total = 0, pass = 0, fail = 0;
    const results = [];
    const failures = [];

    function desc(name, fn) {
        fn();
    }

    function it(name, fn) {
        total++;
        try {
            fn();
            pass++;
            results.push({ name, status: 'PASS' });
        } catch (e) {
            fail++;
            const errMsg = String(e.message).split('\n')[0];
            results.push({ name, status: 'FAIL', error: errMsg });
            failures.push({ name, error: errMsg });
        }
    }

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || 'assertion failed');
    }

    function eq(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error((msg || '') + '\n      expected: ' + JSON.stringify(expected) + '\n      actual:   ' + JSON.stringify(actual));
        }
    }

    function deepEq(actual, expected, msg) {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
            throw new Error((msg || '') + '\n      expected: ' + b + '\n      actual:   ' + a);
        }
    }

    function isArray(val, msg) {
        if (!Array.isArray(val)) throw new Error((msg || '值应为数组') + ', 实际: ' + typeof val);
    }

    function isType(val, type, msg) {
        if (typeof val !== type) throw new Error((msg || `值应为 ${type}`) + `, 实际: ${typeof val}`);
    }

    function throws(fn, expectedMsg) {
        try { fn(); }
        catch (e) {
            if (expectedMsg && !e.message.includes(expectedMsg)) {
                throw new Error(`异常消息不匹配: 期望包含 "${expectedMsg}", 实际 "${e.message}"`);
            }
            return;
        }
        throw new Error('期望抛出异常，但未抛出');
    }

    function finalize() {
        const elapsed = Date.now() - startTime;
        const pct = total ? Math.round(pass / total * 100) : 0;

        const report = generateMarkdownReport(testName, total, pass, fail, pct, elapsed, results, failures);
        writeFileSync(reportPath, report, 'utf8');

        console.log(`\n[${testName}] 总计: ${total} | ✓ ${pass} | ✗ ${fail} | 通过率: ${pct}% | 耗时: ${elapsed}ms`);
        if (fail > 0) console.log(`  报告: ${reportPath}`);

        return { total, pass, fail, pct, elapsed };
    }

    return { desc, it, assert, eq, deepEq, isArray, isType, throws, finalize };
}

function generateMarkdownReport(name, total, pass, fail, pct, elapsed, results, failures) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    let report = '';
    report += `# ${name} — 测试报告\n\n`;
    report += `- **生成时间**: ${now}\n`;
    report += `- **测试总数**: ${total}\n`;
    report += `- **通过**: ${pass} ✓\n`;
    report += `- **失败**: ${fail} ✗\n`;
    report += `- **通过率**: ${pct}%\n`;
    report += `- **耗时**: ${elapsed}ms\n`;
    report += `- **项目**: DevHome Workbench v2.18.1\n\n`;

    if (results.length > 0) {
        report += `## 测试明细\n\n`;
        report += `| # | 测试项 | 状态 |\n`;
        report += `|---|--------|------|\n`;
        results.forEach((r, i) => {
            const icon = r.status === 'PASS' ? '✅' : '❌';
            report += `| ${i + 1} | ${r.name} | ${icon} ${r.status} |\n`;
        });
        report += '\n';
    }

    if (failures.length > 0) {
        report += `## 失败详情\n\n`;
        failures.forEach((f, i) => {
            report += `### ${i + 1}. ${f.name}\n`;
            report += `\`\`\`\n${f.error}\n\`\`\`\n\n`;
        });
    }

    if (fail === 0) {
        report += `## 结论\n\n✅ **所有测试通过**\n`;
    } else {
        report += `## 结论\n\n⚠️ 存在 ${fail} 个失败测试，通过率 ${pct}%\n`;
    }

    return report;
}

function writeFileSync(path, content) {
    try {
        _mkdirSync(dirname(path), { recursive: true });
    } catch (_) { }
    _writeFileSync(path, content, 'utf8');
}

/* ===== DevHome 命名空间快捷引用 ===== */
export function getDH() {
    return globalThis.DevHome || {};
}

/* ===== 清理 localStorage ===== */
export function clearLocalStorage() {
    const keys = Object.keys(globalThis.localStorage).filter(k =>
        k.startsWith('tabpage_') || k.startsWith('devhome_')
    );
    keys.forEach(k => globalThis.localStorage.removeItem(k));
}

export { projectRoot };
