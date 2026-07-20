/**
 * DevHome Workbench - 高分辨率 Favicon 获取与缓存 v2
 *
 * 核心改进（v2.26.0）：
 *   1. 高分辨率源：使用 Google S2 服务请求 128px 图标，覆盖 2x/3x Retina 显示
 *   2. 多级回退策略：128px → 64px → DuckDuckGo → 纯色字母方块
 *   3. IndexedDB LRU 缓存（上限 200），避免重复网络请求
 *   4. 并发控制：同一域名并发请求合并为单个 Promise
 *
 * 原方案问题：
 *   api.xinac.net/icon 返回 16×16 或 32×32 的默认 favicon，
 *   在 56px CSS 像素（2x=112px, 3x=168px device pixels）磁贴中严重模糊。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const FAVICON_LRU_MAX = 200;
    let faviconDB = null;

    // 并发请求去重：同一域名的进行中请求合并
    const _pendingFetches = {};

    /* ================================================================
     * IndexedDB 缓存管理
     * ================================================================ */

    /**
     * 打开/创建 IndexedDB 数据库
     * 存储结构：{ domain (主键), dataUrl: base64 图片, lastAccess: 时间戳 }
     */
    ns.openFaviconDB = function () {
        return new Promise(function (resolve, reject) {
            const req = indexedDB.open('TabPageFaviconDB', 2);
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
    };

    /** 从 IndexedDB 读取缓存的 favicon data URL */
    ns.getFaviconFromDB = function (domain) {
        return new Promise(function (resolve) {
            if (!faviconDB) return resolve(null);
            try {
                const tx = faviconDB.transaction('favicons', 'readwrite');
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
    };

    /** 将 favicon data URL 存入 IndexedDB，并触发 LRU 淘汰 */
    ns.setFaviconInDB = function (domain, dataUrl) {
        if (!faviconDB) return;
        try {
            const tx = faviconDB.transaction('favicons', 'readwrite');
            const store = tx.objectStore('favicons');
            store.put({ domain: domain, dataUrl: dataUrl, lastAccess: Date.now() });
            tx.oncomplete = function () {
                // LRU 淘汰：超过上限时删除最旧的条目
                const countReq = faviconDB.transaction('favicons', 'readonly')
                    .objectStore('favicons').count();
                countReq.onsuccess = function () {
                    if (countReq.result > FAVICON_LRU_MAX) {
                        const delTx = faviconDB.transaction('favicons', 'readwrite');
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
    };

    /* ================================================================
     * 纯色字母回退（favicon 获取完全失败时使用）
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
     * 创建纯色字母方块作为兜底图标
     * 显示域名首字母在彩色圆角方块上，视觉统一且美观
     */
    function createColorFallback(domain, iconWrap) {
        const div = document.createElement('div');
        div.className = 'tile-icon-fallback';
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
        iconWrap.innerHTML = '';
        iconWrap.appendChild(div);
        console.log('[图标] 使用字母回退 域名=' + domain);
    }

    /* ================================================================
     * 主入口：加载并显示 favicon
     * ================================================================ */

    /**
     * 加载磁贴 favicon
     *
     * 加载流程（v2.26.1 修复国内网络兼容）：
     *   A. 从 IndexedDB 缓存读取 → 命中则立即显示高清 dataURL
     *   B. 无缓存时，用 img.src 多级回退加载（不受 CORS 限制）：
     *      Google S2 128px → Google S2 64px → DuckDuckGo → api.xinac.net → 字母方块
     *   C. 后台用 fetch 尝试下载并缓存（失败静默，不影响显示）
     *
     * @param {string} url - 磁贴目标 URL（用于提取域名）
     * @param {HTMLImageElement} imgElement - 要设置的 <img> 元素
     * @param {HTMLElement} iconWrap - 图标容器（错误时用于创建 fallback）
     */
    ns.loadFavicon = function (url, imgElement, iconWrap) {
        let domain;
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            createColorFallback('?', iconWrap);
            return;
        }

        // 多级 favicon URL 回退链（按优先级排列，img.src 直接使用不受 CORS 限制）
        const faviconSources = [
            { url: 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128' },
            { url: 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64' },
            { url: 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(domain) + '.ico' },
            { url: 'https://api.xinac.net/icon/?url=' + encodeURIComponent(domain) }
        ];

        // 回退索引（追踪当前使用的源）
        let sourceIndex = -1;

        /**
         * 尝试下一级回退源
         * 所有源都失败时显示字母方块
         */
        function tryNextSource() {
            sourceIndex++;
            if (sourceIndex < faviconSources.length) {
                // 清除旧的 onerror 标记，允许新源触发错误处理
                imgElement.dataset.faviconFallback = '';
                imgElement.src = faviconSources[sourceIndex].url;
            } else {
                // 全部源加载失败 → 字母方块兜底
                imgElement.src = '';
                createColorFallback(domain, iconWrap);
                console.warn('[图标] 全部源失败，使用字母回退 域名=' + domain);
            }
        }

        // Step A: 优先从 IndexedDB 缓存加载（无网络依赖，一进页面就显示）
        ns.getFaviconFromDB(domain).then(function (cached) {
            if (cached && typeof cached === 'string' && cached.startsWith('data:image')) {
                // 缓存命中 → 直接显示高清版，不再走网络回退链
                imgElement.src = cached;
                imgElement.dataset.faviconCached = '1';
                imgElement.dataset.faviconDone = '1';
                console.log('[图标] 缓存命中 域名=' + domain);
            } else {
                // 无缓存 → 启动 img.src 多级回退链
                tryNextSource();
            }
        });

        // Step B: img 加载失败 → 自动切换下一级源
        imgElement.onerror = function () {
            if (imgElement.dataset.faviconFallback === '1') return; // 已在处理中
            imgElement.dataset.faviconFallback = '1';
            tryNextSource();
        };

        // Step C: img 加载成功 → 后台尝试缓存高清版（仅 Google S2 成功时才有意义）
        imgElement.onload = function () {
            // 缓存命中的跳过（dataURL 已经在 DB 中）
            if (imgElement.dataset.faviconCached === '1') return;
            // 标记为已完成，防止重复
            imgElement.dataset.faviconDone = '1';

            const currentSrc = imgElement.currentSrc || imgElement.src;
            // 仅对 Google S2 的 128px 结果尝试缓存（api.xinac.net 返回尺寸不可控）
            if (currentSrc.indexOf('google.com/s2/favicons') !== -1 && currentSrc.indexOf('sz=128') !== -1) {
                _cacheFaviconFromSrc(domain, currentSrc);
            }
        };

        // 兜底：如果在回调绑定之前就已经失败/成功（极端情况）
        if (imgElement.complete) {
            if (imgElement.naturalWidth > 0) {
                imgElement.onload && imgElement.onload();
            } else if (!imgElement.dataset.faviconCached) {
                imgElement.onerror && imgElement.onerror();
            }
        }
    };

    /**
     * 后台将当前显示的 favicon URL 下载并缓存到 IndexedDB
     * 对于 Google 服务的 URL，使用代理管理器检测连通性后再请求
     * 使用 fetch + AbortController 5 秒超时，失败不影响显示
     * @param {string} domain - 域名
     * @param {string} url - favicon 图片 URL
     */
    function _cacheFaviconFromSrc(domain, url) {
        // 并发去重
        if (_pendingFetches[domain]) return;
        _pendingFetches[domain] = true;

        /**
         * 执行实际的 fetch + 缓存
         */
        function doFetch() {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () { controller.abort(); }, 5000);

            fetch(url, { signal: controller.signal })
                .then(function (response) {
                    clearTimeout(timeoutId);
                    if (!response.ok) { delete _pendingFetches[domain]; return null; }
                    return response.blob();
                })
                .then(function (blob) {
                    if (!blob || !blob.type.startsWith('image/')) {
                        delete _pendingFetches[domain];
                        return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = function () {
                        ns.setFaviconInDB(domain, reader.result);
                        delete _pendingFetches[domain];
                        console.log('[图标] 已缓存高清图标 域名=' + domain);
                    };
                    reader.onerror = function () { delete _pendingFetches[domain]; };
                    reader.readAsDataURL(blob);
                })
                .catch(function () {
                    clearTimeout(timeoutId);
                    delete _pendingFetches[domain];
                    // 静默失败：fetch 缓存失败不影响 img.src 已经显示的图标
                });
        }

        // Google 服务 → 检查代理连通性后决定是否发起 fetch
        const isGoogleUrl = url.indexOf('google.com') !== -1;
        if (isGoogleUrl && ns.proxyManager) {
            // 使用代理管理器判断 Google 是否可达
            if (ns.proxyManager.isGoogleReachable()) {
                doFetch();
            } else {
                // Google 不可达 → 跳过缓存请求，避免无谓超时
                delete _pendingFetches[domain];
                console.log('[图标] 跳过缓存（Google 不可达）域名=' + domain);
            }
        } else {
            // 非 Google 服务 → 直接 fetch
            doFetch();
        }
    }

})(window.DevHome);
