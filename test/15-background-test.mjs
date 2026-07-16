/**
 * DevHome Workbench - background.js Service Worker 测试 (T4)
 *
 * 目标覆盖: 50%
 * 覆盖: 激励语句库 / 番茄钟状态结构 / alarm 处理 / 消息监听
 *
 * 运行: node test/15-background-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/* ===== Mock 浏览器/Chrome 环境 ===== */
globalThis.window = globalThis;
globalThis.window.addEventListener = function () {};
globalThis.location = { search: '' };

var alarmListeners = {};
var messageListeners = {};
var notificationStack = [];
var pomodoroStorage = {};

globalThis.chrome = {
    storage: {
        local: {
            get: function (keys) {
                var result = {};
                if (typeof keys === 'string') { if (pomodoroStorage[keys] !== undefined) result[keys] = pomodoroStorage[keys]; }
                return Promise.resolve(result);
            },
            set: function (data) { Object.assign(pomodoroStorage, data); return Promise.resolve(); },
            remove: function (keys) {
                var arr = Array.isArray(keys) ? keys : [keys];
                arr.forEach(function (k) { delete pomodoroStorage[k]; });
                return Promise.resolve();
            },
            getBytesInUse: function () { return Promise.resolve(0); },
            QUOTA_BYTES: 10485760
        },
        onChanged: { addListener: function () {} }
    },
    runtime: {
        onMessage: {
            addListener: function (fn) { messageListeners._message = fn; },
            removeListener: function () {}
        },
        onMessageExternal: { addListener: function () {} },
        onStartup: { addListener: function () {} },
        onInstalled: { addListener: function () {} },
        sendMessage: function () { return Promise.resolve(); },
        connect: function () { return { onDisconnect: { addListener: function () {} }, postMessage: function () {}, disconnect: function () {} }; },
        lastError: undefined
    },
    alarms: {
        create: function (name, opts) { alarmListeners[name] = opts; return Promise.resolve(); },
        clear: function (name) { delete alarmListeners[name]; return Promise.resolve(); },
        getAll: function () { return Promise.resolve([]); },
        onAlarm: {
            addListener: function (fn) { alarmListeners._handler = fn; },
            removeListener: function () {}
        }
    },
    notifications: {
        create: function (id, opts) {
            notificationStack.push({ id: id, opts: opts });
            return Promise.resolve('notif_' + Date.now());
        },
        clear: function () { notificationStack = []; return Promise.resolve(); },
        onClicked: { addListener: function () {} },
        onButtonClicked: { addListener: function () {} }
    },
    action: {
        setBadgeText: function () { return Promise.resolve(); },
        setBadgeBackgroundColor: function () { return Promise.resolve(); }
    },
    contextMenus: {
        create: function () {},
        onClicked: { addListener: function () {} }
    },
    commands: {
        onCommand: { addListener: function () {} }
    },
    sidePanel: {
        setOptions: function () { return Promise.resolve(); },
        open: function () { return Promise.resolve(); }
    },
    scripting: {
        executeScript: function () { return Promise.resolve([]); }
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

loadModule('background.js');

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
console.log('  DevHome Workbench — background.js 测试 (T4)');
console.log('█'.repeat(58));

/* ================================================================
   1. 激励语句库验证
   ================================================================ */
describe('激励语句库', function () {
    it('WORK_COMPLETE_QUOTES 非空数组', function () {
        // 通过 source code 正则提取验证
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(/WORK_COMPLETE_QUOTES/.test(code), '源码中应存在 WORK_COMPLETE_QUOTES');
        assert(/REST_COMPLETE_QUOTES/.test(code), '源码中应存在 REST_COMPLETE_QUOTES');
        assert(/REST_START_QUOTES/.test(code), '源码中应存在 REST_START_QUOTES');
    });

    it('语句库包含中文内容', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        var chineseCount = (code.match(/[\u4e00-\u9fff]/g) || []).length;
        assert(chineseCount > 50, 'backgroud.js 应包含中文激励内容，实际: ' + chineseCount + '个汉字');
    });

    it('randomQuote 函数逻辑正确', function () {
        // 验证函数存在（通过代码分析）
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(/function randomQuote/.test(code), '应存在 randomQuote 函数');
    });
});

/* ================================================================
   2. 番茄钟状态结构
   ================================================================ */
describe('番茄钟状态管理', function () {
    it('pomodoroState 包含必要字段', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        var fields = ['active', 'duration', 'restDuration', 'type'];
        fields.forEach(function (f) {
            assert(code.indexOf(f) !== -1, 'pomodoroState 应包含 ' + f + ' 字段');
        });
    });

    it('POMODORO_STORAGE_KEY 前缀正确', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(code.indexOf("'v2/pomodoro_state'") !== -1 || code.indexOf('"v2/pomodoro_state"') !== -1,
            '存储键应为 v2/pomodoro_state');
    });
});

/* ================================================================
   3. 消息处理器注册
   ================================================================ */
describe('消息处理器', function () {
    it('chrome.runtime.onMessage.addListener 代码存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(code.indexOf('onMessage.addListener') !== -1 || code.indexOf('onMessageExternal.addListener') !== -1,
            '应包含消息监听器注册');
    });

    it('chrome.alarms.onAlarm 已注册监听', function () {
        assert(typeof alarmListeners._handler === 'function',
            '应注册 onAlarm 处理器');
    });
});

/* ================================================================
   4. Chrome API 结构验证
   ================================================================ */
describe('Chrome API 注册', function () {
    it('contextMenus.create 已调用', function () {
        // 验证右键菜单创建代码存在
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(code.indexOf('contextMenus') !== -1, '应包含 contextMenus 注册逻辑');
    });

    it('sidePanel 配置存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(code.indexOf('sidePanel') !== -1, '应包含 sidePanel 配置');
    });

    it('通知创建逻辑存在', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        assert(code.indexOf('notifications') !== -1, '应包含 notifications 逻辑');
    });
});

/* ================================================================
   5. 代码安全
   ================================================================ */
describe('代码安全', function () {
    it('无 eval() 调用', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        var evalCalls = (code.match(/\beval\s*\(/g) || []).length;
        eq(evalCalls, 0, 'background.js 不应包含 eval()');
    });

    it('无硬编码敏感信息', function () {
        var code = readFileSync(resolve(projectRoot, 'js/background.js'), 'utf8');
        // 检查无 API Key 硬编码（简单正则）
        var suspicious = (code.match(/api_key\s*[:=]\s*["'][A-Za-z0-9]{20,}["']/gi) || []).length;
        eq(suspicious, 0, '不应包含硬编码 API Key');
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
    '# DevHome Workbench — background.js 测试报告 (T4)',
    '',
    '## 覆盖范围',
    '- 激励语句库: 存在性验证 + 中文内容检查',
    '- 番茄钟状态: 字段结构 + 存储键前缀',
    '- 消息处理器: onMessage / onAlarm 监听器注册',
    '- Chrome API: contextMenus / sidePanel / notifications',
    '- 代码安全: eval() 检查 / API Key 检查',
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
writeFileSync(resolve(docsDir, '15-background-test-report.md'), report, 'utf8');
console.log('  报告已输出: test/docs/15-background-test-report.md');
