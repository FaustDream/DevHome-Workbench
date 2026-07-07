/**
 * DevHome Workbench - 构建脚本
 *
 * 用法:
 *   node build.mjs           # 开发构建（不压缩，含 sourcemap）
 *   node build.mjs --prod    # 生产构建（压缩 + 不含 sourcemap）
 *
 * 构建目标:
 *   1. 编译 js/components/ui/*.jsx → js/ui-components/*.js（React 组件）
 *   2. 打包 js/tiptap-editor.js → js/tiptap-bundle.js（Tiptap 编辑器）
 */
import * as esbuild from 'esbuild';
import { readdirSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.argv.includes('--prod');

// 根据模式调整构建参数
const minify = isProd;
const sourcemap = isProd ? false : 'inline';
const modeLabel = isProd ? 'production' : 'development';
console.log('[build] 构建模式: ' + modeLabel);

const srcDir = join(__dirname, 'js', 'components', 'ui');
const outDir = join(__dirname, 'js', 'ui-components');

// 确保输出目录存在
if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
}

// ===== 1. React JSX 组件编译 =====
const entries = readdirSync(srcDir).filter(f => f.endsWith('.jsx'));

if (entries.length === 0) {
    console.log('[build] 未找到 JSX 组件文件，跳过');
} else {
    console.log('[build] 发现 ' + entries.length + ' 个组件: ' + entries.join(', '));
    let totalSize = 0;
    await Promise.all(entries.map(async (file) => {
        const entry = join(srcDir, file);
        const outfile = join(outDir, file.replace('.jsx', '.js'));
        const result = await esbuild.build({
            entryPoints: [entry],
            outfile,
            bundle: true,
            format: 'iife',
            globalName: file.replace('.jsx', '').replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }),
            target: 'es2017',
            jsx: 'transform',
            jsxFactory: 'React.createElement',
            jsxFragment: 'React.Fragment',
            external: ['react', 'react-dom'],
            minify,
            sourcemap,
            banner: { js: '/* DevHome Workbench - ' + file + ' (' + modeLabel + ') */' },
            drop: isProd ? ['console', 'debugger'] : []
        });
        const size = (result.outputFiles || []).reduce((s, f) => s + f.bytes, 0);
        totalSize += size;
        console.log('[build] ✓ ' + file + ' → ' + outfile.replace(__dirname + '/', '') + ' (' + formatSize(size) + ')');
    }));
    console.log('[build] 组件总计: ' + formatSize(totalSize));
}

// ===== 2. Tiptap 编辑器打包 =====
console.log('[build] 打包 Tiptap 编辑器...');
const tiptapResult = await esbuild.build({
    entryPoints: [join(__dirname, 'js', 'tiptap-editor.js')],
    outfile: join(__dirname, 'js', 'tiptap-bundle.js'),
    bundle: true,
    format: 'iife',
    globalName: '__tiptapBundle',
    target: 'es2017',
    minify,
    sourcemap,
    write: false,
    banner: { js: '/* DevHome Workbench - Tiptap 编辑器 (' + modeLabel + ') */\n' },
    plugins: [{
        name: 'fix-prosemirror-imports',
        setup(build) {
            build.onResolve({ filter: /^@tiptap\/pm$/ }, () => ({ external: true }));
        }
    }]
});
const tiptapSize = tiptapResult.outputFiles.reduce((s, f) => s + f.bytes, 0);
writeFileSync(join(__dirname, 'js', 'tiptap-bundle.js'), tiptapResult.outputFiles[0].contents);
console.log('[build] ✓ tiptap-editor.js → js/tiptap-bundle.js (' + formatSize(tiptapSize) + ')');

// ===== 构建总结 =====
const totalJs = entries.reduce((_, f) => {
    const p = join(outDir, f.replace('.jsx', '.js'));
    return existsSync(p) ? 0 : 0; // already counted
}, 0);
console.log('\n[build] ' + modeLabel + ' 构建完成');
if (isProd) {
    console.log('[build] 已启用: JS 压缩 + console 剔除 + SourceMap 关闭');
    console.log('[build] 生产构建适合发布，开发构建保留 sourcemap 用于调试');
}

function formatSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
