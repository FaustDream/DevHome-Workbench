/**
 * DevHome Workbench - 工具函数
 * HTML 转义、分类状态修复、默认磁贴加载等通用辅助函数。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

let storage = ns.storage;

    /* ===== HTML 转义 ===== */
    ns.escapeHtml = function (str) {
let div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * 轻量 HTML 净化：用于渲染 AI 生成的 Markdown（marked.parse 输出）。
     * 不引入第三方库，仅剔除常见的 XSS 向量：
     *   - <script>/<style>/<iframe> 等可执行/嵌入标签
     *   - 所有 on* 事件属性
     *   - javascript:/data:text/html 协议的 href/src
     * 注：本地扩展页风险有限，此为低成本防护；如需更强保障可引入 DOMPurify。
     * @param {string} html - 待净化的 HTML 字符串
     * @returns {string} 净化后的 HTML
     */
    ns.sanitizeHtml = function (html) {
        if (!html) return '';
let div = document.createElement('div');
        div.innerHTML = html;
        // 移除可执行 / 嵌入类标签
        div.querySelectorAll('script, style, iframe, object, embed, link, meta, base').forEach(function (el) {
            el.remove();
        });
        // 清理危险属性与危险协议
        div.querySelectorAll('*').forEach(function (el) {
            Array.prototype.forEach.call(el.attributes, function (attr) {
let name = attr.name.toLowerCase();
let val = String(attr.value || '').trim().toLowerCase();
                if (name.indexOf('on') === 0) {
                    // 移除事件处理器属性（如 onclick、onerror）
                    el.removeAttribute(attr.name);
                } else if ((name === 'href' || name === 'src') &&
                    (val.indexOf('javascript:') === 0 || val.indexOf('data:text/html') === 0)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return div.innerHTML;
    };

    /* ===== 搜索引擎图标渲染 ===== */
    ns.renderEngineIcon = function (engine) {
        if (engine.iconName && typeof ns.icon === 'function') {
            return ns.icon(engine.iconName, 'dh-icon--md engine-vector-icon');
        }
        if (engine.badge) {
            return '<span class="engine-badge" aria-hidden="true">' + engine.badge + '</span>';
        }
        if (engine.svg) return engine.svg;
        return '';
    };

    /* ===== 分类状态修复 ===== */
    ns.normalizePageState = function (pagesData, storedPageNames) {
let changed = false;
let normalizedNames = pagesData.map(function (page, idx) {
let pageName = page && typeof page.name === 'string' ? page.name.trim() : '';
let storedName = typeof storedPageNames[idx] === 'string' ? storedPageNames[idx].trim() : '';
let finalName = pageName || storedName || '第' + (idx + 1) + '页';
            if (!page || page.name !== finalName) {
                if (page) page.name = finalName;
                changed = true;
            }
            if (storedName !== finalName) changed = true;
            return finalName;
        });
        if (storedPageNames.length !== normalizedNames.length) changed = true;
        return { changed: changed, pageNames: normalizedNames, pagesData: pagesData };
    };

    /* ===== 磁贴身份 ===== */
    ns.getTileIdentity = function (tile) {
        return [tile && tile.label ? tile.label : '', tile && tile.url ? tile.url : ''].join('|');
    };

    ns.getPageTileSignature = function (page) {
let tiles = page && Array.isArray(page.tiles) ? page.tiles : [];
        return tiles.map(ns.getTileIdentity).sort().join('||');
    };

    /* ===== 修复默认分类内容错位 ===== */
    ns.repairDefaultCategoryContent = function (pagesData, pageNames, defaultPagesData) {
        if (!Array.isArray(pagesData) || !Array.isArray(defaultPagesData) || pagesData.length !== defaultPagesData.length) {
            return { changed: false, pagesData: pagesData };
        }
let defaultByName = new Map(defaultPagesData.map(function (p) { return [p.name, p]; }));
let defaultSignatureByName = new Map(defaultPagesData.map(function (p) { return [p.name, ns.getPageTileSignature(p)]; }));
let defaultNameBySignature = new Map(defaultPagesData.map(function (p) { return [ns.getPageTileSignature(p), p.name]; }));
        if (!pageNames.every(function (name) { return defaultByName.has(name); })) {
            return { changed: false, pagesData: pagesData };
        }
let needRepair = false;
        for (let idx = 0; idx < pagesData.length; idx += 1) {
let expectedName = pageNames[idx];
let currentSignature = ns.getPageTileSignature(pagesData[idx]);
let expectedSignature = defaultSignatureByName.get(expectedName);
            if (currentSignature === expectedSignature) continue;
let matchedDefaultName = defaultNameBySignature.get(currentSignature);
            if (!matchedDefaultName || matchedDefaultName === expectedName) {
                return { changed: false, pagesData: pagesData };
            }
            needRepair = true;
        }
        if (!needRepair) return { changed: false, pagesData: pagesData };
        return {
            changed: true,
            pagesData: pagesData.map(function (page, idx) {
let expectedName2 = pageNames[idx];
let defaultPage = defaultByName.get(expectedName2);
                return Object.assign({}, page, {
                    name: expectedName2,
                    tiles: (defaultPage.tiles || []).map(function (tile, tileIdx) {
                        return Object.assign({}, tile, { position: typeof tile.position === 'number' ? tile.position : tileIdx });
                    })
                });
            })
        };
    };

    /* ===== 默认磁贴创建 ===== */
    ns.createDefaultTile = function (item, idx, seed) {
        seed = seed || Date.now();
        return {
            id: 'tile_' + seed + '_' + idx,
            label: item.name,
            url: item.url,
            type: 'favicon',
            icon: '',
            color: '#4a9eff',
            position: idx
        };
    };

    /* ===== 获取默认页面数据 ===== */
    const _defaultsCacheKey = 'tabpage_defaults_cached';
    const _defaultsCacheVersionKey = 'tabpage_defaults_version';
    const DEFAULTS_VERSION = ns.DEFAULTS_VERSION;

    ns.getDefaultPagesData = async function () {
        try {
let cached = localStorage.getItem(_defaultsCacheKey);
let cachedVersion = localStorage.getItem(_defaultsCacheVersionKey);
            if (cached && cachedVersion === DEFAULTS_VERSION) return JSON.parse(cached);
        } catch (_) { }

let now = Date.now();
let categoryNames, pages;
        try {
let url;
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
                url = chrome.runtime.getURL('defaults.json');
            } else {
                url = 'defaults.json';
            }
let resp = await fetch(url);
let data = await resp.json();
            categoryNames = data.categoryNames;
            pages = data.pages;
        } catch (_) {
            categoryNames = ns.INLINE_DEFAULT_CATEGORY_NAMES;
            pages = {
                "常用": [{ "name": "哔哩哔哩", "url": "https://www.bilibili.com" }, { "name": "知乎", "url": "https://www.zhihu.com" }, { "name": "GitHub", "url": "https://github.com" }, { "name": "ChatGPT", "url": "https://chatgpt.com" }],
                "AI": [{ "name": "ChatGPT", "url": "https://chatgpt.com" }, { "name": "Claude", "url": "https://claude.ai" }, { "name": "Gemini", "url": "https://gemini.google.com" }, { "name": "DeepSeek", "url": "https://chat.deepseek.com" }, { "name": "Kimi", "url": "https://kimi.moonshot.cn" }, { "name": "豆包", "url": "https://www.doubao.com" }],
                "视频": [{ "name": "哔哩哔哩", "url": "https://www.bilibili.com" }, { "name": "YouTube", "url": "https://www.youtube.com" }, { "name": "抖音", "url": "https://www.douyin.com" }, { "name": "Netflix", "url": "https://www.netflix.com" }, { "name": "腾讯视频", "url": "https://v.qq.com" }, { "name": "爱奇艺", "url": "https://www.iqiyi.com" }],
                "社交": [{ "name": "微博", "url": "https://weibo.com" }, { "name": "知乎", "url": "https://www.zhihu.com" }, { "name": "小红书", "url": "https://www.xiaohongshu.com" }, { "name": "X (Twitter)", "url": "https://x.com" }, { "name": "Instagram", "url": "https://www.instagram.com" }, { "name": "Reddit", "url": "https://www.reddit.com" }],
                "开发": [{ "name": "GitHub", "url": "https://github.com" }, { "name": "MDN Web Docs", "url": "https://developer.mozilla.org" }, { "name": "Stack Overflow", "url": "https://stackoverflow.com" }, { "name": "力扣", "url": "https://leetcode.cn" }, { "name": "Vercel", "url": "https://vercel.com" }, { "name": "npm", "url": "https://www.npmjs.com" }],
                "设计": [{ "name": "Figma", "url": "https://www.figma.com" }, { "name": "Pinterest", "url": "https://www.pinterest.com" }, { "name": "Behance", "url": "https://www.behance.net" }, { "name": "Dribbble", "url": "https://dribbble.com" }, { "name": "Canva", "url": "https://www.canva.com" }, { "name": "Iconfont", "url": "https://www.iconfont.cn" }],
                "学习": [{ "name": "菜鸟教程", "url": "https://www.runoob.com" }, { "name": "中国大学MOOC", "url": "https://www.icourse163.org" }, { "name": "Coursera", "url": "https://www.coursera.org" }, { "name": "Wikipedia", "url": "https://www.wikipedia.org" }, { "name": "DeepL 翻译", "url": "https://www.deepl.com" }, { "name": "arXiv", "url": "https://arxiv.org" }],
                "工具": [{ "name": "Notion", "url": "https://www.notion.so" }, { "name": "百度网盘", "url": "https://pan.baidu.com" }, { "name": "Google Drive", "url": "https://drive.google.com" }, { "name": "iLovePDF", "url": "https://www.ilovepdf.com" }, { "name": "草料二维码", "url": "https://cli.im" }, { "name": "Excalidraw", "url": "https://excalidraw.com" }],
                "购物": [{ "name": "淘宝", "url": "https://www.taobao.com" }, { "name": "京东", "url": "https://www.jd.com" }, { "name": "拼多多", "url": "https://www.pinduoduo.com" }, { "name": "什么值得买", "url": "https://www.smzdm.com" }, { "name": "eBay", "url": "https://www.ebay.com" }, { "name": "AliExpress", "url": "https://www.aliexpress.com" }],
                "音乐": [{ "name": "网易云音乐", "url": "https://music.163.com" }, { "name": "QQ音乐", "url": "https://y.qq.com" }, { "name": "Spotify", "url": "https://open.spotify.com" }, { "name": "Apple Music", "url": "https://music.apple.com" }, { "name": "SoundCloud", "url": "https://soundcloud.com" }, { "name": "猫耳FM", "url": "https://www.missevan.com" }],
                "资讯": [{ "name": "Hacker News", "url": "https://news.ycombinator.com" }, { "name": "Product Hunt", "url": "https://www.producthunt.com" }, { "name": "36氪", "url": "https://36kr.com" }, { "name": "虎嗅", "url": "https://www.huxiu.com" }, { "name": "今日头条", "url": "https://www.toutiao.com" }, { "name": "少数派", "url": "https://sspai.com" }]
            };
        }
let globalIdx = 0;
let result = categoryNames.map(function (catName, pageIdx) {
let catTiles = pages[catName] || [];
            return {
                id: 'page_' + pageIdx,
                name: catName,
                tiles: catTiles.map(function (item, idx) { return ns.createDefaultTile(item, globalIdx++, now); })
            };
        });
        try {
            localStorage.setItem(_defaultsCacheKey, JSON.stringify(result));
            localStorage.setItem(_defaultsCacheVersionKey, DEFAULTS_VERSION);
        } catch (_) { }
        return result;
    };

    ns.getDefaultPageNames = function () { return ns.INLINE_DEFAULT_CATEGORY_NAMES; };

    /* ===== 快捷方式尺寸辅助 ===== */
    ns.normalizeShortcutSize = function (size) {
        return ns.SHORTCUT_SIZE_OPTIONS[size] ? size : ns.DEFAULT_SHORTCUT_SIZE;
    };

    ns.normalizeShortcutColumns = function (columns) {
let key = String(columns);
        return ns.SHORTCUT_COLUMN_OPTIONS[key] ? key : String(ns.DEFAULT_SHORTCUT_COLUMNS);
    };

    /* ===== 自定义确认弹窗（使用 Shadcn Dialog 组件） ===== */
    /**
     * 显示确认弹窗
     * @param {string} message - 提示消息
     * @param {object} [opts] - 可选配置 { title, okLabel, cancelLabel }
     * @returns {Promise<boolean>} true=确定，false=取消
     */
    ns.showConfirm = function (message, opts) {
        if (window.ShadcnDialogs) return window.ShadcnDialogs.showConfirm(message, opts);
        // 兜底：Shadcn 未加载时使用原生 confirm
        return Promise.resolve(window.confirm(message));
    };

    /* ===== 自定义输入弹窗（使用 Shadcn Dialog 组件） ===== */
    /**
     * 显示输入弹窗
     * @param {string} message - 提示消息
     * @param {object} [opts] - 可选配置 { title, defaultValue, okLabel, cancelLabel }
     * @returns {Promise<string|null>} 输入的文本，取消返回 null
     */
    ns.showPrompt = function (message, opts) {
        if (window.ShadcnDialogs) return window.ShadcnDialogs.showPrompt(message, opts);
        // 兜底：Shadcn 未加载时使用原生 prompt
        return Promise.resolve(window.prompt(message, (opts && opts.defaultValue) || ''));
    };

    /* ===== Toast 通知（替代原生 alert） ===== */
    /**
     * 显示自动消失的 toast 通知
     * @param {string} message - 通知内容
     * @param {string} [type] - 类型：'info' | 'success' | 'error'，默认 'info'
     * @param {number} [duration] - 显示时长（毫秒），默认 2500
     */
    ns.showToast = function (message, type, duration) {
        type = type || 'info';
        duration = duration || 2500;
let toast = document.createElement('div');
        toast.className = 'wb-toast ' + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        // 动画结束后移除
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, duration + 300);
    };

    /* ===== 带操作按钮的 Action Toast（用于撤销等场景） ===== */
    /**
     * 显示带操作按钮的 toast 通知
     * @param {string} message - 通知内容
     * @param {string} actionLabel - 操作按钮文字（如 "撤销"）
     * @param {function} actionCallback - 点击操作按钮的回调
     * @param {number} [duration] - 显示时长（毫秒），默认 4000
     * @param {string} [type] - 类型：'info' | 'success' | 'error'，默认 'info'
     */
    ns.showActionToast = function (message, actionLabel, actionCallback, duration, type) {
        type = type || 'info';
        duration = duration || 4000;
let toast = document.createElement('div');
        toast.className = 'wb-toast wb-toast-action ' + type;
        toast.style.pointerEvents = 'auto';
        toast.style.cursor = 'default';

let messageSpan = document.createElement('span');
        messageSpan.className = 'wb-toast-message';
        messageSpan.textContent = message;

let actionBtn = document.createElement('button');
        actionBtn.className = 'wb-toast-action-btn';
        actionBtn.textContent = actionLabel;

let didAction = false;
let timer = null;

let cleanup = function () {
            if (timer) { clearTimeout(timer); timer = null; }
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        };

        actionBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!didAction) {
                didAction = true;
                actionCallback();
            }
            cleanup();
        });

        toast.appendChild(messageSpan);
        toast.appendChild(actionBtn);
        document.body.appendChild(toast);

        // 自动消失后清理
        timer = setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, duration + 300);
    };

})(window.DevHome);
