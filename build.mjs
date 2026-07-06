/**
 * DevHome Workbench - Shadcn 组件构建脚本
 * 使用 esbuild 编译 js/components/ 下的 JSX 到 js/ui-components/
 * 
 * 用法: node build.mjs
 * 输出: js/ui-components/*.js（ES5 兼容，Chrome MV3 可直接引入）
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

// 获取所有 .jsx 源文件
const entries = readdirSync(srcDir).filter(f => f.endsWith('.jsx'));

if (entries.length === 0) {
    console.log('[build] 未找到 JSX 组件文件，跳过构建');
    process.exit(0);
}

console.log(`[build] 发现 ${entries.length} 个组件: ${entries.join(', ')}`);

/** 将 kebab-case 文件名转为合法的 IIFE globalName */
function toGlobalName(filename) {
    var base = filename.replace('.jsx', '');
    // kebab-case → camelCase
    return base.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
}

// 并行编译所有组件
await Promise.all(entries.map(async (file) => {
    const entry = join(srcDir, file);
    const outfile = join(outDir, file.replace('.jsx', '.js'));

    await esbuild.build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'iife',
        globalName: toGlobalName(file),
        target: 'es2017',
        jsx: 'transform',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
        external: ['react', 'react-dom'],
        minify: false,
        sourcemap: 'inline',
        banner: {
            js: `/* DevHome Workbench - Shadcn/ui 编译组件: ${file} */`
        }
    });

    console.log(`[build] ✓ ${file} → ${outfile}`);
}));

console.log('[build] 构建完成');
