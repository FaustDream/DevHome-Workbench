/**
 * DevHome Workbench v2 - Service Worker（编排入口）
 *
 * 架构说明：
 *   本文件为 Service Worker 的编排入口，所有业务逻辑已拆分到 js/bg/ 私有子目录：
 *     _quotes.js              — 激励语句库
 *     _pomodoro-core.js       — 番茄钟核心（状态管理 + 生命周期 + 持久化 + 通知）
 *     _pomodoro-broadcast.js  — 番茄钟状态广播 + 长连接管理
 *     _clip-capture.js        — 网页剪藏 + 快捷键处理
 *     _task-notify.js         — 任务到期检查通知
 *
 *  子模块通过 importScripts 加载，共享 Service Worker 全局作用域。
 *  所有模块变量（pomodoroState、pomodoroPorts 等）在全局作用域中互通。
 */
'use strict';

importScripts(
    'bg/_quotes.js',
    'bg/_pomodoro-core.js',
    'bg/_pomodoro-broadcast.js',
    'bg/_clip-capture.js',
    'bg/_task-notify.js'
);

/* ===== 安装/启动 ===== */
chrome.runtime.onInstalled.addListener(function () {
    console.log('[后台] DevHome Workbench v2 已安装');
    chrome.contextMenus.create({
        id: 'capture-selection',
        title: '剪藏到工作台',
        contexts: ['selection']
    });
});

chrome.runtime.onStartup.addListener(restorePomodoroState);

/* ===== 通知点击处理 ===== */
chrome.notifications.onClicked.addListener(function (notificationId) {
    if (notificationId === 'pomodoro-done' || notificationId === 'pomodoro-rest-done') {
        chrome.tabs.query({ url: chrome.runtime.getURL('index.html') }, function (tabs) {
            if (tabs && tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
                chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                chrome.tabs.create({ url: 'index.html' });
            }
        });
        chrome.notifications.clear(notificationId);
    } else if (notificationId.startsWith('task-due-')) {
        chrome.tabs.query({ url: chrome.runtime.getURL('index.html') }, function (tabs) {
            if (tabs && tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
                chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                chrome.tabs.create({ url: 'index.html' });
            }
        });
        chrome.notifications.clear(notificationId);
    }
});

/* ===== chrome.alarms 回调 ===== */
chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === 'pomodoro-phase') {
        console.log('[后台] alarm 触发阶段切换');
        await pomodoroPhaseEnd();
    } else if (alarm.name === 'task-due-check') {
        console.log('[后台] alarm 触发任务到期检查');
        await checkTaskDueNotifications();
    }
});

/* ===== 后台解析目标站点真实 favicon（绕过页面级 CORS） ===== */
/**
 * 在 Service Worker 中解析并抓取目标站点的真实 favicon，转成 dataURL 回传
 *
 * 为什么放 SW：扩展页面直接 fetch 任意站点会被 CORS 拦截（无法读取首页 HTML
 * 与图标字节）。而 SW 对 host_permissions（含 <all_urls>）覆盖的域名发起的
 * fetch 可豁免 CORS，因此能读取目标站点首页 HTML 与图标资源。
 *
 * 解析策略（按优先级）：
 *   1. 约定路径 https://<domain>/favicon.ico（多数站点直接提供，体积小）
 *   2. 抓取首页 HTML，提取 <link rel="icon"> / rel="apple-touch-icon">
 *      （apple-touch-icon 分辨率高，优先使用），支持相对/绝对/协议相对地址
 * @param {string} domain - 目标域名
 * @returns {Promise<string|null>} 成功返回 base64 dataURL，未找到返回 null
 */
