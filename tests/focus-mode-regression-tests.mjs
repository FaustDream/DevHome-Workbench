import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

let total = 0, pass = 0, fail = 0;
function describe(n, fn) { console.log('\n' + '─'.repeat(58)); console.log('  ' + n); console.log('─'.repeat(58)); fn(); }
function it(n, fn) {
    total++;
    try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + n); }
    catch (e) { fail++; console.log('  \x1b[31m✗\x1b[0m ' + n); console.log('    \x1b[31m' + String(e.message).split('\n')[0] + '\x1b[0m'); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + '\n      expected: ' + JSON.stringify(b) + '\n      actual:   ' + JSON.stringify(a)); }

console.log('\n' + '█'.repeat(58));
console.log('  Focus Mode / 文档编写 / 组件回归测试');
console.log('█'.repeat(58));

// ===== 1. CSS 语法错误（专注模式样式失效） =====
describe('CSS 语法', () => {
    it('base.css / pixel-theme.css / warm-paper.css 不含非法 ::root', () => {
        for (const f of ['css/base.css', 'css/themes/pixel-theme.css', 'css/themes/warm-paper.css']) {
            const c = readFileSync(resolve(root, f), 'utf8');
            if (/::root\b/.test(c)) throw new Error('发现 ::root：' + f);
        }
    });

    it('主题 CSS 不含三冒号伪元素（:::-webkit / :::selection）', () => {
        for (const f of ['css/themes/pixel-theme.css', 'css/themes/warm-paper.css']) {
            const c = readFileSync(resolve(root, f), 'utf8');
            if (/:::[a-zA-Z-]/.test(c)) throw new Error('发现三冒号伪元素：' + f);
        }
    });

    it('warm-paper.css 不存在游离的 letter-spacing 片段', () => {
        const c = readFileSync(resolve(root, 'css/themes/warm-paper.css'), 'utf8');
        // 匹配 "*/" 后紧跟 letter-spacing: 0.05em; 和 "}"
        assert(!/\*\/[\s\r\n]*\s*letter-spacing:\s*0\.05em;\s*[\r\n]*\s*\}/.test(c), '发现游离样式片段');
    });
});

// ===== 2. 笔记迁移逻辑（PM 未就绪时不应覆盖 doc） =====
function loadNotesModule() {
    globalThis.window = globalThis;
    globalThis.document = {
        createElement() { return { innerHTML: '', setAttribute() {}, appendChild() {} }; }
    };
    globalThis.DevHome = {
        state: { notes: [] },
        dom: {},
        storageV2: { KEYS: { NOTES: 'notes' }, get() { return Promise.resolve([]); }, set() { return Promise.resolve(); } },
        NOTE_TYPES: [],
        EMPTY_STATE_MESSAGES: {}
    };
    const code = readFileSync(resolve(root, 'js/notes.js'), 'utf8');
    new Function(code)();
    return globalThis.DevHome;
}

describe('notes.js 迁移安全', () => {
    it('ProseMirror 未就绪时，migrateNoteDoc 不覆盖原 doc', () => {
        const ns = loadNotesModule();
        window.PM = undefined;
        const note = { id: 'n1', content: '<p>不要丢</p>' };
        ns.migrateNoteDoc(note);
        assert(!note.doc, 'PM 未就绪时仍写入了 doc');
    });

    it('ProseMirror 就绪时，migrateNoteDoc 为旧笔记生成 doc', () => {
        const ns = loadNotesModule();
        // 用 fake PM 模拟解析成功，避免依赖真实 DOMParser
        window.PM = {
            Schema: class FakeSchema {
                constructor(spec) { this.spec = spec; }
            },
            DOMParser: {
                fromSchema() {
                    return {
                        parse() {
                            return {
                                toJSON() {
                                    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'parsed' }] }] };
                                }
                            };
                        }
                    };
                }
            }
        };
        const note = { id: 'n2', content: '<p>旧内容</p>' };
        ns.migrateNoteDoc(note);
        assert(note.doc && note.doc.type === 'doc', '未生成 doc');
    });

    it('migrateAllNotes 仅统计成功迁移的笔记', () => {
        const ns = loadNotesModule();
        window.PM = undefined;
        ns.state.notes = [
            { id: 'a', content: 'A' },
            { id: 'b', content: 'B' }
        ];
        const count = ns.migrateAllNotes();
        eq(count, 0, 'PM 未就绪时不应计入迁移');
    });
});

// ===== 3. 组件模块事件冲突 =====
describe('组件事件冲突', () => {
    it('utils.js 自定义弹窗的 Escape/Enter 处理阻止事件冒泡', () => {
        const c = readFileSync(resolve(root, 'js/utils.js'), 'utf8');
        // 统计 onKeyDown 函数中 stopPropagation 的调用次数（showConfirm + showPrompt 各 2 处）
        const matches = c.match(/e\.stopPropagation\(\)/g) || [];
        assert(matches.length >= 4, 'stopPropagation 调用不足（当前 ' + matches.length + '）');
    });

    it('events.js 在编辑或弹窗打开时禁用专注模式快捷键', () => {
        const c = readFileSync(resolve(root, 'js/events.js'), 'utf8');
        assert(c.includes('isContentEditable') && c.includes('activeElement'), '未检查当前焦点元素');
        assert(c.includes('wbConfirmOverlay') || c.includes('wbPromptOverlay'), '未检查自定义弹窗');
        // 快捷键调用处应同时排除编辑和弹窗
        const shortcutCall = c.match(/isFocusModeShortcut\(e\)/);
        assert(shortcutCall, '未找到专注模式快捷键调用');
    });

    it('events.js Escape 处理在弹窗打开时不退出专注模式', () => {
        const c = readFileSync(resolve(root, 'js/events.js'), 'utf8');
        assert(c.includes('hasModalOpen') || c.includes('hasConfirmOpen'), '未对弹窗做 Escape 拦截');
    });
});

// ===== 4. ProseMirror 编辑器兜底 =====
describe('proseMirrorEditor.js 旧 HTML 解析', () => {
    it('创建编辑器时，若 note.doc 缺失应解析 note.content', () => {
        const c = readFileSync(resolve(root, 'js/proseMirrorEditor.js'), 'utf8');
        assert(c.includes('note.content') && c.includes('DOMParser.fromSchema'), '未实现 HTML 回退解析');
        assert(c.includes('note.doc = docNode.toJSON()'), '解析后未回填 note.doc');
    });
});

console.log('\n' + '█'.repeat(58));
const pct = total ? Math.round(pass / total * 100) : 0;
console.log(`  总计: ${total} | ✓ ${pass} | ✗ ${fail} | 通过率: ${pct}%`);
console.log('█'.repeat(58));
if (fail > 0) process.exitCode = 1;
else console.log('\n  ✅ 所有回归测试通过\n');
