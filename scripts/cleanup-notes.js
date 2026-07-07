/**
 * 四象限任务-笔记关联重构脚本
 *
 * 直接在浏览器 DevTools 控制台中执行。
 * 进入扩展的新标签页后，按 F12 打开控制台，粘贴执行。
 *
 * 功能：
 *  1. 备份当前状态到 window.__devhome_backup
 *  2. 清除所有笔记数据（chrome.storage + localStorage + 文件系统）
 *  3. 清空所有任务的 noteIds 关联
 *  4. 验证清理结果
 *
 * 安全：不触碰 tiles/pomodoro/behavior/config 等其他数据
 */

(async function cleanupNotesAndTaskLinks() {
    'use strict';

    const LOG = [];
    function log(msg, type) { type = type || 'info'; LOG.push({ type, msg, time: new Date().toISOString() }); console.log('%c' + msg, type === 'error' ? 'color:#ff6b6b;font-weight:bold' : type === 'warn' ? 'color:#ffcc66' : 'color:#47f0a2'); }

    log('═══════════════════════════════════════');
    log('  笔记清理 & 任务关联重构');
    log('═══════════════════════════════════════');

    // ─── 1. 备份 ─────────────────────────────
    try {
        log('创建备份...');
        var backup = {};

        // chrome.storage.local 数据
        var allStorage = await chrome.storage.local.get(['v2/notes', 'v2/tasks', 'v2/captures', 'v2/config']);
        backup['v2/notes'] = allStorage['v2/notes'] || [];
        backup['v2/tasks'] = allStorage['v2/tasks'] || [];
        backup['v2/captures'] = allStorage['v2/captures'] || [];
        backup['v2/config'] = allStorage['v2/config'] || {};

        // localStorage 缓存
        try { backup._cache_notes = JSON.parse(localStorage.getItem('devhome_v2_cache_notes') || '[]'); } catch (_) { backup._cache_notes = []; }
        try { backup._cache_tasks = JSON.parse(localStorage.getItem('devhome_v2_cache_tasks') || '[]'); } catch (_) { backup._cache_tasks = []; }

        // 旧版工作台数据
        try { backup._workbench = JSON.parse(localStorage.getItem('devhome_workbench') || 'null'); } catch (_) { backup._workbench = null; }

        window.__devhome_backup = backup;
        log('备份已保存到 window.__devhome_backup');
        log('  笔记数: ' + backup['v2/notes'].length);
        log('  任务数: ' + backup['v2/tasks'].length);
        log('  捕获数: ' + backup['v2/captures'].length);
    } catch (e) {
        log('备份失败: ' + e.message, 'error');
        log('操作已中止，未做任何修改', 'error');
        console.error(e);
        return;
    }

    // ─── 确认 ─────────────────────────────
    var confirmed = confirm(
        '即将执行以下操作：\n\n' +
        '1. 删除 ' + backup['v2/notes'].length + ' 条笔记\n' +
        '2. 清除所有任务的笔记关联\n' +
        '3. 保留 ' + backup['v2/tasks'].length + ' 条任务不删除\n\n' +
        '备份已存在 window.__devhome_backup 中。\n' +
        '确定继续？'
    );

    if (!confirmed) {
        log('用户取消操作', 'warn');
        return;
    }

    // ─── 2. 清除笔记 ───────────────────────
    try {
        // chrome.storage.local
        await chrome.storage.local.set({ 'v2/notes': [] });
        log('✓ chrome.storage.local v2/notes → []');

        // localStorage 缓存
        localStorage.setItem('devhome_v2_cache_notes', '[]');
        log('✓ localStorage devhome_v2_cache_notes → []');

        // 运行时状态
        if (window.DevHome && window.DevHome.state) {
            window.DevHome.state.notes = [];
            window.DevHome.state.currentNote = null;
            window.DevHome.state._deletedNotes = [];
            log('✓ 运行时 state.notes → []');
        }
    } catch (e) {
        log('清除笔记失败: ' + e.message, 'error');
        log('可用备份恢复: window.__devhome_backup', 'warn');
        return;
    }

    // ─── 3. 清除任务关联 ───────────────────
    try {
        var tasksV2 = backup['v2/tasks'];
        var modifiedCount = 0;

        // 处理 v2 任务
        tasksV2 = tasksV2.map(function (task) {
            if (Array.isArray(task.noteIds) && task.noteIds.length > 0) {
                task.noteIds = [];
                modifiedCount++;
            }
            if (typeof task.noteId === 'string' && task.noteId) {
                delete task.noteId;
                modifiedCount++;
            }
            return task;
        });

        await chrome.storage.local.set({ 'v2/tasks': tasksV2 });
        localStorage.setItem('devhome_v2_cache_tasks', JSON.stringify(tasksV2));
        log('✓ chrome.storage.local v2/tasks 关联已清除 (' + modifiedCount + ' 条任务)');

        // 处理 localStorage 旧版工作台任务
        var wb = backup._workbench;
        if (wb && wb.quadrants) {
            var wbModified = 0;
            ['q1', 'q2', 'q3', 'q4'].forEach(function (q) {
                var qt = wb.quadrants[q];
                if (qt && qt.tasks) {
                    qt.tasks.forEach(function (task) {
                        if (task.noteIds || task.noteId) {
                            task.noteIds = [];
                            delete task.noteId;
                            wbModified++;
                        }
                    });
                }
            });
            if (wbModified > 0) {
                localStorage.setItem('devhome_workbench', JSON.stringify(wb));
                log('✓ localStorage devhome_workbench 关联已清除 (' + wbModified + ' 条任务)');
            }
        }

        // 更新运行时工作台数据
        if (window.DevHome && window.DevHome.state && window.DevHome.state.workbench) {
            var swb = window.DevHome.state.workbench;
            if (swb.quadrants) {
                ['q1', 'q2', 'q3', 'q4'].forEach(function (q) {
                    var qt = swb.quadrants[q];
                    if (qt && qt.tasks) {
                        qt.tasks.forEach(function (task) {
                            task.noteIds = [];
                            delete task.noteId;
                        });
                    }
                });
            }
            log('✓ 运行时 state.workbench 关联已清除');
        }
    } catch (e) {
        log('清除任务关联失败: ' + e.message, 'error');
        log('可用备份恢复: window.__devhome_backup', 'warn');
        return;
    }

    // ─── 4. 验证 ─────────────────────────────
    log('\n─── 验证结果 ───');
    try {
        var verify = await chrome.storage.local.get(['v2/notes', 'v2/tasks']);
        var vNotes = verify['v2/notes'] || [];
        var vTasks = verify['v2/tasks'] || [];

        var remainingNoteIds = 0;
        vTasks.forEach(function (t) {
            if (Array.isArray(t.noteIds) && t.noteIds.length > 0) remainingNoteIds++;
            if (t.noteId) remainingNoteIds++;
        });

        log('  笔记数: ' + vNotes.length + ' (预期 0)');
        log('  任务数: ' + vTasks.length);
        log('  残留关联: ' + remainingNoteIds + ' (预期 0)');

        if (vNotes.length === 0 && remainingNoteIds === 0) {
            log('✅ 清理成功！', 'info');
        } else {
            log('⚠ 仍有残留数据', 'warn');
        }
    } catch (e) {
        log('验证失败: ' + e.message, 'error');
    }

    // ─── 5. 文件系统清理提示 ────────────────
    log('\n─── 文件系统清理 ───');
    log('如果已选择配置目录，请同时清理 notes/ 下的文件：');
    log('  方法1: 设置 → 文件配置 → 切换配置目录 → 重新选择同一目录');
    log('  方法2: 手动删除配置目录下 notes/ 文件夹中的所有 .json 文件');

    log('\n═══════════════════════════════════════');
    log('备份: window.__devhome_backup（本次会话有效）');
    log('恢复: 在控制台执行 restoreBackup()');
    log('═══════════════════════════════════════');
})();

/**
 * 恢复备份（在需要回滚时手动调用）
 */
window.restoreBackup = async function () {
    var backup = window.__devhome_backup;
    if (!backup) { console.error('无备份数据'); return; }

    try {
        await chrome.storage.local.set({
            'v2/notes': backup['v2/notes'],
            'v2/tasks': backup['v2/tasks']
        });
        localStorage.setItem('devhome_v2_cache_notes', JSON.stringify(backup['v2/notes']));
        localStorage.setItem('devhome_v2_cache_tasks', JSON.stringify(backup['v2/tasks']));
        if (backup._workbench) {
            localStorage.setItem('devhome_workbench', JSON.stringify(backup._workbench));
        }
        console.log('✅ 备份已恢复');
    } catch (e) {
        console.error('恢复失败:', e);
    }
};

console.log('📦 笔记清理脚本已加载，按需执行；备份函数 restoreBackup 已注册');
