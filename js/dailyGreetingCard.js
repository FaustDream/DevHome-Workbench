/**
 * 每日问候区域模块（重构版 v2）
 * 问候文本无缝融合至纯色页面背景，无卡片容器。
 * 日期 + 天气 + 时段问候 + 鼓励话语。
 * 交互：双击天气徽章刷新天气，双击鼓励话语刷新内容。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    /* ===== 鼓励话语语料库（20 条） ===== */
    const ENCOURAGE_QUOTES = [
        '新的一天，新的起点。\n保持好心情，一切都会顺利的。',
        '每一个清晨都是重新开始的机会。',
        '今天也是元气满满的一天，加油！',
        '别想太多，先把手头的事做好，\n你已经很棒了。',
        '过往皆为序章，未来皆可期盼。',
        '不辜负生活，不迷失方向。',
        '生活不会辜负每一个努力的人。',
        '与其仰望星空，不如脚踏实地。',
        '今天的你，比昨天更接近梦想。',
        '哪怕步伐很小，也要步步向前。',
        '世界很大，但你独一无二。',
        '所有美好的事物都在向你奔来。',
        '放轻松，你已经做得很好了。',
        '把平凡的日子过得闪闪发光。',
        '平静的心态是最好的生产力。',
        '所谓幸运，就是努力遇上了机会。',
        '好事总会发生在下个转弯。',
        '与其焦虑未来，不如专注当下。',
        '山有顶峰，海有彼岸，慢慢来。',
        '愿你眼中有光，活成自己喜欢的模样。'
    ];

    const ENC_CACHE_KEY = 'daily_greeting_card_quote';

    /* ===== 昵称获取 ===== */
    function getNickname() {
        try {
            let raw = localStorage.getItem('config_nickname');
            if (raw) return raw.trim();
        } catch (e) { }
        return '主人';
    }

    /* ===== 时段问候语 ===== */
    function getGreetingByHour(hour) {
        if (hour >= 5 && hour < 9)  return '早上好';
        if (hour >= 9 && hour < 12) return '上午好';
        if (hour >= 12 && hour < 14) return '中午好';
        if (hour >= 14 && hour < 18) return '下午好';
        if (hour >= 18 && hour < 24) return '晚上好';
        return '夜深了';
    }

    /* ===== 日期格式化 ===== */
    function formatDate() {
        let now = new Date();
        let weekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekMap[now.getDay()];
    }

    /* ===== 鼓励话语选取（每日随机，缓存当天） ===== */
    function pickEncourage() {
        let today = new Date().toLocaleDateString('zh-CN');
        let cached;
        try { cached = JSON.parse(localStorage.getItem(ENC_CACHE_KEY)); } catch (e) { }
        if (cached && cached.date === today && cached.text) return cached.text;

        let idx = Math.floor(Math.random() * ENCOURAGE_QUOTES.length);
        let text = ENCOURAGE_QUOTES[idx];
        localStorage.setItem(ENC_CACHE_KEY, JSON.stringify({ date: today, text: text }));
        return text;
    }

    /* ===== 强制重新随机鼓励话语（忽略当日缓存） ===== */
    function refreshEncourage() {
        let today = new Date().toLocaleDateString('zh-CN');
        let idx = Math.floor(Math.random() * ENCOURAGE_QUOTES.length);
        let text = ENCOURAGE_QUOTES[idx];
        localStorage.setItem(ENC_CACHE_KEY, JSON.stringify({ date: today, text: text }));
        return text;
    }

    /* ===== WMO 天气码映射 ===== */
    const WEATHER_ICON_MAP = {
        0: { text: '晴', icon: '☀️' },     1: { text: '大部晴', icon: '🌤' },
        2: { text: '多云', icon: '⛅' },     3: { text: '阴', icon: '☁️' },
        45: { text: '雾', icon: '🌫' },      48: { text: '霜雾', icon: '🌫' },
        51: { text: '小雨', icon: '🌦' },    53: { text: '中雨', icon: '🌧' },
        55: { text: '大雨', icon: '🌧' },    61: { text: '小雨', icon: '🌦' },
        63: { text: '中雨', icon: '🌧' },    65: { text: '大雨', icon: '🌧' },
        71: { text: '小雪', icon: '🌨' },    73: { text: '中雪', icon: '🌨' },
        75: { text: '大雪', icon: '❄️' },    80: { text: '阵雨', icon: '🌦' },
        81: { text: '暴雨', icon: '⛈' },     82: { text: '大暴雨', icon: '⛈' },
        95: { text: '雷暴', icon: '⛈' },     96: { text: '冰雹雷暴', icon: '⛈' },
        99: { text: '强冰雹', icon: '⛈' }
    };

    /* ===== 渲染鼓励话语文本（带闪动反馈） ===== */
    function renderEncourageText(text, animate) {
        let el = document.getElementById('dhEncourageText');
        if (!el) return;
        el.innerHTML = text.replace(/\n/g, '<br>');
        if (animate) {
            el.classList.add('reloading');
            setTimeout(function () { el.classList.remove('reloading'); }, 400);
        }
        console.log('[交互] 鼓励话语渲染' + (animate ? '（双击刷新）' : ''));
    }

    /* ===== 渲染全部问候区域（日期 + 问候 + 鼓励） ===== */
    function render() {
        let area = document.getElementById('dhGreetingArea');
        if (!area) return;

        let hour = new Date().getHours();
        let greeting = getGreetingByHour(hour);
        let nickname = getNickname();
        let encourage = pickEncourage();

        // 日期
        let dateEl = document.getElementById('dhGreetingDate');
        if (dateEl) dateEl.textContent = formatDate();

        // 时段问候
        let mainEl = document.getElementById('dhGreetingMain');
        if (mainEl) mainEl.textContent = greeting + '，' + nickname;

        // 鼓励话语
        renderEncourageText(encourage, false);

        // 天气：如果已有缓存数据则直接渲染，否则保持隐藏
        renderWeatherFromCache();

        console.log('[每日问候] 渲染完成 → ' + greeting + '，' + nickname);
    }

    /* ===== 从缓存/已有数据渲染天气徽章 ===== */
    function renderWeatherFromCache() {
        if (!ns.weatherData) return;
        renderWeatherBadge(ns.weatherData);
    }

    /* ===== 渲染天气徽章内容 ===== */
    function renderWeatherBadge(data) {
        let badge = document.getElementById('dhWeatherBadge');
        if (!badge) return;
        let w = WEATHER_ICON_MAP[data.currentCode] || { text: '未知', icon: '🌡' };

        let iconEl = badge.querySelector('.dh-weather-icon');
        let tempEl = document.getElementById('dhWeatherTempText');
        let descEl = document.getElementById('dhWeatherDescText');

        if (iconEl) iconEl.textContent = w.icon;
        if (tempEl) tempEl.textContent = data.currentTemp + '°';
        if (descEl) descEl.textContent = w.text;

        badge.title = w.text + ' ' + data.currentTemp + '°C · 双击刷新天气';
        badge.style.display = '';

        console.log('[每日问候] 天气徽章渲染 → ' + w.text + ' ' + data.currentTemp + '°C');
    }

    /* ===== 显示天气加载中状态 ===== */
    function showWeatherLoading() {
        let badge = document.getElementById('dhWeatherBadge');
        if (!badge) return;
        let descEl = document.getElementById('dhWeatherDescText');
        if (descEl) descEl.textContent = '刷新中…';
        badge.style.display = '';
    }

    /* ===== 天气徽章双击处理 ===== */
    async function onWeatherDblClick(e) {
        e.preventDefault();
        e.stopPropagation();
        let badge = document.getElementById('dhWeatherBadge');
        if (!badge) return;

        console.log('[交互] 双击天气徽章 → 刷新天气');
        // 闪动反馈
        badge.classList.add('reloading');
        setTimeout(function () { badge.classList.remove('reloading'); }, 400);

        showWeatherLoading();

        try {
            if (typeof ns.refreshWeather === 'function') {
                await ns.refreshWeather();
            }
        } catch (err) {
            console.warn('[警告] 天气刷新失败:', err.message);
            let descEl = document.getElementById('dhWeatherDescText');
            if (descEl && descEl.textContent === '刷新中…') {
                descEl.textContent = '失败';
            }
        }
    }

    /* ===== 鼓励话语双击处理 ===== */
    function onEncourageDblClick(e) {
        e.preventDefault();
        e.stopPropagation();
        let el = document.getElementById('dhEncourageText');
        if (!el) return;

        console.log('[交互] 双击鼓励话语 → 刷新内容');
        let newText = refreshEncourage();
        renderEncourageText(newText, true);
    }

    /* ===== 绑定事件 ===== */
    function bindEvents() {
        // 天气徽章：双击刷新（不与单击冲突，单击无操作）
        let weatherBadge = document.getElementById('dhWeatherBadge');
        if (weatherBadge) {
            weatherBadge.addEventListener('dblclick', onWeatherDblClick);
        }

        // 鼓励话语：双击刷新
        let encText = document.getElementById('dhEncourageText');
        if (encText) {
            encText.addEventListener('dblclick', onEncourageDblClick);
        }

        console.log('[每日问候] 事件绑定完成（双击交互）');
    }

    /* ===== 更新日期（每分钟检查跨日） ===== */
    function updateDateIfNeeded() {
        let el = document.getElementById('dhGreetingDate');
        if (!el) return;
        let formatted = formatDate();
        if (el.textContent !== formatted) {
            el.textContent = formatted;
            console.log('[每日问候] 日期更新 → ' + formatted);
        }
    }

    /* ===== 更新时段问候（整点检查） ===== */
    function updateGreetingIfNeeded() {
        let now = new Date();
        if (now.getMinutes() !== 0) return; // 仅整点检查
        let mainEl = document.getElementById('dhGreetingMain');
        if (!mainEl) return;
        let greeting = getGreetingByHour(now.getHours());
        let nickname = getNickname();
        let text = greeting + '，' + nickname;
        if (mainEl.textContent !== text) {
            mainEl.textContent = text;
            console.log('[每日问候] 时段问候更新 → ' + text);
        }
    }

    /* ===== 天气回调（由 weather.js 在获取到数据后调用） ===== */
    ns.updateDailyGreetingCardWeather = function () {
        if (ns.weatherData) {
            renderWeatherBadge(ns.weatherData);
        }
    };

    /* ===== 初始化 ===== */
    ns.initDailyGreetingCard = function () {
        render();
        bindEvents();

        // 如果天气数据已就绪（ns.weatherData 存在），直接渲染
        if (ns.weatherData) {
            renderWeatherBadge(ns.weatherData);
        }
        // 每分钟检查日期和问候语是否需要更新
        setInterval(function () {
            updateDateIfNeeded();
            updateGreetingIfNeeded();
            if (ns.weatherData) renderWeatherBadge(ns.weatherData);
        }, 60000);
        // 页面可见性变化时刷新（用户切回来可能跨时段）
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                updateDateIfNeeded();
                updateGreetingIfNeeded();
            }
        });
        console.log('[每日问候] 初始化完成');
    };

})(window.DevHome);
