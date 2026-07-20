/**
 * DevHome Workbench - 高分辨率 Favicon 获取与缓存 v3
 *
 * 核心改进（v2.27.5）：
 *   1. 真实站点图标优先：通过后台 Service Worker 直接抓取目标站点自身的
 *      favicon（约定路径 /favicon.ico 或解析首页 <link rel="icon"> /
 *      <link rel="apple-touch-icon">），保证拿到站点真实图标，而非第三方
 *      服务的默认地球（即用户看到的"模糊的球"）。
 *   2. 绕过 CORS：SW 拥有 host_permissions（含 <all_urls>），对目标站点的
 *      fetch 可豁免 CORS，从而能读取首页 HTML 与图标字节。
 *   3. 字母兜底先行：网络请求期间先显示纯色字母方块占位，真实图标到达后
 *      无缝替换；彻底避免先闪一下默认地球的问题。
 *   4. IndexedDB LRU 缓存（上限 200），存储的是真实图标 dataURL；
 *      数据库版本升至 3，清空旧版本可能缓存的默认地球图标。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const FAVICON_LRU_MAX = 200;
    let faviconDB = null;
    // 数据库打开单例：首次需要时才打开，后续复用同一 Promise，
    // 避免「openFaviconDB 异步未完成时 loadFavicon 已执行」导致缓存链路形同虚设。
    let _dbOpenPromise = null;

    // 并发请求去重：同一域名的进行中请求合并为单个
    const _pendingFetches = {};

    /* ================================================================
     * IndexedDB 缓存管理
     * ================================================================ */

    /**
     * 打开/创建 IndexedDB 数据库（单例）
     * 存储结构：{ domain (主键), dataUrl: base64 图片, lastAccess: 时间戳 }
     * 版本升至 3：重建存储，清空旧版本可能缓存的默认地球图标（dataURL）。
     *
     * 返回缓存的 Promise 单例：多次调用只真正打开一次，
     * 因此 loadFavicon 在 openFaviconDB 未完成时也能通过 _ensureDB 复用同一实例。
     */
    ns.openFaviconDB = function () {
        if (_dbOpenPromise) return _dbOpenPromise;
        _dbOpenPromise = new Promise(function (resolve, reject) {
            const req = indexedDB.open('TabPageFaviconDB', 3);
            req.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('favicons')) {
                    const store = db.createObjectStore('favicons', { keyPath: 'domain' });
                    store.createIndex('lastAccess', 'lastAccess', { unique: false });
                }
            };
            req.onsuccess = function (e) { faviconDB = e.target.result; resolve(faviconDB); };
            req.onerror = function (e) { reject(e.target.error); };
        });
        return _dbOpenPromise;
    };

    /**
     * 惰性确保数据库已打开：首次调用时打开，之后复用已打开实例。
     * 这样无论 openFaviconDB 是否已被外部显式调用、以及调用时机如何，
     * get/set 都不会因 faviconDB 为 null 而静默失效，保证本地缓存真正可用。
     * @returns {Promise<IDBDatabase>}
     */
    function _ensureDB() {
        if (faviconDB) return Promise.resolve(faviconDB);
        return ns.openFaviconDB();
    }

    /** 从 IndexedDB 读取缓存的 favicon data URL */
    ns.getFaviconFromDB = function (domain) {
        return _ensureDB().then(function (db) {
            return new Promise(function (resolve) {
                if (!db) return resolve(null);
                try {
                    const tx = db.transaction('favicons', 'readwrite');
                    const store = tx.objectStore('favicons');
                    const getReq = store.get(domain);
                    getReq.onsuccess = function () {
                        if (getReq.result) {
                            // 更新最后访问时间（LRU 排序依据）
                            store.put({ domain: domain, dataUrl: getReq.result.dataUrl, lastAccess: Date.now() });
                            resolve(getReq.result.dataUrl);
                        } else {
                            resolve(null);
                        }
                    };
                    getReq.onerror = function () { resolve(null); };
                } catch (e) { resolve(null); }
            });
        }).catch(function () { return null; });
    };

    /** 将 favicon data URL 存入 IndexedDB，并触发 LRU 淘汰 */
    ns.setFaviconInDB = function (domain, dataUrl) {
        _ensureDB().then(function (db) {
            if (!db) return;
            try {
                const tx = db.transaction('favicons', 'readwrite');
                const store = tx.objectStore('favicons');
                store.put({ domain: domain, dataUrl: dataUrl, lastAccess: Date.now() });
                tx.oncomplete = function () {
                    // LRU 淘汰：超过上限时删除最旧的条目
                    const countReq = db.transaction('favicons', 'readonly')
                        .objectStore('favicons').count();
                    countReq.onsuccess = function () {
                        if (countReq.result > FAVICON_LRU_MAX) {
                            const delTx = db.transaction('favicons', 'readwrite');
                            const delStore = delTx.objectStore('favicons');
                            const idx = delStore.index('lastAccess');
                            const cursorReq = idx.openCursor();
                            let toDelete = countReq.result - FAVICON_LRU_MAX;
                            cursorReq.onsuccess = function (e) {
                                const cursor = e.target.result;
                                if (cursor && toDelete > 0) {
                                    cursor.delete();
                                    toDelete--;
                                    cursor.continue();
                                }
                            };
                        }
                    };
                };
            } catch (e) { /* 静默失败，不影响主要流程 */ }
        }).catch(function () { /* 数据库不可用时放弃缓存，不影响显示 */ });
    };

    /* ================================================================
     * 纯色字母回退（favicon 获取完全失败 / 网络请求期间占位时使用）
     * ================================================================ */

    /** 暖色系色板，确保白色文字可读 */
    function randomFaviconColor() {
        const palette = [
            '#c0692a', '#d94a3a', '#e67e22', '#f39c12', '#27ae60',
            '#2ecc71', '#1abc9c', '#2980b9', '#3498db', '#8e44ad',
            '#9b59b6', '#16a085', '#e74c3c', '#7f8c8d', '#2c3e50'
        ];
        return palette[Math.floor(Math.random() * palette.length)];
    }

    /**
     * 创建/复用纯色字母方块（最终兜底 & 加载占位）
     *
     * 关键调整（v2.27.5）：不再清空 iconWrap，而是保留 <img> 元素。
     * 加载期间隐藏 <img> 显示字母占位；真实图标到达后由 img.onload
     * 移除字母方块并显示 <img>，实现无缝替换；仅在失败时保持字母显示。
     * @param {string} domain - 域名
     * @param {HTMLElement} iconWrap - 图标容器
     * @param {HTMLImageElement} [imgElement] - 关联的 <img>，失败/占位时隐藏
     */
    function createColorFallback(domain, iconWrap, imgElement) {
        // 隐藏 <img>，避免加载期间露出破图图标
        if (imgElement) imgElement.style.display = 'none';
        // 复用已有字母方块，避免重复创建
        let div = iconWrap.querySelector('.tile-icon-fallback');
        if (!div) {
            div = document.createElement('div');
            div.className = 'tile-icon-fallback';
            iconWrap.appendChild(div);
        }
        div.style.width = 'var(--shortcut-icon, 32px)';
        div.style.height = 'var(--shortcut-icon, 32px)';
        div.style.borderRadius = '8px';
        div.style.background = randomFaviconColor();
        div.style.color = '#fff';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.fontSize = '14px';
        div.style.fontWeight = '700';
        div.style.fontFamily = 'var(--font-sans)';
        div.textContent = (domain.charAt(0) || '?').toUpperCase();
        console.log('[图标] 使用字母回退 域名=' + domain);
    }

    /** 移除字母占位方块（真实图标成功显示后调用） */
    function removeColorFallback(iconWrap) {
        const div = iconWrap.querySelector('.tile-icon-fallback');
        if (div) div.remove();
    }

    /* ================================================================
     * 主入口：加载并显示 favicon
     * ================================================================ */

    /**
     * 加载磁贴 favicon（v2.27.5 重构）
     *
     * 加载流程：
     *   A. 优先从 IndexedDB 缓存读取真实图标 dataURL → 命中则立即显示
     *   B. 无缓存时，先显示字母占位，再向后台 SW 请求目标站点真实 favicon
     *      （SW 抓取 /favicon.ico 或解析首页 <link rel="icon">/apple-touch-icon）
     *   C. SW 返回真实图标 → 替换显示并写入缓存；无真实图标 → 保持字母兜底
     *
     * 相比旧方案：不再使用 Google S2 / DuckDuckGo 等第三方服务作为展示源，
     * 因此不会出现第三方默认地球（"模糊的球"）被当成结果展示或缓存的问题。
     *
     * @param {string} url - 磁贴目标 URL（用于提取域名）
     * @param {HTMLImageElement} imgElement - 要设置的 <img> 元素
     * @param {HTMLElement} iconWrap - 图标容器（失败/占位时用于创建 fallback）
     * @param {Function} [onResult] - 可选回调，加载结束（成功或失败）时调用，
     *        签名 onResult(success: boolean, info: {reason?: string, source?: string})
     */
    ns.loadFavicon = function (url, imgElement, iconWrap, onResult) {
        // 结果回调只触发一次，避免重复上报
        let resultReported = false;
        function reportResult(success, info) {
            if (resultReported || typeof onResult !== 'function') return;
            resultReported = true;
            onResult(success, info || {});
        }

        let domain;
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            // 网址无法解析 → 直接失败并给出原因
            reportResult(false, { reason: '网址无法解析' });
            createColorFallback('?', iconWrap, imgElement);
            return;
        }

        // 真实图标 dataURL 加载失败 → 保持字母兜底（已是最终状态）
        imgElement.onerror = function () {
            imgElement.style.display = 'none';
        };
        // 真实图标加载成功 → 显示 <img> 并移除字母占位
        imgElement.onload = function () {
            imgElement.style.display = '';
            removeColorFallback(iconWrap);
        };

        // Step A：优先从 IndexedDB 缓存加载（无网络依赖，一进页面就显示）
        ns.getFaviconFromDB(domain).then(function (cached) {
            if (cached && typeof cached === 'string' && cached.startsWith('data:image')) {
                // 缓存命中 → 直接显示真实高清版，不显示字母占位，避免闪动
                imgElement.src = cached;
                imgElement.dataset.faviconCached = '1';
                imgElement.dataset.faviconDone = '1';
                console.log('[图标] 命中本地缓存，直接使用 域名=' + domain);
                reportResult(true, { source: '缓存' });
            } else {
                // 无缓存 → 先显示字母占位，再向后台 SW 请求目标站点真实 favicon
                createColorFallback(domain, iconWrap, imgElement);
                console.log('[图标] 无本地缓存，向 SW 请求真实 favicon 域名=' + domain);
                _requestRealFavicon(domain, imgElement, iconWrap, reportResult);
            }
        }).catch(function (err) {
            // 缓存读取异常（如 IndexedDB 不可用）→ 不阻塞，显示字母占位并降级到网络源
            console.warn('[图标] 读取缓存失败，降级到 SW 域名=' + domain +
                ' 原因=' + (err && err.message ? err.message : err));
            createColorFallback(domain, iconWrap, imgElement);
            _requestRealFavicon(domain, imgElement, iconWrap, reportResult);
        });
    };

    /**
     * 通过后台 Service Worker 解析并获取目标站点的真实 favicon
     *
     * 由 SW 代理的原因：扩展页面直接 fetch 任意站点会被 CORS 拦截（无法读取
     * 首页 HTML 与图标字节）；而 SW 拥有 <all_urls> host_permissions，其 fetch
     * 可豁免 CORS。SW 解析到真实图标后转成 dataURL 回传，页面写入 IndexedDB。
     *
     * @param {string} domain - 域名
     * @param {HTMLImageElement} imgElement - 显示用 <img>
     * @param {HTMLElement} iconWrap - 图标容器
     * @param {Function} report - 结果回调 (success, info)
     */
    function _requestRealFavicon(domain, imgElement, iconWrap, report) {
        // 并发去重：同一域名的缓存请求合并为单个
        if (_pendingFetches[domain]) return;
        _pendingFetches[domain] = true;

        // 收尾：无论成功失败都释放去重标记，避免该域名被永久跳过
        function finish() { delete _pendingFetches[domain]; }

        try {
            // 交给后台 SW 代理：抓取目标站点自身图标，规避页面级 CORS
            chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', domain: domain }, function (resp) {
                if (chrome.runtime.lastError) {
                    // 后台未就绪或通信异常 → 保留字母兜底（不影响主要流程）
                    console.warn('[图标] 后台解析 favicon 失败 域名=' + domain +
                        ' 原因=' + chrome.runtime.lastError.message);
                    finish();
                    report(false, { reason: '后台解析失败' });
                    return;
                }
                if (resp && resp.success && typeof resp.dataUrl === 'string' &&
                    resp.dataUrl.indexOf('data:image') === 0) {
                    // 回传的是合法图片 dataURL → 写入缓存并展示
                    imgElement.src = resp.dataUrl; // onload 会显示并移除字母占位
                    ns.setFaviconInDB(domain, resp.dataUrl);
                    console.log('[图标] 已获取并缓存真实 favicon 域名=' + domain);
                    finish();
                    report(true, { source: '真实站点图标' });
                } else {
                    // 站点无可用真实图标 → 保留字母兜底，不缓存
                    finish();
                    report(false, { reason: '站点无可用 favicon' });
                }
            });
        } catch (e) {
            // 极端情况下 message 端口不可用 → 直接放弃，不阻塞主流程
            finish();
            report(false, { reason: '请求异常' });
        }
    }

})(window.DevHome);
