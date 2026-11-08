import { describe, expect, it } from 'vitest';
import { goalSchema, stepSchema, type Goal, type Step } from '../src/schema';

const goal: Goal = {
  id: '01JC0000000000000000000000',
  title: 'Thesis',
  kind: 'thesis',
  color: '#6366f1',
  deadline: '2027-03-31',
  order: 'a0',
  archived: false,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  deleted: false,
};

const step: Step = {
  id: '01JC0000000000000000000001',
  goalId: goal.id,
  parentId: null,
  order: 'a0',
  title: 'Literature review',
  status: 'open',
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  deleted: false,
};

describe('goalSchema', () => {
  it('accepts a valid goal', () => {
    expect(goalSchema.parse(goal)).toEqual(goal);
  });

  it('accepts optional fields being absent and a server rev', () => {
    const { deadline: _deadline, ...noDeadline } = goal;
    expect(goalSchema.safeParse({ ...noDeadline, rev: 12, course: 'Advanced ML' }).success).toBe(
      true,
    );
  });

  it('rejects an unknown kind', () => {
    expect(goalSchema.safeParse({ ...goal, kind: 'hobby' }).success).toBe(false);
  });

  it('requires the deadline to be a plain ISO date', () => {
    expect(goalSchema.safeParse({ ...goal, deadline: '2027-03-31T00:00:00Z' }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, deadline: '31/03/2027' }).success).toBe(false);
  });

  it('requires ISO timestamps and a non-empty order key', () => {
    expect(goalSchema.safeParse({ ...goal, updatedAt: 'yesterday' }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, order: '' }).success).toBe(false);
  });

  it('rejects a negative or fractional rev', () => {
    expect(goalSchema.safeParse({ ...goal, rev: -1 }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, rev: 1.5 }).success).toBe(false);
  });
});

describe('stepSchema', () => {
  it('accepts a valid top-level step', () => {
    expect(stepSchema.parse(step)).toEqual(step);
  });

  it('accepts a completed child step with v2 fields', () => {
    const child: Step = {
      ...step,
      id: '01JC0000000000000000000002',
      parentId: step.id,
      status: 'done',
      completedAt: '2026-11-02T10:00:00.000+01:00',
      autoCompleted: true,
      size: 'L',
      inToday: true,
      notes: 'Ask supervisor',
    };
    expect(stepSchema.parse(child)).toEqual(child);
  });

  it('rejects an unknown status or size', () => {
    expect(stepSchema.safeParse({ ...step, status: 'doing' }).success).toBe(false);
    expect(stepSchema.safeParse({ ...step, size: 'XL' }).success).toBe(false);
  });

  it('requires parentId to be present (null for top level)', () => {
    const { parentId: _parentId, ...rest } = step;
    expect(stepSchema.safeParse(rest).success).toBe(false);
  });
});
