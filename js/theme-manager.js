/**
 * DevHome Workbench - ThemeManager
 * 色彩模式管理器（浅色/深色）
 *
 * 职责：
 * - 管理 data-color-scheme（light/dark）
 * - localStorage 持久化
 * - 发布 theme-changed 自定义事件
 *
 * 使用：
 *   ns.theme.init()            // 从 localStorage 恢复并应用
 *   ns.theme.setScheme('dark') // 设置深色模式
 */
(function (ns) {
    'use strict';

    var STORAGE_KEY = '_devhome_theme';
    var SCHEME_ATTR = 'data-color-scheme';

    /** 当前状态 */
    var state = {
        colorScheme: 'light'  // 'light' | 'dark'
    };

    /**
     * 应用色彩方案到 DOM
     */
    function applySchemeToDOM() {
        document.documentElement.setAttribute(SCHEME_ATTR, state.colorScheme);
    }

    /**
     * 持久化到 localStorage
     */
    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                colorScheme: state.colorScheme
            }));
        } catch (e) {
            console.warn('[色彩] localStorage 写入失败', e.message);
        }
    }

    /**
     * 发布主题变更事件
     */
    function emitThemeChanged() {
        var detail = {
            themeId: 'default',
            themeName: '蔚蓝',
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
     */
    function init() {
        console.log('[色彩] ThemeManager 初始化');
        var saved;
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (e) { /* ignore */ }

        if (saved && saved.colorScheme && (saved.colorScheme === 'light' || saved.colorScheme === 'dark')) {
            state.colorScheme = saved.colorScheme;
            console.log('[色彩] 恢复保存的方案 scheme=' + state.colorScheme);
        } else {
            state.colorScheme = 'light';
            console.log('[色彩] 使用默认方案 scheme=light');
        }

        applySchemeToDOM();
        persist();
        emitThemeChanged();
    }

    /**
     * 设置深浅色方案
     * @param {string} scheme - 'light' | 'dark'
     */
    function setScheme(scheme) {
        if (scheme !== 'light' && scheme !== 'dark') {
            console.warn('[色彩] 无效的方案: ' + scheme);
            return;
        }
        if (state.colorScheme === scheme) {
            console.log('[色彩] 已是 ' + (scheme === 'light' ? '浅色' : '深色') + '，跳过');
            return;
        }

        console.log('[色彩] 方案切换 ' + state.colorScheme + ' → ' + scheme);
        state.colorScheme = scheme;
        applySchemeToDOM();
        persist();
        emitThemeChanged();
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
        getState: getState
    };

})(window.DevHome = window.DevHome || {});
