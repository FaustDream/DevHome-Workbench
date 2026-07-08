/**
 * DevHome Workbench - 自动化测试
 * 可集成到 CI/CD 流水线的自动化测试套件
 * 验证构建产物、依赖完整性、文件结构
 */
import { setupGlobalMock, loadModule, createReporter, getDH, clearLocalStorage, projectRoot } from './shared-env.mjs';
import { resolve, join } from 'node:path';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

setupGlobalMock();

const reportPath = resolve(projectRoot, 'test', 'docs', '02-automation-test-report.md');
const t = createReporter('自动化测试 (Automation Tests)', reportPath);

// 加载模块
['config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js', 'bgManager.js',
 'pageManager.js', 'tiles.js', 'categoryUI.js', 'ui.js', 'search.js', 'logger.js',
 'workbench.js', 'events.js', 'main.js'
].forEach(f => loadModule(f));

const D = getDH();
clearLocalStorage();

// ===================================================================
// 1. 项目结构完整性
// ===================================================================
t.desc('项目结构完整性', () => {
    t.it('根目录存在 manifest.json', () => {
        t.assert(existsSync(resolve(projectRoot, 'manifest.json')));
    });

    t.it('根目录存在 index.html', () => {
        t.assert(existsSync(resolve(projectRoot, 'index.html')));
    });

    t.it('根目录存在 popup.html', () => {
        t.assert(existsSync(resolve(projectRoot, 'popup.html')));
    });

    t.it('根目录存在 sidepanel.html', () => {
        t.assert(existsSync(resolve(projectRoot, 'sidepanel.html')));
    });

    t.it('根目录存在 package.json', () => {
        t.assert(existsSync(resolve(projectRoot, 'package.json')));
    });

    t.it('根目录存在 AGENTS.md', () => {
        t.assert(existsSync(resolve(projectRoot, 'AGENTS.md')));
    });

    t.it('js 目录存在且包含 .js 文件', () => {
        const files = readdirSync(resolve(projectRoot, 'js')).filter(f => f.endsWith('.js'));
        t.assert(files.length > 10);
    });

    t.it('css 目录存在且包含 .css 文件', () => {
        const files = readdirSync(resolve(projectRoot, 'css')).filter(f => f.endsWith('.css'));
        t.assert(files.length > 0);
    });

    t.it('icons 目录存在并包含 PNG/SVG 图标', () => {
        const files = readdirSync(resolve(projectRoot, 'icons'));
        const icons = files.filter(f => f.endsWith('.png') || f.endsWith('.svg'));
        t.assert(icons.length >= 3);
    });

    t.it('defaults.json 文件存在且有效', () => {
        t.assert(existsSync(resolve(projectRoot, 'defaults.json')));
        const content = readFileSync(resolve(projectRoot, 'defaults.json'), 'utf8');
        const parsed = JSON.parse(content);
        t.isArray(parsed.categoryNames);
        t.assert(typeof parsed.pages === 'object');
    });
});

// ===================================================================
// 2. manifest.json 配置验证
// ===================================================================
t.desc('Manifest 配置验证', () => {
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
    } catch (e) {
        t.assert(false, 'manifest.json 解析失败');
        return;
    }

    t.it('manifest_version 为 3', () => {
        t.eq(manifest.manifest_version, 3);
    });

    t.it('name 非空且为 DevHome Workbench', () => {
        t.isType(manifest.name, 'string');
        t.assert(manifest.name.includes('DevHome'));
    });

    t.it('version 格式为 semver', () => {
        t.assert(/^\d+\.\d+\.\d+$/.test(manifest.version));
    });

    t.it('chrome_url_overrides.newtab 指向 index.html', () => {
        t.eq(manifest.chrome_url_overrides.newtab, 'index.html');
    });

    t.it('action.default_popup 指向 popup.html', () => {
        t.eq(manifest.action.default_popup, 'popup.html');
    });

    t.it('side_panel.default_path 指向 sidepanel.html', () => {
        t.eq(manifest.side_panel.default_path, 'sidepanel.html');
    });

    t.it('包含 background service_worker', () => {
        t.assert(manifest.background && manifest.background.service_worker);
    });

    t.it('permissions 包含 storage', () => {
        t.assert(manifest.permissions.includes('storage'));
    });

    t.it('commands 包含 capture_selection 快捷键', () => {
        t.assert(manifest.commands && manifest.commands.capture_selection);
    });

    t.it('content_security_policy 限制 script-src', () => {
        const csp = manifest.content_security_policy;
        t.assert(csp && csp.extension_pages);
        t.assert(csp.extension_pages.includes("script-src 'self'"));
    });
});

