/**
 * DevHome Workbench v2 - Service Worker
 *
 * 职责：
 *   1. 注册右键菜单（剪藏到工作台）
 *   2. 监听快捷键命令
 *   3. 番茄钟后台计时（基于 chrome.alarms，可靠且跨 SW 休眠）
 *   4. 番茄钟完成时发送 Chrome 通知
 *   5. 侧边栏与 content script 消息中转
 */
'use strict';

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
var REST_START_QUOTES = [
    '起身走动一下吧', '闭眼休息片刻', '喝口水，放松肩膀',
    '远眺窗外30秒', '深呼吸，放空大脑', '做几个伸展动作'
];

function randomQuote(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ===== 番茄钟状态 =====
   说明：Service Worker 随时可能被浏览器休眠/销毁，内存中的 setInterval 不可靠。
   因此状态持久化到 chrome.storage.local，并以「阶段开始时间戳 + 阶段总时长」推导剩余秒数，
   计时与阶段切换交由 chrome.alarms（精确 when）在 SW 唤醒时可靠推进；
   同时保留内存 setInterval 仅用于存活期间向 UI 每秒广播一次。

   连接管理：使用 chrome.runtime.connect() 长连接替代每秒 sendMessage，
   减少消息序列化开销，提升番茄钟计时精度。 */
var POMODORO_STORAGE_KEY = 'v2/pomodoro_state';
var pomodoroState = {
    active: false,           // 是否处于运行（含工作/休息）中
    taskId: null,
    taskTitle: '',           // 关联的四象限任务名称
    duration: 25,            // 工作总时长（分钟）
    restDuration: 5,         // 休息时长（分钟）
    type: 'default',         // default | focus
    isResting: false,        // 是否在休息阶段
    autoCycle: true,         // 是否自动循环
    sessionCount: 0,         // 已完成的工作轮次
    phaseStartAt: null,      // 当前阶段开始的精确时间戳(ms)
    phaseTotalSeconds: 0,    // 当前阶段总时长(秒)
    remaining: 0             // 当前阶段剩余秒数（暂停时冻结；运行时由时间戳推导）
};
var pomodoroTimer = null;    // 存活期间的 setInterval 句柄（仅用于广播）
var pomodoroPorts = [];      // 活跃的长连接端口列表（替代 sendMessage 广播）
var _phaseEndInProgress = false; // 防重入标记：防止 alarm 和 restore 同时触发 phaseEnd

/** 由阶段开始时间戳推导当前剩余秒数（不受 SW 休眠影响） */
function computeRemaining() {
    if (!pomodoroState.active || !pomodoroState.phaseStartAt) return pomodoroState.remaining;
    var elapsed = Math.floor((Date.now() - pomodoroState.phaseStartAt) / 1000);
    return Math.max(0, pomodoroState.phaseTotalSeconds - elapsed);
}

/** 持久化番茄钟状态，使其跨 SW 重启不丢失 */
async function persistPomodoroState() {
    try {
        await chrome.storage.local.set({ [POMODORO_STORAGE_KEY]: pomodoroState });
    } catch (e) {
        console.warn('[Background] 保存番茄钟状态失败:', e);
    }
}

/** SW 启动时恢复番茄钟（若此前正在运行） */
async function restorePomodoroState() {
    try {
        // 如果 alarm handler 正在处理阶段切换，跳过恢复
        if (_phaseEndInProgress) {
            console.log('[Background] phaseEnd 进行中，跳过状态恢复');
            return;
        }

        var result = await chrome.storage.local.get(POMODORO_STORAGE_KEY);
        var saved = result[POMODORO_STORAGE_KEY];
        if (!saved) return;
        // 合并，缺失字段保留默认值
        pomodoroState = Object.assign(pomodoroState, saved);
        if (!pomodoroState.active) return;
        pomodoroState.remaining = computeRemaining();
        if (pomodoroState.remaining <= 0) {
            // 休眠期间阶段已结束，直接推进到下一阶段
            await pomodoroPhaseEnd();
        } else {
            startPomodoroTick();
            schedulePomodoroAlarm();
            console.log('[Background] 恢复番茄钟状态，剩余', formatTime(pomodoroState.remaining));
        }
    } catch (e) {
        console.warn('[Background] 恢复番茄钟状态失败:', e);
    }
}

/** 启动存活期间的每秒广播（setInterval 仅用于 UI 流畅，非计时权威） */
function startPomodoroTick() {
    if (pomodoroTimer) return;
    pomodoroTimer = setInterval(pomodoroTick, 1000);
}

/** 停止存活期间的每秒广播 */
function stopPomodoroTick() {
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
}

/** 安排下一次阶段切换的精确闹钟（即使 SW 休眠也会在到期时唤醒） */
function schedulePomodoroAlarm() {
    try {
        chrome.alarms.create('pomodoro-phase', {
            when: Date.now() + Math.max(1, pomodoroState.remaining) * 1000
        });
    } catch (e) {
        console.warn('[Background] 安排番茄钟闹钟失败:', e);
    }
}

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

// SW 启动（浏览器启动等）时恢复番茄钟状态
chrome.runtime.onStartup.addListener(restorePomodoroState);

/* ===== 右键菜单点击处理 ===== */
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'capture-selection' && info.selectionText) {
        handleClipCapture(info.selectionText.trim(), tab);
    }
});

