/**
 * bg 子模块 — 番茄钟状态广播
 * 职责：向所有连接的页面端口广播番茄钟状态，管理长连接生命周期
 * 依赖：_pomodoro-core.js（pomodoroState, computeRemaining, formatTime）
 */
'use strict';

const pomodoroPorts = [];

function broadcastPomodoroState() {
    let remaining = pomodoroState.active ? computeRemaining() : pomodoroState.remaining;
    const state = {
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
    const msg = { type: 'POMODORO_STATE', data: state };

    if (pomodoroPorts.length > 0) {
        pomodoroPorts = pomodoroPorts.filter(function (port) {
            try { port.postMessage(msg); return true; }
            catch (_) { return false; }
        });
    } else {
        chrome.runtime.sendMessage(msg).catch(function () {});
    }
}

/* ===== 长连接管理 ===== */
chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'pomodoro') return;
    pomodoroPorts.push(port);
    console.log('[后台] 番茄钟长连接已建立，当前端口数:', pomodoroPorts.length);
    port.onDisconnect.addListener(function () {
        pomodoroPorts = pomodoroPorts.filter(function (p) { return p !== port; });
        console.log('[后台] 番茄钟长连接已断开，剩余端口数:', pomodoroPorts.length);
    });
});
