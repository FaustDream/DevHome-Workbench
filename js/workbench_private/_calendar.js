/**
 * DevHome Workbench - 日历渲染（迷你/侧栏/详情）
 * 从 workbench.js 拆分，职责：迷你日历、侧栏日历、日期详情
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const escapeHtml = ns.escapeHtml;

    let _calendarDate = new Date();

    ns.navigateCalendar = function (delta) {
        _calendarDate.setMonth(_calendarDate.getMonth() + delta);
        ns.renderCalendar(new Date(_calendarDate));
        ns.renderMiniCalendar(new Date(_calendarDate));
        ns.renderSideCalendar(new Date(_calendarDate));
    };

    ns.renderCalendar = function (date) {
        _calendarDate = new Date(date);
        state.currentCalendarDate = _calendarDate;

        // 右栏迷你日历标题
        const titleEl = document.getElementById('wbCalendarTitle');
        if (titleEl) {
            titleEl.textContent = _calendarDate.getFullYear() + '年' + (_calendarDate.getMonth() + 1) + '月';
        }

        // 右栏迷你日历日期格（使用 .wb-cal-day 类名）
        const daysEl = document.getElementById('wbCalendarDays');
        if (!daysEl) return;
        daysEl.innerHTML = ns._buildCalendarDaysHTML(_calendarDate, 'wb-cal-day');
        ns._bindCalendarDayClicks(daysEl);
    };

    /** 右栏迷你日历渲染 */
    ns.renderMiniCalendar = function (date) {
        if (!date) date = _calendarDate;
        const titleEl = document.getElementById('wbCalendarTitle');
        const daysEl = document.getElementById('wbCalendarDays');
        if (titleEl) {
            titleEl.textContent = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
        }
        if (daysEl) {
            daysEl.innerHTML = ns._buildCalendarDaysHTML(date, 'wb-cal-day');
            ns._bindCalendarDayClicks(daysEl);
        }
    };

    /** 侧栏迷你日历渲染 */
    ns.renderSideCalendar = function (date) {
        if (!date) date = _calendarDate;
        const titleEl = document.getElementById('wbSideCalTitle');
        const daysEl = document.getElementById('wbSideCalDays');
        if (titleEl) {
            titleEl.textContent = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
        }
        if (daysEl) {
            daysEl.innerHTML = ns._buildCalendarDaysHTML(date, 'wb-side-cal-day');
            daysEl.querySelectorAll('.wb-side-cal-day').forEach(function (el) {
                el.addEventListener('click', function () {
                    ns.showCalendarDetail(el.dataset.date);
                });
            });
        }
    };

    /** 构建日历日期网格 HTML */
    ns._buildCalendarDaysHTML = function (date, cellClass) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const prevMonthDays = new Date(year, month, 0).getDate();
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        // 有内容的日期
        const contentDates = {};
        (state.notes || []).forEach(function (n) {
            const d = new Date(n.createdAt);
            if (d.getFullYear() === year && d.getMonth() === month) {
                contentDates[d.getDate()] = true;
            }
        });

        let html = '';
        // 上月填充
        for (let i = firstDay - 1; i >= 0; i--) {
            html += '<span class="' + cellClass + ' other-month">' + (prevMonthDays - i) + '</span>';
        }
        // 当月
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            const classes = [cellClass];
            if (dateStr === todayStr) classes.push('today');
            if (contentDates[day]) classes.push('has-content');
            html += '<span class="' + classes.join(' ') + '" data-date="' + dateStr + '">' + day + '</span>';
        }
        // 下月填充
        const totalCells = firstDay + daysInMonth;
        let remaining = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
        for (let j = 1; j <= remaining; j++) {
            html += '<span class="' + cellClass + ' other-month">' + j + '</span>';
        }
        return html;
    };

    /** 绑定日期点击事件 */
    ns._bindCalendarDayClicks = function (container) {
        container.querySelectorAll('[data-date]').forEach(function (el) {
            el.addEventListener('click', function () {
                ns.showCalendarDetail(el.dataset.date);
            });
        });
    };

    ns.showCalendarDetail = function (dateStr) {
        if (!dom.wbCalendarDetail) return;
        const notes = (state.notes || []).filter(function (n) {
            const d = new Date(n.createdAt);
            const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return ds === dateStr;
        });
        let captures = (state.captures || []).filter(function (c) {
            const d = new Date(c.createdAt);
            const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return ds === dateStr;
        });

        if (notes.length === 0 && captures.length === 0) {
            dom.wbCalendarDetail.innerHTML = '<p class="wb-calendar-detail-empty">' + dateStr + ' 暂无记录</p>';
            return;
        }

        let html = '<h3>' + dateStr + '</h3>';
        if (notes.length > 0) {
            html += '<div style="margin-top:8px;"><strong>笔记 (' + notes.length + ')</strong></div>';
            notes.forEach(function (n) {
                html += '<div style="padding:4px 0;font-size:13px;">📝 ' + escapeHtml(n.title) + '</div>';
            });
        }
        if (captures.length > 0) {
            html += '<div style="margin-top:8px;"><strong>捕获 (' + captures.length + ')</strong></div>';
            captures.forEach(function (c) {
                html += '<div style="padding:4px 0;font-size:13px;">⚡ ' + escapeHtml(c.content.slice(0, 80)) + '</div>';
            });
        }
        dom.wbCalendarDetail.innerHTML = html;
    };

    /** 日历视图切换 */
    ns.switchCalendarView = function (view) {
        state._calendarView = view;
        // 更新按钮状态
        document.querySelectorAll('.wb-cal-view-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        // 重新渲染日历
        const daysEl = document.getElementById('wbCalendarDays');
        if (!daysEl) return;
        if (view === 'week') {
            daysEl.classList.add('week-view');
        } else {
            daysEl.classList.remove('week-view');
        }
        ns.renderMiniCalendar(_calendarDate);
        console.log('[面板] 日历切换到' + (view === 'week' ? '周视图' : '月视图'));
    };

})(window.DevHome);
