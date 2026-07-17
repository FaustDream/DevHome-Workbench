/**
 * DevHome Workbench - ThemeManager
 * 色彩模式管理器（浅色/深色 + 系统偏好自动跟随）
 *
 * 职责：
 * - 管理 data-color-scheme（light/dark）
 * - localStorage 持久化
 * - 发布 theme-changed 自定义事件
 * - 支持 prefers-color-scheme 系统自动跟随（O16）
 *
 * 使用：
 *   ns.theme.init()            // 从 localStorage 恢复并应用
 *   ns.theme.setScheme('dark') // 设置深色模式
 *   ns.theme.enableAutoFollow() // 启用系统偏好自动跟随
 */
(function (ns) {
    'use strict';

    const STORAGE_KEY = '_devhome_theme';
    const SCHEME_ATTR = 'data-color-scheme';

    /** 当前状态 */
let state = {
        colorScheme: 'light',  // 'light' | 'dark'
        autoFollowSystem: false // 是否自动跟随系统偏好（O16）
    };

    /** prefers-color-scheme 媒体查询监听器引用 */
    let _systemSchemeQuery = null;

    /**
     * 应用色彩方案到 DOM
     */
    function applySchemeToDOM() {
        document.documentElement.setAttribute(SCHEME_ATTR, state.colorScheme);
    }

    /**
     * 持久化到 localStorage（保存方案和自动跟随状态）
     */
    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                colorScheme: state.colorScheme,
                autoFollowSystem: state.autoFollowSystem
            }));
        } catch (e) {
            console.warn('[色彩] localStorage 写入失败', e.message);
        }
    }

    /**
     * 发布主题变更事件
     */
    function emitThemeChanged() {
let detail = {
            themeId: 'default',
            themeName: '极简',
            colorScheme: state.colorScheme,
            resolvedScheme: state.colorScheme,
            isDark: state.colorScheme === 'dark'
        };
        console.log('[色彩] theme-changed', JSON.stringify(detail));
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: detail }));
    }

    /* ================================================================
       公开 API
       ================================================================ */

    /**
     * 初始化：从 localStorage 恢复色彩方案
     * 若启用了系统自动跟随，则根据系统偏好设置并注册监听
     */
    function init() {
        console.log('[色彩] ThemeManager 初始化');
let saved;
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (e) { /* ignore */ }

        if (saved && saved.colorScheme && (saved.colorScheme === 'light' || saved.colorScheme === 'dark')) {
            state.colorScheme = saved.colorScheme;
            state.autoFollowSystem = !!saved.autoFollowSystem;
            console.log('[色彩] 恢复保存的方案 scheme=' + state.colorScheme + ' autoFollow=' + state.autoFollowSystem);
        } else {
            // 首次使用：启用系统自动跟随
            state.autoFollowSystem = true;
            console.log('[色彩] 首次使用，启用系统偏好自动跟随');
        }

        // 若启用自动跟随，则以系统当前偏好覆盖
        if (state.autoFollowSystem) {
let systemScheme = _detectSystemScheme();
            console.log('[色彩] 系统偏好检测结果 scheme=' + systemScheme);
            state.colorScheme = systemScheme;
        }

        applySchemeToDOM();
        persist();
        emitThemeChanged();

        // 注册系统偏好变化监听器
        _bindSystemSchemeListener();
    }

    /**
     * 检测当前系统 prefers-color-scheme
     * @returns {'light' | 'dark'}
     */
    function _detectSystemScheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * 注册系统偏好变化监听器
     * 当系统层面切换浅色/深色时自动同步
     */
    function _bindSystemSchemeListener() {
        if (!window.matchMedia) return;

        // 先移除旧的监听器
        if (_systemSchemeQuery) {
            _systemSchemeQuery.removeEventListener('change', _onSystemSchemeChange);
        }

        _systemSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        _systemSchemeQuery.addEventListener('change', _onSystemSchemeChange);
    }

    /**
     * 系统偏好变化回调
     */
    function _onSystemSchemeChange(e) {
        if (!state.autoFollowSystem) return;

let newScheme = e.matches ? 'dark' : 'light';
        if (state.colorScheme === newScheme) return;

        console.log('[色彩] 系统偏好变更: ' + state.colorScheme + ' → ' + newScheme);
        state.colorScheme = newScheme;
        applySchemeToDOM();
        persist();
        emitThemeChanged();
    }

    /**
     * 设置深浅色方案（手动操作会禁用系统自动跟随）
     * @param {string} scheme - 'light' | 'dark'
     */
    function setScheme(scheme) {
        if (scheme !== 'light' && scheme !== 'dark') {
            console.warn('[色彩] 无效的方案: ' + scheme);
            return;
        }
        if (state.colorScheme === scheme && !state.autoFollowSystem) {
            console.log('[色彩] 已是 ' + (scheme === 'light' ? '浅色' : '深色') + '，跳过');
            return;
        }

        console.log('[色彩] 方案切换 ' + state.colorScheme + ' → ' + scheme);
        state.colorScheme = scheme;
        // 手动设置方案时禁用系统自动跟随
        if (state.autoFollowSystem) {
            state.autoFollowSystem = false;
            console.log('[色彩] 手动设置方案，禁用系统自动跟随');
        }
        applySchemeToDOM();
        persist();
        emitThemeChanged();
    }

    /**
     * 启用系统偏好自动跟随（O16）
     * 立即检测当前系统偏好并应用
     */
    function enableAutoFollow() {
        if (state.autoFollowSystem) {
            console.log('[色彩] 系统自动跟随已启用');
            return;
        }
        console.log('[色彩] 启用系统偏好自动跟随');
        state.autoFollowSystem = true;
let systemScheme = _detectSystemScheme();
        if (state.colorScheme !== systemScheme) {
            console.log('[色彩] 自动跟随：' + state.colorScheme + ' → ' + systemScheme);
            state.colorScheme = systemScheme;
            applySchemeToDOM();
        }
        persist();
        emitThemeChanged();
    }

    /**
     * 禁用系统偏好自动跟随
     */
    function disableAutoFollow() {
        if (!state.autoFollowSystem) return;
        console.log('[色彩] 禁用系统偏好自动跟随，保持当前方案 scheme=' + state.colorScheme);
        state.autoFollowSystem = false;
        persist();
    }

    /**
     * 获取当前是否启用系统自动跟随
     */
    function isAutoFollow() {
        return state.autoFollowSystem;
    }

    /**
     * 获取当前配色方案
     */
    function getActiveScheme() {
        return state.colorScheme;
    }

    /**
     * 获取当前主题状态
     */
    function getState() {
        return {
            themeId: 'default',
            colorScheme: state.colorScheme,
            resolvedScheme: state.colorScheme
        };
    }

    /** 兼容旧代码：theme.set() 转发到 setScheme() */
    function set(themeId) {
        // 仅 'default' 和旧主题 ID 兼容
        if (themeId === 'dark' || themeId === 'light') {
            setScheme(themeId);
        }
    }

    /* ================================================================
       挂载到全局命名空间
       ================================================================ */
    ns.theme = {
        init: init,
        set: set,
        setScheme: setScheme,
        getActiveScheme: getActiveScheme,
        getState: getState,
        // O16: 系统偏好自动跟随
        enableAutoFollow: enableAutoFollow,
        disableAutoFollow: disableAutoFollow,
        isAutoFollow: isAutoFollow
    };

})(window.DevHome = window.DevHome || {});
