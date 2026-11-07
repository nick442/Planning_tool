# Planning Tool — Project Plan

A personal planning and anti-procrastination tool for a master's programme.
You enter a big task (a course assignment, a thesis chapter, an exam), break it
down step by step into a tree of smaller steps, and tick off the small steps.
Each completed step lands in a **Completed** feed, so the progress you've made
stays visible and keeps you going.

**Decisions so far**

| Question | Decision |
|----------|----------|
| Devices | **Laptop and phone.** The mobile layout and installable app (PWA) are part of the MVP. |
| Sync | **Self-hosted on the always-on Mac mini.** The data lives there, and each device keeps an offline copy. |
| AI suggestions | **Out of scope.** |
| Deadlines | **Shown, not planned around.** Goals have a deadline with a countdown. There is no back-planning and no warnings. The tool stays focused on breaking tasks down and keeping momentum. |
| Goal order | **Drag and drop** to reorder goals in the sidebar. |

---

## 1. Core idea

Procrastination usually comes from tasks that are **too big or too vague** to
start. The tool deals with that in three ways:

1. **Break it down.** Any step can be split into smaller child steps, as many
   levels deep as needed, until each one is obvious and small.
2. **Show only what's next.** A Today view shows a few small actionable steps,
   not the whole intimidating project.
3. **Make progress visible.** Finished steps go to a Completed feed and fill
   up progress bars and streaks.

---

## 2. Concepts and terminology

| Term          | Meaning |
|---------------|---------|
| **Goal**      | A top-level item: "Thesis", "ML course – Assignment 3", "Stats exam". It has a deadline and a position in the goal list. |
| **Step**      | Any node beneath a goal. Steps can have child steps. |
| **Branch**    | A step together with all its descendants. |
| **Leaf / Action** | A step with no children. It's the thing you actually *do*. |
| **Completed** | A step marked done. It moves to the Completed feed and is hidden from the active tree by default. |

Rules:
- A parent step's progress = the share of its leaf descendants that are done.
- When the last child of a step is completed, the parent is **auto-completed**
  (with a small "Branch finished!" moment). You can undo this.
- Completing a parent with open children asks: "Mark all N remaining steps done?"
- Nothing is ever deleted when completed. It's only hidden, so you can
  always see the full history of a goal.

---

## 3. Features

### MVP (v1)
- **Goals:**
  - create, rename, archive, colour or emoji, and a tag such as *Course*, *Thesis* or *Exam*
  - **deadline** (optional), shown as a date plus a countdown ("12 days left")
  - **reorder by drag and drop** in the sidebar (long-press and drag on the phone)
- **Breakdown tree (Outline view):** a collapsible, indented tree with
  keyboard-first editing on desktop:
  - `Enter` adds a sibling, `Tab` / `Shift+Tab` indents or outdents
  - `Space` (or clicking the checkbox) completes a step
  - drag and drop to reorder or move branches
  - inline title editing, plus an optional notes field per step
  - on the phone: tap to edit, swipe right to complete, and a "+" button on
    each row to add a sub-step
- **Mark complete:** checkbox with a short animation. The step fades out of the
  active tree and appears in the Completed feed.
- **Completed feed:** a reverse-chronological list grouped by day ("Today",
  "Yesterday", "Mon 3 Nov") that shows each step's title and the breadcrumb of
  its goal. Each entry has an undo button.
- **Progress:** a progress bar on each goal and branch (done leaves / total leaves).
- **Works offline:** every device keeps a local copy and saves instantly.
- **Sync through the Mac mini:** changes reach your other devices within
  seconds when online, and offline changes are sent when you reconnect
  (see §5).
- **Installable app (PWA):** add it to the iPhone/Android home screen and it
  opens full screen like a native app.
- **Backup:** a nightly automatic backup on the Mac mini, plus manual
  JSON export and import.

### v2: Visual and momentum
- **Map view (branches):** a visual left-to-right tree/mind-map of a goal,
  laid out automatically. Done branches turn green or collapse, and the leaves
  you can act on now are highlighted. You can add children directly from a node.
- **Today / Focus list:** pick 1–3 leaf steps for today. A dedicated, minimal
  screen shows *only* these (the default tab on the phone).
- **"Too big?" nudge:** steps can have a rough size (S / M / L).
  Anything marked L gets a "Break this down" hint.
- **Streaks and stats:** consecutive days with at least one completed step, steps
  completed this week, and a small heatmap (GitHub-style).
