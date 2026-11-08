import { liveQuery } from 'dexie';
import { create } from 'zustand';
import type { ChangedEvent, Goal, PullResponse, PushResponse, Step } from '@planning/shared';
import { db as defaultDb, outboxKey, type OutboxEntry, type PlanningDB } from '@/db/db';
import { applyRemote } from '@/db/repo';

/**
 * Background sync with the Mac mini (PLAN.md §5):
 *
 * 1. push: send the records named in the outbox; clear entries that weren't
 *    re-queued meanwhile.
 * 2. pull: fetch everything changed since the last revision we saw and
 *    store it (last write wins).
 *
 * It runs on start, when the app comes back to the front or online, about a
 * second after a local change, every minute, and right away when the server
 * says (over SSE) that another device changed something.
 */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'unauthorized' | 'error';

interface SyncState {
  status: SyncStatus;
  /** Local changes not yet on the server. */
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
  /** A live connection to the server is open (instant updates). */
  live: boolean;
}

export const useSyncStore = create<SyncState>(() => ({
  status: 'idle',
  pending: 0,
  lastSyncedAt: null,
  error: null,
  live: false,
}));

export const TOKEN_KEY = 'planning-sync-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the token lasts for this session only.
  }
}

const LAST_REV = 'lastRev';
const PERIODIC_MS = 60_000;
const AFTER_CHANGE_MS = 1_000;

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Server answered ${status}`);
  }
}

export interface SyncEngineOptions {
  db?: PlanningDB;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** null disables live updates (e.g. in tests). */
  EventSource?: typeof EventSource | null;
  getToken?: () => string | null;
}

export class SyncEngine {
  private readonly db: PlanningDB;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly EventSourceImpl: typeof EventSource | null;
  private readonly token: () => string | null;

  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private events: EventSource | null = null;
  private stopFns: (() => void)[] = [];

  constructor(options: SyncEngineOptions = {}) {
    this.db = options.db ?? defaultDb;
    this.baseUrl = options.baseUrl ?? '';
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args));
    this.EventSourceImpl =
      options.EventSource === undefined
        ? typeof EventSource === 'undefined'
          ? null
          : EventSource
        : options.EventSource;
    this.token = options.getToken ?? getToken;
  }

  /** Starts syncing in the background. Returns a stop function. */
  start(): () => void {
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.request();
    };
    const onOnline = () => this.request();
    const onOffline = () => useSyncStore.setState({ status: 'offline', live: false });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onOnline);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const periodic = setInterval(() => this.request(), PERIODIC_MS);

    // Count pending changes for the indicator; sync shortly after new ones.
    let lastCount = 0;
    const outbox = liveQuery(() => this.db.outbox.count()).subscribe({
      next: (count) => {
        useSyncStore.setState({ pending: count });
        if (count > lastCount) this.request(AFTER_CHANGE_MS);
        lastCount = count;
      },
    });

    this.stopFns = [
      () => document.removeEventListener('visibilitychange', onVisible),
      () => window.removeEventListener('focus', onOnline),
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
      () => clearInterval(periodic),
      () => outbox.unsubscribe(),
      () => this.closeEvents(),
      () => this.timer && clearTimeout(this.timer),
    ];
    this.request();
    return () => this.stop();
  }

  stop(): void {
    for (const fn of this.stopFns) fn();
    this.stopFns = [];
  }

  /** Asks for a sync, now or after `delayMs` (later requests can bring it forward). */
  request(delayMs = 0): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, delayMs);
  }

  /** Runs one sync (or joins the one in progress and runs once more after it). */
  async syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.runOnce();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      useSyncStore.setState({ status: 'offline', live: false });
      return;
    }
    useSyncStore.setState({ status: 'syncing' });
    try {
      await this.push();
      await this.pull();
      this.failures = 0;
      useSyncStore.setState({
        status: 'idle',
        error: null,
        lastSyncedAt: new Date().toISOString(),
      });
      this.openEvents();
    } catch (error) {
      this.failures++;
      useSyncStore.setState(describeFailure(error));
      // Try again with growing gaps: 5 s, 10 s, 20 s, … up to the periodic minute.
      if (!(error instanceof HttpError && error.status === 401)) {
        this.request(Math.min(PERIODIC_MS, 5_000 * 2 ** (this.failures - 1)));
      }
    }
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.token();
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new HttpError(res.status);
    return (await res.json()) as T;
  }

  private async push(): Promise<void> {
    const entries = await this.db.outbox.toArray();
    if (entries.length === 0) return;
    const goalIds = entries.filter((e) => e.table === 'goals').map((e) => e.recordId);
    const stepIds = entries.filter((e) => e.table === 'steps').map((e) => e.recordId);
    const goals = (await this.db.goals.bulkGet(goalIds)).filter((g): g is Goal => !!g);
    const steps = (await this.db.steps.bulkGet(stepIds)).filter((s): s is Step => !!s);

    await this.api<PushResponse>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ goals: goals.map(withoutRev), steps: steps.map(withoutRev) }),
    });

    // Clear what was sent, unless it changed again while we were pushing.
    await this.db.transaction('rw', this.db.outbox, async () => {
      for (const entry of entries) {
        const current = await this.db.outbox.get(entry.key);
        if (current && current.queuedAt === entry.queuedAt) await this.db.outbox.delete(entry.key);
      }
    });
  }

  private async pull(): Promise<void> {
    let since = await this.lastRev();
    for (;;) {
      const page = await this.api<PullResponse>(`/api/sync/pull?since=${since}`);
      if (page.rev < since) {
        // The server was reset or restored from an older backup: send it
        // everything this device has and start over.
        await this.requeueEverything();
        await this.setLastRev(0);
        this.again = true;
        return;
      }
      await applyRemote(page.goals, page.steps, this.db);
      since = page.rev;
      await this.setLastRev(since);
      if (!page.hasMore) return;
    }
  }

  private async lastRev(): Promise<number> {
    const entry = await this.db.meta.get(LAST_REV);
    return typeof entry?.value === 'number' ? entry.value : 0;
  }

  private async setLastRev(rev: number): Promise<void> {
    await this.db.meta.put({ key: LAST_REV, value: rev });
  }

  private async requeueEverything(): Promise<void> {
    const queuedAt = new Date().toISOString();
    await this.db.transaction('rw', this.db.goals, this.db.steps, this.db.outbox, async () => {
      const entries: OutboxEntry[] = [
        ...(await this.db.goals.toCollection().primaryKeys()).map((id) => ({
          key: outboxKey('goals', id),
          table: 'goals' as const,
          recordId: id,
          queuedAt,
        })),
        ...(await this.db.steps.toCollection().primaryKeys()).map((id) => ({
          key: outboxKey('steps', id),
          table: 'steps' as const,
          recordId: id,
          queuedAt,
        })),
      ];
      await this.db.outbox.bulkPut(entries);
    });
  }

  /** Live updates: the server tells us when another device changed something. */
  private openEvents(): void {
    if (!this.EventSourceImpl || this.events || this.stopFns.length === 0) return;
    const token = this.token();
    const url = `${this.baseUrl}/api/sync/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const events = new this.EventSourceImpl(url);
    this.events = events;
    const onRev = (event: MessageEvent<string>) => {
      useSyncStore.setState({ live: true });
      const { rev } = JSON.parse(event.data) as ChangedEvent;
      void this.lastRev().then((last) => {
        if (rev !== last) this.request();
      });
    };
    events.addEventListener('hello', onRev as EventListener);
    events.addEventListener('changed', onRev as EventListener);
    events.onerror = () => {
      useSyncStore.setState({ live: false });
      // EventSource retries by itself unless the server refused; then reopen
      // after the next successful sync.
      if (events.readyState === 2) this.closeEvents();
    };
  }

  private closeEvents(): void {
    this.events?.close();
    this.events = null;
    useSyncStore.setState({ live: false });
  }
}

function withoutRev<T extends { rev?: number }>(record: T): Omit<T, 'rev'> {
  const { rev: _rev, ...rest } = record;
  return rest;
}

function describeFailure(error: unknown): Partial<SyncState> {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return { status: 'unauthorized', error: 'The server needs the access token.' };
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return { status: 'offline', error: "Can't reach the server." };
    }
    return { status: 'error', error: error.message };
  }
  // fetch rejects with a TypeError when the network or server is unreachable.
  if (error instanceof TypeError) return { status: 'offline', error: "Can't reach the server." };
  return { status: 'error', error: error instanceof Error ? error.message : String(error) };
}
