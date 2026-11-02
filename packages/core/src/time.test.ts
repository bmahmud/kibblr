import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './time';

const now = new Date('2026-11-01T15:00:00');

describe('formatRelativeTime', () => {
  it('says "just now" under a minute, including small clock skew into the future', () => {
    expect(formatRelativeTime(new Date('2026-11-01T14:59:30'), now)).toBe('just now');
    expect(formatRelativeTime(new Date('2026-11-01T15:00:05'), now)).toBe('just now');
  });

  it('counts minutes, then hours, on the same day', () => {
    expect(formatRelativeTime(new Date('2026-11-01T14:55:00'), now)).toBe('5 min ago');
    expect(formatRelativeTime(new Date('2026-11-01T12:00:00'), now)).toBe('3 h ago');
  });

  it('says "yesterday" for the previous calendar day', () => {
    expect(formatRelativeTime(new Date('2026-10-31T09:00:00'), now)).toBe('yesterday');
  });

  it('counts days within a week', () => {
    expect(formatRelativeTime(new Date('2026-10-28T09:00:00'), now)).toBe('4 days ago');
  });

  it('falls back to a short date after a week', () => {
    const text = formatRelativeTime(new Date('2026-10-02T09:00:00'), now);
    expect(text).not.toMatch(/ago|yesterday/);
    expect(text).toMatch(/2/);
  });
});
