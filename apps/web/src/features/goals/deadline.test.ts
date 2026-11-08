import { describe, expect, it } from 'vitest';
import { countdown } from './deadline';

const today = new Date(2026, 10, 8, 15, 30); // Sun 8 Nov 2026, afternoon

describe('countdown', () => {
  it.each([
    ['2026-11-20', 12, '12 days left', '12d'],
    ['2026-11-10', 2, '2 days left', '2d'],
    ['2026-11-09', 1, 'Due tomorrow', '1d'],
    ['2026-11-08', 0, 'Due today', 'today'],
    ['2026-11-07', -1, 'Yesterday', '-1d'],
    ['2026-11-01', -7, '7 days ago', '-7d'],
  ])('%s → %s days', (deadline, days, long, short) => {
    expect(countdown(deadline, today)).toMatchObject({ days, long, short });
  });

  it('counts calendar days, not 24h periods', () => {
    const lateEvening = new Date(2026, 10, 8, 23, 59);
    expect(countdown('2026-11-09', lateEvening).days).toBe(1);
  });

  it('formats the date', () => {
    expect(countdown('2026-11-20', today).date).toBe('Fri 20 Nov');
  });
});