/**
 * 处理网页剪藏：将选中文字保存为笔记
 *
 * 注意：Service Worker 中无法加载页面级 storageV2 模块（依赖 localStorage 和 DOM），
 * 因此直接操作 chrome.storage.local。页面端 storageV2.get('notes') 优先读取
 * chrome.storage.local，会自动同步到 localStorage 缓存，确保数据一致性。
 * 文件写盘由 storageV2.set() 中的 markDirty() 触发，在页面端下次写入时自动同步。
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
        // 读取现有笔记并追加剪藏
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

/* ===== 番茄钟 ===== */

/**
 * 开始番茄钟（工作阶段）
 * @param {Object} params - { duration, restDuration, type, taskId, autoCycle }
 */
function startPomodoro(params) {
    stopPomodoroTick();

    params = params || {};
    pomodoroState.active = true;
    pomodoroState.duration = params.duration || 25;
    pomodoroState.restDuration = params.restDuration || 5;
    pomodoroState.type = params.type || 'default';
    pomodoroState.taskId = params.taskId || null;
    pomodoroState.taskTitle = params.taskTitle || '';
    pomodoroState.isResting = false;
    pomodoroState.autoCycle = params.autoCycle !== false; // 默认开启
    pomodoroState.sessionCount = 0;
    pomodoroState.phaseStartAt = Date.now();
    pomodoroState.phaseTotalSeconds = pomodoroState.duration * 60;
    pomodoroState.remaining = pomodoroState.phaseTotalSeconds;

    startPomodoroTick();
    schedulePomodoroAlarm();
    persistPomodoroState();
    broadcastPomodoroState();

    console.log('[Background] 番茄钟已开始:', pomodoroState.duration + '分钟, 自动循环=' + pomodoroState.autoCycle);
}

/**
 * 番茄钟每秒广播（仅在 SW 存活期间执行；计时权威由时间戳 + alarms 保证）
 */
function pomodoroTick() {
    if (!pomodoroState.active || _phaseEndInProgress) return;
    pomodoroState.remaining = computeRemaining();
    broadcastPomodoroState();
    if (pomodoroState.remaining <= 0) {
        pomodoroPhaseEnd();
    }
}

/**
 * 阶段结束处理（工作→休息 或 休息→工作），由 setInterval 或 chrome.alarms 触发。
 * 统一处理阶段切换、通知、持久化与下一次闹钟安排。
 * 【fix 2026-07-16】改为 async：确保 await 所有异步操作，避免 SW 提前终止导致通知丢失。
 */
