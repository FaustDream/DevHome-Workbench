/**
 * bg 子模块 — 任务到期通知
 * 职责：定期检查四象限任务到期情况，发送 Chrome 通知
 * 依赖：_pomodoro-core.js（sendPomodoroNotification）
 */
'use strict';

const _taskDueNotified = {};

/**
 * 检查四象限任务是否即将到期，发送 Chrome 通知。
 * 由 chrome.alarms('task-due-check', { periodInMinutes: 15 }) 触发。
 */
async function checkTaskDueNotifications() {
    try {
        const notifyResult = await chrome.storage.local.get('v2/taskNotifySettings');
        const notifySettings = notifyResult['v2/taskNotifySettings'];
        if (!notifySettings || !notifySettings.enabled) return;

        const remindBefore = notifySettings.remindBefore || 15;
        const tasksResult = await chrome.storage.local.get('v2/tasks');
        let tasks = tasksResult['v2/tasks'];
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return;

        const now = Date.now();
        const checkWindow = remindBefore * 60 * 1000;

        tasks.forEach(function (task) {
            if (task.status !== 'active') return;
            if (!task.dueDate && !task.plannedAt) return;

            const dueTime = task.dueDate ? new Date(task.dueDate).getTime() : task.plannedAt;
            if (!dueTime || isNaN(dueTime)) return;

            let remaining = dueTime - now;
            if (remaining > 0 && remaining <= checkWindow) {
                if (_taskDueNotified[task.id]) return;
                _taskDueNotified[task.id] = true;
                const minutesLeft = Math.round(remaining / 60000);
                let title = (task.title || '').slice(0, 40);
                sendPomodoroNotification('task-due-' + task.id, {
                    type: 'basic', iconUrl: 'icons/icon128.png',
                    title: '\u23F0 \u4EFB\u52A1\u5373\u5C06\u5230\u671F',
                    message: '\u300C' + title + '\u300D\u8FD8\u6709 ' + minutesLeft + ' \u5206\u949F\u5230\u671F',
                    priority: 2, requireInteraction: true
                });
                console.log('[后台] 任务到期通知: ' + title + ' 剩余' + minutesLeft + '分钟');
            } else if (remaining <= 0) {
                if (_taskDueNotified[task.id]) return;
                _taskDueNotified[task.id] = true;
                const title2 = (task.title || '').slice(0, 40);
                sendPomodoroNotification('task-due-' + task.id, {
                    type: 'basic', iconUrl: 'icons/icon128.png',
                    title: '\u26A0\uFE0F \u4EFB\u52A1\u5DF2\u8D85\u671F',
                    message: '\u300C' + title2 + '\u300D\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5C3D\u5FEB\u5904\u7406',
                    priority: 2, requireInteraction: true
                });
                console.log('[后台] 任务超期通知: ' + title2);
            }
        });
    } catch (e) {
        console.warn('[后台] 任务到期检查失败:', e);
    }
}
