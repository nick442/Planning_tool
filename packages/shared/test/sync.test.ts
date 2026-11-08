import { describe, expect, it } from 'vitest';
import { isNewer, pushRequestSchema } from '../src/sync';
import { makeStep } from './helpers';

describe('isNewer (last write wins)', () => {
  it('takes a record that does not exist yet', () => {
    expect(isNewer({ updatedAt: '2026-11-08T10:00:00.000Z' }, undefined)).toBe(true);
  });

  it('compares instants, not strings', () => {
    // Same instant written with an offset: not newer.
    expect(
      isNewer(
        { updatedAt: '2026-11-08T11:00:00.000+01:00' },
        { updatedAt: '2026-11-08T10:00:00.000Z' },
      ),
    ).toBe(false);
    expect(
      isNewer({ updatedAt: '2026-11-08T10:00:00.001Z' }, { updatedAt: '2026-11-08T10:00:00.000Z' }),
    ).toBe(true);
  });

  it('keeps the existing copy on a tie', () => {
    const t = { updatedAt: '2026-11-08T10:00:00.000Z' };
    expect(isNewer(t, t)).toBe(false);
  });
});

describe('pushRequestSchema', () => {
  it('accepts goals and steps and defaults missing lists', () => {
    const parsed = pushRequestSchema.parse({ steps: [makeStep({ id: 's1' })] });
    expect(parsed.goals).toEqual([]);
    expect(parsed.steps).toHaveLength(1);
  });

  it('rejects malformed records', () => {
    expect(pushRequestSchema.safeParse({ steps: [{ id: 's1' }] }).success).toBe(false);
  });
});
