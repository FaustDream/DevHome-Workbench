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

/* ===== 番茄钟状态（Service Worker 内存，重启丢失） ===== */
var pomodoroState = {
    active: false,
    taskId: null,
    duration: 25,        // 总时长（分钟）
    restDuration: 5,     // 休息时长（分钟）
    type: 'default',     // default | focus
    remaining: 0,        // 剩余秒数
    startedAt: null,
    isResting: false,    // 是否在休息阶段
    restRemaining: 0
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
 * 开始番茄钟
 * @param {Object} params - { duration, restDuration, type, taskId }
 */
function startPomodoro(params) {
    // 清除旧计时器
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }

    pomodoroState.active = true;
    pomodoroState.duration = params.duration || 25;
    pomodoroState.restDuration = params.restDuration || 5;
    pomodoroState.type = params.type || 'default';
    pomodoroState.taskId = params.taskId || null;
    pomodoroState.remaining = pomodoroState.duration * 60;
    pomodoroState.startedAt = Date.now();
    pomodoroState.isResting = false;
    pomodoroState.restRemaining = 0;

    // 使用 setInterval 每秒 tick（Service Worker 可能被休眠，但番茄钟场景可接受）
    pomodoroTimer = setInterval(pomodoroTick, POMODORO_TICK_MS);

    console.log('[Background] 番茄钟已开始:', pomodoroState.duration + '分钟');
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
            // 休息结束
            if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
            pomodoroState.active = false;
            pomodoroState.isResting = false;
            broadcastPomodoroState();
        } else {
            // 工作时间结束，进入休息
            pomodoroState.isResting = true;
            pomodoroState.restRemaining = pomodoroState.restDuration * 60;
            pomodoroState.remaining = pomodoroState.restRemaining;

            // 发送通知
            var messages = [
                '又干掉一个🍅',
                '大脑说谢谢',
                '比刚才的自己多坚持了一会儿',
                '专注是一种超能力',
                '休息一下，你值得'
            ];
            var msg = messages[Math.floor(Math.random() * messages.length)];

            chrome.notifications.create('pomodoro-done', {
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: '番茄钟完成！',
                message: msg + '\n休息 ' + pomodoroState.restDuration + ' 分钟吧',
                priority: 1
            });

            // 记录番茄钟会话
            savePomodoroSession();
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
 * 停止/重置番茄钟
 */
function stopPomodoro() {
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
    pomodoroState.active = false;
    pomodoroState.remaining = 0;
    pomodoroState.isResting = false;
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
        type: pomodoroState.type,
        isResting: pomodoroState.isResting,
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
                    type: pomodoroState.type,
                    isResting: pomodoroState.isResting,
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
