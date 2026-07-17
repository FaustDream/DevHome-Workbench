/**
 * DevHome Workbench - IndexedDB Favicon 缓存（LRU 上限200）
 * 三级加载策略：IndexedDB 缓存 -> API 加载 -> 失败回退为问号图标
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const FAVICON_LRU_MAX = 200;
    let faviconDB = null;

    ns.openFaviconDB = function () {
        return new Promise(function (resolve, reject) {
            const req = indexedDB.open('TabPageFaviconDB', 1);
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

    ns.getFaviconFromDB = function (domain) {
        return new Promise(function (resolve) {
            if (!faviconDB) return resolve(null);
            try {
                const tx = faviconDB.transaction('favicons', 'readwrite');
                const store = tx.objectStore('favicons');
                const getReq = store.get(domain);
                getReq.onsuccess = function () {
                    if (getReq.result) {
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

    ns.setFaviconInDB = function (domain, dataUrl) {
        if (!faviconDB) return;
        try {
            const tx = faviconDB.transaction('favicons', 'readwrite');
            const store = tx.objectStore('favicons');
            store.put({ domain: domain, dataUrl: dataUrl, lastAccess: Date.now() });
            tx.oncomplete = function () {
                const countReq = faviconDB.transaction('favicons', 'readonly').objectStore('favicons').count();
                countReq.onsuccess = function () {
                    if (countReq.result > FAVICON_LRU_MAX) {
                        const delTx = faviconDB.transaction('favicons', 'readwrite');
                        const delStore = delTx.objectStore('favicons');
                        const idx = delStore.index('lastAccess');
                        const cursorReq = idx.openCursor();
                        let toDelete = countReq.result - FAVICON_LRU_MAX;
                        cursorReq.onsuccess = function (e) {
                            const cursor = e.target.result;
                            if (cursor && toDelete > 0) { cursor.delete(); toDelete--; cursor.continue(); }
                        };
                    }
                };
            };
        } catch (e) { /* 静默失败 */ }
    };

    /** 随机纯色生成器（favicon 获取失败时使用） */
    function randomFaviconColor() {
        const palette = [
            '#c0692a', '#d94a3a', '#e67e22', '#f39c12', '#27ae60',
            '#2ecc71', '#1abc9c', '#2980b9', '#3498db', '#8e44ad',
            '#9b59b6', '#16a085', '#e74c3c', '#7f8c8d', '#2c3e50'
        ];
        return palette[Math.floor(Math.random() * palette.length)];
    }

    /**
     * 创建 favicon 获取失败时的纯色方块回退
     * 显示域名首字母在彩色圆角方块上
     */
    function createColorFallback(domain, iconWrap) {
        const div = document.createElement('div');
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
    }

    ns.loadFavicon = function (url, imgElement, iconWrap) {
        try {
            const urlObj = new URL(url);
            let domain = urlObj.hostname;
            const apiUrl = 'https://api.xinac.net/icon/?url=' + domain;
            ns.getFaviconFromDB(domain).then(function (cached) {
                if (cached && typeof cached === 'string' && cached.startsWith('data:image')) { imgElement.src = cached; return; }
                imgElement.src = apiUrl;
            });
            imgElement.onerror = function () {
                imgElement.src = '';
                createColorFallback(domain, iconWrap);
            };
            fetch(apiUrl).then(function (r) { return r.blob(); }).then(function (blob) {
                if (!blob.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onloadend = function () { ns.setFaviconInDB(domain, reader.result); };
                reader.readAsDataURL(blob);
            }).catch(function () { /* 忽略失败 */ });
        } catch (e) {
            let domain = '';
            try { domain = new URL(url).hostname; } catch (_) {}
            createColorFallback(domain || '?', iconWrap);
        }
    };

})(window.DevHome);
