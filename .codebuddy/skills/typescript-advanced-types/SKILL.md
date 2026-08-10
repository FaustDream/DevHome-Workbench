---
name: typescript-advanced-types
description: 掌握 TypeScript 的高级类型系统，包括泛型（generics）、条件类型（conditional types）、映射类型（mapped types）、模板字面量类型（template literals）与工具类型（utility types），用于构建类型安全的应用。在需要实现复杂类型逻辑、创建可复用的类型工具，或在 TypeScript 项目中确保编译期类型安全时使用。
---

# TypeScript 高级类型

关于掌握 TypeScript 高级类型系统的全面指南，涵盖泛型、条件类型、映射类型、模板字面量类型与工具类型，帮助你构建健壮、类型安全的应用。

## 何时使用本技能

- 构建类型安全的库或框架
- 创建可复用的泛型组件
- 实现复杂的类型推断逻辑
- 设计类型安全的 API 客户端
- 构建表单验证系统
- 创建强类型的配置对象
- 实现类型安全的状态管理
- 将 JavaScript 代码库迁移到 TypeScript

## 核心概念

### 1. 泛型（Generics）

**用途：** 在保持类型安全的同时，创建可复用、类型灵活的组件。

**基础泛型函数：**

```typescript
function identity<T>(value: T): T {
  return value;
}

const num = identity<number>(42); // 类型：number
const str = identity<string>("hello"); // 类型：string
const auto = identity(true); // 类型推断：boolean
```

**泛型约束：**

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(item: T): T {
  console.log(item.length);
  return item;
}

logLength("hello"); // 正确：string 有 length
logLength([1, 2, 3]); // 正确：数组有 length
logLength({ length: 10 }); // 正确：对象有 length
// logLength(42);             // 错误：number 没有 length
```

**多个类型参数：**

```typescript
function merge<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

const merged = merge({ name: "John" }, { age: 30 });
// 类型：{ name: string } & { age: number }
```

### 2. 条件类型（Conditional Types）

**用途：** 创建依赖条件而定的类型，实现复杂的类型逻辑。

**基础条件类型：**

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false
```

**提取返回值类型：**

```typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function getUser() {
  return { id: 1, name: "John" };
}

type User = ReturnType<typeof getUser>;
// 类型：{ id: number; name: string; }
```

**分布式条件类型：**

```typescript
type ToArray<T> = T extends any ? T[] : never;

type StrOrNumArray = ToArray<string | number>;
// 类型：string[] | number[]
```

**嵌套条件：**

```typescript
type TypeName<T> = T extends string
  ? "string"
  : T extends number
    ? "number"
    : T extends boolean
      ? "boolean"
      : T extends undefined
        ? "undefined"
        : T extends Function
          ? "function"
          : "object";

type T1 = TypeName<string>; // "string"
type T2 = TypeName<() => void>; // "function"
```

### 3. 映射类型（Mapped Types）

**用途：** 通过遍历已有类型的属性来转换它。

**基础映射类型：**

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

interface User {
  id: number;
  name: string;
}

type ReadonlyUser = Readonly<User>;
// 类型：{ readonly id: number; readonly name: string; }
```

**可选属性：**

```typescript
type Partial<T> = {
  [P in keyof T]?: T[P];
};

type PartialUser = Partial<User>;
// 类型：{ id?: number; name?: string; }
```

**键重映射（Key Remapping）：**

```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// 类型：{ getName: () => string; getAge: () => number; }
```

**属性过滤：**

```typescript
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

interface Mixed {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

type OnlyNumbers = PickByType<Mixed, number>;
// 类型：{ id: number; age: number; }
```

### 4. 模板字面量类型（Template Literal Types）

**用途：** 创建基于字符串、支持模式匹配与转换的类型。

**基础模板字面量：**

```typescript
type EventName = "click" | "focus" | "blur";
type EventHandler = `on${Capitalize<EventName>}`;
// 类型："onClick" | "onFocus" | "onBlur"
```

**字符串操作：**

```typescript
type UppercaseGreeting = Uppercase<"hello">; // "HELLO"
type LowercaseGreeting = Lowercase<"HELLO">; // "hello"
type CapitalizedName = Capitalize<"john">; // "John"
type UncapitalizedName = Uncapitalize<"John">; // "john"
```

**路径构建：**

```typescript
type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string ? `${K}` | `${K}.${Path<T[K]>}` : never;
    }[keyof T]
  : never;

interface Config {
  server: {
    host: string;
    port: number;
  };
  database: {
    url: string;
  };
}

type ConfigPath = Path<Config>;
// 类型："server" | "database" | "server.host" | "server.port" | "database.url"
```

### 5. 工具类型（Utility Types）

**内置工具类型：**

```typescript
// Partial<T> - 使所有属性变为可选
type PartialUser = Partial<User>;

// Required<T> - 使所有属性变为必填
type RequiredUser = Required<PartialUser>;

// Readonly<T> - 使所有属性变为只读
type ReadonlyUser = Readonly<User>;

// Pick<T, K> - 挑选特定属性
type UserName = Pick<User, "name" | "email">;

// Omit<T, K> - 移除特定属性
type UserWithoutPassword = Omit<User, "password">;

// Exclude<T, U> - 从联合类型中排除
type T1 = Exclude<"a" | "b" | "c", "a">; // "b" | "c"

// Extract<T, U> - 从联合类型中提取
type T2 = Extract<"a" | "b" | "c", "a" | "b">; // "a" | "b"

// NonNullable<T> - 排除 null 和 undefined
type T3 = NonNullable<string | null | undefined>; // string

// Record<K, T> - 创建键为 K、值为 T 的对象类型
type PageInfo = Record<"home" | "about", { title: string }>;
```

## 详细实战示例与模式

详细章节（以 `## Advanced Patterns` 开头）位于 `references/details.md`。当上方导航概要不够用时请阅读该文件。

## 最佳实践

1. **用 `unknown` 而非 `any`**：强制类型检查
2. **对象形状优先用 `interface`**：错误信息更友好
3. **联合类型与复杂类型用 `type`**：更灵活
4. **善用类型推断**：在可能时让 TypeScript 自动推断
5. **创建辅助类型**：构建可复用的类型工具
6. **使用 const 断言（`as const`）**：保留字面量类型
7. **避免类型断言（`as`）**：改用类型守卫
8. **为复杂类型编写文档**：添加 JSDoc 注释
9. **开启 strict 模式**：启用全部 strict 编译选项
10. **测试你的类型**：使用类型测试验证类型行为

## 类型测试

```typescript
// 类型相等断言测试
type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

type Test1 = AssertEqual<string, string>; // true
type Test2 = AssertEqual<string, number>; // false
type Test3 = AssertEqual<string | number, string>; // false

// 期望报错辅助类型
type ExpectError<T extends never> = T;

// 使用示例
type ShouldError = ExpectError<AssertEqual<string, number>>;
```

## 常见陷阱

1. **过度使用 `any`**：违背 TypeScript 的设计初衷
2. **忽略 strict null 检查**：可能导致运行时错误
3. **类型过于复杂**：会拖慢编译
4. **不使用可辨识联合（discriminated unions）**：错失类型收窄机会
5. **忘记 `readonly` 修饰符**：造成非预期变更
6. **循环类型引用**：可能导致编译错误
7. **未处理边界情况**：如空数组或 null 值

## 性能考量

- 避免深层嵌套的条件类型
- 尽可能使用简单类型
- 缓存复杂的类型计算
- 限制递归类型的递归深度
- 使用构建工具在生产环境跳过类型检查
