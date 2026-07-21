/**
 * bg 子模块 — 番茄钟核心
 * 职责：定时器状态管理、启动/暂停/恢复/停止、阶段切换、持久化与闹钟
 * 依赖：_quotes.js（激励语句库）、_pomodoro-broadcast.js（状态广播）
 */
'use strict';

/* ===== 番茄钟状态 =====
   说明：Service Worker 随时可能被浏览器休眠/销毁，内存中的 setInterval 不可靠。
   因此状态持久化到 chrome.storage.local，并以「阶段开始时间戳 + 阶段总时长」推导剩余秒数，
   计时与阶段切换交由 chrome.alarms（精确 when）在 SW 唤醒时可靠推进；
   同时保留内存 setInterval 仅用于存活期间向 UI 每秒广播一次。 */
const POMODORO_STORAGE_KEY = 'v2/pomodoro_state';
const pomodoroState = {
    active: false,
    taskId: null,
    taskTitle: '',
    duration: 25,
    restDuration: 5,
    type: 'default',
    isResting: false,
    autoCycle: true,
    sessionCount: 0,
    phaseStartAt: null,
    phaseTotalSeconds: 0,
    remaining: 0
};
let pomodoroTimer = null;
let _phaseEndInProgress = false;

function computeRemaining() {
    if (!pomodoroState.active || !pomodoroState.phaseStartAt) return pomodoroState.remaining;
    const elapsed = Math.floor((Date.now() - pomodoroState.phaseStartAt) / 1000);
    return Math.max(0, pomodoroState.phaseTotalSeconds - elapsed);
}

async function persistPomodoroState() {
    try {
        await chrome.storage.local.set({ [POMODORO_STORAGE_KEY]: pomodoroState });
    } catch (e) {
        console.warn('[后台] 保存番茄钟状态失败:', e);
    }
}

async function restorePomodoroState() {
    try {
        if (_phaseEndInProgress) {
            console.log('[后台][恢复] phaseEnd 进行中，跳过状态恢复');
            return;
        }
        console.log('[后台][恢复] 开始恢复番茄钟状态, key=' + POMODORO_STORAGE_KEY);
        const result = await chrome.storage.local.get(POMODORO_STORAGE_KEY);
        const saved = result[POMODORO_STORAGE_KEY];
        if (!saved) {
            console.log('[后台][恢复] 未发现持久化番茄钟状态，无需恢复');
            return;
        }
        // 合并前快照当前内存状态，便于排查「覆盖异常」类问题
        const before = {
            active: pomodoroState.active,
            remaining: pomodoroState.remaining,
            phaseStartAt: pomodoroState.phaseStartAt
        };
        Object.assign(pomodoroState, saved);
        console.log('[后台][恢复] 已合并持久化状态',
            'active=' + pomodoroState.active,
            'isResting=' + pomodoroState.isResting,
            'type=' + pomodoroState.type,
            'duration=' + pomodoroState.duration,
            'restDuration=' + pomodoroState.restDuration,
            'sessionCount=' + pomodoroState.sessionCount,
            'phaseStartAt=' + pomodoroState.phaseStartAt,
            'phaseTotalSeconds=' + pomodoroState.phaseTotalSeconds,
            'savedRemaining=' + saved.remaining,
            'mergeBefore=' + JSON.stringify(before)
        );
        if (!pomodoroState.active) {
            console.log('[后台][恢复] 恢复状态为未激活(active=false)，不重新启动计时');
            return;
        }
        // 以「阶段开始时间戳 + 阶段总时长」推导剩余秒数，日志打出推导过程便于校验
        const elapsed = pomodoroState.phaseStartAt
            ? Math.floor((Date.now() - pomodoroState.phaseStartAt) / 1000)
            : null;
        pomodoroState.remaining = computeRemaining();
        console.log('[后台][恢复] 计算剩余时长',
            'phaseStartAt=' + pomodoroState.phaseStartAt,
            'elapsed=' + elapsed + 's',
            'phaseTotalSeconds=' + pomodoroState.phaseTotalSeconds,
            'computedRemaining=' + pomodoroState.remaining
        );
        if (pomodoroState.remaining <= 0) {
            console.log('[后台][恢复] 判定剩余<=0，直接进入阶段结束流程');
            await pomodoroPhaseEnd();
        } else {
            startPomodoroTick();
            schedulePomodoroAlarm();
            console.log('[后台][恢复] 恢复番茄钟计时，剩余', formatTime(pomodoroState.remaining));
        }
        console.log('[后台][恢复] 恢复流程完成');
    } catch (e) {
        console.warn('[后台][恢复] 恢复番茄钟状态失败:', e);
    }
}

