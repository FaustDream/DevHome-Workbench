/**
 * DevHome Workbench - 搜索系统
 * 本地搜索历史 + 磁贴匹配 + Bing API 网络联想词。
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    const state = ns.state;
    const dom = ns.dom;
    const storage = ns.storage;
    const $$ = ns.$$;
    const escapeHtml = ns.escapeHtml;
    const tileManager = ns.tileManager;
    const engines = ns.engines;
    const renderEngineIcon = ns.renderEngineIcon;

    /* ===== 搜索历史 ===== */
    ns.loadSearchHistory = function () { state.searchHistory = storage.get('search_history', []); };
    function saveSearchHistory() { storage.set('search_history', state.searchHistory); }
    ns.clearSearchHistory = function () { state.searchHistory = []; saveSearchHistory(); };
    ns.addSearchHistory = function (term) {
        if (!term) return;
        state.searchHistory = state.searchHistory.filter(function (t) { return t !== term; });
        state.searchHistory.unshift(term);
        if (state.searchHistory.length > 20) state.searchHistory = state.searchHistory.slice(0, 20);
        saveSearchHistory();
    };

    /* ===== 建议构建 ===== */
    function getTileSuggestions(query) {
        const q = query.toLowerCase(), results = [];
        tileManager.currentTiles.forEach(function (tile) {
            if (tile.label.toLowerCase().includes(q)) {
                results.push({ type: 'tile', text: tile.url, label: tile.label, url: tile.url, icon: tile.icon, iconType: tile.type, imageData: tile.imageData });
            }
        });
        return results;
    }

    ns.buildSuggestions = function (query) {
        const suggestions = [], q = query.trim().toLowerCase();
        if (q) {
            state.searchHistory.filter(function (t) { return t.toLowerCase().includes(q); }).forEach(function (t) { suggestions.push({ type: 'history', text: t, label: t }); });
            suggestions.push.apply(suggestions, getTileSuggestions(q));
        } else {
            state.searchHistory.slice(0, 10).forEach(function (t) { suggestions.push({ type: 'history', text: t, label: t }); });
        }
        return suggestions;
    };

    /* ===== 网络联想词 ===== */
    let suggestionDebounce = null;
    function fetchOnlineSuggestions(query, callback) {
        // 搜索建议开关：当用户关闭时跳过网络请求，仅保留本地历史+磁贴匹配
        if (!ns.getSearchConfig || !ns.getSearchConfig().showSuggestions) { callback([]); return; }
        const url = 'https://api.bing.com/osjson.aspx?query=' + encodeURIComponent(query);
        try {
            fetch(url).then(function (r) { return r.json(); }).then(function (data) {
                if (Array.isArray(data) && Array.isArray(data[1])) callback(data[1]); else callback([]);
            }).catch(function (err) {
                // 网络类异常（离线/超时/CORS/非 JSON 响应）一律仅控制台告警，不抛到插件层
                console.warn('[网络] 联想词获取失败，网络原因自动跳过 详情:', (err && err.message) || err);
                callback([]);
            });
        } catch (err) {
            // fetch 同步异常（如运行环境不支持）也仅控制台告警，避免插件层报错
            console.warn('[网络] 联想词请求异常，已忽略 详情:', (err && err.message) || err);
            callback([]);
        }
    }

    ns.renderSuggestions = function () {
        // 搜索建议开关：关闭时不渲染
        if (ns.getSearchConfig && !ns.getSearchConfig().showSuggestions) { ns.hideSuggestions(); return; }
        const query = dom.searchInput.value, suggestions = ns.buildSuggestions(query);
        updateSuggestionDOM(suggestions, query);
        const q = query.trim().toLowerCase();
        if (q) {
            clearTimeout(suggestionDebounce);
            suggestionDebounce = setTimeout(function () {
                fetchOnlineSuggestions(q, function (onlineWords) {
                    const merged = suggestions.slice(), existingTexts = new Set(merged.map(function (s) { return s.text.toLowerCase(); }));
                    onlineWords.forEach(function (word) { if (!existingTexts.has(word.toLowerCase())) { merged.push({ type: 'online', text: word, label: word }); existingTexts.add(word.toLowerCase()); } });
                    updateSuggestionDOM(merged, query);
                });
            }, 150);
        }
    };

    function updateSuggestionDOM(suggestions, query) {
        let panel = document.querySelector('.search-suggestions') || document.getElementById('searchSuggestions');
        let list = document.querySelector('.suggestions-list') || document.getElementById('suggestionsList');
        let header = document.querySelector('.suggestions-header') || document.getElementById('suggestionsHeader');
        let footer = document.querySelector('.suggestions-footer') || document.getElementById('suggestionsFooter');
        if (!panel) {
            panel = document.createElement('div'); panel.className = 'search-suggestions';
            header = document.createElement('div'); header.className = 'suggestions-header';
            list = document.createElement('div'); list.className = 'suggestions-list';
            footer = document.createElement('div'); footer.className = 'suggestions-footer';
            panel.append(header, list, footer);
            if (dom.searchContainer) dom.searchContainer.appendChild(panel); else return;
        }
        list.innerHTML = ''; state.selectedSuggestionIndex = -1;
        const q = query.trim().toLowerCase();
        header.innerHTML = '';
        const headerTitle = document.createElement('span');
        headerTitle.textContent = q ? '搜索建议' : '最近搜索';
        header.appendChild(headerTitle);
        if (!q && state.searchHistory.length > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button'; clearBtn.className = 'suggestions-clear-btn'; clearBtn.textContent = '清除历史';
            clearBtn.setAttribute('aria-label', '清除全部历史搜索记录');
            clearBtn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); ns.clearSearchHistory(); ns.renderSuggestions(); dom.searchInput.focus(); });
            header.appendChild(clearBtn);
        }
        footer.textContent = '';
        if (suggestions.length === 0) {
            if (q) { panel.classList.remove('visible'); state.suggestionsVisible = false; return; }
            const empty = document.createElement('div'); empty.className = 'suggestion-empty';
            empty.innerHTML = ns.icon('history', 'dh-icon--md') + '<span>暂无搜索历史</span>';
            list.appendChild(empty);
            panel.classList.add('visible'); state.suggestionsVisible = true; return;
        }
        const frag = document.createDocumentFragment();
        suggestions.forEach(function (sug, index) {
            const div = document.createElement('div'); div.className = 'suggestion-item'; div.dataset.index = index;
            if (sug.type === 'history') div.innerHTML = ns.icon('history', 'dh-icon--md') + '<span>' + escapeHtml(sug.label) + '</span>';
            else if (sug.type === 'online') div.innerHTML = ns.icon('search', 'dh-icon--md') + '<span>' + escapeHtml(sug.label) + '</span>';
            else {
                let iconHtml = '';
                if (sug.iconType === 'fa') iconHtml = '<i class="' + escapeHtml(sug.icon) + '"></i>';
                else if (sug.iconType === 'emoji') iconHtml = '<span style="font-size:14px">' + escapeHtml(sug.icon) + '</span>';
                else if (sug.iconType === 'image' && sug.imageData) iconHtml = '<img src="' + escapeHtml(sug.imageData) + '" style="width:16px;height:16px;border-radius:2px">';
                else iconHtml = ns.icon('bookmark', 'dh-icon--md');
                div.innerHTML = iconHtml + '<span>' + escapeHtml(sug.label) + '</span><span style="margin-left:auto;color:var(--color-text-tertiary);font-size:var(--font-size-xs)">打开</span>';
            }
            div.addEventListener('mousedown', function (e) { e.preventDefault(); ns.applySuggestion(sug); });
            frag.appendChild(div);
        });
        list.appendChild(frag); panel.classList.add('visible'); state.suggestionsVisible = true;
    }

    ns.hideSuggestions = function () {
        let panel = document.querySelector('.search-suggestions') || document.getElementById('searchSuggestions');
        if (panel) panel.classList.remove('visible');
        state.suggestionsVisible = false; state.selectedSuggestionIndex = -1;
    };

    ns.updateActiveSuggestion = function () {
        let items = $$('.suggestion-item');
        items.forEach(function (item, i) { item.classList.toggle('active', i === state.selectedSuggestionIndex); });
        if (state.selectedSuggestionIndex >= 0 && items[state.selectedSuggestionIndex]) items[state.selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
    };

    ns.applySuggestion = function (sug) {
        if (sug.type === 'tile') { ns.openUrl(sug.url, { type: 'tiles' }); dom.searchInput.value = ''; ns.hideSuggestions(); dom.searchInput.blur(); }
        else { dom.searchInput.value = sug.text; ns.hideSuggestions(); ns.doSearch(); }
    };

    /* ===== 搜索执行 ===== */
    ns.doSearch = function () {
        const query = dom.searchInput.value.trim();
        if (!query) { dom.searchInput.focus(); return; }
        ns.addSearchHistory(query); ns.hideSuggestions();
        // 保留内容开关：关闭时搜索后清空输入框
        if (!ns.getSearchConfig || !ns.getSearchConfig().retainContent) { dom.searchInput.value = ''; }
        ns.openUrl(state.engineUrl + encodeURIComponent(query), { type: 'search' });
    };

    /* ===== 搜索引擎 ===== */
    const chevronDownSvg = ns.icon('chevron-down', 'dh-icon--sm');
    ns.initEngine = function () { ns.setEngine(storage.get('engine', 'google'), false); };
    ns.setEngine = function (key, save) {
        const eng = engines[key]; if (!eng) return;
        state.currentEngine = key; state.engineUrl = eng.url;
        dom.currentEngine.innerHTML = renderEngineIcon(eng) + '<span>' + eng.name + '</span>' + chevronDownSvg;
        if (save !== false) storage.set('engine', key);
        $$('.engine-option').forEach(function (opt) { opt.classList.toggle('active', opt.dataset.engine === key); });
    };

    ns.toggleEngineDropdown = function () {
        if (dom.engineDropdown.classList.contains('visible')) { ns.hideEngineDropdown(); } else { showEngineDropdown(); }
    };
    function showEngineDropdown() {
        const rect = dom.engineSelector.getBoundingClientRect();
        dom.engineDropdown.style.left = rect.left + 'px';
        dom.engineDropdown.style.top = rect.bottom + 6 + 'px';
        dom.engineDropdown.classList.add('visible');
        dom.engineSelector.classList.add('active');
    }
    ns.hideEngineDropdown = function () { dom.engineDropdown.classList.remove('visible'); dom.engineSelector.classList.remove('active'); };

    /* ===== 搜索事件 ===== */
    ns.handleSearchKeydown = function (e) {
        if (e.key === 'Enter') { ns.doSearch(); return; }
        if (!state.suggestionsVisible) return;
        let items = $$('.suggestion-item');
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); state.selectedSuggestionIndex = (state.selectedSuggestionIndex + 1) % items.length; ns.updateActiveSuggestion(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); state.selectedSuggestionIndex = (state.selectedSuggestionIndex - 1 + items.length) % items.length; ns.updateActiveSuggestion(); }
        else if (e.key === 'Escape') { e.preventDefault(); ns.hideSuggestions(); dom.searchInput.blur(); }
        else if (e.key === 'Tab') { e.preventDefault(); if (state.selectedSuggestionIndex >= 0 && items[state.selectedSuggestionIndex]) { const s = ns.buildSuggestions(dom.searchInput.value)[state.selectedSuggestionIndex]; if (s) ns.applySuggestion(s); } }
    };
    ns.handleSearchInput = function () { ns.renderSuggestions(); };
    ns.handleSearchFocus = function () { ns.renderSuggestions(); };
    ns.handleSearchBlur = function () { setTimeout(function () { if (!document.activeElement.closest('.suggestion-item')) ns.hideSuggestions(); }, 200); };

    /* ===== 搜索框设置管理 ===== */
    ns.getSearchConfig = function () {
        if (!ns.storage) return ns.DEFAULT_SEARCH_CONFIG;
        const saved = ns.storage.get('searchConfig') || {};
        return Object.assign({}, ns.DEFAULT_SEARCH_CONFIG, saved);
    };
    ns.applySearchConfig = function (config) {
        const dom = ns.dom;
        if (!dom.searchButton) return;
        // 隐藏搜索按钮
        dom.searchButton.style.display = config.hideSearchButton ? 'none' : '';
        // 搜索框尺寸
        const wrapper = dom.searchContainer || document.querySelector('.search-wrapper');
        if (wrapper) {
            wrapper.style.maxWidth = config.searchWidth + 'px';
            wrapper.style.borderRadius = config.searchRadius + 'px';
            wrapper.style.opacity = config.searchOpacity;
        }
    };

})(window.DevHome);
