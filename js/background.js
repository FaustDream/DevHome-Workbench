/**
 * DevHome Workbench v2 - Service Worker
 *
 * 职责：
 *   1. 注册右键菜单（剪藏到工作台）
 *   2. 监听快捷键命令
 *   3. 番茄钟后台计时
 *   4. 番茄钟完成时发送 Chrome 通知
 *   5. 侧边栏与 content script 消息中转
 */
'use strict';

/* ===== 常量 ===== */
var POMODORO_TICK_MS = 1000; // 每秒 tick

/* ===== 激励语句库 ===== */
var WORK_COMPLETE_QUOTES = [
    '又干掉一个🍅', '大脑说谢谢', '比刚才的自己多坚持了一会儿',
    '专注是一种超能力', '休息一下，你值得', '时间花在了对的地方',
    '每一步都算数', '专注的你是最强的', '这一轮很漂亮',
    '让大脑喘口气', '高效不在于时长，在于专注'
];
var REST_COMPLETE_QUOTES = [
    '满血复活，继续冲！', '休息好了，准备下一轮', '充电完成，出发',
    '精力已恢复，开始吧', '新的一轮，新的可能', '休息是为了走更远',
    '状态回来了', '再来一个🍅', '准备好迎接挑战了吗',
    '深吸一口气，继续前进'
];
var WORK_START_QUOTES = [
    '专注模式启动', '进入心流', '屏蔽干扰，聚焦当下',
    '这一个番茄献给你想做的事', '开始创造', '安静地开启一段专注'
];
var REST_START_QUOTES = [
    '起身走动一下吧', '闭眼休息片刻', '喝口水，放松肩膀',
    '远眺窗外30秒', '深呼吸，放空大脑', '做几个伸展动作'
];

function randomQuote(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ===== 番茄钟状态（Service Worker 内存，重启丢失） ===== */
var pomodoroState = {
    active: false,
    taskId: null,
    duration: 25,         // 工作总时长（分钟）
    restDuration: 5,      // 休息时长（分钟）
    type: 'default',      // default | focus
    remaining: 0,         // 当前阶段剩余秒数
    startedAt: null,
    isResting: false,     // 是否在休息阶段
    restRemaining: 0,
    autoCycle: true,      // 是否自动循环
    sessionCount: 0       // 已完成的工作轮次
};
var pomodoroTimer = null; // setInterval 句柄

/* ===== 安装/启动 ===== */
chrome.runtime.onInstalled.addListener(function () {
    console.log('[Background] DevHome Workbench v2 已安装');

    // 注册右键菜单：剪藏选中文字
    chrome.contextMenus.create({
        id: 'capture-selection',
        title: '剪藏到工作台',
        contexts: ['selection']
    });
});

/* ===== 右键菜单点击处理 ===== */
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'capture-selection' && info.selectionText) {
        handleClipCapture(info.selectionText.trim(), tab);
    }
});

/**
 * 处理网页剪藏：将选中文字保存为笔记
 */
async function handleClipCapture(text, tab) {
    var clipData = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        content: text,
        type: 'webclip',
        tags: [],
        sourceUrl: tab ? tab.url : '',
        sourceTitle: tab ? tab.title : '',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    try {
        // 保存到 chrome.storage.local
        var result = await chrome.storage.local.get('v2/notes');
        var notes = result['v2/notes'] || [];
        notes.unshift(clipData);
        await chrome.storage.local.set({ 'v2/notes': notes });

        // 打开侧边栏
        if (tab) {
            await chrome.sidePanel.open({ tabId: tab.id });
        }

        // 通知侧边栏刷新
        chrome.runtime.sendMessage({
            type: 'NEW_WEBCLIP',
            data: clipData
        }).catch(function () {
            // 侧边栏可能未打开，忽略
        });

        console.log('[Background] 剪藏已保存:', clipData.title);
    } catch (e) {
        console.error('[Background] 剪藏保存失败:', e);
    }
}

/* ===== 快捷键处理 ===== */
chrome.commands.onCommand.addListener(async function (command, tab) {
    if (command === 'capture_selection') {
        // 通过 content script 获取选中文字
        if (tab && tab.id) {
            try {
                var results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: function () { return window.getSelection().toString().trim(); }
                });
                if (results && results[0] && results[0].result) {
                    handleClipCapture(results[0].result, tab);
                }
            } catch (e) {
                console.warn('[Background] 快捷键剪藏失败:', e);
            }
        }
    } else if (command === 'open_side_panel') {
        if (tab) {
            chrome.sidePanel.open({ tabId: tab.id });
        }
    }
});

/* ===== 番茄钟：使用 chrome.alarms ===== */

/**
 * 开始番茄钟（工作阶段）
 * @param {Object} params - { duration, restDuration, type, taskId, autoCycle, countUp }
 */
function startPomodoro(params) {
    // 清除旧计时器
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }

    params = params || {};
    pomodoroState.active = true;
    pomodoroState.duration = params.duration || 25;
    pomodoroState.restDuration = params.restDuration || 5;
    pomodoroState.type = params.type || 'default';
    pomodoroState.taskId = params.taskId || null;
    pomodoroState.remaining = pomodoroState.duration * 60;
    pomodoroState.startedAt = Date.now();
    pomodoroState.isResting = false;
    pomodoroState.restRemaining = 0;
    pomodoroState.autoCycle = params.autoCycle !== false; // 默认开启
    pomodoroState.sessionCount = (params.sessionCount || 0) + 0;

    // 使用 setInterval 每秒 tick
    pomodoroTimer = setInterval(pomodoroTick, POMODORO_TICK_MS);

    console.log('[Background] 番茄钟已开始:', pomodoroState.duration + '分钟, 自动循环=' + pomodoroState.autoCycle);
}

