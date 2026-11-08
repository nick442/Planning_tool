import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

export interface Countdown {
  /** Calendar days until the deadline; negative once it has passed. */
  days: number;
  /** "12 days left", "Due today", "2 days ago". */
  long: string;
  /** "12d", "today", "-2d", for the sidebar. */
  short: string;
  /** "Fri 20 Nov". */
  date: string;
}

/**
 * Countdown text for a goal deadline (an ISO date). Deadlines are shown, not
 * planned around, so passed deadlines get neutral wording, not a warning.
 */
export function countdown(deadline: string, today: Date): Countdown {
  const due = parseISO(deadline);
  const days = differenceInCalendarDays(due, today);
  const date = format(due, 'EEE d MMM');
  if (days === 0) return { days, long: 'Due today', short: 'today', date };
  if (days === 1) return { days, long: 'Due tomorrow', short: '1d', date };
  if (days > 1) return { days, long: `${days} days left`, short: `${days}d`, date };
  const ago = -days;
  return { days, long: ago === 1 ? 'Yesterday' : `${ago} days ago`, short: `-${ago}d`, date };
}

/** The current date, refreshed every minute so countdowns roll over at midnight. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setToday((prev) => (prev.toDateString() === now.toDateString() ? prev : now));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
