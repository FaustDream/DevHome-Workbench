/**
 * 番茄钟事件模块
 * 负责开始/暂停/重置、模式切换（倒计时/正计时）、时长预设、休息时长、自动循环
 * v5 新增：顶部工具栏常驻条事件 + 悬浮面板 hover 行为
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindPomodoroEvents = function () {
        const state = ns.state;

        // ===== 悬浮面板内按钮（ID 未变，仍为 wbPomodoroSideStart/Reset 等） =====
        const pomoSideStart = document.getElementById('wbPomodoroSideStart');
        const pomoSideReset = document.getElementById('wbPomodoroSideReset');
        if (pomoSideStart) {
            pomoSideStart.addEventListener('click', function () {
                if (pomoSideStart.classList.contains('is-running')) {
                    ns.pausePomodoro();
                } else {
                    ns.startPomodoro();
                }
            });
        }
        if (pomoSideReset) pomoSideReset.addEventListener('click', function () { ns.resetPomodoro(); });

        document.querySelectorAll('.wb-pomodoro-mode-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { ns.togglePomodoroMode(btn.dataset.mode); });
        });

        const restInput = document.getElementById('wbPomodoroRestInput');
        if (restInput) restInput.addEventListener('change', function () { ns.setPomodoroRestDuration(this.value); });

        const autoCycleBtn = document.getElementById('wbPomodoroAutoCycleBtn');
        if (autoCycleBtn) autoCycleBtn.addEventListener('click', function () { ns.togglePomodoroAutoCycle(); });

        document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const duration = parseInt(btn.dataset.duration);
                ns.setPomodoroDuration(duration);
            });
        });

        // ===== v5 顶部工具栏常驻条事件 =====
        const pomoTop = document.getElementById('wbPomodoroTop');
        const pomoTopStart = document.getElementById('wbPomodoroTopStart');
        const pomoPopover = document.getElementById('wbPomodoroPopover');

        // 顶部开始按钮：开始/暂停番茄钟
        if (pomoTopStart) {
            pomoTopStart.addEventListener('click', function (e) {
                e.stopPropagation();
                if (pomoTop.classList.contains('pomodoro-active')) {
                    ns.pausePomodoro();
                } else {
                    ns.startPomodoro();
                }
            });
        }

        // 鼠标悬停常驻条 → 显示/隐藏悬浮完整面板
        if (pomoTop && pomoPopover) {
            var hoverTimer = null;
            pomoTop.addEventListener('mouseenter', function () {
                clearTimeout(hoverTimer);
                pomoPopover.style.display = 'block';
                console.log('[面板] 番茄钟悬浮面板 显示');
            });
            pomoTop.addEventListener('mouseleave', function () {
                hoverTimer = setTimeout(function () {
                    pomoPopover.style.display = 'none';
                    console.log('[面板] 番茄钟悬浮面板 隐藏');
                }, 300); // 300ms 延迟，防止抖动
            });
            // 悬浮面板内也保持显示
            pomoPopover.addEventListener('mouseenter', function () {
                clearTimeout(hoverTimer);
            });
            pomoPopover.addEventListener('mouseleave', function () {
                pomoPopover.style.display = 'none';
                console.log('[面板] 番茄钟悬浮面板 隐藏');
            });
        }

        // ===== 旧版番茄钟按钮（兼容） =====
        const pomoStart = document.getElementById('wbPomodoroStart');
        const pomoPause = document.getElementById('wbPomodoroPause');
        const pomoReset = document.getElementById('wbPomodoroReset');
        if (pomoStart) pomoStart.addEventListener('click', ns.startPomodoro);
        if (pomoPause) pomoPause.addEventListener('click', ns.pausePomodoro);
        if (pomoReset) pomoReset.addEventListener('click', ns.resetPomodoro);

        const pomoPresets = document.querySelectorAll('.wb-pomodoro-preset');
        pomoPresets.forEach(function (btn) {
            btn.addEventListener('click', function () {
                const duration = parseInt(btn.dataset.duration, 10);
                if (!isNaN(duration)) ns.setPomodoroDuration(duration);
            });
        });

        const pomoCustom = document.getElementById('wbPomodoroCustom');
        if (pomoCustom) {
            pomoCustom.addEventListener('change', function () {
                const val = parseInt(pomoCustom.value, 10);
                if (val > 0 && val <= 180) ns.setPomodoroDuration(val);
            });
        }

        const modeDefault = document.getElementById('wbPomodoroModeDefault');
        const modeFocus = document.getElementById('wbPomodoroModeFocus');
        if (modeDefault) modeDefault.addEventListener('click', function () { ns.setPomodoroMode('default'); });
        if (modeFocus) modeFocus.addEventListener('click', function () { ns.setPomodoroMode('focus'); });

        const restBtns = document.querySelectorAll('.wb-pomodoro-rest-btn');
        restBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                const rest = parseInt(btn.dataset.rest, 10);
                if (!isNaN(rest)) {
                    state.pomodoroRestDuration = rest;
                    restBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
                }
            });
        });
    };

})(window.DevHome);
