import { describe, expect, it } from 'vitest';

import { DEFAULT_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_SETTINGS, newHousehold } from './household';
import { householdSchema } from './schemas';

describe('DEFAULT_HOUSEHOLD_SETTINGS', () => {
  it('matches the spec defaults, with lb as the weight unit', () => {
    expect(DEFAULT_HOUSEHOLD_SETTINGS).toEqual({
      defaultLowStockDays: 7,
      notifyHour: 9,
      preferredWeightUnit: 'lb',
    });
  });
});

describe('newHousehold', () => {
  it('makes the creating user the only member, with default settings', () => {
    expect(newHousehold('uid-1')).toEqual({
      name: DEFAULT_HOUSEHOLD_NAME,
      memberUids: ['uid-1'],
      settings: DEFAULT_HOUSEHOLD_SETTINGS,
    });
  });

  it('accepts a custom name, trimmed', () => {
    expect(newHousehold('uid-1', '  The Den  ').name).toBe('The Den');
  });

  it('falls back to the default name when the custom name is blank', () => {
    expect(newHousehold('uid-1', '   ').name).toBe(DEFAULT_HOUSEHOLD_NAME);
  });

  it('produces a document that passes the schema once createdAt is added', () => {
    expect(householdSchema.safeParse({ ...newHousehold('uid-1'), createdAt: new Date() }).success).toBe(true);
  });

  it('does not share the settings object between households', () => {
    const a = newHousehold('a');
    const b = newHousehold('b');
    expect(a.settings).not.toBe(b.settings);
    expect(a.settings).not.toBe(DEFAULT_HOUSEHOLD_SETTINGS);
  });

  it('rejects an empty uid', () => {
    expect(() => newHousehold('')).toThrow();
  });
});
