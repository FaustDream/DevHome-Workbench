/**
 * 番茄钟事件模块
 * 负责开始/暂停/重置、模式切换（倒计时/正计时）、时长预设、休息时长、自动循环
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindPomodoroEvents = function () {
        var state = ns.state;

        var pomoSideStart = document.getElementById('wbPomodoroSideStart');
        var pomoSideReset = document.getElementById('wbPomodoroSideReset');
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

        var restInput = document.getElementById('wbPomodoroRestInput');
        if (restInput) restInput.addEventListener('change', function () { ns.setPomodoroRestDuration(this.value); });

        var autoCycleBtn = document.getElementById('wbPomodoroAutoCycleBtn');
        if (autoCycleBtn) autoCycleBtn.addEventListener('click', function () { ns.togglePomodoroAutoCycle(); });

        document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var duration = parseInt(btn.dataset.duration);
                ns.setPomodoroDuration(duration);
            });
        });

        // 旧版番茄钟按钮（兼容）
        var pomoStart = document.getElementById('wbPomodoroStart');
        var pomoPause = document.getElementById('wbPomodoroPause');
        var pomoReset = document.getElementById('wbPomodoroReset');
        if (pomoStart) pomoStart.addEventListener('click', ns.startPomodoro);
        if (pomoPause) pomoPause.addEventListener('click', ns.pausePomodoro);
        if (pomoReset) pomoReset.addEventListener('click', ns.resetPomodoro);

        var pomoPresets = document.querySelectorAll('.wb-pomodoro-preset');
        pomoPresets.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var duration = parseInt(btn.dataset.duration, 10);
                if (!isNaN(duration)) ns.setPomodoroDuration(duration);
            });
        });

        var pomoCustom = document.getElementById('wbPomodoroCustom');
        if (pomoCustom) {
            pomoCustom.addEventListener('change', function () {
                var val = parseInt(pomoCustom.value, 10);
                if (val > 0 && val <= 180) ns.setPomodoroDuration(val);
            });
        }

        var modeDefault = document.getElementById('wbPomodoroModeDefault');
        var modeFocus = document.getElementById('wbPomodoroModeFocus');
        if (modeDefault) modeDefault.addEventListener('click', function () { ns.setPomodoroMode('default'); });
        if (modeFocus) modeFocus.addEventListener('click', function () { ns.setPomodoroMode('focus'); });

        var restBtns = document.querySelectorAll('.wb-pomodoro-rest-btn');
        restBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var rest = parseInt(btn.dataset.rest, 10);
                if (!isNaN(rest)) {
                    state.pomodoroRestDuration = rest;
                    restBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
                }
            });
        });
    };

})(window.DevHome);
