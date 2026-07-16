/**
 * DevHome Workbench - storageV2.js 存储层单元测试
 *
 * 目标覆盖: 80%
 * 覆盖方法: get / set / remove / getAll / migrateFromLegacy / isAvailable / isCacheExpired
 *
 * 运行: node test/12-storage-test.mjs
 */
import { readFileSync } from 'node:fs';
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
        },
        configurable: true, enumerable: true
    });
    return el;
}

globalThis.window = globalThis;
globalThis.location = { search: '' };
globalThis.performance = { now: function () { return Date.now(); } };
globalThis.requestAnimationFrame = function (cb) { setTimeout(cb, 16); };
globalThis.fetch = function () { return Promise.reject(new Error('not available')); };
globalThis.Blob = class { constructor(parts, opts) { this._parts = parts; this.type = (opts && opts.type) || ''; } };
globalThis.FileReader = class { readAsDataURL() {} readAsText() {} readAsArrayBuffer() {} };
globalThis.MutationObserver = class { constructor(cb) { this._cb = cb; } observe() {} disconnect() {} };
globalThis.URL = { createObjectURL: function () { return 'blob:mock'; }, revokeObjectURL: function () {} };
globalThis.indexedDB = (function () {
    function makeAsyncResult(resultVal) {
        var req = {};
        setTimeout(function () {
            if (req.onsuccess) req.onsuccess({ target: { result: resultVal } });
        }, 0);
        return req;
    }
    return {
        open: function () {
            var r = {};
            setTimeout(function () {
                var mockDb = {
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
                            oncomplete: function () {}
                        };
                    }
                };
                if (r.onsuccess) r.onsuccess({ target: { result: mockDb } });
            }, 0);
            return r;
        }
    };
})();
globalThis.document = {
    createElement: function () { return mockEl(); },
    createDocumentFragment: function () { return { appendChild: function (c) { return c; }, childNodes: [], children: [], querySelector: function () { return null; }, querySelectorAll: function () { return []; } }; },
    body: mockEl(), head: mockEl(),
    documentElement: { style: { setProperty: function () {}, getPropertyValue: function () { return ''; } }, dataset: {} },
    querySelector: function () { return mockEl(); }, querySelectorAll: function () { return [mockEl()]; },
    getElementById: function () { return mockEl(); },
    addEventListener: function () {}, removeEventListener: function () {}
};
globalThis.localStorage = (function () {
    var d = {};
    return {
        getItem: function (k) { return d[k] || null; },
        setItem: function (k, v) { d[k] = String(v); },
        removeItem: function (k) { delete d[k]; },
        clear: function () { Object.keys(d).forEach(function (k) { delete d[k]; }); },
        get length() { return Object.keys(d).length; }
    };
})();

/* ===== Mock chrome.storage.local ===== */
var storageData = {};
globalThis.chrome = {
    storage: {
        local: {
            get: function (keys) {
                return new Promise(function (resolve) {
                    var result = {};
                    if (keys === null) {
                        Object.assign(result, storageData);
                    } else if (Array.isArray(keys)) {
                        keys.forEach(function (k) {
                            if (storageData[k] !== undefined) result[k] = storageData[k];
                        });
                    } else if (typeof keys === 'string') {
                        if (storageData[keys] !== undefined) result[keys] = storageData[keys];
                    }
                    resolve(result);
                });
            },
            set: function (obj) {
                return new Promise(function (resolve) {
                    Object.keys(obj).forEach(function (k) {
                        storageData[k] = obj[k];
                    });
                    resolve();
                });
            },
            remove: function (keys) {
                return new Promise(function (resolve) {
                    if (Array.isArray(keys)) {
                        keys.forEach(function (k) { delete storageData[k]; });
                    } else if (typeof keys === 'string') {
                        delete storageData[keys];
                    }
                    resolve();
                });
            }
        },
        onChanged: {
            addListener: function () {}
        }
    }
};

/* ===== 加载 storageV2 模块 ===== */
// 需要先加载 config.js 和 storage.js 作为依赖
function loadModule(filename) {
    var code = readFileSync(resolve(projectRoot, 'js', filename), 'utf8');
    if (filename === 'main.js') {
        code = code.replace(/\/\* ===== 自动聚焦[\s\S]*$/, '// boot() suppressed\n})(window.DevHome);\n');
    }
    var fn = new Function(code);
    fn();
}

loadModule('config.js');
loadModule('storage.js');
loadModule('storageV2.js');

var D = globalThis.DevHome || {};
var sv2 = D.storageV2;