- **Focus timer:** start a 25-minute (configurable) Pomodoro on a step, plus a
  **"Just 5 minutes"** button to get past starting friction.

### Later (if wanted)
- Weekly review screen: what you finished, what's stuck, and what's next week's focus.
- Themes, plus a sort option for goals by deadline next to the manual order.

**Explicitly out of scope:** AI suggestions, deadline back-planning and
warnings, calendar integration, multiple users.

---

## 4. UI / UX

Design principles: **calm, minimal, few colours, lots of whitespace**, one
accent colour per goal, smooth but subtle animations, dark mode, fully usable
with the keyboard on desktop and with one thumb on the phone.

### Desktop / laptop

```
┌────────────────┬──────────────────────────────────────┬──────────────────┐
│  GOALS    ⇅    │  Thesis                 [Outline|Map] │  COMPLETED  🔥 5 │
│                │  ██████████░░░░░░░░ 42%  ⏳ 12 days   │                  │
│ ⠿ ● Thesis     │                                       │  Today           │
│     42% · 12d  │  ▾ Literature review          ███░ 60%│  ✓ Read paper X  │
│ ⠿ ● ML A3      │     ▾ Find sources                    │  ✓ Outline ch. 2 │
│     80% · 3d   │        ☐ Search Scopus for "..."      │                  │
│ ⠿ ● Stats exam │        ☐ Ask supervisor for key refs  │  Yesterday       │
│     10% · 30d  │     ▸ Write summaries (3 open)        │  ✓ Set up Zotero │
│                │  ▾ Methodology                ░░░░ 0% │  ✓ Draft RQ      │
│ + New goal     │     ☐ Draft research questions        │                  │
│ ────────────── │     + Add step                        │  [Show all]      │
│ ☀ Today (3)    │  + Add step      [ ] Show completed   │                  │
│ 📊 Stats       │                               ● synced│                  │
└────────────────┴──────────────────────────────────────┴──────────────────┘
```
`⠿` = drag handle for reordering goals.
The small **sync indicator** shows synced, syncing or offline (with the
number of pending changes).

### Phone

```
┌─────────────────────────┐
│ ‹ Goals     Thesis   ⋯  │
│ ████████░░░░ 42% · 12d  │
│                         │
│ ▾ Literature review 60% │
│   ▾ Find sources        │
│     ☐ Search Scopus  +  │
│     ☐ Ask supervisor +  │
│   ▸ Write summaries     │
│ ▾ Methodology        0% │
│     ☐ Draft RQs      +  │
│                         │
│            ( + )        │
├─────────────────────────┤
│ ☀ Today │ ◎ Goals │ ✓ Done │
└─────────────────────────┘
```
There are three bottom tabs: **Today** (default), **Goals** (goal list → tree)
and **Done** (Completed feed and streak).

### Map view sketch (v2)

```
                         ┌─ Find sources ──┬─ ☐ Search Scopus
          ┌─ Lit review ─┤                 └─ ☐ Ask supervisor
 Thesis ──┤              └─ Write summaries ─ ...
          └─ Methodology ── ☐ Draft RQs
```

---

## 5. Architecture: local-first, synced via the Mac mini

```
  iPhone (PWA)            Laptop (browser/PWA)
  ┌─────────────┐         ┌─────────────┐
  │ React app   │         │ React app   │
  │ IndexedDB   │         │ IndexedDB   │   ← always works offline
  │ + outbox    │         │ + outbox    │
  └──────┬──────┘         └──────┬──────┘
         │  HTTPS over Tailscale (private network)
         └──────────┬────────────┘
             ┌──────▼───────────────────┐
             │ Mac mini                  │
             │  Node server (Hono)       │  serves the web app + /api/sync
             │  SQLite (planning.db)     │  ← source of truth
             │  launchd: auto-start      │
             │  nightly backup           │
             └───────────────────────────┘
```

### Why this setup
- **Local-first:** the app reads and writes its local database, so it's
  instant and works on a train or in the library without Wi-Fi. Sync runs in
  the background.
- **Mac mini as hub:** a small Node + SQLite server holds the full data.
  You don't need a cloud account or a subscription, and the data stays yours.
- **Tailscale for access:** the Mac mini, laptop and phone join one private
  Tailscale network (free for personal use). This means:
  - You can reach the server from anywhere (uni, home, mobile data)
    **without opening ports** on your router.
  - `tailscale serve` gives a real **HTTPS** address
    (e.g. `https://mac-mini.<tailnet>.ts.net`). Installable apps and offline
    support only work over HTTPS.
  - Only your own devices can reach the server. A simple access token
    adds a second layer.