async function pomodoroPhaseEnd() {
    // 防重入：alarm 和 SW 恢复可能同时触发
    if (_phaseEndInProgress) {
        console.log('[Background] phaseEnd 已在进行中，跳过重复调用');
        return;
    }
    _phaseEndInProgress = true;

    try {
        if (pomodoroState.isResting) {
            // 休息结束 → 自动开始下一轮工作
            pomodoroState.isResting = false;
            pomodoroState.sessionCount = (pomodoroState.sessionCount || 0) + 1;
            pomodoroState.phaseStartAt = Date.now();
            pomodoroState.phaseTotalSeconds = pomodoroState.duration * 60;
            pomodoroState.remaining = pomodoroState.phaseTotalSeconds;

            var restQuote = randomQuote(REST_COMPLETE_QUOTES);
            var taskMsg = pomodoroState.taskTitle ? '\n任务：' + pomodoroState.taskTitle : '';
            await sendPomodoroNotification('pomodoro-rest-done', {
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: '休息结束 — ' + restQuote,
                message: '开始第 ' + (pomodoroState.sessionCount + 1) + ' 轮专注，' + pomodoroState.duration + ' 分钟' + taskMsg,
                priority: 2,
                requireInteraction: true
            });

            schedulePomodoroAlarm();
            await persistPomodoroState();
            broadcastPomodoroState();
            console.log('[Background] 休息结束，自动开始新一轮工作');
        } else {
            // 工作时间结束
            pomodoroState.sessionCount = (pomodoroState.sessionCount || 0) + 1;
            await savePomodoroSession();

            if (pomodoroState.autoCycle) {
                // 自动进入休息
                pomodoroState.isResting = true;
                pomodoroState.phaseStartAt = Date.now();
                pomodoroState.phaseTotalSeconds = pomodoroState.restDuration * 60;
                pomodoroState.remaining = pomodoroState.phaseTotalSeconds;

                var workQuote = randomQuote(WORK_COMPLETE_QUOTES);
                var taskMsg2 = pomodoroState.taskTitle ? '\n任务：' + pomodoroState.taskTitle : '';
                var restStartQuote = randomQuote(REST_START_QUOTES);
                await sendPomodoroNotification('pomodoro-done', {
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: '工作完成！' + workQuote,
                    message: '休息 ' + pomodoroState.restDuration + ' 分钟 — ' + restStartQuote + taskMsg2,
                    priority: 2,
                    requireInteraction: true
                });

                schedulePomodoroAlarm();
                await persistPomodoroState();
                broadcastPomodoroState();
                console.log('[Background] 第' + pomodoroState.sessionCount + '轮完成，自动进入休息');
            } else {
                // 不自动循环，停止
                stopPomodoroTick();
                chrome.alarms.clear('pomodoro-phase');
                pomodoroState.active = false;
                pomodoroState.remaining = 0;
                pomodoroState.phaseStartAt = null;
                pomodoroState.phaseTotalSeconds = 0;

                var doneQuote = randomQuote(WORK_COMPLETE_QUOTES);
                var taskMsg3 = pomodoroState.taskTitle ? '\n任务：' + pomodoroState.taskTitle : '';
                await sendPomodoroNotification('pomodoro-done', {
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: '番茄钟完成！' + doneQuote,
                    message: '你今天已经完成了 ' + pomodoroState.sessionCount + ' 个番茄' + taskMsg3,
                    priority: 2,
                    requireInteraction: true
                });

                await persistPomodoroState();
                broadcastPomodoroState();
            }
        }
    } finally {
        _phaseEndInProgress = false;
    }
}

/**
 * 发送番茄钟系统通知（带错误处理和日志）
 * @param {string} id - 通知唯一标识
 * @param {Object} options - chrome.notifications.create 的选项
 * @returns {Promise<string|boolean>} 成功返回通知ID，失败返回false
 */
function sendPomodoroNotification(id, options) {
    return new Promise(function (resolve) {
        try {
            chrome.notifications.create(id, options, function (notificationId) {
                if (chrome.runtime.lastError) {
                    console.error('[Background] 通知发送失败:', id, chrome.runtime.lastError.message);
                    resolve(false);
                } else {
                    console.log('[Background] 通知已发送:', id, notificationId);
                    resolve(notificationId);
                }
            });
        } catch (e) {
            console.error('[Background] 通知 API 异常:', id, e.message);
            resolve(false);
        }
    });
}

/**
 * 暂停番茄钟（冻结剩余秒数，停止计时与闹钟）
 */
function pausePomodoro() {
    if (!pomodoroState.active) return;
    stopPomodoroTick();
    chrome.alarms.clear('pomodoro-phase');
    pomodoroState.remaining = computeRemaining();
    pomodoroState.active = false;
    persistPomodoroState();
    console.log('[Background] 番茄钟已暂停，剩余:', formatTime(pomodoroState.remaining));
}

/**
 * 恢复番茄钟（从冻结的剩余秒数继续）
 */