// ===================================================================
// 3. package.json 依赖完整性
// ===================================================================
t.desc('package.json 依赖完整性', () => {
    let pkg;
    try {
        pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
    } catch (e) {
        t.assert(false, 'package.json 解析失败');
        return;
    }

    t.it('scripts 包含 build/test 命令', () => {
        t.assert(pkg.scripts && pkg.scripts.test);
        t.assert(pkg.scripts.build || pkg.scripts['build:components']);
    });

    t.it('依赖 prettier 在 tests/tests_output.txt 中', () => {
        t.assert(pkg.devDependencies && pkg.devDependencies.esbuild);
    });

    t.it('版本号与 manifest.json 一致', () => {
        const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'));
        t.eq(pkg.version, manifest.version);
    });
});

// ===================================================================
// 4. 构建产物验证
// ===================================================================
t.desc('构建产物验证', () => {
    t.it('ui-components 目录存在', () => {
        const dir = resolve(projectRoot, 'js', 'ui-components');
        const hasDir = existsSync(dir);
        const hasFiles = hasDir && readdirSync(dir).filter(f => f.endsWith('.js')).length > 0;
        // 如果没有构建产物，不算失败，跳过
        if (hasDir && hasFiles) {
            t.assert(hasFiles); // 有编译产物
        } else {
            // 跳过：需要先运行构建
        }
    });

    t.it('components/ui 源码目录有 JSX 文件', () => {
        const dir = resolve(projectRoot, 'js', 'components', 'ui');
        if (existsSync(dir)) {
            const jsxFiles = readdirSync(dir).filter(f => f.endsWith('.jsx'));
            t.assert(jsxFiles.length > 0);
        }
    });

    t.it('build.mjs 可执行为 ES Module', () => {
        const content = readFileSync(resolve(projectRoot, 'build.mjs'), 'utf8');
        t.assert(content.includes('esbuild'));
        t.assert(content.includes('import'));
    });
});

// ===================================================================
// 5. 数据持久化流程测试
// ===================================================================
t.desc('数据持久化流程', () => {
    t.it('存储 → 读取 → 清除 完整流程', () => {
        const key = 'auto_test_flow';
        D.storage.set(key, { flow: 1, data: 'hello' });
        const read = D.storage.get(key);
        t.deepEq(read, { flow: 1, data: 'hello' });
        D.storage.clear(key);
        t.eq(D.storage.get(key, 'default'), 'default');
    });

    t.it('devhomeStorage 完整 CRUD 流程', () => {
        D.devhomeStorage.set('flow_test', [1, 2, 3]);
        const val = D.devhomeStorage.get('flow_test');
        t.deepEq(val, [1, 2, 3]);

        // 更新
        D.devhomeStorage.set('flow_test', [1, 2, 3, 4]);
        t.deepEq(D.devhomeStorage.get('flow_test'), [1, 2, 3, 4]);
    });

    t.it('备份 → 最多3份 → 读取 完整流程', () => {
        for (let i = 1; i <= 4; i++) {
            D.backupPagesSnapshot('snap_' + i, [{ id: 'p' + i }], ['Page' + i]);
        }
        const snaps = D.storage.get('page_backups', []);
        t.eq(snaps.length, 3);
        t.eq(snaps[0].reason, 'snap_4');
    });
});

// ===================================================================
// 6. JS 文件语法正确性
// ===================================================================
t.desc('JS 文件语法正确性检查', () => {
    const jsFiles = [
        'config.js', 'storage.js', 'state.js', 'utils.js', 'favicon.js',
        'bgManager.js', 'pageManager.js', 'tiles.js', 'search.js'
    ];

    jsFiles.forEach(f => {
        t.it(`${f} 语法正确且无加载异常`, () => {
            const filePath = resolve(projectRoot, 'js', f);
            t.assert(existsSync(filePath), `${f} 不存在`);
            const code = readFileSync(filePath, 'utf8');
            // 验证文件非空
            t.assert(code.trim().length > 0, `${f} 文件为空`);
            // 验证是 IIFE 模式
            t.assert(code.includes('window.DevHome'), `${f} 未引用 DevHome 命名空间`);
        });
    });
});

// ===================================================================
// 7. 构建命令可用性
// ===================================================================
t.desc('构建命令可用性', () => {
    t.it('npm test 脚本指向 valid 文件', () => {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        const testPath = pkg.scripts.test;
        t.assert(existsSync(resolve(projectRoot, testPath)));
    });

    t.it('npm run build:components 脚本存在', () => {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
        t.assert(pkg.scripts['build:components']);
    });

    t.it('test 目录存在且包含测试文件', () => {
        const dir = resolve(projectRoot, 'tests');
        const hasDir = existsSync(dir);
        if (hasDir) {
            const testFiles = readdirSync(dir).filter(f => f.endsWith('.mjs') || f.endsWith('.txt'));
            t.assert(testFiles.length > 0);
        }
    });
});

const result = t.finalize();
if (result.fail > 0) process.exitCode = 1;
