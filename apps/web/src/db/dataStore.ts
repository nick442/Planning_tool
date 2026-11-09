import { liveQuery } from 'dexie';
import { create } from 'zustand';
import { applyChanges, type Goal, type Step } from '@planning/shared';
import { db as defaultDb, type PlanningDB } from './db';
import { saveRecords } from './repo';

/**
 * The in-memory working copy of all goals and steps that the UI renders.
 *
 * Mutations are applied here synchronously (so the next keystroke already
 * sees a new row) and written to IndexedDB in the background, in order.
 * Changes that arrive in IndexedDB from elsewhere (another tab now, the sync
 * loop in Milestone 5) are merged back in with the same last-write-wins rule
 * the server uses: the copy with the newer `updatedAt` wins.
 */
interface DataState {
  loaded: boolean;
  goals: Goal[];
  steps: Step[];
}

export const useDataStore = create<DataState>(() => ({ loaded: false, goals: [], steps: [] }));

export const getSteps = () => useDataStore.getState().steps;
export const getGoals = () => useDataStore.getState().goals;

// ---------------------------------------------------------------------------
// Write-ahead journal
//
// IndexedDB writes are asynchronous, so a reload or a closed tab in the few
// milliseconds after a change could lose it. Every change is therefore also
// written synchronously to localStorage and removed once IndexedDB has it.
// Leftovers are replayed on the next start.
// ---------------------------------------------------------------------------

export const JOURNAL_KEY = 'planning-unsaved';

interface Journal {
  goals: Record<string, Goal>;
  steps: Record<string, Step>;
}

/** Records not yet confirmed in IndexedDB (queued or being written). */
const unsaved: Journal = { goals: {}, steps: {} };

function writeJournal(): void {
  try {
    if (Object.keys(unsaved.goals).length === 0 && Object.keys(unsaved.steps).length === 0) {
      localStorage.removeItem(JOURNAL_KEY);
    } else {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(unsaved));
    }
  } catch {
    // Storage full or unavailable (private mode): IndexedDB still gets the write.
  }
}

function readJournal(): Journal | null {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Journal>;
    return { goals: parsed.goals ?? {}, steps: parsed.steps ?? {} };
  } catch {
    return null;
  }
}

// Changes waiting to be written. While one write runs, later changes collect
// here and go out together in the next transaction, so the database never
// falls far behind the screen.
const pendingGoals = new Map<string, Goal>();
const pendingSteps = new Map<string, Step>();
let flushing: Promise<void> | null = null;

function forget<T extends { id: string }>(saved: readonly T[], from: Record<string, T>): void {
  for (const record of saved) {
    // Only if it wasn't changed again while the write was running.
    if (from[record.id] === record) delete from[record.id];
  }
}

async function flushLoop(): Promise<void> {
  while (pendingGoals.size > 0 || pendingSteps.size > 0) {
    const goals = [...pendingGoals.values()];
    const steps = [...pendingSteps.values()];
    pendingGoals.clear();
    pendingSteps.clear();
    try {
      await saveRecords(goals, steps);
      forget(goals, unsaved.goals);
      forget(steps, unsaved.steps);
      writeJournal();
    } catch (error) {
      // The records stay in the journal and are retried on the next start.
      console.error('Saving to the local database failed', error);
    }
  }
}

function scheduleFlush(): void {
  if (flushing) return;
  flushing = flushLoop().finally(() => {
    flushing = null;
    if (pendingGoals.size > 0 || pendingSteps.size > 0) scheduleFlush();
  });
}

/** Resolves once every pending change has reached IndexedDB. */
export async function whenSaved(): Promise<void> {
  while (flushing) await flushing;
}

function queue(goals: readonly Goal[], steps: readonly Step[]): void {
  for (const goal of goals) {
    pendingGoals.set(goal.id, goal);
    unsaved.goals[goal.id] = goal;
  }
  for (const step of steps) {
    pendingSteps.set(step.id, step);
    unsaved.steps[step.id] = step;
  }
  writeJournal();
  scheduleFlush();
}

export function commitSteps(changes: readonly Step[]): void {
  if (changes.length === 0) return;
  useDataStore.setState((s) => ({ steps: applyChanges(s.steps, changes) }));
  queue([], changes);
}

export function commitGoals(changes: readonly Goal[]): void {
  if (changes.length === 0) return;
  useDataStore.setState((s) => ({ goals: applyChanges(s.goals, changes) }));
  queue(changes, []);
}

/**
 * Merges `incoming` records into `current`, keeping whichever copy of each
 * record has the newer `updatedAt`. Returns `current` itself when nothing
 * changes, so subscribers don't re-render.
 */
export function mergeNewer<T extends { id: string; updatedAt: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const byId = new Map(current.map((r) => [r.id, r]));
  const newer = incoming.filter((r) => {
    const mine = byId.get(r.id);
    return !mine || r.updatedAt > mine.updatedAt;
  });
  return newer.length === 0 ? (current as T[]) : applyChanges(current, newer);
}

/** Loads the local database and keeps the store in step with it. Returns a stop function. */
export function startDataSync(database: PlanningDB = defaultDb): () => void {
  // Replay changes that hadn't reached IndexedDB when the app last closed.
  const journal = readJournal();
  if (journal) {
    const goals = Object.values(journal.goals);
    const steps = Object.values(journal.steps);
    useDataStore.setState((s) => ({
      goals: mergeNewer(s.goals, goals),
      steps: mergeNewer(s.steps, steps),
    }));
    queue(goals, steps);
  }

  const subscription = liveQuery(() =>
    Promise.all([database.goals.toArray(), database.steps.toArray()]),
  ).subscribe({
    next: ([goals, steps]) => {
      useDataStore.setState((s) => ({
        loaded: true,
        goals: mergeNewer(s.goals, goals),
        steps: mergeNewer(s.steps, steps),
      }));
    },
    error: (error: unknown) => console.error('Reading the local database failed', error),
  });
  return () => subscription.unsubscribe();
}
