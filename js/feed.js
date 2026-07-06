/**
 * 资讯热榜 + GitHub Trending 聚合模块
 * 可折叠卡片：知乎热榜 / V2EX 最新 / GitHub Trending Tab 切换。
 * 独立 GitHub Trending 卡片。数据缓存 15 分钟（资讯）/ 30 分钟（Trending）。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var FEED_CACHE_TTL = 15 * 60 * 1000; // 15 分钟
    var TRENDING_CACHE_TTL = 30 * 60 * 1000; // 30 分钟

    /* ===== 知乎热榜（通过代理/直接接口） ===== */
    async function fetchZhihu() {
        try {
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 6000);
            var resp = await fetch('https://api.zhihu.com/topstory/hot-lists/total?limit=8', { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (data && data.data) {
                return data.data.map(function (item) {
                    return {
                        title: item.target ? item.target.title : '',
                        url: item.target ? ('https://www.zhihu.com/question/' + item.target.id) : '',
                        hot: item.detail_text || ''
                    };
                }).filter(function (x) { return x.title; });
            }
        } catch (e) { }
        return [];
    }

    /* ===== V2EX 最新主题 ===== */
    async function fetchV2ex() {
        try {
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 6000);
            var resp = await fetch('https://www.v2ex.com/api/topics/hot.json', { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (Array.isArray(data)) {
                return data.slice(0, 8).map(function (item) {
                    return {
                        title: item.title,
                        url: item.url || ('https://www.v2ex.com/t/' + item.id),
                        hot: (item.replies || 0) + ' 回复'
                    };
                });
            }
        } catch (e) { }
        return [];
    }

    /* ===== GitHub Trending（解析 GitHub 页面） ===== */
    async function fetchGithubTrending(lang) {
        try {
            var url = 'https://github.com/trending' + (lang ? '/' + encodeURIComponent(lang) : '') + '?since=daily';
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 8000);
            var resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var html = await resp.text();
            // 简单解析：提取 repo name + description + stars
            var repos = [];
            var repoRegex = /<h2[^>]*class="h3 lh-condensed"[^>]*>[\s\S]*?href="\/([^"]+)"[^>]*>[\s\S]*?<\/h2>[\s\S]*?<p[^>]*class="col-9 color-fg-muted[^>]*>([\s\S]*?)<\/p>[\s\S]*?(?:(\d[\d,]*) stars)/gi;
            // 更简单的正则提取方案
            var h2Regex = /href="\/([^\/"]+\/[^\/"]+)"/g;
            var descRegex = /<p class="col-9 color-fg-muted my-1 pr-4">([^<]*)<\/p>/g;
            var starsRegex = /(\d[\d,]*) stars today/g;

            var titles = [], descs = [], starsList = [];
            var m;
            while ((m = h2Regex.exec(html)) !== null && titles.length < 7) {
                titles.push(m[1]);
            }
            while ((m = descRegex.exec(html)) !== null && descs.length < 7) {
                descs.push(m[1].trim());
            }
            while ((m = starsRegex.exec(html)) !== null && starsList.length < 7) {
                starsList.push(m[1]);
            }

            for (var i = 0; i < Math.min(titles.length, 7); i++) {
                repos.push({
                    title: titles[i],
                    url: 'https://github.com/' + titles[i],
                    desc: descs[i] || '',
                    stars: starsList[i] || ''
                });
            }
            return repos;
        } catch (e) { }
        return [];
    }

    /* ===== 渲染通用 Feed 列表 ===== */
    function renderFeedList(items, containerId) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!items || items.length === 0) {
            el.innerHTML = '<div class="feed-empty">暂无数据，请稍后再试</div>';
            return;
        }
        var html = '';
        items.forEach(function (item) {
            html += '<a class="feed-item" href="' + item.url + '" target="_blank" rel="noopener">'
                + '<span class="feed-item-title">' + escapeText(item.title) + '</span>'
                + '<span class="feed-item-meta">' + escapeText(item.hot || item.stars || '') + '</span></a>';
        });
        el.innerHTML = html;
    }

    function escapeText(s) {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ===== 资讯热榜主卡片 ===== */
    var feedDataCache = {};

    async function loadFeedData(source) {
        var now = Date.now();
        if (feedDataCache[source] && (now - feedDataCache[source].ts < FEED_CACHE_TTL)) {
            return feedDataCache[source].data;
        }
        var data = [];
        if (source === 'zhihu') data = await fetchZhihu();
        else if (source === 'v2ex') data = await fetchV2ex();
        else if (source === 'github') data = await fetchGithubTrending();
        feedDataCache[source] = { ts: now, data: data };
        return data;
    }

    /** 切换热榜 Tab */
    ns.switchFeedTab = async function (tab) {
        var card = document.getElementById('feedCard');
        if (!card) return;
        // 更新 Tab 按钮 active
        card.querySelectorAll('.feed-tab').forEach(function (b) {
            b.classList.toggle('active', b.dataset.feedTab === tab);
        });
        // 加载对应数据
        var list = card.querySelector('.feed-list');
        if (list) list.innerHTML = '<div class="feed-loading">加载中...</div>';
        var data = await loadFeedData(tab);
        renderFeedList(data, list ? list.id : 'feedList');
        console.log('[资讯] 切换到 ' + tab + ' → ' + (data ? data.length : 0) + ' 条');
    };

    /** 初始化资讯热榜 */
    ns.initFeed = async function () {
        if (!ns.isModuleEnabled('newsFeed')) {
            var card = document.getElementById('feedCard');
            if (card) card.style.display = 'none';
            return;
        }
        // 默认加载知乎热榜
        await ns.switchFeedTab('zhihu');
        console.log('[资讯] 热榜卡片渲染完成');
    };

    /** 切换折叠状态 */
    ns.toggleFeedCollapse = function () {
        var body = document.getElementById('feedCardBody');
        if (!body) return;
        var isCollapsed = body.style.display === 'none';
        body.style.display = isCollapsed ? '' : 'none';
        var icon = document.getElementById('feedToggleIcon');
        if (icon) icon.textContent = isCollapsed ? '▼' : '▶';
    };

    /* ===== GitHub Trending 独立卡片 ===== */
    ns.initGithubTrending = async function () {
        if (!ns.isModuleEnabled('githubTrending')) {
            var card = document.getElementById('trendingCard');
            if (card) card.style.display = 'none';
            return;
        }
        var list = document.getElementById('trendingList');
        if (list) list.innerHTML = '<div class="feed-loading">加载中...</div>';
        var data = await fetchGithubTrending();
        renderFeedList(data, 'trendingList');
        console.log('[GitHub] Trending 卡片渲染完成 → ' + (data ? data.length : 0) + ' 条');
    };

    ns.toggleTrendingCollapse = function () {
        var body = document.getElementById('trendingCardBody');
        if (!body) return;
        var isCollapsed = body.style.display === 'none';
        body.style.display = isCollapsed ? '' : 'none';
        var icon = document.getElementById('trendingToggleIcon');
        if (icon) icon.textContent = isCollapsed ? '▼' : '▶';
    };

})(window.DevHome);
