// 构建脚本 - 打包 ProseMirror 和 highlight.js 为独立 bundle
import * as esbuild from 'esbuild';

const OUT_DIR = 'js/lib';

async function build() {
    console.log('[构建] 开始打包...\n');

    // 1. 打包 ProseMirror（所有 8 个模块 + basic schema）
    console.log('[构建] 打包 ProseMirror...');
    await esbuild.build({
        entryPoints: ['js/lib/pm-entry.js'],
        bundle: true,
        format: 'iife',
        globalName: 'PM',  // 不实际使用，entry 里已手动挂载 window.PM
        outfile: `${OUT_DIR}/pm.bundle.js`,
        target: ['chrome120'],
        minify: false,
        sourcemap: false,
        // prosemirror-view 依赖 prosemirror-model，bundle 中已包含，无需 external
    });
    console.log('[构建] ✓ pm.bundle.js 完成');

    // 2. 打包 highlight.js（仅 20 种语言）
    console.log('[构建] 打包 highlight.js...');
    await esbuild.build({
        entryPoints: ['js/lib/hljs-entry.js'],
        bundle: true,
        format: 'iife',
        globalName: 'hljs',  // 不实际使用，entry 里已手动挂载 window.hljs
        outfile: `${OUT_DIR}/hljs.bundle.js`,
        target: ['chrome120'],
        minify: false,
        sourcemap: false,
    });
    console.log('[构建] ✓ hljs.bundle.js 完成\n');

    console.log('[构建] 全部完成！');
    console.log(`  ${OUT_DIR}/pm.bundle.js`);
    console.log(`  ${OUT_DIR}/hljs.bundle.js`);
}

build().catch(err => {
    console.error('[构建] 失败:', err);
    process.exit(1);
});
