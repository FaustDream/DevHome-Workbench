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
     * @param {Function} [onResult] - 可选回调，加载结束（成功或失败）时调用，
     *        签名 onResult(success: boolean, info: {reason?: string, source?: string})
     */
    ns.loadFavicon = function (url, imgElement, iconWrap, onResult) {
        // 结果回调只触发一次，避免多级回退 / 缓存命中重复上报
        let resultReported = false;
        function reportResult(success, info) {
            if (resultReported || typeof onResult !== 'function') return;
            resultReported = true;
            onResult(success, info || {});
        }

        // 根据最终图片源 URL 推断来源标签，用于成功提示
        function sourceLabel(src) {
            if (src.indexOf('sz=128') !== -1) return 'Google 128px';
            if (src.indexOf('google.com/s2/favicons') !== -1) return 'Google';
            if (src.indexOf('duckduckgo') !== -1) return 'DuckDuckGo';
            if (src.indexOf('xinac') !== -1) return 'xinac';
            return '缓存';
        }

        let domain;
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            // 网址无法解析 → 直接失败并给出原因
            reportResult(false, { reason: '网址无法解析' });
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
         * 尝试下一级回退源（严格按优先级顺序）
         * 索引每 +1 代表尝试更低优先级的图标源；全部源都失败时显示字母方块兜底
         */
        function tryNextSource() {
            sourceIndex++;
            if (sourceIndex < faviconSources.length) {
                // 清除旧的 onerror 标记，允许新源触发错误处理
                imgElement.dataset.faviconFallback = '';
                imgElement.src = faviconSources[sourceIndex].url;
                console.log('[降级] 尝试图标源 ' + (sourceIndex + 1) + '/' + faviconSources.length +
                    ' 域名=' + domain + ' 地址=' + faviconSources[sourceIndex].url);
            } else {
                // 全部源加载失败 → 字母方块兜底（最终兜底方案），并上报失败及原因
                imgElement.src = '';
                createColorFallback(domain, iconWrap);
                console.warn('[降级] 所有图标源均失败，启用最终兜底字母图标 域名=' + domain);
                reportResult(false, { reason: '所有图标源均无法访问（网络受限或域名无图标）' });
            }
        }

        // Step A: 优先从 IndexedDB 缓存加载（无网络依赖，一进页面就显示）
        // 这是回退链的唯一启动入口：命中缓存则直接用，未命中/异常则启动网络回退链。
        // 注意：本函数内 img 的 src 始终在回调/事件处理器绑定之后才赋值，
        // 因此不存在"处理器绑定前已加载/失败"的竞态，无需额外 complete 兜底。
        ns.getFaviconFromDB(domain).then(function (cached) {
            if (cached && typeof cached === 'string' && cached.startsWith('data:image')) {
                // 缓存命中 → 直接显示高清版，不再走网络回退链
                imgElement.src = cached;
                imgElement.dataset.faviconCached = '1';
                imgElement.dataset.faviconDone = '1';
                console.log('[降级] 命中本地缓存，直接使用 域名=' + domain);
                // 命中本地缓存即视为成功获取
                reportResult(true, { source: '缓存' });
            } else {
                // 无缓存 → 启动 img.src 多级回退链（严格顺序降级）
                console.log('[降级] 无本地缓存，启动图标源回退链 域名=' + domain);
                tryNextSource();
            }
        }).catch(function (err) {
            // 缓存读取异常（如 IndexedDB 不可用）→ 不阻塞，直接降级到网络源
            console.warn('[降级] 读取缓存失败，降级到网络源 域名=' + domain +
                ' 原因=' + (err && err.message ? err.message : err));
            tryNextSource();
        });

        // Step B: img 加载失败 → 自动切换下一级（更低优先级）源
        imgElement.onerror = function () {
            if (imgElement.dataset.faviconFallback === '1') return; // 已在处理中，防止单事件重复触发
            imgElement.dataset.faviconFallback = '1';
            console.log('[降级] 当前图标源加载失败，准备降级 域名=' + domain +
                ' 当前已尝试序号=' + (sourceIndex + 1));
            tryNextSource();
        };

        // Step C: img 加载成功 → 上报成功并尝试后台缓存高清版（仅 Google S2 成功时才有意义）
        imgElement.onload = function () {
            // 缓存命中的跳过（dataURL 已经在 DB 中，且命中时已上报成功）
            if (imgElement.dataset.faviconCached === '1') return;
            // 标记为已完成，防止重复
            imgElement.dataset.faviconDone = '1';

            const currentSrc = imgElement.currentSrc || imgElement.src;
            // 从真实图标源加载成功 → 上报成功（中断回退链）
            console.log('[降级] 图标源加载成功，终止回退 域名=' + domain + ' 源=' + sourceLabel(currentSrc));
            reportResult(true, { source: sourceLabel(currentSrc) });

            // 仅对 Google S2 的 128px 结果尝试缓存（api.xinac.net 返回尺寸不可控）
            if (currentSrc.indexOf('google.com/s2/favicons') !== -1 && currentSrc.indexOf('sz=128') !== -1) {
                _cacheFaviconFromSrc(domain, currentSrc);
            }
        };
    };

    /**
     * 后台将当前显示的 favicon 下载并缓存到 IndexedDB
     *
     * 关键约束：favicon 来自 Google S2 / gstatic 等跨域服务，扩展**页面**直接
     * fetch 会被 CORS 拦截（响应缺少 Access-Control-Allow-Origin，控制台报
     * "blocked by CORS policy"）。但扩展的 Service Worker 对 host_permissions
     * 覆盖的域名发起的 fetch 可豁免 CORS。
     *
     * 因此本函数不再在页面直接 fetch，而是：
     *   1. 通过 chrome.runtime.sendMessage 把请求交给后台 SW 代理
     *   2. SW 代理 fetch 并把图片转成 dataURL 回传
     *   3. 页面把合法 dataURL 写入 IndexedDB，加速后续加载
     *
     * 注意：Step B（img.src 多级回退）展示完全不受影响，本步仅用于缓存加速。
     * @param {string} domain - 域名
     * @param {string} url - favicon 图片 URL
     */
    function _cacheFaviconFromSrc(domain, url) {
        // 并发去重：同一域名的缓存请求合并为单个，避免重复写库
        if (_pendingFetches[domain]) return;
        _pendingFetches[domain] = true;

        // 收尾：无论成功/失败都释放去重标记，避免该域名被永久跳过
        function finish() { delete _pendingFetches[domain]; }

        try {
            // 交给后台 SW 代理：规避页面级 CORS，由 SW 的 host_permissions 豁免
            chrome.runtime.sendMessage({ type: 'FETCH_FAVICON', url: url }, function (resp) {
                if (chrome.runtime.lastError) {
                    // 后台未就绪或通信异常 → 静默放弃缓存（不影响已显示的图标）
                    console.warn('[图标] 后台代理 favicon 请求失败 域名=' + domain +
                        ' 原因=' + chrome.runtime.lastError.message);
                    finish();
                    return;
                }
                // 回传必须是合法的图片 dataURL 才写入缓存
                if (!resp || !resp.success || typeof resp.dataUrl !== 'string' ||
                    resp.dataUrl.indexOf('data:image') !== 0) {
                    finish();
                    return;
                }
                ns.setFaviconInDB(domain, resp.dataUrl);
                console.log('[图标] 已缓存高清图标 域名=' + domain);
                finish();
            });
        } catch (e) {
            // 极端情况下 message 端口不可用 → 直接放弃，不阻塞主流程
            finish();
        }
    }

})(window.DevHome);