function resumePomodoro() {
    if (pomodoroState.active) return;
    if (pomodoroState.remaining <= 0) return;
    // 重新对齐 phaseStartAt，使 computeRemaining() 从剩余秒数继续倒计时
    pomodoroState.phaseStartAt = Date.now() - (pomodoroState.phaseTotalSeconds - pomodoroState.remaining) * 1000;
    pomodoroState.active = true;
    startPomodoroTick();
    schedulePomodoroAlarm();
    persistPomodoroState();
    console.log('[Background] 番茄钟已恢复');
}

/**
 * 停止/重置番茄钟（彻底终止自动循环）
 */
function stopPomodoro() {
    stopPomodoroTick();
    chrome.alarms.clear('pomodoro-phase');
    pomodoroState.active = false;
    pomodoroState.remaining = 0;
    pomodoroState.isResting = false;
    pomodoroState.sessionCount = 0;
    pomodoroState.phaseStartAt = null;
    pomodoroState.phaseTotalSeconds = 0;
    persistPomodoroState();
    broadcastPomodoroState();
    console.log('[Background] 番茄钟已停止');
}

/** chrome.alarms 回调：阶段到期时可靠推进（即使 SW 此前处于休眠） */
chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === 'pomodoro-phase') {
        console.log('[Background] alarm 触发阶段切换');
        await pomodoroPhaseEnd();
    } else if (alarm.name === 'task-due-check') {
        console.log('[Background] alarm 触发任务到期检查');
        await checkTaskDueNotifications();
    }
});

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/* ===== 通知点击处理：点击通知时打开工作台标签页 ===== */
chrome.notifications.onClicked.addListener(function (notificationId) {
    if (notificationId === 'pomodoro-done' || notificationId === 'pomodoro-rest-done') {
        // 查找并聚焦已有的工作台标签页，否则打开新标签页
        chrome.tabs.query({ url: chrome.runtime.getURL('index.html') }, function (tabs) {
            if (tabs && tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
                chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                chrome.tabs.create({ url: 'index.html' });
            }
        });
        // 清除通知
        chrome.notifications.clear(notificationId);
    } else if (notificationId.startsWith('task-due-')) {
        // 任务到期通知点击 → 打开工作台并进入专注模式
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
            taskTitle: pomodoroState.taskTitle || '',
            duration: pomodoroState.duration,
            restDuration: pomodoroState.restDuration,
            type: pomodoroState.type,
            startedAt: pomodoroState.phaseStartAt,
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
 * 优先通过长连接端口（port.postMessage）广播，无连接时回退到 sendMessage。
 * 额外携带 phaseStartAt / phaseTotalSeconds，供页面端在 SW 休眠时本地推算倒计时。
 */
function broadcastPomodoroState() {
    var remaining = pomodoroState.active ? computeRemaining() : pomodoroState.remaining;
    var state = {
        active: pomodoroState.active,
        remaining: remaining,
        duration: pomodoroState.duration,
        restDuration: pomodoroState.restDuration,
        type: pomodoroState.type,
        isResting: pomodoroState.isResting,
        autoCycle: pomodoroState.autoCycle,
        sessionCount: pomodoroState.sessionCount,
        formatted: formatTime(remaining),
        phaseStartAt: pomodoroState.phaseStartAt,
        phaseTotalSeconds: pomodoroState.phaseTotalSeconds
    };
    var msg = { type: 'POMODORO_STATE', data: state };

    // 优先通过长连接端口广播（无序列化开销，性能更好）
    if (pomodoroPorts.length > 0) {
        pomodoroPorts = pomodoroPorts.filter(function (port) {
            try {
                port.postMessage(msg);
                return true;
            } catch (_) {
                return false; // 端口已断开，移除
            }
        });
    } else {
        // 无活跃端口时回退到 sendMessage（兼容旧页面或未建立连接的情况）
        chrome.runtime.sendMessage(msg).catch(function () {
            // 无监听者，忽略
        });
    }
}

/* ===== 番茄钟长连接管理 =====
   页面端通过 chrome.runtime.connect({ name: 'pomodoro' }) 建立长连接，
   之后每秒广播通过 port.postMessage 推送，替代高频 sendMessage 减少开销。 */
chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'pomodoro') return;
    pomodoroPorts.push(port);
    console.log('[Background] 番茄钟长连接已建立，当前端口数:', pomodoroPorts.length);

    port.onDisconnect.addListener(function () {
        pomodoroPorts = pomodoroPorts.filter(function (p) { return p !== port; });
        console.log('[Background] 番茄钟长连接已断开，剩余端口数:', pomodoroPorts.length);
    });
});

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

