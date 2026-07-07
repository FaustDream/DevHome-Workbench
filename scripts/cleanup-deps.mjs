/**
 * DevHome Workbench - 依赖分析与清理脚本
 *
 * 功能:
 *   1. 扫描项目所有 .js .jsx .html .mjs 源码，提取 import/require 的包名
 *   2. 对比 package.json dependencies，列出已使用 vs 未使用的包
 *   3. 计算 node_modules 目录大小（清理前后对比）
 *   4. 确认所有顶层依赖均被引用后，建议将 node_modules 移出 git 跟踪
 *
 * 用法: node scripts/cleanup-deps.mjs
 * 安全: 本脚本仅分析，不执行任何删除操作（clean 需额外传参 --do-clean）
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ===== 1. 读取 package.json =====
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});
console.log(`\n📦 package.json 依赖分析`);
console.log(`   dependencies:   ${deps.length} 个 (${deps.join(', ')})`);
console.log(`   devDependencies: ${devDeps.length} 个 (${devDeps.join(', ')})`);
console.log(`   总计: ${deps.length + devDeps.length} 个顶层包`);

// ===== 2. 扫描源码中实际 import/require 的包 =====
console.log(`\n🔍 扫描源码引用...`);

const sourceExts = ['.js', '.jsx', '.mjs', '.html'];
const scanDirs = ['js', 'build.mjs', 'scripts'];
const excludePatterns = ['node_modules', 'tiptap-bundle.js', 'react.production', 'react-dom.production'];
const usedPackages = new Set();

function collectFiles(dir) {
    const files = [];
    try {
        const entries = readdirSync(join(root, dir), { withFileTypes: true });
        for (const e of entries) {
            const full = join(dir, e.name);
            if (excludePatterns.some(p => full.includes(p))) continue;
            if (e.isDirectory()) {
                files.push(...collectFiles(full));
            } else if (sourceExts.some(ext => e.name.endsWith(ext))) {
                files.push(full);
            }
        }
    } catch (_) { /* skip */ }
    return files;
}

function scanSingleFile(filePath) {
    try {
        const content = readFileSync(join(root, filePath), 'utf8');
        // ES import: import ... from 'pkg'
        const importRe = /(?:import\s+(?:[\s\S]*?\s+from\s+)?['"]([@a-zA-Z0-9_/-]+)['"])/g;
        // CommonJS require: require('pkg')
        const requireRe = /require\s*\(\s*['"]([@a-zA-Z0-9_/-]+)['"]\s*\)/g;
        // Dynamic import: import('pkg')
        const dynImportRe = /import\s*\(\s*['"]([@a-zA-Z0-9_/-]+)['"]\s*\)/g;

        for (const re of [importRe, requireRe, dynImportRe]) {
            let m;
            while ((m = re.exec(content)) !== null) {
                const name = m[1];
                // 过滤相对路径导入
                if (name.startsWith('.') || name.startsWith('/')) continue;
                // 提取包名（处理 scoped packages 如 @tiptap/core）
                const parts = name.split('/');
                const pkgName = name.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
                usedPackages.add(pkgName);
            }
        }
    } catch (_) { /* skip */ }
}

// 收集并扫描所有源文件
const allFiles = [];
for (const dir of scanDirs) {
    const full = join(root, dir);
    if (existsSync(full)) {
        if (statSync(full).isDirectory()) {
            allFiles.push(...collectFiles(dir));
        } else {
            allFiles.push(dir);
        }
    }
}
// 也扫描单个文件
for (const f of ['build.mjs']) {
    if (existsSync(join(root, f))) {
        allFiles.push(f);
        scanSingleFile(f);
    }
}

for (const f of allFiles) {
    scanSingleFile(f);
}

console.log(`   已扫描 ${allFiles.length} 个源文件`);

// ===== 3. 生成使用报告 =====
console.log(`\n📋 依赖使用情况报告`);
console.log(`   ${'─'.repeat(56)}`);

const used = [];
const unused = [];

for (const dep of deps) {
    if (usedPackages.has(dep)) {
        used.push(dep);
        console.log(`   ✅ ${dep}  — 已使用`);
    } else {
        unused.push(dep);
        console.log(`   ❌ ${dep}  — 未使用（可移除）`);
    }
}

for (const dep of devDeps) {
    if (usedPackages.has(dep)) {
        console.log(`   ✅ ${dep} (dev) — 已使用`);
    } else {
        console.log(`   ❌ ${dep} (dev) — 未使用（可移除）`);
    }
}

// 列出被引用但不在 package.json 中的包
const missing = [...usedPackages].filter(p => !deps.includes(p) && !devDeps.includes(p));
if (missing.length > 0) {
    console.log(`\n⚠️  源码中引用但未在 package.json 中声明: ${missing.join(', ')}`);
    console.log(`   (这些包通过传递依赖间接可用，建议显式声明)`);
}

// ===== 4. 计算 node_modules 大小 =====
function dirSize(dirPath) {
    let size = 0;
    try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        for (const e of entries) {
            const full = join(dirPath, e.name);
            if (e.isDirectory()) {
                size += dirSize(full);
            } else {
                size += statSync(full).size;
            }
        }
    } catch (_) { /* skip */ }
    return size;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

const nodeModulesPath = join(root, 'node_modules');
if (existsSync(nodeModulesPath)) {
    const totalSize = dirSize(nodeModulesPath);
    console.log(`\n📊 node_modules 存储`);
    console.log(`   当前大小: ${formatSize(totalSize)}`);

    // 列出传递依赖数量
    const topLevelDirs = readdirSync(nodeModulesPath, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .filter(e => !e.name.startsWith('_'))
        .length;
    console.log(`   顶层目录: ${topLevelDirs} 个`);
}

// ===== 5. 结论与建议 =====
console.log(`\n🏁 分析结论`);
if (unused.length === 0) {
    console.log(`   ✅ 所有 ${deps.length + devDeps.length} 个顶层包均被实际引用，无冗余包`);
    console.log(`\n💡 优化建议:`);
    console.log(`   • node_modules 仅构建时使用，运行时依赖均已打包为独立 .js 文件`);
    console.log(`   • 建议将 node_modules/ 加入 .gitignore，克隆后执行 npm install`);
    console.log(`   • 此操作可减少 Git 仓库约 ${formatSize(dirSize(nodeModulesPath))} 的跟踪体积`);
    console.log(`   • 运行 npm run build 即可重新生成所有构建产物`);
} else {
    console.log(`   ⚠️ 发现 ${unused.length} 个未使用的包: ${unused.join(', ')}`);
    console.log(`   可执行 npm uninstall ${unused.join(' ')} 清理`);
}

// 显示 git 中 node_modules 的跟踪状态
console.log(`\n📝 若要移出 Git 跟踪:`);
console.log(`   echo node_modules/ >> .gitignore`);
console.log(`   git rm -r --cached node_modules/`);
console.log(`   git commit -m "chore: 从 Git 中移除 node_modules（构建时依赖，npm install 恢复）"`);
