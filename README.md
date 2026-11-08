# Planning Tool

A personal planning and anti-procrastination tool: break big tasks into a tree
of small steps, tick them off, and watch the Completed feed grow. See
[PLAN.md](PLAN.md) for the full plan.

## Layout

```
apps/web         React + Vite + Tailwind + shadcn/ui front end (PWA later)
apps/server      Hono server for the Mac mini (sync and SQLite come in Milestone 5)
packages/shared  Zod schemas and the pure tree / ordering logic, with unit tests
```

`packages/shared` ships TypeScript source. Vite compiles it for the web app and
`tsup` bundles it into the server build.

## Getting started

Needs Node 22.12+ and pnpm 10 (`corepack enable` sets up the pinned version).

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` starts the web app on http://localhost:5173 and the API server on
http://localhost:3000 (the web dev server proxies `/api` to it).

## Scripts

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `pnpm test`       | Runs every Vitest project (shared, web, server)  |
| `pnpm test:watch` | Vitest in watch mode                             |
| `pnpm lint`       | ESLint over the whole repo                       |
| `pnpm format`     | Formats with Prettier (`format:check` to verify) |
| `pnpm typecheck`  | `tsc --noEmit` in every package                  |
| `pnpm build`      | Builds the web app and the server                |
| `pnpm check`      | Format check, lint, typecheck and tests          |

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, tests and build on
pull requests and pushes to `main`.

## Core logic (`packages/shared`)

- `schema.ts`: Zod schemas and types for `Goal` and `Step`, shared by the app and the server.
- `order.ts`: fractional-indexing helpers (`keyAt`, `keyForMove`, `compareOrder`, ...).
- `tree.ts`: pure step-tree functions: `buildTree`, progress, `addStep`, `moveStep`,
  `indentStep`, `outdentStep`, `completeStep` (with auto-complete and cascade),
  `uncompleteStep` (undo), `deleteStep` (soft delete).
- `goals.ts`: `createGoal`, `sortGoals`, `moveGoal` for the sidebar.

Every mutation takes the current steps and returns only the records it created
or changed, each with a fresh `updatedAt`, ready to write to IndexedDB and the
sync outbox. `applyChanges` folds them back into an in-memory list.
