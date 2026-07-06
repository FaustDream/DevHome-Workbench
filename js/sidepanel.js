/**
 * DevHome Workbench v2 - 侧边栏逻辑
 *
 * 职责：
 *   1. 快速捕获输入
 *   2. 最近捕获/笔记列表
 *   3. 番茄钟状态条
 *   4. 监听后台消息（新剪藏、番茄钟状态更新）
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var storageV2 = ns.storageV2;
    var dom = {};

    /* ===== DOM 缓存 ===== */
    function cacheDom() {
        dom.captureInput = document.getElementById('spCaptureInput');
        dom.captureList = document.getElementById('spCaptureList');
        dom.notesList = document.getElementById('spNotesList');
        dom.pomodoroTime = document.getElementById('spPomodoroTime');
        dom.pomodoroLabel = document.getElementById('spPomodoroLabel');
        dom.pomodoroToggle = document.getElementById('spPomodoroToggle');
    }

    /* ===== 加载数据 ===== */
    async function loadData() {
        try {
            var captures = await storageV2.get(storageV2.KEYS.CAPTURES, []);
            renderCaptures(captures.slice(0, 5));

            var notes = await storageV2.get(storageV2.KEYS.NOTES, []);
            renderNotes(notes.slice(0, 5));
        } catch (e) {
            console.warn('[SidePanel] 数据加载失败:', e);
        }
    }

    /* ===== 渲染捕获列表 ===== */
    function renderCaptures(captures) {
        if (!dom.captureList) return;
        if (!captures || captures.length === 0) {
            dom.captureList.innerHTML = '<div class="sp-empty">还没有捕获</div>';
            return;
        }
        dom.captureList.innerHTML = captures.map(function (c) {
            var time = new Date(c.createdAt);
            var timeStr = String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
            return '<div class="sp-list-item">' +
                '<span class="sp-list-item-time">' + timeStr + '</span> ' +
                escapeHtml(c.content.slice(0, 60)) +
                '</div>';
        }).join('');
    }

    /* ===== 渲染笔记列表 ===== */
    function renderNotes(notes) {
        if (!dom.notesList) return;
        if (!notes || notes.length === 0) {
            dom.notesList.innerHTML = '<div class="sp-empty">还没有笔记</div>';
            return;
        }
        dom.notesList.innerHTML = notes.map(function (n) {
            var icon = n.type === 'webclip' ? '🔗' : '📝';
            return '<div class="sp-list-item">' +
                icon + ' ' + escapeHtml(n.title.slice(0, 40)) +
                '</div>';
        }).join('');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ===== 快速捕获 ===== */
    function handleCaptureInput(e) {
        if (e.key !== 'Enter') return;
        var val = dom.captureInput.value.trim();
        if (!val) return;
        dom.captureInput.value = '';

        storageV2.get(storageV2.KEYS.CAPTURES, []).then(function (captures) {
            captures.unshift({
                id: 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                content: val,
                tags: [],
                createdAt: Date.now()
            });
            return storageV2.set(storageV2.KEYS.CAPTURES, captures);
        }).then(function () {
            return storageV2.get(storageV2.KEYS.CAPTURES, []);
        }).then(function (captures) {
            renderCaptures(captures.slice(0, 5));
        }).catch(function (e) {
            console.warn('[SidePanel] 保存捕获失败:', e);
        });
    }

    /* ===== 番茄钟状态 ===== */
    function handlePomodoroToggle() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_GET_STATE' }, function (response) {
                if (response && response.data) {
                    if (response.data.active) {
                        chrome.runtime.sendMessage({ type: 'POMODORO_PAUSE' });
                    } else if (response.data.remaining > 0) {
                        chrome.runtime.sendMessage({ type: 'POMODORO_RESUME' });
                    }
                }
            });
        }
    }

    /* ===== 监听后台消息 ===== */
    var pomodoroDisplayTimer = null;   // 本地自走秒定时器（SW 休眠时仍保持显示）
    var lastPomodoroState = null;      // 最近一次番茄钟状态快照

    function listenMessages() {
        if (typeof chrome === 'undefined' || !chrome.runtime) return;
        chrome.runtime.onMessage.addListener(function (message) {
            if (message.type === 'NEW_WEBCLIP') {
                // 新剪藏 → 刷新列表
                loadData();
            } else if (message.type === 'POMODORO_STATE') {
                updatePomodoroUI(message.data);
            }
        });
    }

    function stopPomodoroDisplayTimer() {
        if (pomodoroDisplayTimer) { clearInterval(pomodoroDisplayTimer); pomodoroDisplayTimer = null; }
    }

    /** 由状态快照本地推算剩余秒数（不依赖后台每秒广播） */
    function computePomodoroRemaining(data) {
        if (data.active && data.phaseStartAt) {
            return Math.max(0, data.phaseTotalSeconds - Math.floor((Date.now() - data.phaseStartAt) / 1000));
        }
        return data.remaining || 0;
    }

    function updatePomodoroUI(data) {
        if (!data) return;
        lastPomodoroState = data;

        // 运行期间启动本地自走秒，保证 SW 休眠时显示不卡住
        if (data.active && !pomodoroDisplayTimer) {
            pomodoroDisplayTimer = setInterval(function () {
                if (lastPomodoroState) updatePomodoroUI(lastPomodoroState);
            }, 1000);
        } else if (!data.active && pomodoroDisplayTimer) {
            stopPomodoroDisplayTimer();
        }

        var remaining = computePomodoroRemaining(data);
        if (dom.pomodoroTime) {
            var m = Math.floor(remaining / 60);
            var s = remaining % 60;
            dom.pomodoroTime.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }
        if (dom.pomodoroLabel) {
            if (!data.active && remaining <= 0) {
                dom.pomodoroLabel.textContent = '未开始';
            } else if (data.isResting) {
                dom.pomodoroLabel.textContent = '休息中';
            } else if (data.active) {
                dom.pomodoroLabel.textContent = '专注中';
            } else {
                dom.pomodoroLabel.textContent = '已暂停';
            }
        }
    }

    /* ===== 初始化 ===== */
    function init() {
        // 应用主题：设置 data-color-scheme，使侧边栏配色跟随主页面的浅色/深色切换
        if (ns.theme && typeof ns.theme.init === 'function') {
            ns.theme.init();
        }

        cacheDom();
        loadData();
        listenMessages();

        if (dom.captureInput) {
            dom.captureInput.addEventListener('keydown', handleCaptureInput);
        }
        if (dom.pomodoroToggle) {
            dom.pomodoroToggle.addEventListener('click', handlePomodoroToggle);
        }

        // 获取初始番茄钟状态
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'POMODORO_GET_STATE' }, function (response) {
                if (response && response.data) {
                    updatePomodoroUI(response.data);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window.DevHome);
