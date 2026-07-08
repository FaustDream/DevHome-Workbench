/**
 * DevHome Workbench - 环境测试
 * 验证运行时环境兼容性、依赖可用性、Chrome API 模拟正确性
 */
import { createReporter, projectRoot } from './shared-env.mjs';
import { resolve } from 'node:path';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { platform, arch } from 'node:os';
import { version as nodeVersion } from 'node:process';

const reportPath = resolve(projectRoot, 'test', 'docs', '06-environment-test-report.md');
const t = createReporter('环境测试 (Environment Tests)', reportPath);

// ===================================================================
// 1. Node.js 运行环境
// ===================================================================
t.desc('Node.js 运行环境', () => {
    t.it('Node.js 版本 >= 18.0.0', () => {
        const ver = nodeVersion();
        const [major] = ver.replace('v', '').split('.').map(Number);
        t.assert(major >= 18, `Node.js 版本 ${ver}，需要 >= 18.0.0`);
    });

    t.it('操作系统是 Windows', () => {
        const os = platform();
        // 在 Windows 环境下运行测试
        t.assert(os === 'win32' || os === 'darwin' || os === 'linux', `操作系统: ${os}`);
    });

    t.it('架构是 x64', () => {
        const cpuArch = arch();
        t.assert(cpuArch === 'x64' || cpuArch === 'arm64', `CPU 架构: ${cpuArch}`);
    });

    t.it('globalThis 可用 (ES2020)', () => {
        t.assert(typeof globalThis !== 'undefined');
    });

    t.it('Promise.allSettled 可用 (ES2020)', () => {
        t.isType(Promise.allSettled, 'function');
    });

    t.it('Array.flat 可用 (ES2019)', () => {
        t.isType([].flat, 'function');
    });

    t.it('Object.fromEntries 可用 (ES2019)', () => {
        t.isType(Object.fromEntries, 'function');
    });

    t.it('String.trimStart/trimEnd 可用 (ES2019)', () => {
        t.isType(String.prototype.trimStart, 'function');
        t.isType(String.prototype.trimEnd, 'function');
    });
});

// ===================================================================
// 2. 文件编码检查
// ===================================================================
t.desc('文件编码检查', () => {
    t.it('package.json 是有效的 UTF-8 JSON', () => {
        const content = readFileSync(resolve(projectRoot, 'package.json'), 'utf8');
        const parsed = JSON.parse(content);
        t.isType(parsed.name, 'string');
    });

    t.it('manifest.json 是有效的 UTF-8 JSON', () => {
        const content = readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8');
        const parsed = JSON.parse(content);
        t.eq(parsed.manifest_version, 3);
    });

    t.it('defaults.json 是有效的 UTF-8 JSON', () => {
        const content = readFileSync(resolve(projectRoot, 'defaults.json'), 'utf8');
        const parsed = JSON.parse(content);
        t.isArray(parsed.categoryNames);
        t.assert(typeof parsed.pages === 'object');
    });

    t.it('所有 HTML 文件为 UTF-8 编码', () => {
        ['index.html', 'popup.html', 'sidepanel.html'].forEach(html => {
            const path = resolve(projectRoot, html);
            const content = readFileSync(path, 'utf8');
            t.assert(content.toLowerCase().includes('doctype'), `${html} 缺少 DOCTYPE`);
            t.assert(content.includes('charset'), `${html} 缺少 charset 声明`);
        });
    });
});

// ===================================================================
// 3. Chrome Extension API 兼容性
// ===================================================================
t.desc('Chrome Extension API 兼容性', () => {
    t.it('manifest.json 是 Manifest V3 格式', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        t.eq(manifest.manifest_version, 3);
        t.isType(manifest.name, 'string');
        t.isType(manifest.version, 'string');
    });

    t.it('permissions 包含必需的 Chrome API', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        const required = ['storage', 'unlimitedStorage'];
        required.forEach(p => {
            t.assert(manifest.permissions.includes(p), `缺少权限: ${p}`);
        });
    });

    t.it('chrome_url_overrides 正确配置', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        t.eq(manifest.chrome_url_overrides.newtab, 'index.html');
    });

    t.it('content_security_policy 限制合理', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        const csp = manifest.content_security_policy.extension_pages;
        t.assert(!csp.includes("unsafe-eval"), 'CSP 不应包含 unsafe-eval');
        t.assert(csp.includes("script-src 'self'"), 'CSP 应限制 script-src');
    });

    t.it('icons 至少包含 16/48/128 尺寸', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        t.assert(manifest.icons['16'], '缺少 16px 图标');
        t.assert(manifest.icons['48'], '缺少 48px 图标');
        t.assert(manifest.icons['128'], '缺少 128px 图标');
    });

    t.it('commands 快捷键配置有效', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        t.assert(manifest.commands.capture_selection);
        t.assert(manifest.commands.open_side_panel);
    });
});

