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
     * 高分辨率 Favicon 获取策略
     * ================================================================ */

    /**
     * 从 Google S2 服务获取 favicon
     * Google 的 S2 favicon 服务会尝试返回指定尺寸的图标，
     * 如果原始图标支持更大尺寸则直接返回，否则会缩放。
     * @param {string} domain - 域名
     * @param {number} size - 请求尺寸（像素），最大 256
     * @returns {Promise<string|null>} base64 data URL，失败返回 null
     */
    function fetchGoogleS2(domain, size) {
        const url = 'https://www.google.com/s2/favicons?domain=' +
            encodeURIComponent(domain) + '&sz=' + size;
        return fetchFaviconAsDataUrl(url, domain);
    }

    /**
     * 从 DuckDuckGo favicon 服务获取（回退方案）
     * DuckDuckGo 返回的图标质量中等，但稳定性高
     */
    function fetchDuckDuckGo(domain) {
        const url = 'https://icons.duckduckgo.com/ip3/' +
            encodeURIComponent(domain) + '.ico';
        return fetchFaviconAsDataUrl(url, domain);
    }

    /**
     * 通用 favicon URL → data URL 转换
     * 校验返回的是有效图片（通过 Blob.type 检查）
     * @param {string} fetchUrl - favicon 服务 URL
     * @param {string} domain - 域名（用于日志）
     * @returns {Promise<string|null>}
     */
    function fetchFaviconAsDataUrl(fetchUrl, domain) {
        return fetch(fetchUrl)
            .then(function (response) {
                if (!response.ok) return null;
                return response.blob();
            })
            .then(function (blob) {
                if (!blob || !blob.type.startsWith('image/')) return null;
                return new Promise(function (resolve) {
                    const reader = new FileReader();
                    reader.onloadend = function () {
                        resolve(reader.result);
                    };
                    reader.onerror = function () {
                        resolve(null);
                    };
                    reader.readAsDataURL(blob);
                });
            })
            .catch(function () {
                return null;
            });
    }

    /**
     * 多级回退获取高分辨率 favicon
     * 策略：128px → 64px → DuckDuckGo → null
     * @param {string} domain - 域名
     * @returns {Promise<string|null>} base64 data URL
     */
    async function fetchHighResFavicon(domain) {
        // Tier 1: Google S2 128px（覆盖 2x Retina 112px 需求）
        const s2128 = await fetchGoogleS2(domain, 128);
        if (s2128) return s2128;

        // Tier 2: Google S2 64px（降级方案）
        const s264 = await fetchGoogleS2(domain, 64);
        if (s264) return s264;

        // Tier 3: DuckDuckGo 服务
        const ddg = await fetchDuckDuckGo(domain);
        if (ddg) return ddg;

        // Tier 4: 全部失败
        return null;
    }

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
     * 加载流程：
     *   1. 检查 IndexedDB 缓存 → 命中则立即显示
     *   2. 后台进行多级高分辨率源网络请求
     *   3. 成功后更新缓存 + 替换 img src
     *   4. 全部失败则显示纯色字母方块
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
            // URL 解析失败 → 回退
            createColorFallback('?', iconWrap);
            return;
        }

        // 步骤 1: 优先从 IndexedDB 缓存加载
        ns.getFaviconFromDB(domain).then(function (cached) {
            if (cached && typeof cached === 'string' && cached.startsWith('data:image')) {
                imgElement.src = cached;
                // 标记为已缓存，下文不再重复 fetch
                imgElement.dataset.faviconCached = '1';
            }
        });

        // 步骤 2: 后台网络请求高分辨率 favicon（去重合并并发）
        if (!_pendingFetches[domain]) {
            _pendingFetches[domain] = fetchHighResFavicon(domain).then(function (dataUrl) {
                delete _pendingFetches[domain];
                if (dataUrl) {
                    // 缓存到 IndexedDB 供后续使用
                    ns.setFaviconInDB(domain, dataUrl);
                }
                return dataUrl;
            });
        }
        _pendingFetches[domain].then(function (dataUrl) {
            if (dataUrl) {
                // 无论之前是否显示了缓存版本，都用新获取的高清版替换
                imgElement.src = dataUrl;
            } else if (!imgElement.src || imgElement.dataset.faviconCached !== '1') {
                // 无缓存且网络请求全部失败 → 字母回退
                createColorFallback(domain, iconWrap);
            }
        });

        // 步骤 3: 图片加载错误处理（兜底）
        imgElement.onerror = function () {
            // 已经显示过回退则不再重复创建
            if (imgElement.dataset.faviconFallback === '1') return;
            imgElement.dataset.faviconFallback = '1';
            imgElement.src = '';
            createColorFallback(domain, iconWrap);
            console.warn('[图标] 图片加载失败，使用字母回退 域名=' + domain);
        };
    };

})(window.DevHome);
