# Planning Tool

A personal planning and anti-procrastination tool: break big tasks into a tree
of small steps, tick them off, and watch the Completed feed grow. See
[PLAN.md](PLAN.md) for the full plan.

## Layout

```
apps/web         React + Vite + Tailwind + shadcn/ui front end (PWA later)
apps/server      Hono + SQLite (Drizzle) server for the Mac mini: sync API and the built web app
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
http://localhost:3000 (the web dev server proxies `/api` to it). The development
database is `apps/server/data/planning.db`.

In production the server serves the built web app itself:

```bash
pnpm build
```

```bash
PLANNING_TOKEN=some-long-secret node apps/server/dist/index.js
```

| Variable         | Default                        | Meaning                                       |
| ---------------- | ------------------------------ | --------------------------------------------- |
| `PORT`           | `3000`                         | Port to listen on                             |
| `HOST`           | `127.0.0.1`                    | Interface (Tailscale serve forwards to it)    |
| `PLANNING_DB`    | `apps/server/data/planning.db` | SQLite file (created on first start)          |
| `PLANNING_TOKEN` | not set                        | If set, devices need it (Sync dialog) to sync |
| `WEB_ROOT`       | `apps/web/dist`                | Built web app to serve                        |

Database migrations live in `apps/server/drizzle/` and run on start. After
changing `apps/server/src/db/schema.ts`, generate a new one with
`pnpm --filter @planning/server exec drizzle-kit generate`.

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

## On the phone

Below the tablet breakpoint the app switches to one screen at a time, with
bottom tabs: **Goals** (goal list → outline; tap the tab again to go back to the
list) and **Done** (the Completed feed, with today's count on the tab). The
Today tab from the plan arrives with the Today list in Milestone 8.

- Tap a title to edit it; the floating **+** adds a step, the **+** on a row adds a sub-step.
- Swipe a step to the right to complete it (let go past the green check).
- Drag the handle on the left of a row to move it.

### Installing it (PWA)

The app is an installable PWA: open it over HTTPS (the Mac mini's Tailscale
address, Milestone 6) and choose **Add to Home Screen** (Safari) or **Install
app** (Chrome). It then opens full screen and starts with no connection: the
service worker precaches the whole app and the data lives in IndexedDB. When a
new version is deployed, a toast offers to reload into it.

App icons live in `apps/web/public/icons/`; regenerate them with
`pnpm --filter @planning/web icons`.

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

## Sync

Each device works on its own copy and syncs with the server in the background
(`apps/web/src/sync/engine.ts`, `apps/server/src/sync.ts`):

- **Push** sends the records named in the outbox; the server keeps whichever
  copy was changed last (`updatedAt`, last write wins per record) and gives
  every stored change the next revision number.
- **Pull** fetches everything changed since the last revision the device saw.
- It runs on start, when the app comes back to the front or online, about a
  second after a local change, every minute, and immediately when the server
  announces (Server-Sent Events) that another device changed something.
- If the server's database was reset or restored from an older backup, devices
  notice (its revision went down) and send it everything they have.

The sync status sits at the bottom of the sidebar (and top right on a phone):
Synced, Syncing…, or Offline with the number of changes waiting. Click it to
see details or enter the access token.

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
