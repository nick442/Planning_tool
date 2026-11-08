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

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, tests and build, plus
the Playwright suite in a second job, on pull requests and pushes to `main`.

## Using the outline

Click a step's title to edit it. The outline is built for the keyboard:

| Key                    | While a row is selected             | While editing a title                       |
| ---------------------- | ----------------------------------- | ------------------------------------------- |
| `Enter`                | New step below, start typing        | Save, then new step below (empty: stop)     |
| `Tab` / `Shift+Tab`    | Indent / outdent                    | Indent / outdent, keep typing               |
| `Space`                | Complete (asks if sub-steps open)   |                                             |
| `↑` / `↓`              | Previous / next row                 | Save, edit previous / next row              |
| `←` / `→`              | Collapse / expand (or go to parent) |                                             |
| `Alt+↑` / `Alt+↓`      | Move among siblings                 | Move among siblings                         |
| `e` or `F2`            | Edit title                          |                                             |
| `Delete` / `Backspace` | Delete (asks if it has sub-steps)   | `Backspace` on an empty step deletes it     |
| `Escape`               | Deselect                            | Save and stop editing (empty step: removed) |

Drag the handle on the left of a row to move a branch; drag sideways to change
its depth. Goals in the sidebar reorder the same way (long-press on touch).

## Completing steps

Ticking a step (checkbox or `Space`) pops the checkbox, then the step folds out
of the outline and lands at the top of the **Completed** feed. A toast offers
**Undo** for a few seconds; finishing the last open step of a branch completes
the parent too and shows "🎉 Branch finished".

The Completed feed (right-hand column on large screens, "Completed" in the
sidebar otherwise) lists finished steps newest first, grouped by day ("Today",
"Yesterday", "Tue 3 Nov"), each with its goal and breadcrumb. It can show all
goals or just the current one. Every entry has an undo button, which also
reopens a parent that was finished by that step. Animations respect the
reduced-motion setting.

## Local data

The web app keeps an in-memory copy of all goals and steps
(`apps/web/src/db/dataStore.ts`). Every change is applied there at once, written
synchronously to a small localStorage journal, and then saved to IndexedDB
(Dexie) in batched transactions together with an outbox entry for the coming
sync. Leftover journal entries are replayed on start, so a reload right after a
change loses nothing. Changes that arrive in IndexedDB from elsewhere (another
tab, later the sync loop) are merged back in by last-write-wins on `updatedAt`.

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
