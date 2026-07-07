/**
 * 笔记数据格式转换脚本
 *
 * 用途：将旧版 notes/data.json（单文件笔记数组）转换为独立 <noteId>.json 文件
 *
 * 用法：
 *   node scripts/convert-notes.mjs <配置目录路径>
 *
 * 示例：
 *   node scripts/convert-notes.mjs "C:\Users\xxx\DevHomeConfig"
 *
 * 安全措施：
 *   - 写入前创建 .bak 备份
 *   - 逐笔记校验 id 字段
 *   - 旧文件仅在全部写入成功后删除
 *   - 异常时保留原始文件不变
 */

import { readFile, writeFile, mkdir, readdir, unlink, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';

const NOTES_DIR = 'notes';
const OLD_FILE = 'data.json';
const BACKUP_SUFFIX = '.bak-' + Date.now();

// ─── 工具函数 ────────────────────────────────────

function log(msg) { console.log('  ' + msg); }
function success(msg) { console.log('✅ ' + msg); }
function warn(msg) { console.warn('⚠️  ' + msg); }
function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

// ─── 主流程 ──────────────────────────────────────

async function main() {
    const configDir = process.argv[2];

    if (!configDir) {
        console.log('用法: node scripts/convert-notes.mjs <配置目录路径>');
        console.log('示例: node scripts/convert-notes.mjs "C:\\Users\\xxx\\DevHomeConfig"');
        process.exit(1);
    }

    const notesDir = join(configDir, NOTES_DIR);
    const oldFile = join(notesDir, OLD_FILE);

    console.log('══════════════════════════════════════');
    console.log('  笔记格式转换：data.json → 独立文件');
    console.log('══════════════════════════════════════');
    console.log('配置目录: ' + configDir);
    console.log('笔记目录: ' + notesDir);

    // ─── 1. 前置检查 ──────────────────────────
    if (!existsSync(notesDir)) {
        fail('笔记目录不存在: ' + notesDir);
    }
    if (!existsSync(oldFile)) {
        fail('未找到旧版笔记文件: ' + oldFile);
    }

    // ─── 2. 读取原文件 ────────────────────────
    log('读取 ' + OLD_FILE + '...');
    let raw, notes;
    try {
        raw = await readFile(oldFile, 'utf-8');
    } catch (e) {
        fail('读取文件失败: ' + e.message);
    }

    try {
        notes = JSON.parse(raw);
    } catch (e) {
        fail('JSON 解析失败，文件可能已损坏: ' + e.message);
    }

    if (!Array.isArray(notes)) {
        fail('文件内容不是数组格式，可能已经是新格式，无需转换');
    }

    if (notes.length === 0) {
        warn('笔记数组为空，无需转换');
        process.exit(0);
    }

    log('发现 ' + notes.length + ' 条笔记');

    // 校验每条笔记
    const validNotes = [];
    const invalidNotes = [];
    for (const note of notes) {
        if (note && typeof note.id === 'string' && note.id.length > 0) {
            validNotes.push(note);
        } else {
            invalidNotes.push(note);
        }
    }

    if (invalidNotes.length > 0) {
        warn(invalidNotes.length + ' 条笔记缺少 id，将被跳过');
        for (const n of invalidNotes) {
            log('  跳过: ' + (n?.title || '(无标题)'));
        }
    }

    if (validNotes.length === 0) {
        fail('没有有效笔记（全部缺少 id），无法转换');
    }

    console.log('有效笔记: ' + validNotes.length + ' / ' + notes.length);

    // ─── 3. 备份原文件 ─────────────────────────
    const backupFile = oldFile + BACKUP_SUFFIX;
    try {
        await copyFile(oldFile, backupFile);
        success('备份已创建: ' + basename(backupFile));
    } catch (e) {
        warn('备份失败（继续执行）: ' + e.message);
    }

    // ─── 4. 转换为独立文件 ─────────────────────
    log('开始写入独立笔记文件...');
    let written = 0;
    const writtenIds = new Set();

    try {
        // 确保目录存在
        await mkdir(notesDir, { recursive: true });

        for (const note of validNotes) {
            const fileName = note.id + '.json';
            const filePath = join(notesDir, fileName);

            // 去重检查
            if (writtenIds.has(note.id)) {
                warn('重复 id 跳过: ' + note.id + ' (' + (note.title || '').slice(0, 30) + ')');
                continue;
            }

            try {
                await writeFile(filePath, JSON.stringify(note, null, 2), 'utf-8');
                writtenIds.add(note.id);
                written++;
            } catch (e) {
                warn('写入失败: ' + fileName + ' — ' + e.message);
            }
        }

        success('成功写入 ' + written + ' / ' + validNotes.length + ' 个笔记文件');
    } catch (e) {
        fail('写入过程异常: ' + e.message);
    }

    // ─── 5. 删除旧 data.json ───────────────────
    if (written === validNotes.length) {
        try {
            await unlink(oldFile);
            success('旧 data.json 已删除');
            // 清理备份文件
            try { await unlink(backupFile); } catch (_) { /* 可选 */ }
        } catch (e) {
            warn('删除旧 data.json 失败（不影响使用，可手动删除）: ' + e.message);
        }
    } else {
        warn('部分笔记写入失败（' + written + '/' + validNotes.length + '），保留旧 data.json 未删除');
        warn('备份文件: ' + basename(backupFile));
    }

    // ─── 6. 输出结果 ───────────────────────────
    console.log('');
    console.log('══════════════════════════════════════');
    console.log('  转换完成');
    console.log('══════════════════════════════════════');
    console.log('总笔记:   ' + notes.length);
    console.log('有效:     ' + validNotes.length);
    console.log('已写入:   ' + written);
    console.log('跳过:     ' + invalidNotes.length);
    console.log('');
    console.log('目标目录: ' + notesDir);
    console.log('');
}

main().catch(e => {
    console.error('❌ 未捕获异常:', e);
    process.exit(1);
});
