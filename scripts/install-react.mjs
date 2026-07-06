/**
 * DevHome Workbench - React 安装脚本
 * 下载 React 18 生产构建到 js/lib/ 目录
 *
 * 用法: node scripts/install-react.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const libDir = join(__dirname, '..', 'js', 'lib');

if (!existsSync(libDir)) {
    mkdirSync(libDir, { recursive: true });
}

const FILES = {
    'react.production.min.js': 'https://unpkg.com/react@18/umd/react.production.min.js',
    'react-dom.production.min.js': 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
};

console.log('[install-react] 开始下载 React 生产构建...');

for (const [filename, url] of Object.entries(FILES)) {
    const dest = join(libDir, filename);
    console.log(`[install-react] 下载 ${url} → ${dest}`);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();
        writeFileSync(dest, content, 'utf-8');
        console.log(`[install-react] ✓ ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
        console.error(`[install-react] ✗ ${filename} 下载失败: ${err.message}`);
        console.error('[install-react] 请手动下载放置到 js/lib/ 目录');
    }
}

console.log('[install-react] 完成');
