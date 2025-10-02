# Repository Guidelines

## 项目结构与模块组织
- `src/app/` 采用 Next.js App Router，按业务域划分子目录，跨页面逻辑沉淀于 `src/lib/`。
- 共用 UI 组件置于 `src/components/`，自定义 Hook 放在 `src/hooks/`，命名分别使用帕斯卡命名与 `use` 前缀。
- 类型定义集中在 `src/types/`，全局样式位于 `src/styles/`，静态资源存放在 `public/`。
- 脚本工具与自动化操作置于 `scripts/`，测试文件与源码同级或置于 `__tests__/`。

## 构建、测试与开发命令
- `pnpm install`：安装依赖并同步锁定文件。
- `pnpm dev`：启动本地开发服务器，便于调试页面与 API 代理。
- `pnpm build` / `pnpm start`：生成生产构建并在本地验证产物。
- `pnpm lint`、`pnpm lint:strict`、`pnpm lint:fix`：常规、阻断式检查与自动修复。
- `pnpm typecheck`、`pnpm test`、`pnpm test:watch`：执行 TypeScript 校验与 Jest 测试。

## 代码风格与命名规范
- 默认使用 TypeScript，缩进 2 空格，单引号结尾分号；`pnpm format` 调用 Prettier。
- ESLint 集成 `@typescript-eslint`、`simple-import-sort`、`unused-imports`，提交前确保导入顺序与无冗余符号。
- 组件文件命名 `PascalCase.tsx`，库函数使用短横线命名，如 `fetch-video.ts`。

## 测试指引
- 使用 Jest + Testing Library，编写基于用户行为的断言，避免静态快照。
- 测试文件命名 `*.test.ts(x)`，保持与目标模块同路径或置于 `__tests__/`。
- 推荐在合并前执行 `pnpm lint:strict`、`pnpm typecheck`、`pnpm test` 全量校验。

## 提交与 Pull Request 规范
- 使用 Conventional Commits，例如 `feat(player): 增加 HLS 回退`；提交信息须概述变更意图。
- Pull Request 需包含问题背景、关键改动、验证步骤及 UI 变更截图（若适用），并确认质量检查命令已通过。

## 安全与配置建议
- 环境变量存放于本地 `.env`，勿提交仓库；生产密钥通过部署平台注入。
- 提交前检查 `proxy.worker.js`、Docker 配置与 `vercel.json` 是否保持预期，避免误改线上路由与代理。
