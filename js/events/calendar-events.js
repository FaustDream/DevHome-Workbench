/**
 * 日历导航事件模块
 * 负责迷你日历前后翻页、视图切换（月/周）、日历导航按钮
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    ns._bindCalendarEvents = function () {
        const miniCalPrev = document.getElementById('wbMiniCalPrev');
        const miniCalNext = document.getElementById('wbMiniCalNext');
        if (miniCalPrev) miniCalPrev.addEventListener('click', function () { ns.navigateCalendar(-1); });
        if (miniCalNext) miniCalNext.addEventListener('click', function () { ns.navigateCalendar(1); });

        document.querySelectorAll('.wb-cal-view-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { ns.switchCalendarView(btn.dataset.view); });
        });

        const calPrev = document.getElementById('wbCalendarPrev');
        const calNext = document.getElementById('wbCalendarNext');
        const calToday = document.getElementById('wbCalendarToday');
        if (calPrev) calPrev.addEventListener('click', function () { ns.navigateCalendar(-1); });
        if (calNext) calNext.addEventListener('click', function () { ns.navigateCalendar(1); });
        if (calToday) calToday.addEventListener('click', function () { ns.renderCalendar(new Date()); });
    };

})(window.DevHome);
