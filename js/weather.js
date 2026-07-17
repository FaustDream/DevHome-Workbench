/**
 * 天气预报模块（重构版）
 * 使用 Open-Meteo 免费 API（无需 Key），Geolocation 定位，降级为北京。
 * 取消页面加载时自动请求，改为手动点击刷新按钮触发。
 * 数据缓存 30 分钟 TTL，超时后下次自动刷新或手动刷新时重新获取。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const LAT = 39.9042;  // 默认：北京纬度
    const LON = 116.4074; // 默认：北京经度
    const CACHE_TTL = 30 * 60 * 1000; // 30 分钟缓存 TTL
    const AUTO_REFRESH_INTERVAL = 30 * 60 * 1000; // 自动刷新间隔 30 分钟

    /* 上次成功获取天气的时间戳（用于自动刷新计时） */
    let lastFetchTime = 0;
    /* 自动刷新定时器 ID */
    let autoRefreshTimer = null;

    /** WMO 天气码 → 中文 + 本地 SVG 图标语义名映射 */
    const WEATHER_MAP = {
        0:  { text: '晴', icon: 'weather-sun' },
        1:  { text: '大部晴', icon: 'weather-cloud-sun' },
        2:  { text: '多云', icon: 'weather-cloud-sun' },
        3:  { text: '阴', icon: 'weather-cloud' },
        45: { text: '雾', icon: 'weather-fog' },
        48: { text: '霜雾', icon: 'weather-fog' },
        51: { text: '小雨', icon: 'weather-rain' },
        53: { text: '中雨', icon: 'weather-rain' },
        55: { text: '大雨', icon: 'weather-rain' },
        61: { text: '小雨', icon: 'weather-rain' },
        63: { text: '中雨', icon: 'weather-rain' },
        65: { text: '大雨', icon: 'weather-rain' },
        71: { text: '小雪', icon: 'weather-snow' },
        73: { text: '中雪', icon: 'weather-snow' },
        75: { text: '大雪', icon: 'weather-snowflake' },
        80: { text: '阵雨', icon: 'weather-rain' },
        81: { text: '暴雨', icon: 'weather-storm' },
        82: { text: '大暴雨', icon: 'weather-storm' },
        95: { text: '雷暴', icon: 'weather-storm' },
        96: { text: '冰雹雷暴', icon: 'weather-storm' },
        99: { text: '强冰雹', icon: 'weather-storm' }
    };

    function getWeather(code) {
        return WEATHER_MAP[code] || { text: '未知', icon: 'weather-thermometer' };
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

    /** 检查缓存是否有效 */
    function isCacheValid(lat, lon) {
        const cacheKey = 'tabpage_weather_cache';
        let cached;
        try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { }
        if (!cached || !cached.ts) return false;
        // TTL 过期检查
        if (Date.now() - cached.ts >= CACHE_TTL) return false;
        // 坐标偏移检查（1 度以内视为同城）
        const dist = Math.abs((cached.lat || 0) - lat) + Math.abs((cached.lon || 0) - lon);
        return dist < 1;
    }

    /** 从 localStorage 读取缓存数据 */
    function getCachedWeather() {
        const cacheKey = 'tabpage_weather_cache';
        let cached;
        try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { }
        return cached || null;
    }

    /** 从 Open-Meteo API 获取天气数据 */
    async function fetchWeather(lat, lon) {
        try {
            // Open-Meteo API：获取当前天气 + 3 天预报
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
                + '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3';
            const controller = new AbortController();
            const timeout = setTimeout(function () { controller.abort(); }, 8000);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();

            const result = {
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
            // 写入缓存
            localStorage.setItem('tabpage_weather_cache', JSON.stringify(result));
            lastFetchTime = Date.now();
            console.log('[天气] API 获取成功 → ' + getWeather(result.currentCode).text + ' ' + result.currentTemp + '°C');
            return result;
        } catch (e) {
            console.warn('[天气] API 请求失败:', e.message);
            // 降级到缓存
            return getCachedWeather();
        }
    }

    /** 启动自动刷新定时器（每 30 分钟检查并刷新） */
    function startAutoRefresh() {
        stopAutoRefresh();
        autoRefreshTimer = setInterval(async function () {
            if (lastFetchTime > 0 && Date.now() - lastFetchTime >= AUTO_REFRESH_INTERVAL) {
                console.log('[天气] 自动刷新触发（距上次获取已超 30 分钟）');
                await ns.refreshWeather();
            }
        }, 60000); // 每分钟检查一次是否需要刷新
        console.log('[天气] 自动刷新定时器已启动（间隔 30 分钟）');
    }

    /** 停止自动刷新定时器 */
    function stopAutoRefresh() {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    }

    /**
     * 手动刷新天气（公开接口，供问候区域刷新按钮调用）
     * @returns {Promise<object|null>} 天气数据或 null
     */
    ns.refreshWeather = async function () {
        console.log('[天气] 手动刷新开始');
        const loc = await getLocation();

        // 检查缓存是否仍然有效（避免频繁请求 API）
        if (isCacheValid(loc.lat, loc.lon)) {
            const cached = getCachedWeather();
            ns.weatherData = cached;
            if (typeof ns.updateDailyGreetingCardWeather === 'function') {
                ns.updateDailyGreetingCardWeather();
            }
            console.log('[天气] 缓存有效，直接使用');
            return cached;
        }

        const data = await fetchWeather(loc.lat, loc.lon);
        if (data) {
            ns.weatherData = data;
            // 通知问候区域更新天气显示
            if (typeof ns.updateDailyGreetingCardWeather === 'function') {
                ns.updateDailyGreetingCardWeather();
            }
            // 启动自动刷新定时器
            startAutoRefresh();
            console.log('[天气] 手动刷新完成 → ' + getWeather(data.currentCode).text + ' ' + data.currentTemp + '°C');
        }
        return data;
    };

    /**
     * 初始化天气模块（仅加载缓存数据到内存，不发起网络请求）
     * 自动刷新定时器在首次手动刷新成功后启动。
     */
    ns.initWeather = function () {
        const cached = getCachedWeather();
        if (cached) {
            ns.weatherData = cached;
            lastFetchTime = cached.ts || 0;
            // 通知问候区域显示缓存的天气数据
            if (typeof ns.updateDailyGreetingCardWeather === 'function') {
                // 延迟执行，确保问候区域已渲染
                setTimeout(function () {
                    ns.updateDailyGreetingCardWeather();
                }, 100);
            }
            console.log('[天气] 从缓存加载 → ' + getWeather(cached.currentCode).text + ' ' + cached.currentTemp + '°C');
            // 如果缓存仍在有效期内，启动自动刷新
            if (Date.now() - cached.ts < CACHE_TTL) {
                startAutoRefresh();
            }
        } else {
            console.log('[天气] 无缓存数据，等待手动刷新');
        }
    };

})(window.DevHome);
