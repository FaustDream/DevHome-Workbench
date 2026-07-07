/**
 * DevHome Workbench - 构建脚本
 * 1. 编译 js/components/ 下的 JSX → js/ui-components/
 * 2. 打包 Tiptap 编辑器 → js/tiptap-bundle.js
 * 
 * 用法: node build.mjs
 */
import * as esbuild from 'esbuild';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'js', 'components', 'ui');
const outDir = join(__dirname, 'js', 'ui-components');

// 确保输出目录存在
if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
}

// ===== 1. Shadcn JSX 组件编译 =====
const entries = readdirSync(srcDir).filter(f => f.endsWith('.jsx'));

if (entries.length === 0) {
    console.log('[build] 未找到 JSX 组件文件，跳过');
} else {
    console.log('[build] 发现 ' + entries.length + ' 个组件: ' + entries.join(', '));
    await Promise.all(entries.map(async (file) => {
        const entry = join(srcDir, file);
        const outfile = join(outDir, file.replace('.jsx', '.js'));
        await esbuild.build({
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
            minify: false,
            sourcemap: 'inline',
            banner: { js: '/* DevHome Workbench - 编译组件: ' + file + ' */' }
        });
        console.log('[build] ✓ ' + file + ' → ' + outfile);
    }));
}

// ===== 2. Tiptap 编辑器打包 =====
console.log('[build] 打包 Tiptap 编辑器...');
await esbuild.build({
    entryPoints: [join(__dirname, 'js', 'tiptap-editor.js')],
    outfile: join(__dirname, 'js', 'tiptap-bundle.js'),
    bundle: true,
    format: 'iife',
    globalName: '__tiptapBundle',
    target: 'es2017',
    minify: false,
    sourcemap: 'inline',
    banner: { js: '/* DevHome Workbench - Tiptap 富文本编辑器 bundle */\n/* 依赖: @tiptap/core, @tiptap/starter-kit, @tiptap/extension-placeholder */\n' },
    // 不 external 任何包，全部内联打包
    plugins: [{
        name: 'fix-prosemirror-imports',
        setup(build) {
            // 修复 ProseMirror 子包的 CJS/ESM 互操作问题
            build.onResolve({ filter: /^@tiptap\/pm$/ }, function () {
                return { external: true }; // 这个包在 iife 模式下不需要
            });
        }
    }]
});
console.log('[build] ✓ tiptap-editor.js → js/tiptap-bundle.js');

console.log('[build] 构建完成');