function resolveRealFavicon(domain) {
    const root = 'https://' + domain;
    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, 6000);

    // 将图标 URL 抓取为 dataURL；非图片或抓取失败返回 null
    function toDataUrl(url) {
        return fetch(url, { signal: controller.signal, redirect: 'follow' })
            .then(function (res) {
                if (!res.ok) return null;
                const ct = (res.headers.get('content-type') || '').toLowerCase();
                // .ico 文件始终接受（许多服务器返回错误的 content-type）
                const isIco = /\.ico(\?|$)/i.test(url);
                // 有效的图片 MIME 类型（含旧版 IE .ico 的类型）
                const isImageType = ct.indexOf('image/') === 0 ||
                    ct.indexOf('image-x-icon') !== -1 ||
                    ct.indexOf('vnd.microsoft.icon') !== -1;
                // 文件名是已知图片扩展名也接受（防御 content-type 配置错误）
                const isImageExt = /\.(ico|png|jpg|jpeg|svg|webp|gif)(\?|$)/i.test(url);
                if (!isImageType && !isImageExt) return null;
                return res.blob();
            })
            .then(function (blob) {
                if (!blob) return null;
                // .ico 文件的 blob.type 经常为空或 application/octet-stream，无条件接受
                if (!blob.type || !blob.type.startsWith('image/')) {
                    const isIco = /\.ico(\?|$)/i.test(url);
                    if (blob.size > 0 && blob.size < 2097152 && isIco) {
                        // .ico 文件，手动设置 MIME 以通过 FileReader
                        return new Blob([blob], { type: 'image/x-icon' });
                    }
                    if (!isIco) return null; // 非图片 blob
                }
                // 将二进制 blob 转成 dataURL，便于页面写入 IndexedDB 长期缓存
                return new Promise(function (resolve, reject) {
                    const reader = new FileReader();
                    reader.onloadend = function () { resolve(reader.result); };
                    reader.onerror = function () { reject(reader.error || new Error('read blob failed')); };
                    reader.readAsDataURL(blob);
                });
            })
            .catch(function () { return null; });
    }

    // 从首页 HTML 中提取图标链接，按优先级排序（apple-touch-icon 最高）
    function parseIconLinks(html, baseOrigin) {
        const links = [];
        const linkRe = /<link\b[^>]*>/gi;
        let m;
        while ((m = linkRe.exec(html))) {
            const tag = m[0];
            const relM = tag.match(/\brel=["']([^"']*)["']/i);
            const hrefM = tag.match(/\bhref=["']([^"']*)["']/i);
            if (!relM || !hrefM) continue;
            const rel = relM[1].toLowerCase();
            if (rel.indexOf('icon') === -1) continue; // 仅处理图标类 link
            let href = hrefM[1];
            if (href.indexOf('data:image') === 0) {
                // 内联 data URI 图标，直接采用（优先级最高）
                links.push({ url: href, score: 4 });
                continue;
            }
            if (href.startsWith('//')) href = 'https:' + href;
            else if (href.startsWith('/')) href = baseOrigin + href;
            else if (!/^https?:/i.test(href)) href = baseOrigin + '/' + href;
            // apple-touch-icon 分辨率高，优先；shortcut icon 次之
            const score = rel.indexOf('apple-touch') !== -1 ? 3 : (rel === 'shortcut icon' ? 2 : 1);
            links.push({ url: href, score: score });
        }
        links.sort(function (a, b) { return b.score - a.score; });
        return links;
    }

    return Promise.resolve()
        .then(function () {
            // 1) 先尝试约定路径 favicon.ico
            return toDataUrl(root + '/favicon.ico');
        })
        .then(function (dataUrl) {
            if (dataUrl) return dataUrl;
            // 2) 拉取首页 HTML，解析 <link rel="icon"> 系列
            return fetch(root + '/', { signal: controller.signal, redirect: 'follow' })
                .then(function (htmlResp) {
                    if (!htmlResp.ok) return null;
                    // 以最终响应地址的 origin 作为相对路径基准（处理重定向）
                    const finalOrigin = (function () {
                        try { return new URL(htmlResp.url).origin; } catch (e) { return root; }
                    })();
                    return htmlResp.text().then(function (html) {
                        const links = parseIconLinks(html, finalOrigin);
                        // 按优先级逐个尝试，命中真实图标即返回
                        return links.reduce(function (chain, link) {
                            return chain.then(function (acc) {
                                return acc ? acc : toDataUrl(link.url);
                            });
                        }, Promise.resolve(null));
                    });
                })
                .then(function (parsed) { return parsed; })
                .catch(function () { return null; });
        })
        .then(function (result) {
            clearTimeout(timeoutId);
            return result || null;
        });
}

/* ===== 消息处理 ===== */
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
        case 'POMODORO_START':
            startPomodoro(message.data);
            sendResponse({ success: true });
            break;
        case 'POMODORO_PAUSE':
            pausePomodoro();
            sendResponse({ success: true });
            break;
        case 'POMODORO_RESUME':
            resumePomodoro();
            sendResponse({ success: true });
            break;
        case 'POMODORO_STOP':
            stopPomodoro();
            sendResponse({ success: true });
            break;
        case 'POMODORO_GET_STATE':
            sendResponse({
                success: true,
                data: {
                    active: pomodoroState.active,
                    remaining: pomodoroState.active ? computeRemaining() : pomodoroState.remaining,
                    duration: pomodoroState.duration,
                    restDuration: pomodoroState.restDuration,
                    type: pomodoroState.type,
                    isResting: pomodoroState.isResting,
                    autoCycle: pomodoroState.autoCycle,
                    sessionCount: pomodoroState.sessionCount,
                    formatted: formatTime(pomodoroState.active ? computeRemaining() : pomodoroState.remaining),
                    phaseStartAt: pomodoroState.phaseStartAt,
                    phaseTotalSeconds: pomodoroState.phaseTotalSeconds,
                    taskId: pomodoroState.taskId
                }
            });
            break;
        case 'OPEN_SIDE_PANEL':
            if (sender.tab) { chrome.sidePanel.open({ tabId: sender.tab.id }); }
            sendResponse({ success: true });
            break;
        case 'RESOLVE_FAVICON':
            // 由后台 SW 解析目标站点的真实 favicon：SW 拥有 <all_urls> host_permissions
            // 可豁免 CORS，直接抓取站点自身图标并转成 dataURL 回传，避免拿到默认地球。
            resolveRealFavicon(message.domain)
                .then(function (dataUrl) { sendResponse({ success: true, dataUrl: dataUrl || null }); })
                .catch(function (err) {
                    sendResponse({ success: false, reason: (err && err.message) ? err.message : String(err) });
                });
            break;
        default:
            sendResponse({ success: false, reason: 'unknown_message_type' });
    }
    return true;
});

/* ===== 任务到期 alarm 注册 ===== */
try {
    chrome.alarms.create('task-due-check', { periodInMinutes: 15 });
    console.log('[后台] 已注册任务到期检查 alarm（每15分钟）');
} catch (e) {
    console.warn('[后台] 注册任务到期 alarm 失败:', e);
}

// 启动时恢复番茄钟状态
restorePomodoroState();
console.log('[后台] Service Worker 已启动');
