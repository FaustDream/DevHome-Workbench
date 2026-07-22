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

        // ===== v6 顶部工具栏常驻条事件 =====
        const pomoTop = document.getElementById('wbPomodoroTop');
        const pomoTopStart = document.getElementById('wbPomodoroTopStart');

        // 顶部开始按钮：开始/暂停番茄钟
        if (pomoTopStart) {
            pomoTopStart.addEventListener('click', function (e) {
                e.stopPropagation();
                if (pomoTop && pomoTop.classList.contains('pomodoro-active')) {
                    ns.pausePomodoro();
                } else {
                    ns.startPomodoro();
                }
            });
        }

        // ===== v6 悬浮侧边栏：番茄钟图标点击 → 打开悬浮番茄钟面板 =====
        const floatingPomoBtn = document.getElementById('wbFloatingPomodoroBtn');
        const floatingPomoPanel = document.getElementById('wbFloatingPomodoro');
        const floatingPomoClose = document.getElementById('wbFloatingPomodoroClose');
        const floatingQuadBtn = document.getElementById('wbFloatingQuadrantBtn');
        const floatingQuadPanel = document.getElementById('wbFloatingQuadrant');
        const floatingQuadClose = document.getElementById('wbFloatingQuadrantClose');
        const floatingExitBtn = document.getElementById('wbFloatingExitBtn');

        /**
         * 切换悬浮面板的显隐
         * @param {HTMLElement} panel - 目标面板
         * @param {HTMLElement} btn - 关联图标按钮
         * @param {HTMLElement} otherPanel - 另一个需要关闭的面板（互斥）
         * @param {HTMLElement} otherBtn - 另一个需要取消激活的图标
         */
        function _toggleFloatingPanel(panel, btn, otherPanel, otherBtn) {
            if (!panel) return;
            const isVisible = panel.style.display !== 'none' && panel.style.display !== '';
            // 互斥：先关闭另一个面板
            if (otherPanel && !isVisible) {
                otherPanel.style.display = 'none';
                if (otherBtn) otherBtn.classList.remove('active');
            }
            if (isVisible) {
                panel.style.display = 'none';
                if (btn) btn.classList.remove('active');
                console.log('[面板] 关闭', panel.id);
            } else {
                panel.style.display = 'flex';
                if (btn) btn.classList.add('active');
                console.log('[面板] 打开', panel.id);
            }
        }

        if (floatingPomoBtn) {
            floatingPomoBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                _toggleFloatingPanel(floatingPomoPanel, floatingPomoBtn, floatingQuadPanel, floatingQuadBtn);
            });
        }
        if (floatingPomoClose) {
            floatingPomoClose.addEventListener('click', function () {
                if (floatingPomoPanel) floatingPomoPanel.style.display = 'none';
                if (floatingPomoBtn) floatingPomoBtn.classList.remove('active');
                console.log('[面板] 关闭 wbFloatingPomodoro');
            });
        }
        if (floatingQuadBtn) {
            floatingQuadBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                _toggleFloatingPanel(floatingQuadPanel, floatingQuadBtn, floatingPomoPanel, floatingPomoBtn);
            });
        }
        if (floatingQuadClose) {
            floatingQuadClose.addEventListener('click', function () {
                if (floatingQuadPanel) floatingQuadPanel.style.display = 'none';
                if (floatingQuadBtn) floatingQuadBtn.classList.remove('active');
                console.log('[面板] 关闭 wbFloatingQuadrant');
            });
        }
        if (floatingExitBtn) {
            floatingExitBtn.addEventListener('click', function () {
                console.log('[交互] 点击 退出专注');
                ns.showDailyMode();
            });
        }

        // 点击空白处关闭悬浮面板（不冒泡到面板内部）
        document.addEventListener('click', function (e) {
            if (floatingPomoPanel && floatingPomoPanel.style.display !== 'none') {
                if (!floatingPomoPanel.contains(e.target) && !floatingPomoBtn.contains(e.target)) {
                    floatingPomoPanel.style.display = 'none';
                    if (floatingPomoBtn) floatingPomoBtn.classList.remove('active');
                }
            }
            if (floatingQuadPanel && floatingQuadPanel.style.display !== 'none') {
                if (!floatingQuadPanel.contains(e.target) && !floatingQuadBtn.contains(e.target)) {
                    floatingQuadPanel.style.display = 'none';
                    if (floatingQuadBtn) floatingQuadBtn.classList.remove('active');
                }
            }
        });

        // Esc 键关闭悬浮面板
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (floatingPomoPanel && floatingPomoPanel.style.display !== 'none') {
                    floatingPomoPanel.style.display = 'none';
                    if (floatingPomoBtn) floatingPomoBtn.classList.remove('active');
                } else if (floatingQuadPanel && floatingQuadPanel.style.display !== 'none') {
                    floatingQuadPanel.style.display = 'none';
                    if (floatingQuadBtn) floatingQuadBtn.classList.remove('active');
                }
            }
        });

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
