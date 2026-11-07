# Planning Tool — Project Plan

A personal planning and anti-procrastination tool for a master's programme.
You enter a big task (a course assignment, a thesis chapter, an exam), break it
down step by step into a tree of smaller steps, and tick off the small steps.
Each completed step lands in a **Completed** feed, so the progress you've made
stays visible and keeps you going.

---

## 1. Core idea

Procrastination usually comes from tasks that are **too big or too vague** to
start. The tool deals with that in three ways:

1. **Break it down.** Any step can be split into smaller child steps, as many
   levels deep as needed, until each one is obvious and small.
2. **Show only what's next.** A focus view shows the small actionable steps
   (the leaves of the tree), not the whole intimidating project.
3. **Make progress visible.** Finished steps go to a Completed feed and fill
   up progress bars and streaks.

---

## 2. Concepts and terminology

| Term          | Meaning                                                                 |
|---------------|-------------------------------------------------------------------------|
| **Goal**      | A top-level item: "Thesis", "ML course – Assignment 3", "Stats exam". |
| **Step**      | Any node beneath a goal. Steps can have child steps.                 |
| **Branch**    | A step together with all its descendants.                              |
| **Leaf / Action** | A step with no children. It's the thing you actually *do*.        |
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
- **Goals:** create, rename, archive, colour or emoji, optional deadline, and a
  tag such as *Course* or *Thesis*.
- **Breakdown tree (Outline view):** a collapsible, indented tree with
  keyboard-first editing:
  - `Enter` adds a sibling, `Tab` / `Shift+Tab` indents or outdents (makes a child or parent)
  - `Space` (or clicking the checkbox) completes a step
  - drag and drop to reorder or move branches
  - inline title editing, plus an optional notes field per step
- **Mark complete:** checkbox with a short animation. The step fades out of the
  active tree and appears in the Completed feed.
- **Completed feed:** a reverse-chronological list grouped by day ("Today",
  "Yesterday", "Mon 3 Nov") that shows each step's title and the breadcrumb of
  its goal. Each entry has an undo button.
- **Progress:** a progress bar on each goal and branch (done leaves / total leaves).
- **Persistence:** everything is saved automatically in the browser (IndexedDB),
  and works offline.
- **Backup:** export and import all data as JSON.

### v2: Visual and momentum
- **Map view (branches):** a visual left-to-right tree/mind-map of a goal,
  laid out automatically. Done branches turn green or collapse, and the leaves
  you can act on now are highlighted. You can add children directly from a node.
- **Today / Focus list:** pick 1–3 leaf steps for today. A dedicated, minimal
  screen shows *only* these.
- **"Too big?" nudge:** steps can have a rough size (S / M / L or minutes).
  Anything estimated at more than ~2 h gets a "Break this down" hint.
- **Streaks and stats:** consecutive days with at least one completed step, steps
  completed this week, and a small heatmap (GitHub-style).
- **Focus timer:** start a 25-minute (configurable) Pomodoro on a step, plus a
  **"Just 5 minutes"** button to get past starting friction.

### v3: Nice to have
- **AI breakdown assistant:** "Suggest sub-steps" on any step uses the Claude
  API to propose 3–7 concrete child steps, which you edit and accept.
- **Deadline back-planning:** given a goal deadline and step estimates, suggest
  which steps should be done by when, and flag goals that are falling behind.
- **Calendar export:** push "Today" steps or deadlines into Google Calendar or
  an `.ics` file.
- **Sync across devices:** optional cloud backend (e.g. Supabase) so laptop
  and phone stay in sync.
- **Weekly review:** a short guided screen covering what you finished, what's
  stuck, and what's next week's focus.
- Dark mode, themes, PWA install on phone.

---

## 4. UI / UX

Design principles: **calm, minimal, few colours, lots of whitespace**, one
accent colour per goal, smooth but subtle animations, fully usable with the
keyboard.

### Main layout (desktop)

```
┌──────────────┬──────────────────────────────────────┬──────────────────┐
│  GOALS       │  Thesis                 [Outline|Map] │  COMPLETED  🔥 5 │
│              │  ██████████░░░░░░░░  42%   due 15 Jun │                  │
│ ● Thesis 42% │                                       │  Today           │
│ ● ML A3  80% │  ▾ Literature review          ███░ 60%│  ✓ Read paper X  │
│ ● Stats  10% │     ▾ Find sources                    │  ✓ Outline ch. 2 │
│              │        ☐ Search Scopus for "..."      │                  │
│ + New goal   │        ☐ Ask supervisor for key refs  │  Yesterday       │
│              │     ▸ Write summaries (3 open)        │  ✓ Set up Zotero │
│ ──────────── │  ▾ Methodology                ░░░░ 0% │  ✓ Draft RQ      │
│ ☀ Today (3)  │     ☐ Draft research questions        │                  │
│ 📊 Stats     │     + Add step                        │  [Show all]      │
│              │  + Add step      [ ] Show completed   │                  │
└──────────────┴──────────────────────────────────────┴──────────────────┘
```

- **Left:** goal list with progress, and the Today and Stats screens.
- **Centre:** the selected goal as an Outline or a Map (toggle).
- **Right:** the Completed feed and current streak, which you can collapse.
- **Mobile:** single column with bottom tabs (Goals / Today / Completed).

### Map view sketch

```
                         ┌─ Find sources ──┬─ ☐ Search Scopus
          ┌─ Lit review ─┤                 └─ ☐ Ask supervisor
 Thesis ──┤              └─ Write summaries ─ ...
          └─ Methodology ── ☐ Draft RQs
```

