/**
 * DevHome Workbench v2 - Markdown 导出
 *
 * 职责：
 *   1. 用户选择要导出的内容（笔记/捕获/任务）
 *   2. 拼接为单个 .md 文件
 *   3. 通过 chrome.downloads.download 下载
 */
window.DevHome = window.DevHome || {};
(function (ns) {
    'use strict';

    var state = ns.state;
    var dom = ns.dom;

    /* ===== 渲染导出列表 ===== */
    ns.renderExportList = function (filter) {
        if (!dom.wbMeExportList) return;
        var exportFilter = filter || state.exportFilter || 'all';

        var items = [];

        // 收集笔记
        if (exportFilter === 'all' || exportFilter === 'note') {
            (state.notes || []).forEach(function (n) {
                if (n.status !== 'active') return;
                items.push({
                    id: n.id,
                    type: 'note',
                    icon: '📝',
                    title: n.title,
                    date: n.updatedAt || n.createdAt,
                    data: n
                });
            });
        }

        // 收集捕获
        if (exportFilter === 'all' || exportFilter === 'capture') {
            (state.captures || []).forEach(function (c) {
                items.push({
                    id: c.id,
                    type: 'capture',
                    icon: '⚡',
                    title: c.content.slice(0, 50),
                    date: c.createdAt,
                    data: c
                });
            });
        }

        // 收集任务
        if (exportFilter === 'all' || exportFilter === 'task') {
            // 从 state.workbench 获取四象限任务
            var wb = state.workbench;
            if (wb && wb.quadrants) {
                ['q1', 'q2', 'q3', 'q4'].forEach(function (q) {
                    var tasks = wb.quadrants[q] && wb.quadrants[q].tasks;
                    if (!tasks) return;
                    tasks.forEach(function (t) {
                        items.push({
                            id: t.id,
                            type: 'task',
                            icon: t.status === 'completed' ? '✅' : t.status === 'cancelled' ? '❌' : '⬜',
                            title: t.title,
                            date: t.createdAt,
                            data: Object.assign({}, t, { quadrant: q })
                        });
                    });
                });
            }
        }

        // 按时间倒序
        items.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });

        if (items.length === 0) {
            dom.wbMeExportList.innerHTML = '<div style="color:var(--color-text-tertiary);font-size:12px;padding:12px;text-align:center;">没有可导出的内容</div>';
            return;
        }

        dom.wbMeExportList.innerHTML = items.map(function (item) {
            var dateStr = item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '';
            return '<label class="wb-me-export-item">' +
                '<input type="checkbox" data-export-id="' + ns.escapeHtml(item.id) + '" data-export-type="' + item.type + '">' +
                '<span class="wb-me-export-item-type">' + item.icon + '</span>' +
                '<span class="wb-me-export-item-title">' + ns.escapeHtml(item.title) + '</span>' +
                '<span class="wb-me-export-item-date">' + dateStr + '</span>' +
                '</label>';
        }).join('');

        // 存储 items 引用以便导出时使用
        state._exportItems = items;
    };

    /* ===== 全选/取消全选 ===== */
    ns.toggleSelectAllExport = function () {
        if (!dom.wbMeExportList) return;
        var checkboxes = dom.wbMeExportList.querySelectorAll('input[type="checkbox"]');
        var allChecked = Array.from(checkboxes).every(function (cb) { return cb.checked; });
        checkboxes.forEach(function (cb) { cb.checked = !allChecked; });
    };

    /* ===== 导出选中 ===== */
    ns.exportSelected = function () {
        if (!dom.wbMeExportList) return;
        var checkboxes = dom.wbMeExportList.querySelectorAll('input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            ns.showToast('请至少选择一项内容', 'info');
            return;
        }

        var items = state._exportItems || [];
        var selectedIds = Array.from(checkboxes).map(function (cb) { return cb.dataset.exportId; });
        var selected = items.filter(function (item) { return selectedIds.indexOf(item.id) !== -1; });

        // 拼接 Markdown
        var md = '';
        md += '# DevHome Workbench 导出\n\n';
        md += '> 导出时间：' + new Date().toLocaleString('zh-CN') + '\n';
        md += '> 导出数量：' + selected.length + ' 条\n\n';
        md += '---\n\n';

        selected.forEach(function (item) {
            if (item.type === 'note') {
                var n = item.data;
                md += '---\n';
                md += 'id: "' + n.id + '"\n';
                md += 'type: "' + n.type + '"\n';
                if (n.tags && n.tags.length) md += 'tags: [' + n.tags.map(function (t) { return '"' + t + '"'; }).join(', ') + ']\n';
                md += 'created: "' + new Date(n.createdAt).toISOString() + '"\n';
                if (n.sourceUrl) md += 'source: "' + n.sourceUrl + '"\n';
                md += '---\n\n';
                md += '# ' + (n.title || '无标题') + '\n\n';

                // HTML 内容提取为纯文本导出
                var content = n.content || '';
                if (/<[a-zA-Z][^>]*>/.test(content) || /&[a-z]+;/.test(content)) {
                    var tmp = document.createElement('div');
                    tmp.innerHTML = content;
                    content = tmp.textContent || tmp.innerText || '';
                }
                md += content + '\n\n';
            } else if (item.type === 'capture') {
                var c = item.data;
                md += '---\n';
                md += 'id: "' + c.id + '"\n';
                md += 'type: "capture"\n';
                md += 'created: "' + new Date(c.createdAt).toISOString() + '"\n';
                md += '---\n\n';
                md += '## ⚡ 快速捕获\n\n';
                md += c.content + '\n\n';
            } else if (item.type === 'task') {
                var t = item.data;
                var quadrantLabels = { q1: '重要且紧急', q2: '重要不紧急', q3: '紧急不重要', q4: '不紧急不重要' };
                var statusLabels = { active: '进行中', completed: '已完成', cancelled: '已取消' };
                md += '---\n';
                md += 'id: "' + t.id + '"\n';
                md += 'type: "task"\n';
                md += 'quadrant: "' + (t.quadrant || '') + '"\n';
                md += 'status: "' + (t.status || 'active') + '"\n';
                md += 'created: "' + new Date(t.createdAt).toISOString() + '"\n';
                if (t.completedAt) md += 'completed: "' + new Date(t.completedAt).toISOString() + '"\n';
                md += '---\n\n';
                md += '## ⬜ 任务：' + t.title + '\n\n';
                md += '- **象限**：' + (quadrantLabels[t.quadrant] || t.quadrant) + '\n';
                md += '- **状态**：' + (statusLabels[t.status] || t.status) + '\n';
                if (t.description) md += '- **详情**：' + t.description + '\n';
                md += '\n';
            }
        });

        // 生成 Blob 并下载
        var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var filename = 'devhome-export-' + new Date().toISOString().slice(0, 10) + '.md';

        if (typeof chrome !== 'undefined' && chrome.downloads) {
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            }, function () {
                // 延迟释放 Blob URL
                setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
            });
        } else {
            // 降级：使用 a 标签下载
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        }
    };

})(window.DevHome);