### Sync protocol (simple, robust, single-user)
Every record (`Goal`, `Step`) carries:
- `id`: an ID generated on the device (ULID), so records can be created offline
- `updatedAt`: when it was last changed, set on the device
- `deleted`: a deletion marker, so deletions sync too
- `rev`: a revision number the server assigns, rising with every change it stores

Flow:
1. **Local change** → write to IndexedDB *and* append to a local `outbox`.
2. **Push** `POST /api/sync/push` with the outbox. For each record, the server
   keeps whichever copy has the newer `updatedAt` (last write wins), stores it
   with a new `rev`, and confirms. The client then clears those outbox entries.
3. **Pull** `GET /api/sync/pull?since=<lastRev>` → every record changed
   since. The client applies them and saves the new `lastRev`.
4. **When it runs:** on app start, when the app regains focus, about 1 s after
   a local change, every 60 s, and immediately when the server sends a
   "something changed" notification over a live connection (SSE) to the other
   open devices.

Conflicts can only happen if the same step is edited on two devices while
both are offline. Last write wins per record is fine for one user. If this
ever becomes annoying, upgrade to per-field timestamps, so a rename on the
laptop and a completion on the phone both survive.

Ordering uses **fractional indexing** (sort keys like `"a0"`, `"a0V"`, `"a1"`).
Moving a goal or step changes only that item's key. This keeps drag and drop
cheap and reduces sync conflicts.

### Data model (shared between app and server)

```ts
interface SyncFields {
  id: string;          // ULID
  updatedAt: string;   // ISO timestamp
  deleted: boolean;
  rev?: number;        // assigned by server
}

type GoalKind = 'course' | 'thesis' | 'exam' | 'other';

interface Goal extends SyncFields {
  title: string;
  kind: GoalKind;
  course?: string;     // e.g. "Advanced ML"
  color: string;
  deadline?: string;   // ISO date, display + countdown only
  order: string;       // fractional index → drag & drop order in sidebar
  archived: boolean;
  createdAt: string;
}

interface Step extends SyncFields {
  goalId: string;
  parentId: string | null;  // null = top-level step under the goal
  order: string;            // fractional index among siblings
  title: string;
  notes?: string;
  size?: 'S' | 'M' | 'L';   // v2
  status: 'open' | 'done';
  completedAt?: string;
  autoCompleted?: boolean;  // completed because all children finished
  inToday?: boolean;        // v2
  createdAt: string;
}
```

A flat `steps` table with `parentId` keeps storage and sync simple. The tree
is built in memory with `buildTree(goalId)`. Derived values (progress,
streaks) are computed rather than stored.

### Tech stack

| Concern            | Choice | Why |
|--------------------|--------|-----|
| Repo layout        | **pnpm workspaces** monorepo | Web app, server and shared types/logic in one repo. |
| Frontend           | **React + TypeScript + Vite** | Fast dev loop, type safety for the tree logic. |
| Styling            | **Tailwind CSS** + **shadcn/ui** (Radix) | Clean, accessible components with little effort. |
| State              | **Zustand** | Simple store; reads from Dexie through live queries. |
| Local DB           | **Dexie.js** (IndexedDB) | Offline storage with reactive queries. |
| Drag & drop        | **dnd-kit** | Sortable goal list and nested tree; works with touch. |
| Map view (v2)      | **React Flow (@xyflow/react)** + **elkjs** | Interactive node graph with automatic layout. |
| Animations         | **Framer Motion** | Completion and "move to Completed" transitions. |
| Dates              | **date-fns** | Day grouping, countdowns, streaks. |
| PWA                | **vite-plugin-pwa** | Service worker, offline support, install to home screen. |
| Server             | **Node 22 + Hono** | Tiny, fast and typed; also serves the built frontend. |
| Server DB          | **SQLite** via **better-sqlite3** + **Drizzle ORM** | One file, no DB server, easy backup. |
| Validation         | **Zod** (shared) | Same schemas validate data on the device and on the server. |
| Testing            | **Vitest** (tree + sync logic) + **Playwright** (e2e incl. two-device sync) | Tree and sync must be reliable. |
| Hosting            | Mac mini + **launchd** + **Tailscale serve** | Always on, auto-restarts, private HTTPS. |

### Project structure

