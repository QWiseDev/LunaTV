# 代码风格和约定

## TypeScript 配置
- ��格模式启用 (`strict: true`)
- 目标：ES5
- 模块系统：Node16
- 路径别名：
  - `@/*` → `./src/*`
  - `~/*` → `./public/*`

## ESLint 规则

### 基础规则
- 禁用 `no-console`（仅警告）
- 禁用未使用的变量（通过 `unused-imports` 插件处理）
- React 显示名称检查关闭
- JSX 大括号优化：props 和 children 不使用不必要的大括号

### Import 排序规则
按以下顺序自动排序导入：
1. 外部库导入 (`@?\\w`)
2. CSS 文件导入
3. Lib 和 hooks (`@/lib`, `@/hooks`)
4. 静态数据 (`@/data`)
5. 组件 (`@/components`, `@/container`)
6. Zustand store (`@/store`)
7. 其他 `@/` 导入
8. 相对路径导入（最多 3 层）
9. 类型导入 (`@/types`)

### 未使用导入规则
- 自动���除未使用的导入
- 变量以 `_` 开头时忽略未使用警告
- 参数在使用后才检查

## Prettier 配置
- 箭头函数括号：始终添加 (`arrowParens: 'always'`)
- 单引号：JavaScript 和 JSX 都使用单引号
- Tab 宽度：2 个空格
- 分号：始终添加

## 命名约定

### 文件命名
- 组件文件：PascalCase（如 `EpgScrollableRow.tsx`）
- 工具文件：camelCase（如 `db.client.ts`）
- 页面文件：`page.tsx`（Next.js App Router 约定）
- API 路由：`route.ts`（Next.js App Router 约定）

### 变量和函数命名
- 组件：PascalCase
- 函数：camelCase
- 常量：UPPER_SNAKE_CASE 或 camelCase
- 接口/类型：PascalCase

### React 组件约定
- 使用函数组件
- Props 接口命名：`ComponentNameProps`
- 导出方式：`export default` 用于页面和主要组件

## 注释规范
- 使用 JSDoc 风格注释复杂函数
- 重要逻辑添加行内注释说明意图
- 禁用 ESLint 规则时需要注释说明原因
- 代码��使用 `// ----` 分隔不同功能区域

## Git 提交规范
使用 Conventional Commits 规范：
- `feat`: 新功能
- `fix`: 修复 bug
- `perf`: 性能优化
- `refactor`: 重构
- `docs`: 文档更新
- `style`: 代码格式修改
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动

示例：
```
feat(live-epg): 优化直播代理与节目单体验
fix(auth): 修复用户登录重定向问题
perf: 优化缓存与性能检测机制
```

## React 最佳实践
- 使用 `useCallback` 和 `useMemo` 优化性能
- 避免在 `useEffect` 中遗漏依赖项（使用 `eslint-plugin-react-hooks`）
- 使用 `useRef` 保存不需要触发重渲染的值
- 条件渲染优先使用短路运算符和三元表达式
- 使用 `/* eslint-disable react-hooks/exhaustive-deps */` 时需要注释说明

## 类型定义
- 优先使用 interface 而非 type（除非需要联合类型）
- 导出可复用的类型到 `src/types/` 目录
- 使用 Zod 进行运行时数据验证

## CSS/Tailwind 约定
- 优先使用 Tailwind 工具类
- 复杂样式使用 `clsx` 或 `tailwind-merge` 组合
- 响应式设计：移动优先（sm:, md:, lg: 等）
- 暗色模式支持：使用 `dark:` 前缀

## 性能优化
- 使用动态导入 (`next/dynamic`) 延迟加载重组件
- 图片使用 `next/image` 或带 `loading="lazy"` 的 img 标签
- 长列表使用虚拟滚动（react-window）
- API 请求使用缓存和去重机制