/* ===== 任务到期通知 ===== */

/** 任务到期通知已发送的任务 ID 集合（避免同一轮次重复通知） */
var _taskDueNotified = {};

/**
 * 检查四象限任务是否即将到期，发送 Chrome 通知。
 * 由 chrome.alarms('task-due-check', { periodInMinutes: 15 }) 触发。
 *
 * 逻辑：
 *   1. 读取 chrome.storage.local 中的 v2/tasks（四象限任务数据）
 *   2. 读取 localStorage 中的 taskNotifySettings（通知开关 + 提前分钟数）
 *   3. 遍历任务，检查 dueDate 是否在接下来 remindBefore 分钟内到期且未完成
 *   4. 符合条件的任务发送 chrome.notifications
 */
async function checkTaskDueNotifications() {
    try {
        // 读取通知设置（localStorage 在 SW 中不可用，改为从 chrome.storage.local 读取）
        var notifyResult = await chrome.storage.local.get('v2/taskNotifySettings');
        var notifySettings = notifyResult['v2/taskNotifySettings'];
        if (!notifySettings || !notifySettings.enabled) return;

        var remindBefore = notifySettings.remindBefore || 15; // 提前分钟数

        // 读取任务数据
        var tasksResult = await chrome.storage.local.get('v2/tasks');
        var tasks = tasksResult['v2/tasks'];
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return;

        var now = Date.now();
        var checkWindow = remindBefore * 60 * 1000; // 检查窗口（毫秒）

        tasks.forEach(function (task) {
            // 只检查活跃任务（未完成/未取消）
            if (task.status !== 'active') return;

            // 必须有截止时间
            if (!task.dueDate && !task.plannedAt) return;

            var dueTime = task.dueDate ? new Date(task.dueDate).getTime() : task.plannedAt;
            if (!dueTime || isNaN(dueTime)) return;

            // 检查是否在通知窗口内（即将到期）
            var remaining = dueTime - now;
            if (remaining > 0 && remaining <= checkWindow) {
                // 避免重复通知（同一任务在同一轮次只通知一次）
                if (_taskDueNotified[task.id]) return;
                _taskDueNotified[task.id] = true;

                var minutesLeft = Math.round(remaining / 60000);
                var title = (task.title || '').slice(0, 40);
                var notificationId = 'task-due-' + task.id;

                sendPomodoroNotification(notificationId, {
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: '\u23F0 \u4EFB\u52A1\u5373\u5C06\u5230\u671F',
                    message: '\u300C' + title + '\u300D\u8FD8\u6709 ' + minutesLeft + ' \u5206\u949F\u5230\u671F',
                    priority: 2,
                    requireInteraction: true
                });

                console.log('[Background] 任务到期通知: ' + title + ' 剩余' + minutesLeft + '分钟');
            } else if (remaining <= 0) {
                // 已超期，也通知一次
                if (_taskDueNotified[task.id]) return;
                _taskDueNotified[task.id] = true;

                var title2 = (task.title || '').slice(0, 40);
                var notificationId2 = 'task-due-' + task.id;

                sendPomodoroNotification(notificationId2, {
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: '\u26A0\uFE0F \u4EFB\u52A1\u5DF2\u8D85\u671F',
                    message: '\u300C' + title2 + '\u300D\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5C3D\u5FEB\u5904\u7406',
                    priority: 2,
                    requireInteraction: true
                });

                console.log('[Background] 任务超期通知: ' + title2);
            }
        });
    } catch (e) {
        console.warn('[Background] 任务到期检查失败:', e);
    }
}

/** 注册任务到期检查 alarm（每 15 分钟触发一次） */
try {
    chrome.alarms.create('task-due-check', { periodInMinutes: 15 });
    console.log('[Background] 已注册任务到期检查 alarm（每15分钟）');
} catch (e) {
    console.warn('[Background] 注册任务到期 alarm 失败:', e);
}

// 启动时尝试恢复番茄钟状态（兜底，覆盖 onStartup 未触发的情况）
restorePomodoroState();

console.log('[Background] Service Worker 已启动');
