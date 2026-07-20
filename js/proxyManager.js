/**
 * DevHome Workbench - 代理管理模块
 *
 * 职责：
 *   1. 自动检测系统代理状态（通过 chrome.proxy API）
 *   2. 测试 Google 连通性，判断是否可通过系统代理访问 Google 服务
 *   3. 支持手动指定代理地址和端口（覆盖系统代理）
 *   4. 实时监听系统代理变更（chrome.proxy.settings.onChange）
 *   5. 为所有 Google 相关请求提供代理感知的 fetch 封装
 *
 * 使用方式：
 *   ns.proxyManager.init()       → 初始化，自动检测代理
 *   ns.proxyManager.getConfig()  → 获取当前代理配置
 *   ns.proxyManager.isGoogleReachable() → 检查 Google 是否可达
 *   ns.proxyManager.on('change', fn)    → 监听代理状态变更
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const STORAGE_KEY = 'devhome_proxy_config';
    const GOOGLE_TEST_URL = 'https://www.google.com/s2/favicons?domain=google.com&sz=16';
    const DETECT_TIMEOUT = 4000;       // 连通性检测超时（毫秒）
    const POLL_INTERVAL = 30000;       // 后台轮询间隔（毫秒）
    const CACHE_TTL = 60000;           // 检测结果缓存有效期（毫秒）

    /* ================================================================
     * 内部状态
     * ================================================================ */

    /** 默认代理配置 */
    const DEFAULT_CONFIG = {
        enabled: false,          // 是否启用代理感知
        mode: 'auto',           // 'auto' | 'manual'
        host: '127.0.0.1',      // 手动代理主机
        port: 7890,             // 手动代理端口
        systemProxyDetected: false,  // 系统代理是否检测到
        googleReachable: false,      // Google 是否可达
        lastChecked: 0           // 上次检测时间戳
    };

    let _config = null;           // 当前运行时配置
    let _listeners = {};         // 事件监听器

    /* ================================================================
     * 事件系统（轻量发布/订阅）
     * ================================================================ */

    function emit(event, data) {
        const fns = _listeners[event] || [];
        fns.forEach(function (fn) {
            try { fn(data); } catch (e) {
                console.warn('[代理] 事件监听器异常 ' + event, e.message);
            }
        });
    }

    /* ================================================================
     * 配置读写
     * ================================================================ */

    /** 从 localStorage 加载代理配置 */
    function loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return Object.assign({}, DEFAULT_CONFIG, parsed);
            }
        } catch (_) {}
        return Object.assign({}, DEFAULT_CONFIG);
    }

    /** 持久化代理配置到 localStorage */
    function saveConfig(config) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (_) {}
    }

    /* ================================================================
     * 系统代理检测
     * ================================================================ */

    /**
     * 通过 chrome.proxy API 获取系统代理模式
     * @returns {Promise<{mode: string, servers: string|null}>}
     */
    function detectSystemProxyMode() {
        return new Promise(function (resolve) {
            // chrome.proxy API 可用性检查
            if (typeof chrome === 'undefined' || !chrome.proxy || !chrome.proxy.settings) {
                resolve({ mode: 'unavailable', servers: null });
                return;
            }
            try {
                chrome.proxy.settings.get({}, function (details) {
                    if (chrome.runtime.lastError) {
                        console.warn('[代理] 读取系统代理设置失败:', chrome.runtime.lastError.message);
                        resolve({ mode: 'unavailable', servers: null });
                        return;
                    }
                    const mode = details.levelOfControl === 'not_controllable'
                        ? 'system' : (details.value ? details.value.mode : 'unknown');
                    let servers = null;
                    if (details.value && details.value.rules && details.value.rules.singleProxy) {
                        const sp = details.value.rules.singleProxy;
                        servers = sp.host + ':' + sp.port;
                    }
                    resolve({ mode: mode, servers: servers });
                });
            } catch (e) {
                resolve({ mode: 'unavailable', servers: null });
            }
        });
    }

    /**
     * 测试 Google 连通性
     * 使用 fetch + AbortController 超时控制
     * @returns {Promise<boolean>}
     */
    function testGoogleConnectivity() {
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, DETECT_TIMEOUT);

        return fetch(GOOGLE_TEST_URL, {
            signal: controller.signal,
            cache: 'no-store',
            // mode: 'no-cors' 会导致无法读取 response.ok，所以用默认 cors
            headers: { 'Accept': 'image/*' }
        })
        .then(function (response) {
            clearTimeout(timeoutId);
            return response.ok;
        })
        .catch(function () {
            clearTimeout(timeoutId);
            return false;
        });
    }

    /**
     * 完整代理检测流程
     * 1. 读取系统代理模式
     * 2. 测试 Google 连通性
     * 3. 更新配置并通知监听器
     */
    async function runDetection() {
        console.log('[代理] 开始检测...');
        const proxyMode = await detectSystemProxyMode();
        const systemProxyDetected = proxyMode.mode !== 'direct' && proxyMode.mode !== 'unavailable';
        let googleReachable = false;

        if (systemProxyDetected || _config.mode === 'manual') {
            // 有系统代理或手动配置 → 测试 Google 连通性
            googleReachable = await testGoogleConnectivity();
        }

        const prevGoogleReachable = _config.googleReachable;
        _config.systemProxyDetected = systemProxyDetected;
        _config.googleReachable = googleReachable;
        _config.lastChecked = Date.now();
        saveConfig(_config);

        console.log('[代理] 检测完成 系统代理=' + systemProxyDetected +
            ' Google可达=' + googleReachable +
            ' 模式=' + proxyMode.mode +
            (proxyMode.servers ? ' 服务器=' + proxyMode.servers : ''));

        // Google 连通性变化时通知监听器
        if (googleReachable !== prevGoogleReachable) {
            emit('googleReachabilityChanged', {
                reachable: googleReachable,
                proxyMode: proxyMode.mode,
                servers: proxyMode.servers
            });
        }

        return _config;
    }

    /* ================================================================
     * 系统代理变更监听
     * ================================================================ */

    function startProxyChangeListener() {
        if (typeof chrome === 'undefined' || !chrome.proxy || !chrome.proxy.settings) {
            console.log('[代理] chrome.proxy API 不可用，使用轮询模式');
            // 回退到轮询
            setInterval(function () {
                runDetection().catch(function () {});
            }, POLL_INTERVAL);
            return;
        }

        try {
            // 监听系统代理设置变更
            chrome.proxy.settings.onChange.addListener(function (details) {
                console.log('[代理] 系统代理设置已变更 mode=' +
                    (details.value ? details.value.mode : 'unknown'));
                // 延迟 500ms 再检测，等代理完全生效
                setTimeout(function () {
                    runDetection().catch(function () {});
                }, 500);
            });

            // 同时使用轮询作为兜底（解决某些平台 onChange 不触发的问题）
            setInterval(function () {
                if (Date.now() - _config.lastChecked > POLL_INTERVAL) {
                    runDetection().catch(function () {});
                }
            }, POLL_INTERVAL);

        } catch (e) {
            console.warn('[代理] 注册代理变更监听失败，回退到轮询', e.message);
            setInterval(function () {
                runDetection().catch(function () {});
            }, POLL_INTERVAL);
        }
    }

    /* ================================================================
     * 公共 API
     * ================================================================ */

    ns.proxyManager = {
        /**
         * 初始化代理管理模块
         * 加载配置 → 首次检测 → 启动变更监听
         */
        init: async function () {
            _config = loadConfig();
            console.log('[代理] 初始化 mode=' + _config.mode +
                ' enabled=' + _config.enabled +
                ' host=' + _config.host + ':' + _config.port);

            // 首次检测（异步，不阻塞启动）
            runDetection().catch(function (e) {
                console.warn('[代理] 首次检测失败:', e.message);
            });

            // 启动系统代理变更监听
            startProxyChangeListener();
        },

        /**
         * 获取当前代理配置
         * @returns {{enabled, mode, host, port, systemProxyDetected, googleReachable, lastChecked}}
         */
        getConfig: function () {
            return Object.assign({}, _config);
        },

        /**
         * 更新代理配置
         * @param {Object} partialConfig - 部分配置（仅更新传入的字段）
         */
        updateConfig: function (partialConfig) {
            Object.assign(_config, partialConfig);
            saveConfig(_config);
            console.log('[代理] 配置已更新', partialConfig);

            // 如果启用了代理且模式变为手动，触发重新检测
            if (partialConfig.enabled !== undefined ||
                partialConfig.mode !== undefined ||
                partialConfig.host !== undefined ||
                partialConfig.port !== undefined) {
                // 立即进行一次 Google 连通性检测
                if (_config.enabled) {
                    setTimeout(function () {
                        runDetection().catch(function () {});
                    }, 300);
                }
            }

            emit('configChanged', _config);
        },

        /**
         * 检查 Google 是否可达（使用缓存结果）
         * @returns {boolean}
         */
        isGoogleReachable: function () {
            // 缓存未过期则直接返回
            if (Date.now() - _config.lastChecked < CACHE_TTL) {
                return _config.googleReachable;
            }
            // 缓存过期 → 异步刷新
            runDetection().catch(function () {});
            return _config.googleReachable;
        },

        /**
         * 主动刷新 Google 连通性检测
         * @returns {Promise<boolean>}
         */
        refreshGoogleReachability: async function () {
            await runDetection();
            return _config.googleReachable;
        },

        /**
         * 获取手动配置的代理地址（格式：host:port）
         * @returns {string|null} 代理地址，未配置返回 null
         */
        getManualProxyAddress: function () {
            if (_config.mode === 'manual' && _config.host && _config.port) {
                return _config.host + ':' + _config.port;
            }
            return null;
        },

        /**
         * 针对 Google 服务的智能 fetch 封装
         * 自动根据连通性决定是否发起请求
         * @param {string} url - 要请求的 URL
         * @param {Object} options - fetch options
         * @returns {Promise<Response|null>} 响应或 null（Google 不可达时）
         */
        fetchGoogle: async function (url, options) {
            // 如果缓存显示 Google 不可达且缓存未过期，直接返回 null
            if (!_config.enabled) return null;
            if (!_config.googleReachable &&
                Date.now() - _config.lastChecked < CACHE_TTL) {
                return null;
            }
            const fetchOptions = Object.assign({
                signal: (function () {
                    const ctrl = new AbortController();
                    setTimeout(function () { ctrl.abort(); }, DETECT_TIMEOUT);
                    return ctrl.signal;
                })(),
                cache: 'no-store'
            }, options || {});
            try {
                const resp = await fetch(url, fetchOptions);
                if (!resp.ok) return null;
                return resp;
            } catch (_) {
                // 标记为不可达
                _config.googleReachable = false;
                _config.lastChecked = Date.now();
                return null;
            }
        },

        /**
         * 注册事件监听
         * @param {string} event - 'change' | 'configChanged' | 'googleReachabilityChanged'
         * @param {function} fn - 回调函数
         */
        on: function (event, fn) {
            if (!_listeners[event]) _listeners[event] = [];
            _listeners[event].push(fn);
        },

        /**
         * 取消事件监听
         * @param {string} event
         * @param {function} fn
         */
        off: function (event, fn) {
            if (!_listeners[event]) return;
            _listeners[event] = _listeners[event].filter(function (l) { return l !== fn; });
        }
    };

})(window.DevHome);
