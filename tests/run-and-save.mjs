/**
 * DevHome Workbench - 测试运行器（自动生成输出汇总）
 *
 * 执行测试套件并将结果写入 tests/tests_output.txt，同时输出到控制台。
 * 用于构建流程中自动化测试验证，输出文件即测试汇总报告。
 *
 * 用法: node tests/run-and-save.mjs
 * npm:  npm test
 *
 * 输出:
 *   - 控制台：实时测试进度和结果
 *   - tests/tests_output.txt：完整测试报告（ANSI 颜色码已保留）
 *   - 退出码：0=全部通过，1=存在失败
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const testRunner = resolve(__dirname, 'run-tests.mjs');
const outputFile = resolve(__dirname, 'tests_output.txt');
const outputDir = dirname(outputFile);

// 确保输出目录存在
if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
}

// 生成报告头
const header = [
    '# DevHome Workbench — 测试输出汇总',
    '# 生成时间: ' + new Date().toISOString().replace('T', ' ').slice(0, 19),
    '# 测试脚本: tests/run-tests.mjs',
    '# 测试输出: tests/tests_output.txt',
    '# ============================================================\n'
].join('\n') + '\n';

console.log('[test] 开始运行测试...');

// 启动测试进程，捕获 stdout
const startTime = performance.now();
const child = spawn(process.execPath, [testRunner], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { FORCE_COLOR: '1' }) // 保留 ANSI 颜色
});

let stdout = '';
let stderr = '';

child.stdout.on('data', function (chunk) {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text); // 实时输出到控制台
});

child.stderr.on('data', function (chunk) {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
});

child.on('close', function (code) {
    const elapsed = Math.round(performance.now() - startTime);
    const exitInfo = '\n\n# ============================================================' +
        '\n# 退出码: ' + (code || 0) +
        '\n# 耗时: ' + elapsed + 'ms' +
        '\n# ============================================================\n';

    // 写入完整报告
    const fullReport = header + stdout + (stderr ? '\n# --- STDERR ---\n' + stderr : '') + exitInfo;
    writeFileSync(outputFile, fullReport, 'utf8');

    const fileSize = statSync(outputFile).size;
    console.log('\n[test] 测试报告已写入: tests/tests_output.txt (' + formatSize(fileSize) + ')');

    // 传递退出码
    if (code !== 0) {
        console.error('[test] 存在失败的测试');
        process.exitCode = 1;
    } else {
        console.log('[test] 全部测试通过 ✅');
    }
});

child.on('error', function (err) {
    console.error('[test] 启动测试进程失败:', err.message);
    process.exitCode = 1;
});

/** 格式化文件大小 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
