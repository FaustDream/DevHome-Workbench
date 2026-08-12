/**
 * Thrilled 构建脚本
 * - 将 src/background、src/pages/index 的 TS 入口用 esbuild 打包为 dist/ 产物
 * - 拷贝 css/、html、icons、defaults.json 到 dist/
 * - manifest.json 指向 dist/ 产物
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const PROD = process.argv.includes('--prod');

const entries = [
  { in: join(ROOT, 'src/background/background.ts'), out: join(DIST, 'background.js') },
  { in: join(ROOT, 'src/pages/index/main.ts'), out: join(DIST, 'index.js') },
];

const staticDirs = ['css', 'icons'];

async function main() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  for (const entry of entries) {
    await build({
      entryPoints: [entry.in],
      outfile: entry.out,
      bundle: true,
      format: 'iife',
      target: 'es2022',
      minify: PROD,
      sourcemap: !PROD,
      logLevel: 'info',
    });
  }

  for (const dir of staticDirs) {
    cpSync(join(ROOT, dir), join(DIST, dir), { recursive: true });
  }
  for (const file of ['index.html', 'manifest.json', 'defaults.json']) {
    cpSync(join(ROOT, file), join(DIST, file));
  }

  console.log(`[build] 完成 → dist/（${PROD ? 'production' : 'development'}）`);
}

main().catch((err) => {
  console.error('[build] 失败:', err);
  process.exit(1);
});
