/**
 * DevHome Workbench - 日程倒计时卡片
 * 用户输入目标日期+标题，实时显示剩余天数+进度条。
 * 数据持久化到 localStorage('countdowns')。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 倒计时数据管理 ===== */

    /**
     * 读取倒计时列表
     * @returns {Array<{id:string, title:string, targetDate:string, createdAt:string}>}
     */
    ns.getCountdowns = function () {
        try {
            const raw = localStorage.getItem('countdowns');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('[倒计时] 读取数据失败', e);
            return [];
        }
    };

    /**
     * 保存倒计时列表
     * @param {Array} list
     */
    ns.saveCountdowns = function (list) {
        try {
            localStorage.setItem('countdowns', JSON.stringify(list));
            console.log('[倒计时] 数据已保存 ' + list.length + ' 条');
        } catch (e) {
            console.error('[倒计时] 保存数据失败', e);
        }
    };

    /* ===== 计算逻辑 ===== */

    /**
     * 计算剩余天数和进度
     * @param {string} targetDate - ISO 日期字符串 "YYYY-MM-DD"
     * @param {string} createdAt - ISO 日期字符串，用于计算总天数（进度分母）
     * @returns {{days: number, progress: number, isOverdue: boolean}}
     */
    ns.calcCountdown = function (targetDate, createdAt) {
        const now = new Date();
        const target = new Date(targetDate + 'T00:00:00');
        const diff = target - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        // 进度：从创建日到目标日，计算已过去比例
        let progress = 100;
        if (createdAt) {
            const start = new Date(createdAt);
            const total = target - start;
            if (total > 0) {
                const elapsed = now - start;
                progress = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
            }
        }

        return {
            days: Math.max(0, days),
            progress: progress,
            isOverdue: diff < 0
        };
    };

    /**
     * 格式化日期为中文显示
     * @param {string} dateStr - "YYYY-MM-DD"
     * @returns {string} - "2026年1月29日"
     */
    function formatDate(dateStr) {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return parseInt(parts[0]) + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
    }

    /* ===== DOM 渲染 ===== */

    /** 倒计时更新定时器 ID */
    let _countdownTimer = null;

    /**
     * 渲染单个倒计时卡片
     * @param {Object} cd - 倒计时数据
     * @returns {HTMLElement}
     */
    function renderCountdownCard(cd) {
        const result = ns.calcCountdown(cd.targetDate, cd.createdAt);
        const targetDateFormatted = formatDate(cd.targetDate);

        const card = document.createElement('div');
        card.className = 'countdown-card';
        card.dataset.countdownId = cd.id;

        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'countdown-delete-btn';
        deleteBtn.innerHTML = '&#x2715;';  // ×
        deleteBtn.title = '删除此倒计时';
        deleteBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            ns.deleteCountdown(cd.id);
        });
        card.appendChild(deleteBtn);

        // 标题行
        const titleEl = document.createElement('div');
        titleEl.className = 'countdown-title';
        const icon = document.createElement('span');
        icon.className = 'countdown-title-icon';
        icon.textContent = result.isOverdue ? '\u23F0' : '\u2728';  // 闹钟 / 星星
        titleEl.appendChild(icon);
        const titleText = document.createElement('span');
        titleText.textContent = cd.title || '目标日';
        titleEl.appendChild(titleText);
        card.appendChild(titleEl);

        if (result.isOverdue) {
            // 已过期：显示红色过期标签
            const daysEl = document.createElement('div');
            daysEl.className = 'countdown-days overdue';
            daysEl.textContent = '已过期';
            card.appendChild(daysEl);

            const overdueBadge = document.createElement('div');
            overdueBadge.className = 'countdown-overdue-badge';
            overdueBadge.textContent = '\u26A0\uFE0F ' + targetDateFormatted;  // 警告 + 目标日期
            card.appendChild(overdueBadge);
        } else {
            // 未过期：显示剩余天数
            const daysEl = document.createElement('div');
            daysEl.className = 'countdown-days';
            daysEl.textContent = result.days;
            card.appendChild(daysEl);

            const labelEl = document.createElement('div');
            labelEl.className = 'countdown-label';
            labelEl.textContent = result.days === 0 ? '就在今天！' : '天后';
            card.appendChild(labelEl);

            // 进度条
            const progressWrap = document.createElement('div');
            progressWrap.className = 'countdown-progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'countdown-progress-bar';
            progressBar.style.width = result.progress + '%';
            progressWrap.appendChild(progressBar);
            card.appendChild(progressWrap);
        }

        // 目标日期
        const dateEl = document.createElement('div');
        dateEl.className = 'countdown-target-date';
        dateEl.textContent = '目标：' + targetDateFormatted;
        card.appendChild(dateEl);

        return card;
    }

    /**
     * 刷新所有倒计时卡片（重新渲染）
     */
    function refreshCountdownUI() {
        let root = document.getElementById('countdownRoot');
        if (!root) {
            console.warn('[倒计时] #countdownRoot 不存在');
            return;
        }

        let list = ns.getCountdowns();

        // 清空旧内容
        root.innerHTML = '';

        if (list.length === 0) {
            // 空状态：仅显示添加按钮
            const addBtn = document.createElement('button');
            addBtn.className = 'countdown-add-btn';
            addBtn.textContent = '+';
            addBtn.title = '添加倒计时';
            addBtn.addEventListener('click', ns.showAddCountdown);
            root.appendChild(addBtn);
            console.log('[倒计时] 空状态 显示添加按钮');
            return;
        }

        // 渲染每个倒计时卡片
        for (let i = 0; i < list.length; i++) {
            const card = renderCountdownCard(list[i]);
            root.appendChild(card);
        }

        // 最下方添加新的倒计时按钮（小号 + 号在卡片底部）
        const addBtn = document.createElement('button');
        addBtn.className = 'countdown-add-btn';
        addBtn.textContent = '+';
        addBtn.title = '添加倒计时';
        addBtn.style.cssText = 'position:static;margin-top:8px;';
        addBtn.addEventListener('click', ns.showAddCountdown);
        root.appendChild(addBtn);

        console.log('[倒计时] 渲染 ' + list.length + ' 条倒计时');
    }

    /* ===== 添加/删除操作 ===== */

    /**
     * 显示添加倒计时弹窗
     * 使用原生 DOM 创建表单弹窗（与项目现有的确认弹窗风格一致）
     */
    ns.showAddCountdown = function () {
        console.log('[倒计时] 打开添加倒计时弹窗');

        // 构建表单弹窗
        const overlay = document.createElement('div');
        overlay.className = 'wb-confirm-overlay';
        overlay.id = 'countdownFormOverlay';

        let panel = document.createElement('div');
        panel.className = 'wb-confirm-panel';
        panel.style.cssText = 'max-width:360px;';

        let title = document.createElement('div');
        title.className = 'wb-confirm-title';
        title.textContent = '添加倒计时';

        const form = document.createElement('div');
        form.className = 'wb-confirm-message';
        form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        // 标题输入
        const titleLabel = document.createElement('label');
        titleLabel.textContent = '标题';
        titleLabel.style.cssText = 'font-size:12px;color:var(--color-text-secondary);font-weight:500;';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = '例如：春节、生日、项目截止...';
        titleInput.style.cssText = 'width:100%;padding:8px 12px;border:1px solid var(--color-input-border);border-radius:8px;background:var(--color-input-bg);color:var(--color-text);font-size:14px;outline:none;';
        titleInput.addEventListener('focus', function () {
            this.style.borderColor = 'var(--color-accent)';
        });
        titleInput.addEventListener('blur', function () {
            this.style.borderColor = 'var(--color-input-border)';
        });

        // 日期输入
        const dateLabel = document.createElement('label');
        dateLabel.textContent = '目标日期';
        dateLabel.style.cssText = 'font-size:12px;color:var(--color-text-secondary);font-weight:500;margin-top:4px;';
        let dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.cssText = 'width:100%;padding:8px 12px;border:1px solid var(--color-input-border);border-radius:8px;background:var(--color-input-bg);color:var(--color-text);font-size:14px;outline:none;';
        dateInput.addEventListener('focus', function () {
            this.style.borderColor = 'var(--color-accent)';
        });
        dateInput.addEventListener('blur', function () {
            this.style.borderColor = 'var(--color-input-border)';
        });

        form.appendChild(titleLabel);
        form.appendChild(titleInput);
        form.appendChild(dateLabel);
        form.appendChild(dateInput);

        // 按钮行
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'wb-confirm-cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '添加';
        confirmBtn.className = 'wb-confirm-confirm';

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);

        panel.appendChild(title);
        panel.appendChild(form);
        panel.appendChild(actions);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // 自动聚焦标题输入
        setTimeout(function () { titleInput.focus(); }, 100);

        // 关闭函数
        function closeOverlay() {
            if (overlay.parentNode) {
                overlay.remove();
                console.log('[倒计时] 关闭添加弹窗');
            }
        }

        // 确认添加
        function confirmAdd() {
            let title = titleInput.value.trim();
            const date = dateInput.value;

            if (!title) {
                ns.showToast('请输入标题', 'error');
                return;
            }
            if (!date) {
                ns.showToast('请选择目标日期', 'error');
                return;
            }

            let list = ns.getCountdowns();
            const newItem = {
                id: 'cd_' + Date.now(),
                title: title,
                targetDate: date,
                createdAt: new Date().toISOString().split('T')[0]
            };
            list.push(newItem);
            ns.saveCountdowns(list);

            closeOverlay();
            refreshCountdownUI();
            ns.showToast('倒计时已添加', 'success');
            console.log('[倒计时] 添加成功 ' + title + ' ' + date);
        }

        cancelBtn.addEventListener('click', closeOverlay);
        confirmBtn.addEventListener('click', confirmAdd);

        // 点击遮罩关闭
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeOverlay();
        });

        // Enter 键确认
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') confirmAdd();
            if (e.key === 'Escape') closeOverlay();
        });

        // 日期输入 Enter 也确认
        dateInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') confirmAdd();
            if (e.key === 'Escape') closeOverlay();
        });
    };

    /**
     * 删除指定倒计时
     * @param {string} id
     */
    ns.deleteCountdown = function (id) {
        // 使用项目的确认弹窗
        if (typeof ns.showConfirm === 'function') {
            ns.showConfirm('确定要删除这个倒计时吗？', {
                title: '删除倒计时',
                confirmLabel: '删除',
                danger: true
            }).then(function (confirmed) {
                if (confirmed) {
                    _doDelete(id);
                }
            });
        } else {
            // 回退：直接删除
            _doDelete(id);
        }
    };

    function _doDelete(id) {
        let list = ns.getCountdowns();
        const filtered = list.filter(function (item) { return item.id !== id; });
        ns.saveCountdowns(filtered);
        refreshCountdownUI();
        console.log('[倒计时] 已删除 ' + id);
    }

    /* ===== 初始化 ===== */

    /**
     * 初始化倒计时模块
     * 在 boot() 中调用，渲染卡片并启动定时刷新
     */
    ns.initCountdown = function () {
        console.log('[倒计时] 初始化开始');

        // 确保 DOM 容器存在
        let root = document.getElementById('countdownRoot');
        if (!root) {
            // 动态创建容器
            root = document.createElement('div');
            root.id = 'countdownRoot';
            document.body.appendChild(root);
            console.log('[倒计时] 动态创建 #countdownRoot');
        }

        // 首次渲染
        refreshCountdownUI();

        // 每分钟刷新一次（天级别精度足够）
        if (_countdownTimer) clearInterval(_countdownTimer);
        _countdownTimer = setInterval(refreshCountdownUI, 60000);

        console.log('[倒计时] 初始化完成');
    };

})(window.DevHome);
