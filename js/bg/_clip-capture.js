/**
 * bg 子模块 — 网页剪藏 + 快捷键
 * 职责：右键菜单剪藏、快捷键剪藏、侧边栏控制
 */
'use strict';

/* ===== 右键菜单点击处理 ===== */
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'capture-selection' && info.selectionText) {
        handleClipCapture(info.selectionText.trim(), tab);
    }
});

/**
 * 处理网页剪藏：将选中文字保存为笔记
 * 直接操作 chrome.storage.local（SW 无 localStorage/DOM 权限），
 * 页面端 storageV2 读取时会自动同步到 localStorage 缓存。
 */
async function handleClipCapture(text, tab) {
    const clipData = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        content: text,
        type: 'webclip',
        tags: [],
        sourceUrl: tab ? tab.url : '',
        sourceTitle: tab ? tab.title : '',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    try {
        const result = await chrome.storage.local.get('v2/notes');
        const notes = result['v2/notes'] || [];
        notes.unshift(clipData);
        await chrome.storage.local.set({ 'v2/notes': notes });

        if (tab) { await chrome.sidePanel.open({ tabId: tab.id }); }

        chrome.runtime.sendMessage({ type: 'NEW_WEBCLIP', data: clipData }).catch(function () {});
        console.log('[后台] 剪藏已保存:', clipData.title);
    } catch (e) {
        console.error('[后台] 剪藏保存失败:', e);
    }
}

/* ===== 快捷键处理 ===== */
chrome.commands.onCommand.addListener(async function (command, tab) {
    if (command === 'capture_selection') {
        if (tab && tab.id) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: function () { return window.getSelection().toString().trim(); }
                });
                if (results && results[0] && results[0].result) {
                    handleClipCapture(results[0].result, tab);
                }
            } catch (e) {
                console.warn('[后台] 快捷键剪藏失败:', e);
            }
        }
    } else if (command === 'open_side_panel') {
        if (tab) { chrome.sidePanel.open({ tabId: tab.id }); }
    }
});
