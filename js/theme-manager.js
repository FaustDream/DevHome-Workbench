/**
 * DevHome Workbench - ThemeManager
 * 集中式主题管理器
 *
 * 职责：
 * - 主题注册表（元数据：id/name/supportedSchemes/fonts/linkId）
 * - 加载/卸载主题 CSS <link>（通过 media 属性互斥）
 * - 管理 data-color-scheme（light/dark/auto）
 * - 字体异步加载与兜底
 * - localStorage 持久化
 * - 发布 theme-changed 自定义事件
 *
 * 使用：
 *   ns.theme.init()            // 从 localStorage 恢复并应用
 *   ns.theme.set('hacker')     // 切换到黑客主题
 *   ns.theme.setScheme('dark') // 设置深浅色
 */

(function (ns) {
    'use strict';

    var STORAGE_KEY = '_devhome_theme';
    var SCHEME_ATTR = 'data-color-scheme';

    /** 主题注册表：每个主题的元数据 */
    var THEMES = {
        default: {
            id: 'default',
            name: '默认',
            description: '深海科技渐变 · 深色与浅色双模式',
            supportedSchemes: ['light', 'dark'],
            linkId: 'theme-default',
            fonts: [],
            // 主题卡片缩略图特征色条
            previewColors: ['#071b26', '#55e6d2', '#47f0a2']
        },
        hacker: {
            id: 'hacker',
            name: '黑客',
            description: '纯黑终端 · 荧光绿等宽字体',
            supportedSchemes: ['dark'],  // 仅深色
            linkId: 'theme-hacker',
            fonts: [
                { family: 'Fira Code', src: '../fonts/FiraCode.woff2' }
            ],
            previewColors: ['#0a0a0a', '#00ff41', '#ff0040']
        },
        warm_paper: {
            id: 'warm_paper',
            name: '暖纸',
            description: '米白纸质 · 铁锈红强调',
            supportedSchemes: ['light'],  // 仅浅色
            linkId: 'theme-warm-paper',
            fonts: [],
            previewColors: ['#f5f0e8', '#c0692a', '#1a1410']
        },
        pixel: {
            id: 'pixel',
            name: '像素',
            description: '像素复古 · 8-bit 命令行风',
            supportedSchemes: ['dark'],  // 仅深色
            linkId: 'theme-pixel',
            fonts: [
                { family: 'Press Start 2P', src: null },
                { family: 'VT323', src: null }
            ],
            previewColors: ['#0c0c0c', '#00ff41', '#ffb000']
        }
    };

    /** 当前状态 */
    var state = {
        themeId: 'default',
        colorScheme: 'auto'  // 'light' | 'dark' | 'auto'
    };

    /** 当前激活的 link 元素缓存 */
    var _activeLink = null;

    /** 系统配色方案媒体查询 */
    var _schemeMediaQuery = null;

    /* ================================================================
       内部方法
       ================================================================ */

    /**
     * 解析当前生效的色彩方案
     * 'auto' 时根据系统 prefers-color-scheme 返回实际值
     */
    function resolveScheme() {
        if (state.colorScheme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return state.colorScheme;
    }

    /**
     * 应用色彩方案到 DOM
     */
    function applySchemeToDOM() {
        document.documentElement.setAttribute(SCHEME_ATTR, state.colorScheme);
    }

    /**
     * 异步加载单个字体
     * @returns {Promise<boolean>} 是否加载成功
     */
    function loadFont(fontDef) {
        return new Promise(function (resolve) {
            // 先检查字体是否已加载
            if (document.fonts && document.fonts.check('1em ' + fontDef.family)) {
                console.log('[字体] ' + fontDef.family + ' 已缓存，跳过加载');
                resolve(true);
                return;
            }

            // 通过 FontFace API 加载
            if (fontDef.src) {
                console.log('[字体] 加载 ' + fontDef.family + '...');
                var fontFace = new FontFace(fontDef.family, 'url(' + fontDef.src + ')');
                fontFace.load().then(function (loaded) {
                    document.fonts.add(loaded);
                    console.log('[字体] ' + fontDef.family + ' 加载完成');
                    resolve(true);
                }).catch(function (err) {
                    console.warn('[字体] ' + fontDef.family + ' 加载失败，使用系统兜底', err.message);
                    resolve(false);
                });
            } else {
                // 字体已在 fonts.css 中预声明（Google Fonts 远程），只需触发浏览器加载
                // 尝试通过 document.fonts.load 触发
                if (document.fonts) {
                    document.fonts.load('1em ' + fontDef.family).then(function () {
                        console.log('[字体] ' + fontDef.family + ' 远程加载完成');
                    }).catch(function () {
                        console.warn('[字体] ' + fontDef.family + ' 远程加载超时，使用系统兜底');
                    });
                }
                resolve(true);
            }
        });
    }

    /**
     * 加载主题所需的所有字体
     */
    function loadThemeFonts(theme) {
        if (!theme.fonts || theme.fonts.length === 0) return;
        console.log('[主题] 加载 ' + theme.name + ' 字体（' + theme.fonts.length + ' 个）...');
        theme.fonts.forEach(function (fontDef) {
            loadFont(fontDef);
        });
    }

    /**
     * 激活指定的主题 link 元素
     */
    function activateThemeLink(themeId) {
        var theme = THEMES[themeId];
        if (!theme) return;

        // 先禁用当前激活的
        if (_activeLink && _activeLink.id !== theme.linkId) {
            _activeLink.setAttribute('media', 'not all');
        }

        // 启用目标主题
        var link = document.getElementById(theme.linkId);
        if (link) {
            link.removeAttribute('media');  // 恢复 all
            _activeLink = link;
        } else {
            console.warn('[主题] link #' + theme.linkId + ' 不存在');
        }
    }

    /**
     * 持久化到 localStorage
     */
    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                themeId: state.themeId,
                colorScheme: state.colorScheme
            }));
        } catch (e) {
            console.warn('[主题] localStorage 写入失败', e.message);
        }
    }

    /**
     * 发布主题变更事件
     */
    function emitThemeChanged() {
        var resolvedScheme = resolveScheme();
        var theme = THEMES[state.themeId];
        var detail = {
            themeId: state.themeId,
            themeName: theme ? theme.name : state.themeId,
            colorScheme: state.colorScheme,
            resolvedScheme: resolvedScheme,
            isDark: resolvedScheme === 'dark',
            theme: theme
        };
        console.log('[主题] theme-changed', JSON.stringify(detail));
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: detail }));
    }

    /* ================================================================
       公开 API
       ================================================================ */

    /**
     * 初始化：从 localStorage 恢复主题状态
     */
    function init() {
        console.log('[主题] ThemeManager 初始化');
        var saved;
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (e) { /* ignore */ }

        if (saved && saved.themeId && THEMES[saved.themeId]) {
            state.themeId = saved.themeId;
            state.colorScheme = saved.colorScheme || 'auto';
            console.log('[主题] 恢复保存的状态 themeId=' + state.themeId + ' scheme=' + state.colorScheme);
        } else {
            state.themeId = 'default';
            state.colorScheme = 'auto';
            console.log('[主题] 使用默认状态 themeId=default scheme=auto');
        }

        // 应用主题
        activateThemeLink(state.themeId);
        applySchemeToDOM();

        // 加载当前主题的字体
        var theme = THEMES[state.themeId];
        if (theme) {
            loadThemeFonts(theme);
        }

        // 如果色彩方案为 auto，监听系统变化
        if (state.colorScheme === 'auto') {
            _schemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            _schemeMediaQuery.addEventListener('change', function () {
                console.log('[主题] 系统配色方案变更 → ' + resolveScheme());
                emitThemeChanged();
            });
        }

        persist();
        emitThemeChanged();
    }

    /**
     * 切换主题
     * @param {string} themeId - 主题 ID
     */
    function set(themeId) {
        var theme = THEMES[themeId];
        if (!theme) {
            console.warn('[主题] 未知主题 ID: ' + themeId);
            return;
        }
        if (state.themeId === themeId) {
            console.log('[主题] 已是 ' + theme.name + '，跳过');
            return;
        }

        console.log('[主题] 切换 ' + THEMES[state.themeId].name + ' → ' + theme.name);

        // 智能联动：仅深色的主题，自动切换为深色模式
        if (theme.supportedSchemes.length === 1 && theme.supportedSchemes[0] === 'dark') {
            if (state.colorScheme !== 'dark') {
                state.colorScheme = 'dark';
                applySchemeToDOM();
                console.log('[主题] ' + theme.name + ' 仅支持深色，自动切换为深色模式');
                ns.showToast('已自动切换为深色模式以获得最佳视觉体验', 'info');
            }
        }

        // 仅浅色的主题，自动切换为浅色模式
        if (theme.supportedSchemes.length === 1 && theme.supportedSchemes[0] === 'light') {
            if (state.colorScheme !== 'light') {
                state.colorScheme = 'light';
                applySchemeToDOM();
                console.log('[主题] ' + theme.name + ' 仅支持浅色，自动切换为浅色模式');
                ns.showToast('已自动切换为浅色模式以获得最佳视觉体验', 'info');
            }
        }

        // 激活主题
        state.themeId = themeId;
        activateThemeLink(themeId);
        loadThemeFonts(theme);

        persist();
        emitThemeChanged();
    }

    /**
     * 设置深浅色方案
     * @param {string} scheme - 'light' | 'dark' | 'auto'
     */
    function setScheme(scheme) {
        var validSchemes = ['light', 'dark', 'auto'];
        if (validSchemes.indexOf(scheme) === -1) {
            console.warn('[主题] 无效的色彩方案: ' + scheme);
            return;
        }

        // 检查当前主题是否支持该方案
        var theme = THEMES[state.themeId];
        var resolved = scheme === 'auto' ? resolveScheme() : scheme;
        if (theme && theme.supportedSchemes.indexOf(resolved) === -1 && scheme !== 'auto') {
            console.warn('[主题] ' + theme.name + ' 不支持 ' + scheme + ' 方案');
            ns.showToast('当前主题不支持该色彩模式', 'warning');
            return;
        }

        console.log('[主题] 色彩方案 ' + state.colorScheme + ' → ' + scheme);
        state.colorScheme = scheme;
        applySchemeToDOM();

        // auto 模式下监听系统变化
        if (scheme === 'auto') {
            if (!_schemeMediaQuery) {
                _schemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                _schemeMediaQuery.addEventListener('change', function () {
                    console.log('[主题] 系统配色方案变更 → ' + resolveScheme());
                    emitThemeChanged();
                });
            }
        }

        persist();
        emitThemeChanged();
    }

    /**
     * 获取当前激活的主题元数据
     */
    function getActiveTheme() {
        return THEMES[state.themeId] || null;
    }

    /**
     * 获取当前配色方案
     */
    function getActiveScheme() {
        return resolveScheme();
    }

    /**
     * 获取所有已注册主题
     */
    function getThemes() {
        return THEMES;
    }

    /**
     * 获取当前主题状态
     */
    function getState() {
        return {
            themeId: state.themeId,
            colorScheme: state.colorScheme,
            resolvedScheme: resolveScheme()
        };
    }

    /* ================================================================
       挂载到全局命名空间
       ================================================================ */
    ns.theme = {
        init: init,
        set: set,
        setScheme: setScheme,
        getActiveTheme: getActiveTheme,
        getActiveScheme: getActiveScheme,
        getThemes: getThemes,
        getState: getState,
        THEMES: THEMES
    };

})(window.DevHome = window.DevHome || {});