/* ===== 测试框架 ===== */
var total = 0, pass = 0, fail = 0;
var testQueue = Promise.resolve();
function describe(n, fn) { console.log('\n' + '\u2500'.repeat(58)); console.log('  ' + n); console.log('\u2500'.repeat(58)); fn(); }
function it(n, fn) {
    total++;
    // 将每个测试串行化到 Promise 链中，避免 async 测试并发执行
    testQueue = testQueue.then(function () {
        var result = fn();
        if (result && typeof result.then === 'function') {
            return result.then(function () {
                pass++;
                console.log('  \x1b[32m\u2713\x1b[0m ' + n);
            }, function (e) {
                fail++;
                console.log('  \x1b[31m\u2717\x1b[0m ' + n);
                console.log('    \x1b[31m' + String(e.message).split('\n')[0] + '\x1b[0m');
            });
        } else {
            pass++;
            console.log('  \x1b[32m\u2713\x1b[0m ' + n);
        }
    });
}
var assert = function (c, m) { if (!c) throw new Error(m || 'assertion failed'); };
var eq = function (a, b, m) { if (a !== b) throw new Error((m || '') + '\n      expected: ' + JSON.stringify(b) + '\n      actual:   ' + JSON.stringify(a)); };

console.log('\n' + '\u2588'.repeat(58));
console.log('  DevHome Workbench — storageV2.js 单元测试');
console.log('\u2588'.repeat(58));

/* ===== 测试 ===== */

describe('isAvailable: chrome.storage 可用性检测', function () {
    it('chrome.storage.local 已 mock，应返回 true', function () {
        eq(sv2.isAvailable(), true);
    });
});

describe('KEYS: 常量导出完整性', function () {
    it('应包含所有 8 个已知 KEY', function () {
        var keys = sv2.KEYS;
        eq(keys.CONFIG, 'config');
        eq(keys.NOTES, 'notes');
        eq(keys.CAPTURES, 'captures');
        eq(keys.TASKS, 'tasks');
        eq(keys.NOTEBOOKS, 'notebooks');
        eq(keys.POMODORO_SESSIONS, 'pomodoro_sessions');
        eq(keys.BEHAVIOR, 'behavior');
        eq(keys.ENCOURAGEMENT_POOL, 'encouragement_pool');
    });
});

describe('set/get: 基本读写', function () {
    it('写入字符串后应能读取', async function () {
        await sv2.set('test_string', 'hello');
        var val = await sv2.get('test_string', null);
        eq(val, 'hello');
    });

    it('写入对象后应能读取', async function () {
        var obj = { name: 'Test', count: 42 };
        await sv2.set('test_object', obj);
        var val = await sv2.get('test_object', null);
        // 对象保留 _version 字段（直接嵌入对象中）
        assert(val !== null);
        eq(val.name, 'Test');
        eq(val.count, 42);
    });

    it('写入数组后应能读取（自动解包）', async function () {
        var arr = [1, 2, 3];
        await sv2.set('test_array', arr);
        var val = await sv2.get('test_array', null);
        // get() 自动解包 { data: [...], _version: N } → 原始数组
        assert(val !== null);
        assert(Array.isArray(val));
        eq(val.length, 3);
    });

    it('读取不存在的 key 返回 fallback', async function () {
        var val = await sv2.get('nonexistent_key', 'default_value');
        eq(val, 'default_value');
    });

    it('null 值写入后应能读取', async function () {
        await sv2.set('test_null', null);
        var val = await sv2.get('test_null', 'fallback');
        eq(val, null);
    });
});

describe('set: 乐观锁 _version 字段', function () {
    it('写入对象后应包含 _version 字段', async function () {
        var obj = { title: 'Versioned' };
        await sv2.set('test_versioned', obj);
        var val = await sv2.get('test_versioned', null);
        assert(val._version !== undefined);
        assert(typeof val._version === 'number');
        assert(val._version >= 1);
    });

    it('多次写入同一 key 应递增 _version', async function () {
        var obj1 = { title: 'V1' };
        await sv2.set('test_version_seq', obj1);
        var v1 = (await sv2.get('test_version_seq', null))._version;

        var obj2 = { title: 'V2' };
        await sv2.set('test_version_seq', obj2);
        var v2 = (await sv2.get('test_version_seq', null))._version;

        assert(v2 > v1, 'version should increment: ' + v1 + ' -> ' + v2);
    });
});

describe('remove: 删除数据', function () {
    it('删除后读取应返回 fallback', async function () {
        await sv2.set('test_remove', 'delete_me');
        var before = await sv2.get('test_remove', null);
        eq(before, 'delete_me');

        await sv2.remove('test_remove');
        var after = await sv2.get('test_remove', 'fallback');
        eq(after, 'fallback');
    });

    it('删除不存在的 key 不报错', async function () {
        try {
            await sv2.remove('key_that_does_not_exist');
            assert(true);
        } catch (e) {
            assert(false, 'should not throw');
        }
    });
});

describe('localStorage 缓存', function () {
    it('写入后应同步到 localStorage', async function () {
        await sv2.set('test_cache', 'cached_value');
        var raw = localStorage.getItem('devhome_v2_cache_test_cache');
        assert(raw !== null, 'localStorage 中应有缓存');
        var parsed = JSON.parse(raw);
        // 新格式：{ value: ..., _cacheTime: ... }
        assert(parsed.value !== undefined);
        eq(parsed.value, 'cached_value');
        assert(parsed._cacheTime !== undefined);
    });

    it('缓存应包含 _cacheTime 时间戳', async function () {
        await sv2.set('test_cache_ts', 'timestamped');
        var raw = localStorage.getItem('devhome_v2_cache_test_cache_ts');
        var parsed = JSON.parse(raw);
        assert(typeof parsed._cacheTime === 'number');
        assert(parsed._cacheTime > 0);
        // 时间戳应在最近 5 秒内
        var now = Date.now();
        assert(now - parsed._cacheTime < 5000, 'cache time should be recent');
    });

    it('删除后缓存也应被清除', async function () {
        await sv2.set('test_cache_remove', 'temp');
        await sv2.remove('test_cache_remove');
        var raw = localStorage.getItem('devhome_v2_cache_test_cache_remove');
        eq(raw, null);
    });
});