/**
 * 番茄钟 tick
 */
function pomodoroTick() {
    if (!pomodoroState.active) return;
    pomodoroState.remaining--;

    // 广播剩余时间
    broadcastPomodoroState();

    // 时间到
    if (pomodoroState.remaining <= 0) {
        if (pomodoroState.isResting) {
            // 休息结束 → 自动开始下一轮工作
            pomodoroState.isResting = false;
            pomodoroState.sessionCount = (pomodoroState.sessionCount || 0) + 0; // 保持计数
            pomodoroState.remaining = pomodoroState.duration * 60;
            pomodoroState.startedAt = Date.now();

            // 发送通知：休息结束
            var restQuote = randomQuote(REST_COMPLETE_QUOTES);
            chrome.notifications.create('pomodoro-rest-done', {
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: '休息结束 — ' + restQuote,
                message: '开始第 ' + (pomodoroState.sessionCount + 1) + ' 轮专注，' + pomodoroState.duration + ' 分钟',
                priority: 1
            });

            broadcastPomodoroState();
            console.log('[Background] 休息结束，自动开始新一轮工作');
        } else {
            // 工作时间结束
            pomodoroState.sessionCount = (pomodoroState.sessionCount || 0) + 1;
            savePomodoroSession();

            if (pomodoroState.autoCycle) {
                // 自动进入休息
                pomodoroState.isResting = true;
                pomodoroState.restRemaining = pomodoroState.restDuration * 60;
                pomodoroState.remaining = pomodoroState.restRemaining;

                // 发送通知：工作完成
                var workQuote = randomQuote(WORK_COMPLETE_QUOTES);
                chrome.notifications.create('pomodoro-done', {
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: '工作完成！' + workQuote,
                    message: '休息 ' + pomodoroState.restDuration + ' 分钟 — ' + randomQuote(REST_START_QUOTES),
                    priority: 1
                });

                broadcastPomodoroState();
                console.log('[Background] 第' + pomodoroState.sessionCount + '轮完成，自动进入休息');
            } else {
                // 不自动循环，停止
                if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
                pomodoroState.active = false;

                var doneQuote = randomQuote(WORK_COMPLETE_QUOTES);
                chrome.notifications.create('pomodoro-done', {
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: '番茄钟完成！' + doneQuote,
                    message: '你今天已经完成了 ' + pomodoroState.sessionCount + ' 个番茄',
                    priority: 1
                });

                broadcastPomodoroState();
            }
        }
    }
}

/**
 * 暂停番茄钟
 */
function pausePomodoro() {
    if (!pomodoroState.active) return;
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
    pomodoroState.active = false;
    console.log('[Background] 番茄钟已暂停，剩余:', formatTime(pomodoroState.remaining));
}

/**
 * 恢复番茄钟
 */
function resumePomodoro() {
    if (pomodoroState.active) return;
    if (pomodoroState.remaining <= 0) return;
    pomodoroState.active = true;
    pomodoroTimer = setInterval(pomodoroTick, POMODORO_TICK_MS);
    console.log('[Background] 番茄钟已恢复');
}

/**
 * 停止/重置番茄钟（彻底终止自动循环）
 */
function stopPomodoro() {
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
    pomodoroState.active = false;
    pomodoroState.remaining = 0;
    pomodoroState.isResting = false;
    pomodoroState.sessionCount = 0;
    broadcastPomodoroState();
    console.log('[Background] 番茄钟已停止');
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/**
 * 保存番茄钟会话到 storage
 */
async function savePomodoroSession() {
    try {
        var result = await chrome.storage.local.get('v2/pomodoro_sessions');
        var sessions = result['v2/pomodoro_sessions'] || [];
        sessions.push({
            id: 'pom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            taskId: pomodoroState.taskId,
            duration: pomodoroState.duration,
            restDuration: pomodoroState.restDuration,
            type: pomodoroState.type,
            startedAt: pomodoroState.startedAt,
            endedAt: Date.now(),
            completed: true
        });
        await chrome.storage.local.set({ 'v2/pomodoro_sessions': sessions });
    } catch (e) {
        console.warn('[Background] 保存番茄钟会话失败:', e);
    }
}

/**
 * 广播番茄钟状态给所有连接的 runtime
 */
function broadcastPomodoroState() {
    var state = {
        active: pomodoroState.active,
        remaining: pomodoroState.remaining,
        duration: pomodoroState.duration,
        restDuration: pomodoroState.restDuration,
        type: pomodoroState.type,
        isResting: pomodoroState.isResting,
        autoCycle: pomodoroState.autoCycle,
        sessionCount: pomodoroState.sessionCount,
        formatted: formatTime(pomodoroState.remaining)
    };
    chrome.runtime.sendMessage({
        type: 'POMODORO_STATE',
        data: state
    }).catch(function () {
        // 无监听者，忽略
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
                    remaining: pomodoroState.remaining,
                    duration: pomodoroState.duration,
                    restDuration: pomodoroState.restDuration,
                    type: pomodoroState.type,
                    isResting: pomodoroState.isResting,
                    autoCycle: pomodoroState.autoCycle,
                    sessionCount: pomodoroState.sessionCount,
                    formatted: formatTime(pomodoroState.remaining),
                    taskId: pomodoroState.taskId
                }
            });
            break;

        case 'OPEN_SIDE_PANEL':
            if (sender.tab) {
                chrome.sidePanel.open({ tabId: sender.tab.id });
            }
            sendResponse({ success: true });
            break;

        default:
            sendResponse({ success: false, reason: 'unknown_message_type' });
    }
    return true; // 保持通道开启以支持异步响应
});

console.log('[Background] Service Worker 已启动');