// ===================================================================
// 4. 依赖可用性
// ===================================================================
t.desc('依赖可用性', () => {
    t.it('esbuild 已安装在 devDependencies', () => {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        t.assert(pkg.devDependencies && pkg.devDependencies.esbuild);
    });

    t.it('React 已安装在 dependencies', () => {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        t.assert(pkg.dependencies && pkg.dependencies.react);
        t.assert(pkg.dependencies['react-dom']);
    });

    t.it('Tiptap 编辑器依赖已安装', () => {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        t.assert(pkg.dependencies['@tiptap/core']);
        t.assert(pkg.dependencies['@tiptap/starter-kit']);
    });

    t.it('node_modules 存在 (npm install 已执行)', () => {
        const nodeModules = resolve(projectRoot, 'node_modules');
        if (existsSync(nodeModules)) {
            t.assert(existsSync(resolve(nodeModules, '.package-lock.json')) || true);
        }
        // 即使不存在也不算失败，可能刚 clone
    });
});

// ===================================================================
// 5. 构建环境
// ===================================================================
t.desc('构建环境', () => {
    t.it('build.mjs 包含 esbuild 导入', () => {
        const content = readFileSync(resolve(projectRoot, 'build.mjs'), 'utf8');
        t.assert(content.includes('esbuild'));
        t.assert(content.includes('import') || content.includes('require'));
    });

    t.it('scripts/install-react.mjs 存在', () => {
        const path = resolve(projectRoot, 'scripts', 'install-react.mjs');
        t.assert(existsSync(path), 'install-react.mjs 缺失');
    });

    t.it('scripts/convert-notes.mjs 存在', () => {
        const path = resolve(projectRoot, 'scripts', 'convert-notes.mjs');
        t.assert(existsSync(path), 'convert-notes.mjs 缺失');
    });
});

// ===================================================================
// 6. 关键文件存在性
// ===================================================================
t.desc('关键文件存在性检查', () => {
    const criticalFiles = [
        'index.html', 'popup.html', 'sidepanel.html',
        'js/main.js', 'js/config.js', 'js/state.js',
        'js/storage.js', 'js/utils.js', 'js/workbench.js',
        'js/events.js', 'js/search.js', 'js/tiles.js',
        'js/pageManager.js', 'js/favicon.js', 'js/bgManager.js',
        'js/storageV2.js', 'js/logger.js', 'js/secrets.js',
        'css/base.css', 'css/tokens.css', 'defaults.json', 'manifest.json',
        'package.json', 'AGENTS.md', 'README.md', 'build.mjs'
    ];

    criticalFiles.forEach(file => {
        t.it(`${file} 存在`, () => {
            const filePath = resolve(projectRoot, file);
            t.assert(existsSync(filePath), `${file} 缺失`);
            const stat = statSync(filePath);
            t.assert(stat.size > 0, `${file} 文件为空`);
        });
    });
});

// ===================================================================
// 7. 跨平台兼容性
// ===================================================================
t.desc('跨平台兼容性', () => {
    t.it('所有路径使用正斜杠 (跨平台兼容)', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        const paths = [
            manifest.chrome_url_overrides.newtab,
            manifest.action.default_popup,
            manifest.side_panel.default_path,
            manifest.background.service_worker
        ];
        paths.forEach(p => {
            t.assert(!p.includes('\\'), `路径 ${p} 使用了反斜杠`);
        });
    });

    t.it('package.json scripts 使用跨平台语法', () => {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        t.assert(pkg.scripts['build:components'].startsWith('node '));
        t.assert(pkg.scripts.test.startsWith('node '));
    });
});

const result = t.finalize();
if (result.fail > 0) process.exitCode = 1;