function startPomodoroTick() {
    if (pomodoroTimer) return;
    pomodoroTimer = setInterval(pomodoroTick, 1000);
}

function stopPomodoroTick() {
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = null; }
}

function schedulePomodoroAlarm() {
    try {
        chrome.alarms.create('pomodoro-phase', {
            when: Date.now() + Math.max(1, pomodoroState.remaining) * 1000
        });
    } catch (e) {
        console.warn('[后台] 安排番茄钟闹钟失败:', e);
    }
}

/* ===== 番茄钟生命周期 ===== */

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
    pomodoroState.autoCycle = params.autoCycle !== false;
    pomodoroState.sessionCount = 0;
    pomodoroState.phaseStartAt = Date.now();
    pomodoroState.phaseTotalSeconds = pomodoroState.duration * 60;
    pomodoroState.remaining = pomodoroState.phaseTotalSeconds;

    startPomodoroTick();
    schedulePomodoroAlarm();
    persistPomodoroState();
    broadcastPomodoroState();
    console.log('[后台] 番茄钟已开始:', pomodoroState.duration + '分钟, 自动循环=' + pomodoroState.autoCycle);
}

function pomodoroTick() {
    if (!pomodoroState.active || _phaseEndInProgress) return;
    pomodoroState.remaining = computeRemaining();
    broadcastPomodoroState();
    if (pomodoroState.remaining <= 0) { pomodoroPhaseEnd(); }
}

async function pomodoroPhaseEnd() {
    if (_phaseEndInProgress) { console.log('[后台] phaseEnd 已在进行中，跳过重复调用'); return; }
    _phaseEndInProgress = true;
    try {
        if (pomodoroState.isResting) {
            pomodoroState.isResting = false;
            pomodoroState.sessionCount = (pomodoroState.sessionCount || 0) + 1;
            pomodoroState.phaseStartAt = Date.now();
            pomodoroState.phaseTotalSeconds = pomodoroState.duration * 60;
            pomodoroState.remaining = pomodoroState.phaseTotalSeconds;
            const restQuote = randomQuote(REST_COMPLETE_QUOTES);
            const taskMsg = pomodoroState.taskTitle ? '\n任务：' + pomodoroState.taskTitle : '';
            await sendPomodoroNotification('pomodoro-rest-done', {
                type: 'basic', iconUrl: 'icons/icon48.png',
                title: '休息结束 — ' + restQuote,
                message: '开始第 ' + (pomodoroState.sessionCount + 1) + ' 轮专注，' + pomodoroState.duration + ' 分钟' + taskMsg,
                priority: 2, requireInteraction: true
            });
            schedulePomodoroAlarm();
            await persistPomodoroState();
            broadcastPomodoroState();
            console.log('[后台] 休息结束，自动开始新一轮工作');
        } else {
            pomodoroState.sessionCount = (pomodoroState.sessionCount || 0) + 1;
            await savePomodoroSession();
            if (pomodoroState.autoCycle) {
                pomodoroState.isResting = true;
                pomodoroState.phaseStartAt = Date.now();
                pomodoroState.phaseTotalSeconds = pomodoroState.restDuration * 60;
                pomodoroState.remaining = pomodoroState.phaseTotalSeconds;
                const workQuote = randomQuote(WORK_COMPLETE_QUOTES);
                const taskMsg2 = pomodoroState.taskTitle ? '\n任务：' + pomodoroState.taskTitle : '';
                const restStartQuote = randomQuote(REST_START_QUOTES);
                await sendPomodoroNotification('pomodoro-done', {
                    type: 'basic', iconUrl: 'icons/icon48.png',
                    title: '工作完成！' + workQuote,
                    message: '休息 ' + pomodoroState.restDuration + ' 分钟 — ' + restStartQuote + taskMsg2,
                    priority: 2, requireInteraction: true
                });
                schedulePomodoroAlarm();
                await persistPomodoroState();
                broadcastPomodoroState();
                console.log('[后台] 第' + pomodoroState.sessionCount + '轮完成，自动进入休息');
            } else {
                stopPomodoroTick();
                chrome.alarms.clear('pomodoro-phase');
                pomodoroState.active = false;
                pomodoroState.remaining = 0;
                pomodoroState.phaseStartAt = null;
                pomodoroState.phaseTotalSeconds = 0;
                const doneQuote = randomQuote(WORK_COMPLETE_QUOTES);
                const taskMsg3 = pomodoroState.taskTitle ? '\n任务：' + pomodoroState.taskTitle : '';
                await sendPomodoroNotification('pomodoro-done', {
                    type: 'basic', iconUrl: 'icons/icon48.png',
                    title: '番茄钟完成！' + doneQuote,
                    message: '你今天已经完成了 ' + pomodoroState.sessionCount + ' 个番茄' + taskMsg3,
                    priority: 2, requireInteraction: true
                });
                await persistPomodoroState();
                broadcastPomodoroState();
            }
        }
    } finally { _phaseEndInProgress = false; }
}

