# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`：承载 Next.js App Router 路由与布局，每个子目录对应独立业务流，跨页面逻辑下沉至 `src/lib/`。
- `src/components/` 与 `src/hooks/`：维护通用组件和自定义 Hook，组件命名使用帕斯卡格式，Hook 使用 `use` 前缀，避免跨层耦合。
- `src/lib/`、`src/types/`、`src/styles/`：分别用于领域工具、共享类型以及 Tailwind 配置；静态资源存放在 `public/`，构建脚本位于 `scripts/`。

## Build, Test, and Development Commands
- `pnpm dev`：启动开发服务器，自动生成 manifest，适合验证页面交互与 API 代理。
- `pnpm build` / `pnpm start`：前者生成生产包，后者在本地模拟生产部署，提交前请完成一次全流程验证。
- `pnpm lint`、`pnpm lint:strict`、`pnpm lint:fix`：分别用于常规检查、阻断警告与快速修复；格式化使用 `pnpm format`。
- `pnpm typecheck` 与 `pnpm test`：类型检查与 Jest/Testing Library 用例执行，建议在合并前保证全部通过。

## Coding Style & Naming Conventions
- 默认使用 TypeScript，缩进 2 空格，单引号结尾分号，Prettier 配置位于 `.prettierrc.js`，请勿手动覆盖规则。
- ESLint 集成 `@typescript-eslint`、`simple-import-sort`、`unused-imports`，提交前确保导入有序且无冗余符号。
- 目录命名遵循现有模式：组件 `PascalCase.tsx`，库 `kebab-case.ts`，测试与页面沿用文件夹语义；尽量使用 `@/` 路径别名。

## Testing Guidelines
- 框架采用 Jest + Testing Library (`jest-environment-jsdom`)，UI 行为需通过用户视角断言避免快照依赖。
- 测试文件命名 `*.test.ts(x)`，可与源码同级或放入 `__tests__/`；路由相关逻辑请使用 `next-router-mock`。
- 优先构建单元与集成测试组合，关注播放器、缓存与并发请求场景；`pnpm test:watch` 用于迭代调试。

## Commit & Pull Request Guidelines
- 提交信息遵循 Conventional Commits（参见 `commitlint.config.js`），描述模块后缀示例：`feat(player): 添加 HLS 回退`。
- PR 需附变更概述、关联 issue、关键页面截图（如 UI 改动）与潜在风险说明，并确认 `pnpm lint:strict`、`pnpm typecheck`、`pnpm test` 均已通过。
- 鼓励在描述中记录验证环境与复现步骤，方便 Reviewer 快速还原问题与验证补丁。

## Security & Configuration Tips
- 环境变量仅放置于本地 `.env`，严禁入库；生产配置由部署平台注入，密钥管理请走安全审计流程。
- 仓库包含 Docker 部署脚本，推荐先运行 `pnpm build` 验证产物；日志和监控策略请参考 `README.md` 中的运维说明。
