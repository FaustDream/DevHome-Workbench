/**
 * DevHome Workbench - 简版全量测试运行器
 * 直接 import 每个测试模块，顺序执行并汇总结果。
 */
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const docsDir = resolve(__dirname, 'docs');

/** 从 manifest.json 动态读取版本号 */
function getVersion() {
    try {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        return manifest.version || 'unknown';
    } catch (_) {
        return 'unknown';
    }
}
const projectVersion = getVersion();

if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

const testModules = [
    { name: '单元测试', file: '01-unit-test.mjs', report: '01-unit-test-report.md', weight: 15 },
    { name: '自动化测试', file: '02-automation-test.mjs', report: '02-automation-test-report.md', weight: 10 },
    { name: '功能测试', file: '03-functional-test.mjs', report: '03-functional-test-report.md', weight: 10 },
    { name: '非功能测试', file: '04-nonfunctional-test.mjs', report: '04-nonfunctional-test-report.md', weight: 10 },
    { name: '回归测试', file: '05-regression-test.mjs', report: '05-regression-test-report.md', weight: 10 },
    { name: '环境测试', file: '06-environment-test.mjs', report: '06-environment-test-report.md', weight: 5 },
    { name: '安全测试', file: '07-security-test.mjs', report: '07-security-test-report.md', weight: 5 },
    { name: '代码静态分析', file: '08-static-analysis.mjs', report: '08-static-analysis-report.md', weight: 5 },
    { name: '边界值&幻觉测试', file: '09-boundary-hallucination.mjs', report: '09-boundary-hallucination-test-report.md', weight: 5 },
    { name: '覆盖率检查', file: '10-coverage-check.mjs', report: '10-coverage-report.md', weight: 5 },
    { name: '旧版BDD测试(T7)', file: '11-legacy-tests.mjs', report: '11-legacy-tests-report.md', weight: 5 },
    { name: 'storageV2测试(T3)', file: '12-storage-test.mjs', report: '12-storage-test-report.md', weight: 5 },
    { name: 'notes.js测试(T1)', file: '13-notes-test.mjs', report: '13-notes-test-report.md', weight: 5 },
    { name: 'fileConfig测试(T2)', file: '14-fileconfig-test.mjs', report: '14-fileconfig-test-report.md', weight: 5 },
    { name: 'background测试(T4)', file: '15-background-test.mjs', report: '15-background-test-report.md', weight: 5 },
    { name: 'events.js测试(T5)', file: '16-events-test.mjs', report: '16-events-test-report.md', weight: 5 },
    { name: 'main.js测试(T6)', file: '17-main-test.mjs', report: '17-main-test-report.md', weight: 5 },
];

const allResults = [];
const startTotal = Date.now();

console.log('█'.repeat(60));
console.log('  DevHome Workbench — 全量测试套件 (v2)');
console.log('  报告输出: test/docs/');
console.log('  测试模块: ' + testModules.length + ' 项');
console.log('█'.repeat(60));

