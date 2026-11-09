import { describe, expect, it } from 'vitest';
import { classifyGesture, SWIPE_COMMIT_PX, swipeOffset } from './swipe';

describe('classifyGesture', () => {
  it('waits until the finger has moved a little', () => {
    expect(classifyGesture(4, 3)).toBe('undecided');
  });

  it('treats a clear rightward move as a swipe', () => {
    expect(classifyGesture(30, 5)).toBe('swipe');
  });

  it('leaves vertical, diagonal and leftward moves to scrolling', () => {
    expect(classifyGesture(3, 30)).toBe('scroll');
    expect(classifyGesture(20, 18)).toBe('scroll');
    expect(classifyGesture(-30, 0)).toBe('scroll');
  });
});

describe('swipeOffset', () => {
  it('follows the finger up to the commit point, then resists', () => {
    expect(swipeOffset(-20)).toBe(0);
    expect(swipeOffset(40)).toBe(40);
    expect(swipeOffset(SWIPE_COMMIT_PX)).toBe(SWIPE_COMMIT_PX);
    const beyond = swipeOffset(SWIPE_COMMIT_PX + 100);
    expect(beyond).toBeGreaterThan(SWIPE_COMMIT_PX);
    expect(beyond).toBeLessThan(SWIPE_COMMIT_PX + 50);
  });
});
