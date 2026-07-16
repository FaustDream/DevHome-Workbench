/**
 * DevHome Workbench - 日历渲染（迷你/侧栏/详情）
 * 从 workbench.js 拆分，职责：迷你日历、侧栏日历、日期详情
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;
    var escapeHtml = ns.escapeHtml;

    var _calendarDate = new Date();

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
        var titleEl = document.getElementById('wbCalendarTitle');
        if (titleEl) {
            titleEl.textContent = _calendarDate.getFullYear() + '年' + (_calendarDate.getMonth() + 1) + '月';
        }

        // 右栏迷你日历日期格（使用 .wb-cal-day 类名）
        var daysEl = document.getElementById('wbCalendarDays');
        if (!daysEl) return;
        daysEl.innerHTML = ns._buildCalendarDaysHTML(_calendarDate, 'wb-cal-day');
        ns._bindCalendarDayClicks(daysEl);
    };

    /** 右栏迷你日历渲染 */
    ns.renderMiniCalendar = function (date) {
        if (!date) date = _calendarDate;
        var titleEl = document.getElementById('wbCalendarTitle');
        var daysEl = document.getElementById('wbCalendarDays');
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
        var titleEl = document.getElementById('wbSideCalTitle');
        var daysEl = document.getElementById('wbSideCalDays');
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
        var year = date.getFullYear();
        var month = date.getMonth();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDay = new Date(year, month, 1).getDay();
        var prevMonthDays = new Date(year, month, 0).getDate();
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        // 有内容的日期
        var contentDates = {};
        (state.notes || []).forEach(function (n) {
            var d = new Date(n.createdAt);
            if (d.getFullYear() === year && d.getMonth() === month) {
                contentDates[d.getDate()] = true;
            }
        });

        var html = '';
        // 上月填充
        for (var i = firstDay - 1; i >= 0; i--) {
            html += '<span class="' + cellClass + ' other-month">' + (prevMonthDays - i) + '</span>';
        }
        // 当月
        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var classes = [cellClass];
            if (dateStr === todayStr) classes.push('today');
            if (contentDates[day]) classes.push('has-content');
            html += '<span class="' + classes.join(' ') + '" data-date="' + dateStr + '">' + day + '</span>';
        }
        // 下月填充
        var totalCells = firstDay + daysInMonth;
        var remaining = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
        for (var j = 1; j <= remaining; j++) {
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
        var notes = (state.notes || []).filter(function (n) {
            var d = new Date(n.createdAt);
            var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return ds === dateStr;
        });
        var captures = (state.captures || []).filter(function (c) {
            var d = new Date(c.createdAt);
            var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return ds === dateStr;
        });

        if (notes.length === 0 && captures.length === 0) {
            dom.wbCalendarDetail.innerHTML = '<p class="wb-calendar-detail-empty">' + dateStr + ' 暂无记录</p>';
            return;
        }

        var html = '<h3>' + dateStr + '</h3>';
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
        var daysEl = document.getElementById('wbCalendarDays');
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
