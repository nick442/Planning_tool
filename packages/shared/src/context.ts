import { ulid } from 'ulid';

/**
 * Everything a mutation needs from the outside world. Injected so the tree
 * logic stays pure and deterministic in tests.
 */
export interface MutationContext {
  /** ISO timestamp written to `updatedAt` / `completedAt` / `createdAt`. */
  now: string;
  /** Generates ids for new records. */
  newId: () => string;
}

export type ContextInput = Partial<MutationContext>;

export function newId(): string {
  return ulid();
}

export function resolveContext(ctx: ContextInput = {}): MutationContext {
  return {
    now: ctx.now ?? new Date().toISOString(),
    newId: ctx.newId ?? newId,
  };
}
