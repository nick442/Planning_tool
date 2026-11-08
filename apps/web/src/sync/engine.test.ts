import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isNewer, type Goal, type Step } from '@planning/shared';
import { PlanningDB, outboxKey } from '@/db/db';
import { SyncEngine, useSyncStore } from './engine';

const T = (min: number) => new Date(Date.UTC(2026, 10, 8, 9, min)).toISOString();

const step = (id: string, updatedAt: string, extra: Partial<Step> = {}): Step => ({
  id,
  goalId: 'g1',
  parentId: null,
  order: 'a0',
  title: id,
  status: 'open',
  createdAt: T(0),
  updatedAt,
  deleted: false,
  ...extra,
});

/** A tiny in-memory implementation of the server's sync protocol. */
class FakeServer {
  rev = 0;
  steps = new Map<string, Step>();
  goals = new Map<string, Goal>();
  token: string | null = null;
  down = false;
  pushes = 0;

  fetch: typeof fetch = async (input, init) => {
    if (this.down) throw new TypeError('Failed to fetch');
    const url = new URL(String(input), 'http://x');
    const auth = new Headers(init?.headers).get('authorization');
    if (this.token && auth !== `Bearer ${this.token}`) return new Response('{}', { status: 401 });
    if (url.pathname === '/api/sync/push') {
      this.pushes++;
      const body = JSON.parse(String(init!.body)) as { steps: Step[]; goals: Goal[] };
      const accepted: string[] = [];
      for (const s of body.steps) {
        if (isNewer(s, this.steps.get(s.id))) {
          this.steps.set(s.id, { ...s, rev: ++this.rev });
          accepted.push(s.id);
        }
      }
      return Response.json({ accepted, rev: this.rev });
    }
    if (url.pathname === '/api/sync/pull') {
      const since = Number(url.searchParams.get('since'));
      const steps = [...this.steps.values()].filter((s) => s.rev! > since);
      return Response.json({ goals: [], steps, rev: this.rev, hasMore: false });
    }
    return new Response('{}', { status: 404 });
  };

  /** Another device's change arrives on the server. */
  external(s: Step) {
    this.steps.set(s.id, { ...s, rev: ++this.rev });
  }
}

let n = 0;
let db: PlanningDB;
let server: FakeServer;
let engine: SyncEngine;
let token: string | null;

beforeEach(async () => {
  db = new PlanningDB(`sync-test-${n++}`);
  await db.open();
  server = new FakeServer();
  token = null;
  engine = new SyncEngine({
    db,
    fetch: (input, init) => server.fetch(input, init),
    EventSource: null,
    getToken: () => token,
  });
  useSyncStore.setState({ status: 'idle', error: null, lastSyncedAt: null });
});

afterEach(async () => {
  engine.stop();
  db.close();
});

async function localChange(s: Step) {
  await db.steps.put(s);
  await db.outbox.put({
    key: outboxKey('steps', s.id),
    table: 'steps',
    recordId: s.id,
    queuedAt: s.updatedAt,
  });
}

describe('SyncEngine', () => {
  it('pushes the outbox and clears it', async () => {
    await localChange(step('a', T(1)));
    await engine.syncNow();
    expect(server.steps.get('a')?.title).toBe('a');
    expect(await db.outbox.count()).toBe(0);
    expect(useSyncStore.getState()).toMatchObject({ status: 'idle', error: null });
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
  });

  it("pulls other devices' changes and remembers the revision", async () => {
    server.external(step('remote', T(1), { title: 'from phone' }));
    await engine.syncNow();
    expect((await db.steps.get('remote'))?.title).toBe('from phone');
    expect((await db.meta.get('lastRev'))?.value).toBe(1);
    // Nothing new: nothing written.
    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps a newer local edit over an older remote one, and sends it', async () => {
    server.external(step('a', T(1), { title: 'old remote' }));
    await localChange(step('a', T(5), { title: 'newer local' }));
    await engine.syncNow();
    expect((await db.steps.get('a'))?.title).toBe('newer local');
    expect(server.steps.get('a')?.title).toBe('newer local');
  });

  it('takes a newer remote edit over an older local one', async () => {
    await localChange(step('a', T(1), { title: 'old local' }));
    server.external(step('a', T(5), { title: 'newer remote' }));
    await engine.syncNow();
    expect((await db.steps.get('a'))?.title).toBe('newer remote');
    expect(server.steps.get('a')?.title).toBe('newer remote');
  });

  it('does not clear an outbox entry that changed again during the push', async () => {
    await localChange(step('a', T(1)));
    const original = server.fetch;
    server.fetch = async (input, init) => {
      // While the push is in flight, the user edits the step again.
      if (String(input).includes('push'))
        await localChange(step('a', T(2), { title: 'edited again' }));
      return original(input, init);
    };
    await engine.syncNow();
    expect(await db.outbox.count()).toBe(1);
    await engine.syncNow();
    expect(server.steps.get('a')?.title).toBe('edited again');
    expect(await db.outbox.count()).toBe(0);
  });

  it('reports offline when the server is unreachable and keeps the changes', async () => {
    server.down = true;
    await localChange(step('a', T(1)));
    await engine.syncNow();
    expect(useSyncStore.getState()).toMatchObject({ status: 'offline' });
    expect(await db.outbox.count()).toBe(1);

    server.down = false;
    await engine.syncNow();
    expect(useSyncStore.getState().status).toBe('idle');
    expect(server.steps.has('a')).toBe(true);
  });

  it('asks for the token when the server refuses', async () => {
    server.token = 's3cret';
    await engine.syncNow();
    expect(useSyncStore.getState().status).toBe('unauthorized');
    token = 's3cret';
    await engine.syncNow();
    expect(useSyncStore.getState().status).toBe('idle');
  });

  it('re-sends everything when the server was reset', async () => {
    await localChange(step('a', T(1)));
    await localChange(step('b', T(1)));
    await engine.syncNow();
    expect(server.steps.size).toBe(2);

    // The Mac mini's database is replaced by an empty one.
    const fresh = new FakeServer();
    server.steps = fresh.steps;
    server.rev = 0;
    await engine.syncNow();
    expect([...server.steps.keys()].sort()).toEqual(['a', 'b']);
    expect(await db.outbox.count()).toBe(0);
  });
});
