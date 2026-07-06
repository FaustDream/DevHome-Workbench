/**
 * 天气预报模块
 * 使用 Open-Meteo 免费 API（无需 Key），Geolocation 定位，降级为北京。
 * 时钟旁显示图标+温度，点击展开 3 天趋势。数据缓存 30 分钟。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var LAT = 39.9042;  // 默认：北京
    var LON = 116.4074;
    var CACHE_TTL = 30 * 60 * 1000; // 30 分钟缓存

    /** WMO 天气码 → 中文 + Emoji 映射 */
    var WEATHER_MAP = {
        0:  { text: '晴', icon: '☀️' },
        1:  { text: '大部晴', icon: '🌤' },
        2:  { text: '多云', icon: '⛅' },
        3:  { text: '阴', icon: '☁️' },
        45: { text: '雾', icon: '🌫' },
        48: { text: '霜雾', icon: '🌫' },
        51: { text: '小雨', icon: '🌦' },
        53: { text: '中雨', icon: '🌧' },
        55: { text: '大雨', icon: '🌧' },
        61: { text: '小雨', icon: '🌦' },
        63: { text: '中雨', icon: '🌧' },
        65: { text: '大雨', icon: '🌧' },
        71: { text: '小雪', icon: '🌨' },
        73: { text: '中雪', icon: '🌨' },
        75: { text: '大雪', icon: '❄️' },
        80: { text: '阵雨', icon: '🌦' },
        81: { text: '暴雨', icon: '⛈' },
        82: { text: '大暴雨', icon: '⛈' },
        95: { text: '雷暴', icon: '⛈' },
        96: { text: '冰雹雷暴', icon: '⛈' },
        99: { text: '强冰雹', icon: '⛈' }
    };

    function getWeather(code) {
        return WEATHER_MAP[code] || { text: '未知', icon: '🌡' };
    }

    /** 尝试获取用户位置，失败则用默认北京坐标 */
    async function getLocation() {
        return new Promise(function (resolve) {
            if (!navigator.geolocation) { resolve({ lat: LAT, lon: LON }); return; }
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                },
                function () { resolve({ lat: LAT, lon: LON }); },
                { timeout: 5000 }
            );
        });
    }

    /** 从缓存或 API 获取天气数据 */
    async function fetchWeather(lat, lon) {
        var cacheKey = 'tabpage_weather_cache';
        var cached;
        try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { }
        if (cached && cached.ts && (Date.now() - cached.ts < CACHE_TTL)) {
            // 坐标没大变就复用缓存
            var dist = Math.abs((cached.lat || 0) - lat) + Math.abs((cached.lon || 0) - lon);
            if (dist < 1) return cached;
        }
        try {
            // Open-Meteo API：获取当前天气 + 3 天预报
            var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
                + '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3';
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 8000);
            var resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();

            var result = {
                lat: lat, lon: lon,
                ts: Date.now(),
                currentTemp: Math.round(data.current.temperature_2m),
                currentCode: data.current.weather_code,
                daily: data.daily.time.map(function (date, i) {
                    return {
                        date: date,
                        max: Math.round(data.daily.temperature_2m_max[i]),
                        min: Math.round(data.daily.temperature_2m_min[i]),
                        code: data.daily.weather_code[i]
                    };
                })
            };
            localStorage.setItem(cacheKey, JSON.stringify(result));
            return result;
        } catch (e) {
            console.warn('[天气] API 请求失败:', e.message);
            return cached || null;
        }
    }

    /** 渲染天气小组件（时钟旁） */
    function renderWidget(data) {
        var el = document.getElementById('weatherWidget');
        if (!el) return;
        el.style.display = '';
        var w = getWeather(data.currentCode);
        el.innerHTML = '<span class="weather-icon">' + w.icon + '</span>'
            + '<span class="weather-temp">' + data.currentTemp + '°</span>'
            + '<span class="weather-desc">' + w.text + '</span>';
        el.title = w.text + ' ' + data.currentTemp + '°C · 点击查看趋势';
        // 缓存数据到 dataset 供点击展开使用
        el._weatherData = data;
    }

    /** 渲染 3 天趋势面板 */
    function renderPanel(data) {
        var panel = document.getElementById('weatherPanel');
        if (!panel) return;
        var weekMap = ['日', '一', '二', '三', '四', '五', '六'];
        var html = '<div class="weather-panel-inner"><div class="weather-panel-title">3 日天气趋势</div>';
        data.daily.forEach(function (d) {
            var w = getWeather(d.code);
            var day = new Date(d.date);
            var label = day.getMonth() + 1 + '/' + day.getDate() + ' 周' + weekMap[day.getDay()];
            html += '<div class="weather-panel-day"><span class="wpd-label">' + label + '</span>'
                + '<span class="wpd-icon">' + w.icon + '</span>'
                + '<span class="wpd-desc">' + w.text + '</span>'
                + '<span class="wpd-temps"><span class="wpd-high">' + d.max + '°</span> <span class="wpd-low">' + d.min + '°</span></span></div>';
        });
        html += '</div>';
        panel.innerHTML = html;
    }

    /** 切换趋势面板显示/隐藏 */
    function togglePanel() {
        var panel = document.getElementById('weatherPanel');
        if (!panel) return;
        var isVisible = panel.classList.contains('visible');
        if (isVisible) {
            panel.classList.remove('visible');
        } else {
            panel.classList.add('visible');
            // 点击外部关闭
            setTimeout(function () {
                document.addEventListener('click', function handler(e) {
                    var widget = document.getElementById('weatherWidget');
                    var p = document.getElementById('weatherPanel');
                    if (p && widget && !widget.contains(e.target) && !p.contains(e.target)) {
                        p.classList.remove('visible');
                        document.removeEventListener('click', handler);
                    }
                });
            }, 50);
        }
    }

    /** 初始化天气模块 */
    ns.initWeather = async function () {
        var loc = await getLocation();
        var data = await fetchWeather(loc.lat, loc.lon);
        if (data) {
            renderWidget(data);
            renderPanel(data);
            // 暴露天气数据给其他模块（如每日问候卡片）
            ns.weatherData = data;
            // 通知每日问候卡片更新天气
            if (typeof ns.updateDailyGreetingCardWeather === 'function') {
                ns.updateDailyGreetingCardWeather();
            }
            console.log('[天气] 渲染完成 → ' + getWeather(data.currentCode).text + ' ' + data.currentTemp + '°C');
        }
    };

    /** 绑定点击事件（由外部在 DOM ready 后调用） */
    ns.bindWeatherEvents = function () {
        var widget = document.getElementById('weatherWidget');
        if (widget) {
            widget.addEventListener('click', togglePanel);
        }
    };

})(window.DevHome);
