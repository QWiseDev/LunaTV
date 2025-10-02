# 2025-10-05 12:45 CST rebase 至最新 szemeng/main
- 触发原因：szemeng/main 新增 Spider 状态 API 与诊断增强，需要同步到 QWiseDev/LunaTV，同时保留本地管理员访问控制大功能。
- 操作步骤：
  1. 对 main 执行 `git rebase szemeng/main`，在 `src/app/tvbox/page.tsx` 出现冲突。
  2. 使用 `apply_patch` 手动合并，保留 `refreshingJar`/诊断增强逻辑并恢复本地 `accessStatus` 权限校验、ShieldOff 拦截界面。
  3. 继续 rebase 完成后，运行 `pnpm lint`（因 Node v14.17.6 不满足 pnpm 要求导致失败，未能验证），最终 `git push origin main --force-with-lease`。
- 关键文件：`src/app/tvbox/page.tsx`。
- 风险与跟进：需在具备 Node >= 18.12 的环境重跑 `pnpm lint`/`pnpm typecheck` 确认无额外问题。