```
apps/
  web/
    src/
      app/            # routing, layout shell, bottom tabs on mobile
      features/
        goals/        # sidebar, sortable goal list, deadline badge, dialogs
        tree/         # outline view, step row, keyboard + touch handling, dnd
        completed/    # completed feed, undo
        today/        # focus list, timer (v2)
        map/          # React Flow map view (v2)
        stats/        # streaks, heatmap (v2)
      sync/           # outbox, push/pull loop, SSE listener, status indicator
      db/             # Dexie schema + migrations
  server/
    src/
      index.ts        # Hono app: static files + /api
      sync.ts         # push/pull handlers, rev counter, SSE broadcast
      db/             # Drizzle schema + migrations (SQLite)
      backup.ts       # nightly SQLite backup
packages/
  shared/
    src/
      schema.ts       # Zod schemas + TS types for Goal/Step
      tree.ts         # pure: buildTree, progress, move, indent, completeCascade
      order.ts        # fractional indexing helpers
deploy/
  com.planningtool.server.plist   # launchd service for the Mac mini
  README.md                       # Mac mini + Tailscale setup steps
```

All tree logic lives in **pure functions in `packages/shared`** with thorough
unit tests. The UI and the server only call these functions.

### Mac mini deployment (one-time setup)
1. Install Node 22 and pnpm, clone the repo, run `pnpm install && pnpm build`.
2. Install the `launchd` plist so the server starts on boot and restarts if
   it crashes.
3. Install Tailscale on the Mac mini, laptop and phone, and sign in with the
   same account.
4. Run `tailscale serve --bg 3000` to get the HTTPS address.
5. On the phone, open that address in Safari or Chrome and choose
   **Add to Home Screen**.
6. Backups: the server writes a nightly `planning-YYYY-MM-DD.db` copy (keeps the
   last 30) into a folder that Time Machine or iCloud Drive also backs up.

To update later: `git pull && pnpm build`, then restart the service (or use a
small `deploy/update.sh` script).

---

## 6. Milestones

| # | Milestone | Deliverable | Rough effort |
|---|-----------|-------------|--------------|
| 0 | **Setup** | pnpm monorepo (web / server / shared), TS, Tailwind + shadcn, lint and format, Vitest, GitHub Actions CI | ½–1 day |
| 1 | **Core logic** | `shared`: Zod schemas, `tree.ts` (build, add, move, indent, complete, cascade, progress), fractional ordering, unit tests | 1–2 days |
| 2 | **Local app: goals + outline** | Dexie DB, sortable goal sidebar (drag and drop), deadline + countdown, outline tree, inline edit, keyboard shortcuts | 2–3 days |
| 3 | **Completion + Completed feed** | Checkbox and animation, hide done, Completed panel grouped by day, undo, progress bars | 1–2 days |
| 4 | **Mobile + PWA** | Responsive layout, bottom tabs, touch drag, swipe to complete, installable PWA with offline support | 1–2 days |
| 5 | **Server + sync** | Hono + SQLite server, push/pull + SSE, client outbox and sync loop, sync indicator, two-device e2e test | 2–3 days |
| 6 | **Mac mini deploy** | launchd service, Tailscale serve, nightly backups, JSON export/import, deploy README → **MVP done** | ½–1 day |
| 7 | **Map view** | React Flow + auto-layout, add children from nodes | 2–3 days |
| 8 | **Momentum features** | Today list, S/M/L sizes + "too big" nudge, streaks, heatmap, focus timer | 2–3 days |
| 9 | **Polish** | Dark mode, empty states, an example goal for onboarding, small UX fixes from real use | 1–2 days |

The MVP (milestones 0–6) is about **2–2.5 weeks** of part-time work. Milestones
2–4 already give a usable single-device app, so you can start using it for
real coursework before sync is done.

---

## 7. MVP acceptance criteria

- [ ] I can create goals with a deadline and see "N days left" next to each.
- [ ] I can reorder goals by dragging them in the sidebar (and by long-press on the phone).
- [ ] I can break a goal into steps, sub-steps and sub-sub-steps, and reorder or move them.
- [ ] Ticking a step animates it out of the tree and into **Completed → Today**.
- [ ] Completing all children of a step completes the parent too; undo restores both.
- [ ] Progress bars on goals and branches update instantly.
- [ ] The app is installed on my phone's home screen and works with no connection.
- [ ] A step completed on my phone appears as completed on my laptop within a few seconds.
- [ ] Changes made offline sync automatically once I'm back online.
- [ ] The Mac mini keeps nightly backups, and I can export/import JSON manually.
