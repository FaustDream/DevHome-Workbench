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

/* ===== 后台代理 favicon fetch（绕过页面级 CORS） ===== */
/**
 * 在 Service Worker 中请求 favicon 并转成 dataURL 回传
 *
 * 为什么放 SW：扩展页面直接 fetch 跨域 favicon 会被 CORS 拦截（响应无
 * Access-Control-Allow-Origin）。而 SW 对 host_permissions 覆盖的域名
 * （含 www.google.com 与 *.gstatic.com）发起的 fetch 可豁免 CORS，
 * 从而正确读取 Google S2 重定向后 gstatic 的图片字节。
 * @param {string} url - favicon 图片地址
 * @returns {Promise<string>} base64 dataURL
 */
function handleFetchFavicon(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, 5000);
    return fetch(url, { signal: controller.signal })
        .then(function (res) {
            clearTimeout(timeoutId);
            if (!res.ok) { throw new Error('HTTP ' + res.status); }
            return res.blob();
        })
        .then(function (blob) {
            // 将二进制 blob 转成 dataURL，便于页面写入 IndexedDB 长期缓存
            return new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onloadend = function () { resolve(reader.result); };
                reader.onerror = function () { reject(reader.error || new Error('read blob failed')); };
                reader.readAsDataURL(blob);
            });
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
        case 'FETCH_FAVICON':
            // 由后台 SW 代理 favicon fetch：SW 拥有 host_permissions 可豁免 CORS，
            // 再把图片转成 dataURL 回传，避免扩展页面直接 fetch 被浏览器拦截。
            handleFetchFavicon(message.url)
                .then(function (dataUrl) { sendResponse({ success: true, dataUrl: dataUrl }); })
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
