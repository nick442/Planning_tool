import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

/** Distance to the right at which letting go completes the step. */
export const SWIPE_COMMIT_PX = 80;
/** Movement below this is still a tap. */
const SLOP_PX = 10;

export type GestureIntent = 'undecided' | 'swipe' | 'scroll';

/**
 * Decides early what a touch gesture is: a clear rightward horizontal move
 * is a swipe; anything else (mostly vertical, or leftward) is left to the
 * browser, which scrolls.
 */
export function classifyGesture(dx: number, dy: number): GestureIntent {
  if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return 'undecided';
  return dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5 ? 'swipe' : 'scroll';
}

/** How far the row follows the finger: 1:1 up to the commit point, then with resistance. */
export function swipeOffset(dx: number): number {
  if (dx <= 0) return 0;
  if (dx <= SWIPE_COMMIT_PX) return dx;
  return SWIPE_COMMIT_PX + (dx - SWIPE_COMMIT_PX) * 0.35;
}

interface SwipeState {
  offset: number;
  armed: boolean;
}

/**
 * Swipe right to complete, for touch and pen only. The row needs
 * `touch-action: pan-y` so vertical scrolling stays with the browser.
 */
export function useSwipeToComplete(onCommit: () => void, enabled: boolean) {
  const [state, setState] = useState<SwipeState>({ offset: 0, armed: false });
  const gesture = useRef<{ x: number; y: number; intent: GestureIntent } | null>(null);
  const suppressClick = useRef(false);

  const reset = useCallback(() => {
    gesture.current = null;
    setState({ offset: 0, armed: false });
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType === 'mouse' || !e.isPrimary) return;
    gesture.current = { x: e.clientX, y: e.clientY, intent: 'undecided' };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.intent === 'undecided') {
      g.intent = classifyGesture(dx, dy);
      if (g.intent === 'scroll') {
        gesture.current = null;
        return;
      }
      if (g.intent === 'swipe') e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (g.intent !== 'swipe') return;
    const armed = dx >= SWIPE_COMMIT_PX;
    setState((prev) => {
      if (armed && !prev.armed) navigator.vibrate?.(10);
      return { offset: swipeOffset(dx), armed };
    });
  };

  const onPointerUp = () => {
    const g = gesture.current;
    if (g?.intent === 'swipe') {
      suppressClick.current = true;
      if (state.armed) onCommit();
    }
    reset();
  };

  // A swipe ends with a click on whatever is under the finger; swallow it.
  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    offset: state.offset,
    armed: state.armed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onClickCapture,
    },
  };
}
