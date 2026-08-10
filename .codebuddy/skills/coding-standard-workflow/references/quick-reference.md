# 快速参考

> 本文件提供 `coding-standard-workflow` Skill 执行过程中的常用命令、检查项和快捷路径。

## 常用命令

```bash
# 列出最近上下文记忆
Get-ChildItem .codebuddy/memory/*.md | Sort-Object Name -Descending | Select-Object -First 10

# 搜索记忆
Select-String -Pattern "<关键词>" .codebuddy/memory/*.md

# 语法/类型检查
npx tsc --noEmit

# 运行测试
npm test

# Lint
npx eslint src/ lib/
```

## 提交前快速检查

```powershell
# 一条命令完成全部检查
npx tsc --noEmit && npm test
```

## 跳过规则

当任务类型匹配以下情况时，可以跳过对应步骤：

| 场景 | 可跳过步骤 | 原因 |
| --- | --- | --- |
| 仅修复拼写/格式 | STEP 4, STEP 7 | 无实质逻辑变更 |
| 仅修改注释/文档 | STEP 4, STEP 5, STEP 7 | 不影响代码 |
| 单文件微小调整 | STEP 4 | 不需要方案设计 |
| 仅更新依赖版本 | STEP 4, STEP 5 | 无需编码 |
| 仅重命名标识符 | STEP 7 | 无关键决策需要记录 |
