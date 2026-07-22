/**
 * DevHome Workbench - 番茄钟控制
 * 从 workbench.js 拆分，职责：番茄钟开始/暂停/重置、模式切换、显示更新、后台状态同步
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;

    /* ===== 辅助函数 ===== */

    /** 更新番茄钟时间显示（侧边栏 + 顶部工具栏同步） */
    function _pomoUpdateTimeEls(textFn) {
        const text = textFn();
        const timeEl = document.getElementById('wbPomodoroSideTime');
        if (timeEl) timeEl.textContent = text;
        // v5: 同步顶部工具栏时间
        const topTime = document.getElementById('wbPomodoroTopTime');
        if (topTime) topTime.textContent = text;
    }

    /** v5: 同步顶部工具栏运行状态 */
    function _pomoSyncToolbarActive(isActive, isResting, taskTitle) {
        const top = document.getElementById('wbPomodoroTop');
        const topStart = document.getElementById('wbPomodoroTopStart');
        if (top) {
            top.classList.toggle('pomodoro-active', isActive);
            if (isResting) top.classList.toggle('pomodoro-resting', true);
            else top.classList.remove('pomodoro-resting');
        }
        if (topStart) {
            topStart.textContent = isActive ? '⏸' : '▶';
        }
        const topTask = document.getElementById('wbPomodoroTopTask');
        if (topTask) {
            topTask.textContent = taskTitle || '';
        }
        // 运行时时间不显示为 --:--，无状态时重置
        if (!isActive) {
            const topTime = document.getElementById('wbPomodoroTopTime');
            if (topTime && !topTime.textContent.match(/^\d/)) topTime.textContent = '--:--';
        }
    }

    /** 设置进度环偏移 */
    function _pomoUpdateProgress(offset, total) {
        let el = document.getElementById('wbPomodoroSideProgress');
        const circumference = 402.12; // r=64 → 2*PI*64
        if (el) el.setAttribute('stroke-dashoffset', String(offset * circumference / total));
    }

    /** 格式化秒数为 MM:SS */
    function _formatTime(seconds) {
        let m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    /** 停止正计时本地定时器 */
    function _stopCountUpTimer() {
        if (state._pomodoroCountUpTimer) {
            clearInterval(state._pomodoroCountUpTimer);
            state._pomodoroCountUpTimer = null;
        }
    }

    /* ===== 模式与时长切换 ===== */

    /** 切换倒计时/正计时模式 */
    ns.togglePomodoroMode = function (mode) {
        state.pomodoroCountUp = (mode === 'countup');
        document.querySelectorAll('.wb-pomodoro-mode-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        // 正计时模式下隐藏快捷按钮，倒计时模式显示
        const quickRow = document.querySelector('.wb-pomodoro-sidebar-quick');
        if (quickRow) quickRow.style.display = mode === 'countup' ? 'none' : '';
        ns.updatePomodoroDisplay();
        console.log('[模式] 番茄钟切换到' + (mode === 'countup' ? '正计时' : '倒计时'));
    };

    /** 切换自动循环开关 */
    ns.togglePomodoroAutoCycle = function () {
        state.pomodoroAutoCycle = !state.pomodoroAutoCycle;
        const btn = document.getElementById('wbPomodoroAutoCycleBtn');
        if (btn) {
            btn.classList.toggle('active', state.pomodoroAutoCycle);
            btn.textContent = state.pomodoroAutoCycle ? '循环中' : '单次';
        }
        console.log('[模式] 自动循环 ' + (state.pomodoroAutoCycle ? '开启' : '关闭'));
    };

    /** 修改休息时长 */
    ns.setPomodoroRestDuration = function (minutes) {
        let m = parseInt(minutes) || 5;
        m = Math.max(1, Math.min(30, m));
        state.pomodoroRestDuration = m;
        const input = document.getElementById('wbPomodoroRestInput');
        if (input) input.value = m;
        console.log('[编辑] 休息时长设为 ' + m + ' 分钟');
    };

    /** 设置番茄钟时长 */
    ns.setPomodoroDuration = function (duration) {
        state.pomodoroDuration = duration;
        // 更新快捷圆形按钮 active 状态
        document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
            btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
        });
        ns.updatePomodoroDisplay();
    };

    /* ===== 显示更新 ===== */

    ns.updatePomodoroDisplay = function () {
        if (state.pomodoroCountUp) {
            _pomoUpdateTimeEls(function () { return '00:00'; });
        } else {
            const text = String(state.pomodoroDuration).padStart(2, '0') + ':00';
            _pomoUpdateTimeEls(function () { return text; });
        }
        const labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '准备开始';
        _pomoUpdateProgress(0, 100);
    };

    /** 渲染番茄钟任务选择器下拉 */
    ns.renderPomodoroTaskSelector = function () {
        const sel = document.getElementById('wbPomodoroTaskSelect');
        if (!sel) return;
        const config = ns.getWorkbenchState();
        let options = '<option value="">无关联</option>';
        const qLabels = { q1: '重急', q2: '重缓', q3: '轻急', q4: '轻缓' };
        ns.forEachQuadrant(function (q) {
            let tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
            tasks.forEach(function (t) {
                if (t.status === 'active') {
                    options += '<option value="' + t.id + '">[' + qLabels[q] + '] ' + ns.escapeHtml(t.title.slice(0, 20)) + '</option>';
                }
            });
        });
        const currentVal = sel.value;
        sel.innerHTML = options;
        if (currentVal) {
            // 保持之前的选择（如果该任务仍存在）
            const exists = sel.querySelector('option[value="' + currentVal + '"]');
            if (exists) sel.value = currentVal;
        }
        sel.addEventListener('change', function () {
            state._pomodoroTaskId = sel.value || null;
            console.log('[编辑] 番茄钟关联任务 ' + (state._pomodoroTaskId || '无'));
        });
    };

    /* ===== 番茄钟控制 ===== */

    /** 启动番茄钟，支持直接传入时长参数 */
    ns.startPomodoro = function (duration) {
        // 如果传入时长，先设置
        if (typeof duration === 'number' && duration > 0) {
            state.pomodoroDuration = duration;
            document.querySelectorAll('.wb-pomodoro-quick-btn').forEach(function (btn) {
                btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
            });
        }

        // 停止旧的正计时定时器
        _stopCountUpTimer();

        // 正计时模式：启动本地 count-up 定时器
        if (state.pomodoroCountUp) {
            state._pomodoroCountUpSeconds = 0;
            _pomoUpdateTimeEls(function () { return '00:00'; });
            _pomoUpdateProgress(100, 100); // 空环
            state._pomodoroCountUpTimer = setInterval(function () {
                state._pomodoroCountUpSeconds = (state._pomodoroCountUpSeconds || 0) + 1;
                const s = state._pomodoroCountUpSeconds;
                _pomoUpdateTimeEls(function () { return _formatTime(s); });
                // 进度环：以2小时为上限从空到满
                let progress = Math.min(s / 7200, 1);
                _pomoUpdateProgress((1 - progress) * 100, 100);
            }, 1000);
        }

        // 通知后台 service worker（倒计时需要，正计时发送大时长用于通知节点）
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            const taskId = state._pomodoroTaskId || null;
            let taskTitle = '';
            if (taskId) {
                const config = ns.getWorkbenchState();
                ns.forEachQuadrant(function (q) {
                    let tasks = (config.quadrants[q] && config.quadrants[q].tasks) || [];
                    tasks.forEach(function (t) {
                        if (t.id === taskId) taskTitle = t.title;
                    });
                });
            }
            chrome.runtime.sendMessage({
                type: 'POMODORO_START',
                data: {
                    duration: state.pomodoroCountUp ? 999 : state.pomodoroDuration,
                    restDuration: state.pomodoroRestDuration,
                    type: state.pomodoroMode,
                    countUp: state.pomodoroCountUp,
                    autoCycle: state.pomodoroAutoCycle,
                    taskId: taskId,
                    taskTitle: taskTitle
                }
            });
        }
        const modeLabel = state.pomodoroCountUp ? '正计时' : (state.pomodoroDuration + '分');
        console.log('[交互] 番茄钟 开始 ' + modeLabel);
        const sideStart = document.getElementById('wbPomodoroSideStart');
        const sideReset = document.getElementById('wbPomodoroSideReset');
        if (sideStart) { sideStart.textContent = '暂停'; sideStart.classList.add('is-running'); }
        if (sideReset) sideReset.style.display = '';
        const labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '专注中...';
        // v5: 同步顶部工具栏运行状态
        _pomoSyncToolbarActive(true, false, taskTitle);
    };

    ns.pausePomodoro = function () {
        console.log('[交互] 番茄钟 暂停');
        _stopCountUpTimer();
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_PAUSE' });
        }
        const sideStart = document.getElementById('wbPomodoroSideStart');
        if (sideStart) { sideStart.textContent = '继续'; sideStart.classList.remove('is-running'); }
        const labelEl = document.getElementById('wbPomodoroLabel');
        if (labelEl) labelEl.textContent = '已暂停';
        // v5: 同步顶部工具栏（非活跃状态）
        _pomoSyncToolbarActive(false, false, '');
    };

    ns.resetPomodoro = function () {
        console.log('[交互] 番茄钟 重置');
        _stopCountUpTimer();
        state._pomodoroCountUpSeconds = 0;
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_STOP' });
        }
        const sideStart = document.getElementById('wbPomodoroSideStart');
        if (sideStart) { sideStart.textContent = '开始'; sideStart.classList.remove('is-running'); }
        ns.updatePomodoroDisplay();
        // v5: 同步顶部工具栏（重置为默认）
        _pomoSyncToolbarActive(false, false, '');
        const topTime = document.getElementById('wbPomodoroTopTime');
        if (topTime) topTime.textContent = '--:--';
    };

    /* ===== 后台番茄钟状态监听（倒计时模式显示更新） =====
       页面端本地自走秒：后台 SW 可能因休眠而停止广播，故此处依据
       phaseStartAt + phaseTotalSeconds 在本地推算剩余时间，保证显示不卡住。 */
    function _pomoApplyState(data) {
        if (state.pomodoroCountUp) return; // 正计时由本地 setInterval 控制
        state._pomodoroLastState = data;

        // 本地推算剩余秒数（SW 休眠时仍可正确倒计时）
        let remaining = data.remaining;
        if (data.active && data.phaseStartAt) {
            remaining = Math.max(0, data.phaseTotalSeconds - Math.floor((Date.now() - data.phaseStartAt) / 1000));
        }

        // 更新休息/工作状态
        state._pomodoroIsResting = data.isResting || false;
        state._pomodoroSessionCount = data.sessionCount || 0;

        const modeEl = document.getElementById('wbPomodoroModeLabel');

        // 番茄钟停止（非自动循环模式主动停止）
        if (!data.active && remaining <= 0) {
            const sideStart = document.getElementById('wbPomodoroSideStart');
            if (sideStart) { sideStart.textContent = '开始'; sideStart.classList.remove('is-running'); }
            if (modeEl) { modeEl.textContent = ''; modeEl.className = 'wb-pomodoro-mode-label'; }
            _stopPomodoroDisplayTimer();
            ns.updatePomodoroDisplay();
            // v5: 同步顶部工具栏为停止状态
            _pomoSyncToolbarActive(false, false, '');
            return;
        }

        // 更新模式标签
        if (modeEl && data.active) {
            const sessionInfo = data.sessionCount > 0 ? ' #' + data.sessionCount : '';
            modeEl.textContent = data.isResting ? '休息中' + sessionInfo : '工作中' + sessionInfo;
            modeEl.className = 'wb-pomodoro-mode-label ' + (data.isResting ? 'resting' : 'working');
        }

        // 更新时间和进度环
        _pomoUpdateTimeEls(function () { return _formatTime(remaining); });
        const phaseDuration = data.isResting ? data.restDuration : data.duration;
        const total = phaseDuration * 60;
        if (total > 0) {
            _pomoUpdateProgress(remaining / total * 100, 100);
        }
        // v5: 同步顶部工具栏运行状态（运行时）
        if (data.active) {
            _pomoSyncToolbarActive(true, data.isResting || false, data.taskTitle || '');
        }
    }

    function _stopPomodoroDisplayTimer() {
        if (state._pomodoroDisplayTimer) {
            clearInterval(state._pomodoroDisplayTimer);
            state._pomodoroDisplayTimer = null;
        }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(function (message) {
            if (message.type !== 'POMODORO_STATE' || !message.data) return;
            const data = message.data;

            // 启动/停止本地自走秒定时器（仅运行期间）
            if (data.active && !state._pomodoroDisplayTimer) {
                state._pomodoroDisplayTimer = setInterval(function () {
                    if (state._pomodoroLastState) _pomoApplyState(state._pomodoroLastState);
                }, 1000);
            } else if (!data.active && state._pomodoroDisplayTimer) {
                _stopPomodoroDisplayTimer();
            }

            _pomoApplyState(data);
        });
    }

})(window.DevHome);
