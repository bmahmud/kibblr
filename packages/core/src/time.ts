const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a short date. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) {
    return 'just now';
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / (24 * HOUR));
  if (days === 0) {
    return elapsed < HOUR ? `${Math.floor(elapsed / MINUTE)} min ago` : `${Math.floor(elapsed / HOUR)} h ago`;
  }
  if (days === 1) {
    return 'yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