---

## 5. Technical approach

**Recommendation:** a local-first web app (later installable as a PWA). It
runs in any browser, needs no server in v1, and can be added to a phone home
screen.

| Concern            | Choice                                   | Why |
|--------------------|------------------------------------------|-----|
| Framework          | **React + TypeScript + Vite**            | Fast dev loop, huge ecosystem, type safety for the tree logic. |
| Styling            | **Tailwind CSS** + **shadcn/ui** (Radix) | Clean, consistent, accessible components with little effort. |
| State              | **Zustand**                              | Simple global store, no boilerplate. |
| Persistence        | **Dexie.js** (IndexedDB)                 | Offline, robust, easy migrations. |
| Drag & drop        | **dnd-kit**                              | Good support for nested/tree sortable lists. |
| Map view           | **React Flow (@xyflow/react)** + **elkjs/dagre** auto-layout | Interactive node graph with pan/zoom out of the box. |
| Animations         | **Framer Motion**                        | Completion and "move to Completed" transitions. |
| Dates              | **date-fns**                             | Grouping the Completed feed by day, streaks. |
| Testing            | **Vitest** (logic) + **Playwright** (e2e)| Tree operations must be reliable. |
| PWA                | **vite-plugin-pwa**                      | Offline and installable. |
| Hosting            | GitHub Pages / Netlify / Vercel          | Free static hosting. |

### Data model

```ts
type GoalKind = 'course' | 'thesis' | 'exam' | 'other';

interface Goal {
  id: string;
  title: string;
  kind: GoalKind;
  course?: string;          // e.g. "Advanced ML"
  color: string;
  deadline?: string;        // ISO date
  archived: boolean;
  createdAt: string;
}

interface Step {
  id: string;
  goalId: string;
  parentId: string | null;  // null = top-level step under the goal
  order: number;            // fractional index for cheap reordering
  title: string;
  notes?: string;
  estimate?: 'S' | 'M' | 'L' | number; // number = minutes
  dueDate?: string;
  status: 'open' | 'done';
  completedAt?: string;
  autoCompleted?: boolean;  // completed because all children finished
  inToday?: boolean;        // v2: pinned to Today list
  createdAt: string;
}

interface FocusSession {      // v2
  id: string;
  stepId: string;
  startedAt: string;
  durationMin: number;
}
```

A flat `steps` table with `parentId` keeps storage and drag-and-drop moves
simple. The tree is built in memory with a selector, `buildTree(goalId)`.
Derived values (progress, leaf status, streak) are computed rather than stored.

### Project structure

```
src/
  app/            # routing, layout shell
  features/
    goals/        # goal list, goal header, create/edit dialogs
    tree/         # outline view, step row, keyboard handling, dnd
    map/          # React Flow map view
    completed/    # completed feed, undo
    today/        # focus list, timer (v2)
    stats/        # streaks, heatmap (v2)
  lib/
    db.ts         # Dexie schema + migrations
    tree.ts       # pure functions: buildTree, progress, move, completeCascade
    dates.ts
  store/          # Zustand stores
  components/ui/  # shadcn components
tests/
```

All tree logic (move, indent, outdent, complete or uncomplete with cascade,
progress) lives in **pure functions in `lib/tree.ts`** with thorough unit tests.
The UI only calls these functions.

---

## 6. Milestones

| # | Milestone | Deliverable | Rough effort |
|---|-----------|-------------|--------------|
| 0 | **Setup** | Vite + React + TS + Tailwind + shadcn, lint and format, Vitest, CI on GitHub Actions, deploy preview | ½ day |
| 1 | **Data layer** | Dexie schema, Zustand store, `tree.ts` with unit tests (build, add, move, indent, complete, cascade, progress) | 1–2 days |
| 2 | **Goals + Outline view** | Sidebar goals, outline tree, inline edit, keyboard shortcuts, collapse/expand | 2–3 days |
| 3 | **Completion + Completed feed** | Checkbox, animation, hide done, Completed panel grouped by day, undo, progress bars | 1–2 days |
| 4 | **Drag & drop + export/import** | dnd-kit nested reorder or move, JSON backup → **MVP done** | 1–2 days |
| 5 | **Map view** | React Flow + auto-layout, sync with outline, add children from nodes | 2–3 days |
| 6 | **Momentum features** | Today list, size estimates and "too big" nudge, streaks, heatmap, focus timer | 2–3 days |
| 7 | **Polish + PWA** | Dark mode, mobile layout, installable PWA, empty states, onboarding example goal | 1–2 days |
| 8 | **Optional extras** | AI breakdown, back-planning, calendar, sync, weekly review | as desired |

---

## 7. MVP acceptance criteria

- [ ] I can create a goal "Thesis" and add a step "Literature review".
- [ ] I can break "Literature review" into sub-steps and those into sub-sub-steps.
- [ ] I can reorder and move steps (keyboard and drag).
- [ ] Ticking a step animates it out of the tree and into **Completed → Today**.
- [ ] Completing all children of a step completes the parent too; undo restores both.
- [ ] Progress bars on goals and branches update instantly.
- [ ] Reloading the page or going offline loses nothing; I can export and import a JSON backup.

---

## 8. Open questions

1. **Devices:** mostly laptop, or also phone? This decides how early sync and PWA matter.
2. **Sync:** is local-only (with JSON backup) fine at first, or is cross-device sync a must from day one?
3. **AI assistance:** should the "suggest sub-steps" feature be in scope (it requires an API key)?
4. **Deadlines:** should the tool actively plan and warn based on deadlines, or stay a pure breakdown and momentum tool?
