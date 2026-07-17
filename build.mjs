/**
 * DevHome Workbench - 构建脚本
 *
 * 用法:
 *   node build.mjs              # 开发构建（不压缩，含 sourcemap）
 *   node build.mjs --prod       # 生产构建（压缩 + 不含 sourcemap）
 *   node build.mjs --bundle     # 业务代码打包为 js/bundle.js
 *   node build.mjs --prod --bundle  # 生产模式 + 业务代码打包
 *
 * 构建目标:
 *   1. 编译 js/components/ui/*.jsx → js/ui-components/*.js（React 组件）
 *   2. 打包 js/tiptap-editor.js → js/tiptap-bundle.js（Tiptap 编辑器）
 *   3. [--bundle] 业务代码打包：js/main.js + 所有依赖 → js/bundle.js
 *   4. [--bundle] CSS 合并：12 个 CSS 文件按顺序合并 → css/bundle.css
 */
import * as esbuild from 'esbuild';
import { readdirSync, mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.argv.includes('--prod');
const noBundle = process.argv.includes('--no-bundle');
const doBundle = !noBundle; // bundle 现在是默认行为，用 --no-bundle 跳过

// 根据模式调整构建参数
const minify = isProd;
const sourcemap = isProd ? false : 'inline';
const modeLabel = isProd ? 'production' : 'development';
console.log('[build] 构建模式: ' + modeLabel + (doBundle ? ' + bundle' : ''));

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

// ===== 3. 业务代码打包（默认开启，--no-bundle 跳过） =====
if (doBundle) {
    console.log('[build] 打包业务代码...');
    // 业务 JS 依赖顺序（与 index.html 中 <script> 标签顺序一致）
    // 注意：不包含 React/Tiptap/Shadcn 编译产物和外部库（marked/dayjs）
    const businessFiles = [
        'js/secrets.js',
        'js/config.js',
        'js/logger.js',
        'js/storage.js',
        'js/storageV2.js',
        'js/dataService.js',
        'js/fileConfig.js',
        'js/state.js',
        'js/utils.js',
        'js/quotes.js',
        'js/weather.js',
        'js/dailyGreetingCard.js',
        'js/favicon.js',
        'js/theme-manager.js',
        'js/bgManager.js',
        'js/pageManager.js',
        'js/linkOpener.js',
        'js/tiles.js',
        'js/categoryUI.js',
        // UI 子模块（右键菜单 → 设置面板 → 磁贴编辑器）
        'js/ui/_context-menu.js',
        'js/ui/_settings-panel.js',
        'js/ui/_tile-editor.js',
        'js/ui.js',
        'js/search.js',
        // 笔记子模块（按依赖顺序：CRUD → 笔记本 → 捕获 → 视图 → 编辑器 → 筛选器）
        'js/notes/_notes-crud.js',
        'js/notes/_notes-notebook.js',
        'js/notes/_notes-capture.js',
        'js/notes/_notes-view.js',
        'js/notes/_notes-editor.js',
        'js/notes/_notes-filter.js',
        // 笔记编排入口（聚合 notesManager API）
        'js/notes.js',
        'js/export.js',
        'js/workbench.js',
        // 事件模块（按领域拆分）
        'js/events/category-events.js',
        'js/events/notebook-events.js',
        'js/events/toolbar-events.js',
        'js/events/quadrant-events.js',
        'js/events/calendar-events.js',
        'js/events/pomodoro-events.js',
        'js/events/filter-events.js',
        'js/events/settings-events.js',
        'js/events/search-events.js',
        'js/events/global-events.js',
        'js/events/misc-events.js',
        'js/events.js',
        // 工作台私有模块
        'js/workbench_private/_quadrant-tasks.js',
        'js/workbench_private/_notes-workbench.js',
        'js/workbench_private/_pomodoro.js',
        'js/workbench_private/_calendar.js',
        'js/workbench_private/_dashboard.js',
        'js/main.js'
    ];

    // 使用 esbuild 的 stdin + virtual module 将多个文件拼接为一个 bundle
    // 策略：创建一个虚拟入口文件，按顺序注入每个文件的 IIFE 代码
    let combinedSource = '';
    businessFiles.forEach(function (file) {
        const fullPath = join(__dirname, file);
        if (existsSync(fullPath)) {
            const code = readFileSync(fullPath, 'utf8');
            // 直接拼接所有 IIFE 模块的源码
            combinedSource += '\n/* === ' + file + ' === */\n' + code + '\n';
        } else {
            console.warn('[build] 跳过不存在的文件: ' + file);
        }
    });

    // 通过 esbuild 压缩（仅压缩，不做 tree-shaking，因为 IIFE 无法静态分析依赖）
    const bundleResult = await esbuild.build({
        stdin: {
            contents: combinedSource,
            resolveDir: join(__dirname, 'js'),
            loader: 'js'
        },
        outfile: join(__dirname, 'js', 'bundle.js'),
        bundle: false,
        format: 'iife',
        target: 'es2017',
        minify,
        sourcemap,
        write: false,
        banner: { js: '/* DevHome Workbench - 业务代码打包 (' + modeLabel + ') */\n' }
    });

    const bundleSize = bundleResult.outputFiles.reduce((s, f) => s + f.bytes, 0);
    writeFileSync(join(__dirname, 'js', 'bundle.js'), bundleResult.outputFiles[0].contents);
    console.log('[build] ✓ 业务代码打包 → js/bundle.js (' + formatSize(bundleSize) + ')');
    console.log('[build] 包含 ' + businessFiles.length + ' 个业务文件');

    // ===== 4. [--bundle] CSS 合并 =====
    console.log('[build] 合并 CSS 文件...');
    // CSS 合并顺序：tokens → themes/default → base → 组件CSS（与 index.html 加载顺序一致）
    const cssFiles = [
        'css/tokens.css',
        'css/themes/default.css',
        'css/base.css',
        'css/fonts.css',
        'css/ui-components.css',
        'css/time-search.css',
        'css/tiles.css',
        'css/overlays.css',
        'css/workbench.css',
        'css/daily-greeting-card.css',
        'css/sidepanel.css',
        'css/tailwind-base.css'
    ];

    let combinedCss = '/* DevHome Workbench - CSS 合并 (' + modeLabel + ') */\n';
    cssFiles.forEach(function (file) {
        const fullPath = join(__dirname, file);
        if (existsSync(fullPath)) {
            let css = readFileSync(fullPath, 'utf8');
            // 生产模式：去除注释和多余空白
            if (isProd) {
                css = css
                    .replace(/\/\*[\s\S]*?\*\//g, '')  // 去除块注释
                    .replace(/\/\/.*$/gm, '')            // 去除行注释
                    .replace(/\n\s*\n/g, '\n')           // 合并空行
                    .replace(/[ \t]+/g, ' ')             // 合并空格
                    .replace(/;\s*/g, ';\n')             // 每条规则换行
                    .trim();
            }
            combinedCss += '\n/* === ' + file + ' === */\n' + css + '\n';
        } else {
            console.warn('[build] 跳过不存在的CSS: ' + file);
        }
    });

    writeFileSync(join(__dirname, 'css', 'bundle.css'), combinedCss, 'utf8');
    const cssSize = statSync(join(__dirname, 'css', 'bundle.css')).size;
    console.log('[build] ✓ CSS 合并 → css/bundle.css (' + formatSize(cssSize) + ')');
    console.log('[build] 包含 ' + cssFiles.length + ' 个 CSS 文件');
}

// ===== 构建总结 =====
let totalJs = 0;
entries.forEach(function (f) {
    const p = join(outDir, f.replace('.jsx', '.js'));
    if (existsSync(p)) {
        totalJs += statSync(p).size;
    }
});
console.log('\n[build] ' + modeLabel + ' 构建完成');
console.log('[build] 组件总计: ' + formatSize(totalJs));
if (isProd) {
    console.log('[build] 已启用: JS 压缩 + console 剔除 + SourceMap 关闭');
    console.log('[build] 生产构建适合发布，开发构建保留 sourcemap 用于调试');
}
if (doBundle) {
    console.log('[build] 已启用: 业务代码打包 + CSS 合并');

    // ===== 5. [--bundle] 生成生产版 index.bundle.html =====
    console.log('[build] 生成生产版 HTML...');
    const indexPath = join(__dirname, 'index.html');
    if (existsSync(indexPath)) {
        let html = readFileSync(indexPath, 'utf8');

        // 移除所有独立的 CSS <link>（保留主题文件）
        html = html.replace(/^\s*<link rel="stylesheet" href="(?!css\/themes\/)[^"]+\.css">\s*$/gm, '');
        // 在第一个 <link> 后插入 bundle.css
        html = html.replace(
            /(<link[^>]+themes\/[^>]+>)/,
            '$1\n    <link rel="stylesheet" href="css/bundle.css">'
        );

        // 移除所有独立的业务 JS <script defer>（保留 tiptap-bundle 和 lib/）
        html = html.replace(
            /^\s*<script src="js\/(?!(tiptap-bundle|lib\/))[^"]+\.js" defer><\/script>\s*$/gm,
            ''
        );
        // 清理多余的空行
        html = html.replace(/\n{3,}/g, '\n\n');

        // 在 tiptap-bundle 之后插入 bundle.js
        html = html.replace(
            /(<script src="js\/tiptap-bundle\.js" defer><\/script>)/,
            '$1\n    <script src="js/bundle.js" defer></script>'
        );

        const outPath = join(__dirname, 'index.bundle.html');
        writeFileSync(outPath, html, 'utf8');
        console.log('[build] ✓ 生产版 HTML → index.bundle.html (' + formatSize(statSync(outPath).size) + ')');
        console.log('[build] 使用方式: 将 index.bundle.html 设为 Chrome 扩展的默认页面');
    } else {
        console.warn('[build] index.html 不存在，跳过 HTML 生成');
    }
}

function formatSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
