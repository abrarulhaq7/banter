import type { ContextId } from '@/lib/database.types';

export const CONTEXT_LABELS: Record<ContextId, string> = {
  stranger: 'Stranger',
  mutual_follow: 'Mutual follow',
  know_her: 'Know her',
  already_talking: 'Already talking',
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 minutes ago", "3 days ago", or the date for anything over a month old. */
export function timeAgo(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  const gap = now.getTime() - then.getTime();
  if (Number.isNaN(gap)) return null;

  const count = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'} ago`;
  if (gap < MINUTE) return 'just now';
  if (gap < HOUR) return count(Math.floor(gap / MINUTE), 'minute');
  if (gap < DAY) return count(Math.floor(gap / HOUR), 'hour');
  if (gap < 30 * DAY) return count(Math.floor(gap / DAY), 'day');
  return then.toISOString().slice(0, 10);
}
