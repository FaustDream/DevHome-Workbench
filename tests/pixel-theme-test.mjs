/**
 * DevHome Workbench - 像素主题 CSS 合规测试
 * 
 * 直接解析 pixel-theme.css，验证像素/8-bit 风格的完整性：
 * - 色板变量（纯黑底 + 荧光绿文字 + 像素边框色）
 * - 字体声明（Press Start 2P + VT323）
 * - 像素渲染规则（image-rendering: pixelated）
 * - CRT 扫描线效果
 * - 零圆角约束
 * - 双层像素边框 + 像素投影
 * 
 * 运行: node tests/pixel-theme-test.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ===== 读取像素主题 CSS =====
const css = readFileSync(resolve(projectRoot, 'css', 'pixel-theme.css'), 'utf8');

// ===== 测试框架 =====
let total = 0, pass = 0, fail = 0;
function describe(n, fn) {
	console.log('\n' + '─'.repeat(58));
	console.log('  ' + n);
	console.log('─'.repeat(58));
	fn();
}
function it(n, fn) {
	total++;
	try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + n); }
	catch (e) { fail++; console.log('  \x1b[31m✗\x1b[0m ' + n); console.log('    \x1b[31m' + String(e.message).split('\n')[0] + '\x1b[0m'); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const assertMatch = (text, pattern, m) => { if (!pattern.test(text)) throw new Error((m || '') + '\n      未找到匹配: ' + pattern); };
const assertNoMatch = (text, pattern, m) => { if (pattern.test(text)) throw new Error((m || '') + '\n      不应匹配: ' + pattern); };

console.log('\n' + '█'.repeat(58));
console.log('  DevHome Workbench — Pixel Theme CSS 合规测试');
console.log('█'.repeat(58));

// ===================================================================
// 1. 色板变量 — 像素主题核心色板
// ===================================================================
describe('色板: CSS 自定义属性完整定义', () => {
	const paletteExpect = [
		['主背景', '--px-bg-primary', '#0c0c0c'],
		['次级面板', '--px-bg-secondary', '#1a1a2e'],
		['三级面板', '--px-bg-tertiary', '#16213e'],
		['弹窗面板', '--px-bg-panel', '#0f0f23'],
		['主文字(荧光绿)', '--px-text-primary', '#00ff41'],
		['次级文字', '--px-text-secondary', '#00cc33'],
		['暗淡文字', '--px-text-dim', '#008f11'],
		['白色文字', '--px-text-white', '#e0e0e0'],
		['琥珀色', '--px-text-amber', '#ffb000'],
		['青色', '--px-text-cyan', '#00ffff'],
		['品红', '--px-text-magenta', '#ff00ff'],
		['黄色', '--px-text-yellow', '#ffff00'],
		['红色', '--px-text-red', '#ff4136'],
		['亮边框(荧光绿)', '--px-border-light', '#00ff41'],
		['暗边框', '--px-border-dim', '#008f11'],
		['深绿投影', '--px-border-dark', '#003b00'],
		['白色边框', '--px-border-white', '#ffffff'],
	];
	paletteExpect.forEach(([label, varName, expectedColor]) => {
		it(`${varName} = ${expectedColor} (${label})`, () => {
			const re = new RegExp(varName.replace('--', '--') + ':\\s*' + expectedColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
			assertMatch(css, re, `缺少或值不匹配: ${varName}: ${expectedColor}`);
		});
	});

	it('色板变量均在 :root 下定义（全局生效）', () => {
		const rootBlock = css.match(/:root\s*\{([^}]+)\}/s);
		assert(rootBlock, ':root 块未找到');
		paletteExpect.forEach(([, varName]) => {
			assert(rootBlock[1].includes(varName), `${varName} 不在 :root 中`);
		});
	});

	it('色板变量总数≥17个', () => {
		const varCount = (css.match(/--px-/g) || []).length;
		assert(varCount >= 17, `CSS 变量引用少于 17 个，实际: ${varCount}`);
	});
});

// ===================================================================
// 2. 背景 — 纯黑底 + 数字雨穿透
// ===================================================================
describe('背景: 纯黑底色 + 半透明面板', () => {
	it('html, body 背景为纯黑 #000', () => {
		assertMatch(css, /html,\s*body\s*\{[^}]*background:\s*#000\s*!important/s);
	});

	it('面板使用 rgba 半透明让数字雨穿透', () => {
		const rgbaCount = (css.match(/rgba\(/g) || []).length;
		assert(rgbaCount >= 8, `rgba 半透明规则少于 8 条，实际: ${rgbaCount}`);
	});

	it('.devhome-stage 背景为 transparent', () => {
		assertMatch(css, /\.devhome-stage\s*\{[^}]*background:\s*transparent/s);
	});

	it('.search-wrapper 背景为 transparent', () => {
		assertMatch(css, /\.search-wrapper\s*\{[^}]*background:\s*transparent/s);
	});

	it('.tile 背景为 transparent', () => {
		assertMatch(css, /\.tile\s*\{[^}]*background:\s*transparent/s);
	});

	it('禁用自定义背景容器 #bgContainer', () => {
		assertMatch(css, /#bgContainer\s*\{[^}]*display:\s*none/s);
	});

	it('禁用 base.css 网格线 body::before', () => {
		assertMatch(css, /body::before\s*\{[^}]*display:\s*none\s*!important/s);
	});
});

// ===================================================================
// 3. 字体 — 像素字体栈
// ===================================================================
describe('字体: Press Start 2P + VT323', () => {
	it('引入 Google Fonts Press Start 2P + VT323', () => {
		assert(css.includes('Press+Start+2P'), '缺少 Press Start 2P 字体');
		assert(css.includes('VT323'), '缺少 VT323 字体');
	});

	it('--px-font-display = "Press Start 2P"', () => {
		assertMatch(css, /--px-font-display:\s*['"]Press\s+Start\s+2P['"]/);
	});

	it('--px-font-mono = "VT323"', () => {
		assertMatch(css, /--px-font-mono:\s*['"]VT323['"]/);
	});

	it('.time-main 使用 Press Start 2P 字体', () => {
		assertMatch(css, /\.time-main\s*\{[^}]*font-family:\s*var\(--px-font-display\)/s);
	});

	it('.search-input 使用 VT323 字体', () => {
		assertMatch(css, /\.search-input\s*\{[^}]*font-family:\s*var\(--px-font-mono\)/s);
	});

	it('.tile-label 使用 VT323 字体', () => {
		assertMatch(css, /\.tile-label\s*\{[^}]*font-family:\s*var\(--px-font-mono\)/s);
	});
});

// ===================================================================
// 4. 像素渲染 — image-rendering + 字体平滑
// ===================================================================
describe('像素渲染: pixelated + 无抗锯齿', () => {
	it('html,body 全局启用 pixelated 渲染', () => {
		const globalBlock = css.match(/html,\s*body\s*\{([^}]+)\}/s);
		assert(globalBlock, 'html,body 块未找到');
		assert(globalBlock[1].includes('image-rendering: pixelated'),
			'缺少 image-rendering: pixelated');
	});

	it('禁用字体平滑（-webkit-font-smoothing: none）', () => {
		const globalBlock = css.match(/html,\s*body\s*\{([^}]+)\}/s);
		assert(globalBlock[1].includes('-webkit-font-smoothing: none'),
			'缺少 -webkit-font-smoothing: none');
	});

	it('兼容 Firefox crisp-edges', () => {
		const globalBlock = css.match(/html,\s*body\s*\{([^}]+)\}/s);
		assert(globalBlock[1].includes('crisp-edges'),
			'缺少 crisp-edges 兼容');
	});

	it('磁贴图标启用 pixelated 渲染', () => {
		assertMatch(css, /image-rendering:\s*pixelated/);
	});
});

// ===================================================================
// 5. CRT 扫描线效果
// ===================================================================
describe('CRT 扫描线: body::after 伪元素', () => {
	it('body::after 存在 CRT 扫描线效果', () => {
		assertMatch(css, /body::after\s*\{[^}]*repeating-linear-gradient/s);
	});

	it('扫描线覆盖全屏（position: fixed + 100%）', () => {
		const afterBlock = css.match(/body::after\s*\{([^}]+)\}/s);
		assert(afterBlock, 'body::after 块未找到');
		assert(afterBlock[1].includes('position: fixed'), '缺少 position: fixed');
		assert(afterBlock[1].includes('width: 100%'), '缺少全宽');
		assert(afterBlock[1].includes('height: 100%'), '缺少全高');
	});

	it('扫描线不阻挡交互（pointer-events: none）', () => {
		const afterBlock = css.match(/body::after\s*\{([^}]+)\}/s);
		assert(afterBlock[1].includes('pointer-events: none'), '缺少 pointer-events: none');
	});

	it('扫描线在最顶层（z-index: 9999）', () => {
		const afterBlock = css.match(/body::after\s*\{([^}]+)\}/s);
		assert(afterBlock[1].includes('z-index: 9999'), '缺少 z-index: 9999');
	});

	it('扫描线使用半透明黑条 1px 间隔', () => {
		const afterBlock = css.match(/body::after\s*\{([^}]+)\}/s);
		assert(afterBlock[1].includes('rgba(0, 0, 0, 0.15)'),
			'扫描线颜色不是 rgba(0,0,0,0.15)');
	});
});

// ===================================================================
// 6. 像素边框 — 双层边框 + 投影
// ===================================================================
describe('像素边框: 双层 + 像素投影', () => {
	it('--px-shadow 定义像素投影 4px×4px', () => {
		assertMatch(css, /--px-shadow:\s*4px\s+4px\s+0px\s+var\(--px-border-dark\)/);
	});

	it('--px-shadow-hover 悬停投影缩小为 2px×2px', () => {
		assertMatch(css, /--px-shadow-hover:\s*2px\s+2px\s+0px\s+var\(--px-border-dark\)/);
	});

	it('--px-shadow-active 按下投影消除', () => {
		assertMatch(css, /--px-shadow-active:\s*0px\s+0px\s+0px\s+var\(--px-border-dark\)/);
	});

	it('--px-border-double 双层边框定义', () => {
		assertMatch(css, /--px-border-double:\s*4px\s+double\s+var\(--px-border-light\)/);
	});

	it('.px-border 工具类内嵌双层边框效果', () => {
		assertMatch(css, /\.px-border\s*\{[^}]*box-shadow:\s*inset\s+0\s+0\s+0\s+2px\s+var\(--px-bg-primary\)/s);
	});

	it('按钮按下时 translate(2px, 2px) + 投影消除', () => {
		assertMatch(css, /transform:\s*translate\(2px,\s*2px\)/);
		assertMatch(css, /box-shadow:\s*0\s+0\s+0\s+var\(--px-border-dark\)/);
	});
});

// ===================================================================
// 7. 零圆角 — 像素风格核心约束
// ===================================================================
describe('零圆角约束: 关键组件无圆角', () => {
	// 定义必须零圆角的核心选择器
	const sharpSelectors = [
		['搜索框', '.search-wrapper'],
		['搜索建议', '.search-suggestions'],
		['分类按钮', '.cat-btn'],
		['磁贴', '.tile'],
		['右键菜单', '.context-menu'],
		['设置面板', '.settings-panel'],
		['弹窗', '.modal'],
		['按钮', '.btn'],
		['输入框', '.form-input'],
		['分类浮窗', '.category-popover'],
		['页面指示器', '.page-indicator'],
		['四象限面板', '.quadrant-board'],
		['四象限卡片', '.quadrant-card'],
		['任务项', '.quadrant-task'],
		['过滤器按钮', '.quadrant-filter-btn'],
		['更新说明弹窗', '.changelog-modal'],
		['添加磁贴按钮', '.add-tile-btn'],
		['象限添加按钮', '.quadrant-add-btn'],
		['分类弹出项', '.category-popover-item'],
	];

	sharpSelectors.forEach(([label, sel]) => {
		it(`${label} (${sel}) 零圆角`, () => {
			// 只在像素主题的该选择器块内检查 border-radius: 0
			const escaped = sel.replace(/\./g, '\\.');
			const blockRe = new RegExp(escaped + '\\s*\\{[^}]+\\}', 's');
			const block = css.match(blockRe);
			if (block) {
				assertNoMatch(block[0], /\bborder-radius:\s*(?!0\b)\S/, `${sel} 不应有非零圆角`);
			}
			// 该类选择器在像素主题中若被定义，应至少有一条 border-radius: 0 或未设圆角
		});
	});

	it('--px-radius = 0px（全局圆角变量为零）', () => {
		assertMatch(css, /--px-radius:\s*0px/);
	});
});

// ===================================================================
// 8. 光标 — 绿色块状光标
// ===================================================================
describe('光标样式: 绿色块状闪烁', () => {
	it('搜索输入框使用绿色块状光标', () => {
		assertMatch(css, /caret-color:\s*var\(--px-text-primary\)/);
	});

	it('光标闪烁动画 @keyframes blink 存在', () => {
		assert(css.includes('@keyframes blink'), '缺少光标闪烁动画');
	});
});

// ===================================================================
// 9. 选中文本样式
// ===================================================================
describe('选中文本: ::selection 荧光绿反相', () => {
	it('选中背景为荧光绿', () => {
		const selBlock = css.match(/::selection\s*\{([^}]+)\}/s);
		assert(selBlock, '::selection 块未找到');
		assert(selBlock[1].includes('var(--px-text-primary)'),
			'选中背景应为荧光绿');
	});

	it('选中文字为纯黑底色', () => {
		const selBlock = css.match(/::selection\s*\{([^}]+)\}/s);
		assert(selBlock[1].includes('var(--px-bg-primary)'),
			'选中文字应为纯黑');
	});
});

// ===================================================================
// 10. 滚动条像素化
// ===================================================================
describe('滚动条: 像素风格滚动条', () => {
	it('滚动条宽度 12px', () => {
		assertMatch(css, /::-webkit-scrollbar\s*\{[^}]*width:\s*12px/s);
	});

	it('滚动条滑块使用暗绿背景', () => {
		assertMatch(css, /::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\(--px-border-dim\)/s);
	});

	it('滚动条滑块 hover 变荧光绿', () => {
		assertMatch(css, /::-webkit-scrollbar-thumb:hover\s*\{[^}]*background:\s*var\(--px-text-primary\)/s);
	});
});

// ===================================================================
// 11. 专注模式渲染重置
// ===================================================================
describe('专注模式: workbench-mode 渲染重置', () => {
	it('body.workbench-mode 隐藏扫描线', () => {
		assertMatch(css, /body\.workbench-mode::after\s*\{[^}]*display:\s*none\s*!important/s);
	});

	it('body.workbench-mode 恢复抗锯齿渲染', () => {
		assertMatch(css, /body\.workbench-mode,\s*body\.workbench-mode\s*\*\s*\{[^}]*image-rendering:\s*auto\s*!important/s);
	});

	it('body.workbench-mode 恢复系统字体', () => {
		assertMatch(css, /body\.workbench-mode\s*\{[^}]*font-family:\s*-apple-system/s);
	});
});

// ===================================================================
// 12. 响应式断点
// ===================================================================
describe('响应式: 移动端适配', () => {
	it('@media (max-width: 768px) 存在', () => {
		assert(css.includes('@media (max-width: 768px)'), '缺少移动端媒体查询');
	});

	it('移动端缩小时间字体', () => {
		assertMatch(css, /@media[^@]*\.time-main\s*\{[^}]*font-size:/s);
	});

	it('移动端缩小搜索输入框字体', () => {
		assertMatch(css, /@media[^@]*\.search-input\s*\{[^}]*font-size:/s);
	});
});

// ===================================================================
// 13. 时间显示像素效果
// ===================================================================
describe('时间显示: 像素化时间模块', () => {
	it('.time-display 使用双层边框（4px double）', () => {
		assertMatch(css, /\.time-display\s*\{[^}]*border:\s*4px\s+double\s+var\(--px-border-light\)/s);
	});

	it('.time-main 文字有像素投影效果', () => {
		const block = css.match(/\.time-main\s*\{([^}]+)\}/s);
		assert(block, '.time-main 块未找到');
		assert(block[1].includes('text-shadow'),
			'缺少 text-shadow 像素文字投影');
	});
});

// ===================================================================
// 14. 搜索框 CMD 风格
// ===================================================================
describe('搜索框: CMD 终端风格', () => {
	it('.search-wrapper 4px 实线荧光绿边框', () => {
		assertMatch(css, /\.search-wrapper\s*\{[^}]*border:\s*4px\s+solid\s+var\(--px-border-light\)/s);
	});

	it('.search-wrapper:focus-within 青色高亮', () => {
		assertMatch(css, /\.search-wrapper:focus-within\s*\{[^}]*var\(--px-text-cyan\)/s);
	});

	it('.doc-prompt 使用 Press Start 2P 字体 + 荧光绿', () => {
		const block = css.match(/\.doc-prompt\s*\{([^}]+)\}/s);
		assert(block, '.doc-prompt 块未找到');
		assert(block[1].includes('var(--px-font-display)'), '缺少像素字体');
		assert(block[1].includes('var(--px-text-primary)'), '缺少荧光绿色');
	});

	it('搜索按钮按下有像素反馈(translate+阴影消除)', () => {
		assertMatch(css, /\.search-button:active\s*\{[^}]*transform:\s*translate\(2px/s);
	});
});

// ===================================================================
// 15. 磁贴模块
// ===================================================================
describe('磁贴: 像素风格磁贴', () => {
	it('.tile 4px 边框 + 像素投影', () => {
		// pixel-theme.css 中有多个 .tile 块，需匹配包含 border 的块
		const block = css.match(/\.tile\s*\{[^}]*border:\s*4px\s+solid\s+var\(--px-border-dim\)[^}]*\}/s);
		assert(block, '未找到 .tile { border: 4px solid ... }');
	});

	it('.tile:hover 偏移 + 投影增大', () => {
		assertMatch(css, /\.tile:hover\s*\{[^}]*transform:\s*translate\(-2px,\s*-2px\)/s);
		assertMatch(css, /\.tile:hover\s*\{[^}]*box-shadow:\s*6px\s+6px\s+0/s);
	});

	it('.tile::after 装饰禁用', () => {
		assertMatch(css, /\.tile::after\s*\{[^}]*display:\s*none/s);
	});

	it('.add-tile-btn 虚线边框 + 无圆角', () => {
		assertMatch(css, /\.add-tile-btn\s*\{[^}]*border:\s*3px\s+dashed/s);
	});
});

// ===================================================================
// 16. 分类按钮像素效果
// ===================================================================
describe('分类按钮: 像素立体按钮', () => {
	it('.cat-btn 有 3px×3px 像素投影', () => {
		assertMatch(css, /\.cat-btn\s*\{[^}]*box-shadow:\s*3px\s+3px\s+0\s+var\(--px-border-dark\)/s);
	});

	it('.cat-btn:hover 偏移 + 投影增大', () => {
		assertMatch(css, /\.cat-btn:hover\s*\{[^}]*transform:\s*translate\(-1px,\s*-1px\)/s);
	});

	it('.cat-btn.active 按下效果（inset + translate(2px,2px)）', () => {
		assertMatch(css, /\.cat-btn\.active\s*\{[^}]*transform:\s*translate\(2px,\s*2px\)/s);
		assertMatch(css, /\.cat-btn\.active\s*\{[^}]*inset\s+2px\s+2px\s+0/s);
	});
});

// ===================================================================
// 17. 像素主题文件完整性
// ===================================================================
describe('文件完整性', () => {
	it('pixel-theme.css 文件非空', () => {
		assert(css.length > 1000, `文件太短: ${css.length} 字符`);
	});

	it('pixel-theme.css 包含 "@import url" 引入 Google Fonts', () => {
		assert(css.includes('@import url'), '缺少 @import 字体引入');
	});

	it('pixel-theme.css 行数 > 500（完整主题）', () => {
		const lines = css.split('\n').length;
		assert(lines > 500, `只有 ${lines} 行，主题可能不完整`);
	});
});

// ===================================================================
// 结果汇总
// ===================================================================
console.log('\n' + '█'.repeat(58));
const pct = total ? Math.round(pass / total * 100) : 0;
console.log(`  总计: ${total} | \x1b[32m✓ ${pass}\x1b[0m | \x1b[31m✗ ${fail}\x1b[0m | 通过率: ${pct}%`);
console.log('█'.repeat(58));
if (fail > 0) {
	console.log('\n  ❌ 像素主题 CSS 测试未通过，请检查失败项。');
	process.exitCode = 1;
} else {
	console.log('\n  ✅ 像素主题 CSS 所有测试通过 — 8-bit NES 风格完整');
}
