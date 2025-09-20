# Repository Guidelines

## Project Structure & Module Organization

- `src/app/` — Next.js App Router routes and layouts.
- `src/components/` — Reusable UI components.
- `src/lib/` — Data, caching, storage, and domain utilities (e.g., `@/lib/redis.db`).
- `src/hooks/` — React hooks.
- `src/styles/` — Global styles and Tailwind setup.
- `src/types/` — Shared TypeScript types.
- `public/` — Static assets.
- `scripts/` — Build helpers (e.g., `generate-manifest.js`).
- Config roots: `next.config.js`, `tailwind.config.ts`, `.eslintrc.js`, `.prettierrc.js`.

Use `@/` to import from `src` (example: `import { fetchVideoDetail } from '@/lib/fetchVideoDetail'`).

## Build, Test, and Development Commands

- `pnpm dev` — Start local dev server (runs `gen:manifest` first).
- `pnpm build` — Production build.
- `pnpm start` — Serve built app.
- `pnpm lint` / `pnpm lint:strict` — Lint code (strict blocks warnings).
- `pnpm lint:fix` — Autofix lint issues and run formatter.
- `pnpm typecheck` — TypeScript checks.
- `pnpm test` / `pnpm test:watch` — Run Jest tests.
- `pnpm format` / `pnpm format:check` — Prettier format / verify.

Requirements: Node `v20.10.0` (`.nvmrc`), PNPM `>=10` (repo sets `pnpm@10.14.0`).

## Coding Style & Naming Conventions

- Language: TypeScript. Indent 2 spaces; single quotes; semicolons; `arrowParens: 'always'` (see `.prettierrc.js`).
- ESLint with `@typescript-eslint`, `simple-import-sort`, `unused-imports`. Keep imports sorted; remove unused code.
- Filenames: components `PascalCase.tsx`, hooks `useThing.ts`, libs `kebab-case.ts` as present in repo.
- Path aliases: prefer `@/` over relative paths.

## Testing Guidelines

- Framework: Jest + Testing Library (`jest-environment-jsdom`).
- Place tests near source or under `__tests__`. Recommended: `*.test.ts` / `*.test.tsx` (e.g., `src/components/VideoCard.test.tsx`).
- Use `next-router-mock` when routing is involved. Import helpers via `@/`.
- Run `pnpm test` locally; keep tests deterministic and UI-focused for components.

## Commit & Pull Request Guidelines

- Commits follow Conventional Commits (see `commitlint.config.js`). Types include: `feat`, `fix`, `docs`, `chore`, `style`, `refactor`, `ci`, `test`, `perf`, `revert`, `vercel`.
- Example: `feat(player): add HLS fallback for m3u8`.
- PRs: include clear description, linked issues, UI screenshots for visual changes, and notes on breaking changes/migrations.
- All PRs must pass `pnpm typecheck`, `pnpm lint:strict`, and tests.

## Security & Configuration Tips

- Environment: use `.env` for local only; do not commit secrets. See `README.md` for variables like storage backends and site config.
- Production deploys use Docker; local dev runs via `pnpm dev`.