function pausePomodoro() {
    if (!pomodoroState.active) return;
    stopPomodoroTick();
    chrome.alarms.clear('pomodoro-phase');
    pomodoroState.remaining = computeRemaining();
    pomodoroState.active = false;
    persistPomodoroState();
    console.log('[后台] 番茄钟已暂停，剩余:', formatTime(pomodoroState.remaining));
}

function resumePomodoro() {
    if (pomodoroState.active) return;
    if (pomodoroState.remaining <= 0) return;
    pomodoroState.phaseStartAt = Date.now() - (pomodoroState.phaseTotalSeconds - pomodoroState.remaining) * 1000;
    pomodoroState.active = true;
    startPomodoroTick();
    schedulePomodoroAlarm();
    persistPomodoroState();
    console.log('[后台] 番茄钟已恢复');
}

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
    console.log('[后台] 番茄钟已停止');
}

async function savePomodoroSession() {
    try {
        const result = await chrome.storage.local.get('v2/pomodoro_sessions');
        const sessions = result['v2/pomodoro_sessions'] || [];
        sessions.push({
            id: 'pom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            taskId: pomodoroState.taskId, taskTitle: pomodoroState.taskTitle || '',
            duration: pomodoroState.duration, restDuration: pomodoroState.restDuration,
            type: pomodoroState.type, startedAt: pomodoroState.phaseStartAt,
            endedAt: Date.now(), completed: true
        });
        await chrome.storage.local.set({ 'v2/pomodoro_sessions': sessions });
    } catch (e) {
        console.warn('[后台] 保存番茄钟会话失败:', e);
    }
}

function formatTime(seconds) {
    let m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function sendPomodoroNotification(id, options) {
    return new Promise(function (resolve) {
        try {
            chrome.notifications.create(id, options, function (notificationId) {
                if (chrome.runtime.lastError) {
                    console.error('[后台] 通知发送失败:', id, chrome.runtime.lastError.message);
                    resolve(false);
                } else {
                    console.log('[后台] 通知已发送:', id, notificationId);
                    resolve(notificationId);
                }
            });
        } catch (e) {
            console.error('[后台] 通知 API 异常:', id, e.message);
            resolve(false);
        }
    });
}
