# TypeScript 工程配置参考

> 本文件为 `architecture/RULE.mdc` 第 8 节的配置附录。规则正文只保留核心约束，完整配置见此处。

## tsconfig.json 核心项

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // 数组/索引访问返回 T | undefined
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,        // 区分 type 与 value 导入
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "node", "vitest/globals"]
  }
}
```

## ESLint（typescript-eslint strict）

- `@typescript-eslint/no-explicit-any` = **error**（跨进程消息尤其禁止 `any`）。
- `@typescript-eslint/no-floating-promises` = error（注入脚本/`executeScript` 调用必须 await）。
- `@typescript-eslint/consistent-type-imports` = error。
- `no-restricted-syntax` 限制 `enum`（用 `as const` 对象 + 字面量联合替代，便于 tree-shake 与判别）。

## AI 协作约定（来自 TS 技能）

类型推导、判别式逻辑、递归类型等"类型体操"应写在 `*.ts` 内并由注释解释意图；不要把 AI 的长篇推理塞进内联类型，AI 上下文应聚焦在 `*.md`/注释层，避免污染类型可读性。