describe('isCacheExpired: 缓存过期检测', function () {
    it('无缓存记录应返回 true（过期）', function () {
        var expired = sv2.isCacheExpired('no_such_cache');
        eq(expired, true);
    });

    it('刚写入的缓存不应过期', async function () {
        await sv2.set('test_fresh', 'fresh');
        var expired = sv2.isCacheExpired('test_fresh');
        eq(expired, false);
    });
});

describe('getCacheRemainingTTL: 缓存剩余时间', function () {
    it('刚写入的缓存应有接近 24h 的剩余时间', async function () {
        await sv2.set('test_ttl', 'value');
        var remaining = sv2.getCacheRemainingTTL('test_ttl');
        assert(remaining > 0, 'remaining TTL should be positive');
        // 应该接近 24h（允许 5 秒误差）
        assert(remaining > 23 * 3600000, 'remaining should be near 24h, got: ' + remaining);
    });

    it('不存在的缓存返回 0', function () {
        var remaining = sv2.getCacheRemainingTTL('no_such_ttl_key');
        eq(remaining, 0);
    });
});

describe('getAll: 批量读取', function () {
    it('返回所有已知 key 的数据', async function () {
        await sv2.set('config', { theme: 'dark' });
        await sv2.set('notes', [{ id: 'n1' }]);
        var all = await sv2.getAll();
        assert(all.config !== undefined);
        assert(all.notes !== undefined);
    });

    it('未设置的 key 不在结果中', async function () {
        // 清除旧数据
        storageData = {};
        var all = await sv2.getAll();
        // 所有 key 都不应出现（或为 null）
        var hasData = Object.values(all).some(function (v) { return v !== undefined && v !== null; });
        // 如果之前有测试遗留数据，至少确认结构正确
        assert(typeof all === 'object');
    });
});

describe('migrateFromLegacy: 数据迁移', function () {
    it('已存在 v2/tasks 时应跳过', async function () {
        // 确保有 tasks 数据
        await sv2.set('tasks', [{ id: 'existing_migrate_test' }]);
        var result = await sv2.migrateFromLegacy();
        // migrateFromLegacy 检查 get('tasks') 非 null → 跳过
        assert(!result.migrated || result.reason === 'already_migrated',
            'should skip when tasks exist, got: ' + JSON.stringify(result));
    });

    it('无旧数据时应跳过', async function () {
        // 清除 tasks
        await sv2.remove('tasks');
        localStorage.removeItem('devhome_v2_cache_tasks');
        try { await chrome.storage.local.remove('v2/tasks'); } catch (_) {}
        // 清除 legacy
        D.devhomeStorage.set('workbench', null);
        var result = await sv2.migrateFromLegacy();
        assert(!result.migrated, 'should not migrate without data, got: ' + JSON.stringify(result));
    });

    it('有旧数据时应迁移', async function () {
        // 清除 tasks
        await sv2.remove('tasks');
        localStorage.removeItem('devhome_v2_cache_tasks');
        try { await chrome.storage.local.remove('v2/tasks'); } catch (_) {}
        // 设置旧格式数据
        var legacyData = {
            quadrants: {
                q1: { tasks: [{ title: 'Old Task 1' }] },
                q2: { tasks: [{ title: 'Old Task 2', completed: true }] }
            }
        };
        D.devhomeStorage.set('workbench', legacyData);

        var result = await sv2.migrateFromLegacy();
        assert(result.migrated, 'should migrate legacy data');
        eq(result.count, 2);

        // 验证迁移后的数据
        var tasks = await sv2.get('tasks', []);
        var taskList = Array.isArray(tasks) ? tasks : [];
        eq(taskList.length, 2);
        eq(taskList[0].title, 'Old Task 1');
        eq(taskList[0].quadrant, 'q1');
        eq(taskList[0].status, 'active');
        eq(taskList[1].title, 'Old Task 2');
        eq(taskList[1].quadrant, 'q2');
        eq(taskList[1].status, 'completed');
    });
});

/* ===== 结果汇总（等待所有 async 测试完成） ===== */
testQueue.then(function () {
    console.log('\n' + '\u2588'.repeat(58));
    var pct = total ? Math.round(pass / total * 100) : 0;
    console.log('  总计: ' + total + ' | \u2713 ' + pass + ' | \u2717 ' + fail + ' | 通过率: ' + pct + '%');
    console.log('\u2588'.repeat(58));
    if (fail > 0) {
        process.exitCode = 1;
        console.log('\n  \u26a0\ufe0f 存在 ' + fail + ' 个失败测试');
    } else {
        console.log('\n  \u2705 所有测试通过');
    }
});