for (let i = 0; i < testModules.length; i++) {
    const m = testModules[i];
    const testPath = resolve(__dirname, m.file);

    if (!existsSync(testPath)) {
        console.log(`\n[${i + 1}/${testModules.length}] ${m.name}: ❌ 文件缺失`);
        allResults.push({ name: m.name, passed: false, error: '文件缺失', total: 0, pass: 0, fail: 0, pct: 0, elapsed: 0, weight: m.weight, report: m.report });
        continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${i + 1}/${testModules.length}] ${m.name}: ${m.file}`);
    console.log('─'.repeat(60));

    const moduleStart = Date.now();
    const result = spawnSync(process.execPath, ['--no-deprecation', testPath], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        timeout: 30000
    });

    const elapsed = Date.now() - moduleStart;
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';

    // 输出到控制台
    if (stdout.trim()) process.stdout.write(stdout);
    if (stderr.trim()) process.stderr.write(stderr);

    // 解析统计信息
    const totalMatch = stdout.match(/总计: (\d+)/);
    const passMatch = stdout.match(/✓ (\d+)/);
    const failMatch = stdout.match(/✗ (\d+)/);
    const pctMatch = stdout.match(/通过率: (\d+)%/);

    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    const pass = passMatch ? parseInt(passMatch[1]) : 0;
    const fail = failMatch ? parseInt(failMatch[1]) : 0;
    const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
    const passed = result.status === 0 && fail === 0;

    allResults.push({ name: m.name, passed, error: result.error ? result.error.message : null, total, pass, fail, pct, elapsed, weight: m.weight, report: m.report, exitCode: result.status });

    const icon = passed ? '✅' : '❌';
    console.log(`[结果] ${icon} ${m.name}: ${total} 用例, ${pass} 通过, ${fail} 失败, ${pct}%, ${elapsed}ms`);
}

// ===== 生成总览报告 =====
console.log(`\n${'='.repeat(60)}`);
console.log('[最终] 生成综合总览报告...');

const totalAll = allResults.reduce((s, r) => s + r.total, 0);
const passAll = allResults.reduce((s, r) => s + r.pass, 0);
const failAll = allResults.reduce((s, r) => s + r.fail, 0);
const overallPct = totalAll > 0 ? Math.round(passAll / totalAll * 100) : 0;
const allPassed = allResults.every(r => r.passed);
const totalTime = Date.now() - startTotal;

let weightedScore = 0;
allResults.forEach(r => {
    const modulePct = r.total > 0 ? Math.round(r.pass / r.total * 100) : 0;
    weightedScore += (modulePct * r.weight / 100);
});

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
let report = '';
report += `# DevHome Workbench — 综合测试总览\n\n`;
report += `- **生成时间**: ${now}\n`;
report += `- **项目**: DevHome Workbench v${projectVersion}\n`;
report += `- **执行模式**: 全量测试 (${testModules.length} 项)\n\n`;

report += `## 执行摘要\n\n`;
report += `| 指标 | 值 |\n`;
report += `|------|----|\n`;
report += `| 测试用例总数 | ${totalAll} |\n`;
report += `| 通过 | ${passAll} ✅ |\n`;
report += `| 失败 | ${failAll} ❌ |\n`;
report += `| 通过率 | ${overallPct}% |\n`;
report += `| 加权评分 | ${weightedScore.toFixed(1)}/100 |\n`;
report += `| 总耗时 | ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s) |\n`;
report += `| 状态 | ${allPassed ? '✅ 全部通过' : '⚠️ 存在失败'} |\n\n`;

report += `## 各模块结果\n\n`;
report += `| # | 测试类型 | 用例数 | 通过 | 失败 | 通过率 | 状态 | 报告 |\n`;
report += `|---|----------|--------|------|------|--------|------|------|\n`;

allResults.forEach((r, i) => {
    const icon = r.passed ? '✅' : '❌';
    report += `| ${i + 1} | ${r.name} | ${r.total || '-'} | ${r.pass || '-'} | ${r.fail || '-'} | ${r.pct}% | ${icon} | [查看](${r.report}) |\n`;
});

report += '\n';

// 失败详情
const failedModules = allResults.filter(r => !r.passed);
if (failedModules.length > 0) {
    report += `## 失败模块详情\n\n`;
    failedModules.forEach(r => {
        report += `### ${r.name}\n`;
        report += `- **失败数**: ${r.fail} 个\n`;
        report += `- **通过率**: ${r.pct}%\n`;
        report += `- **退出码**: ${r.exitCode || '-'}\n`;
        report += `- **详细报告**: [${r.report}](${r.report})\n\n`;
    });
}

report += `## 改进建议\n\n`;
if (!allPassed) report += `1. 修复失败测试后再运行完整套件\n`;
const lowCoverage = allResults.filter(r => r.total > 0 && r.pct < 80);
if (lowCoverage.length > 0) report += `2. 提高以下模块覆盖率: ${lowCoverage.map(r => r.name).join(', ')}\n`;
report += `3. 对 Chrome API 模块 (bgManager.js, storageV2.js) 添加 E2E 测试\n`;
report += `4. 在 CI/CD 流水线中集成此套件\n`;
report += `5. 定期更新边界值测试用例\n\n`;

report += `## 报告文件索引\n\n`;
allResults.forEach((r, i) => {
    const p = resolve(docsDir, r.report);
    const size = existsSync(p) ? statSync(p).size : 0;
    report += `| ${i + 1} | [${r.name}](${r.report}) | ${formatSize(size)} |\n`;
});
report += `\n---\n*此报告由 test/run-all-tests.mjs 自动生成*\n`;

writeFileSync(resolve(docsDir, '00-overview-report.md'), report, 'utf8');

console.log('\n' + '█'.repeat(60));
console.log(`  最终统计: ${totalAll} 用例, ${passAll} 通过, ${failAll} 失败`);
console.log(`  通过率: ${overallPct}% | 状态: ${allPassed ? '✅ 全部通过' : '⚠️ 存在失败'}`);
console.log('█'.repeat(60));

if (!allPassed) process.exitCode = 1;

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
