import { describe, expect, it, vi } from 'vitest';

import { latestRatingByPet, promptPets, ratingPromptReason, validateNote } from './ratings';
import type { StockChange } from './stock';

function change(before: number, after: number): StockChange {
  const applied = after - before;
  return {
    before,
    after,
    applied,
    clamped: false,
    type: applied === 0 ? null : applied > 0 ? 'add' : 'remove',
  };
}

describe('ratingPromptReason', () => {
  it('asks when a product runs out, without checking for earlier use', async () => {
    const hadEarlierUse = vi.fn(async () => true);
    expect(await ratingPromptReason(change(1, 0), 'manual', hadEarlierUse)).toBe('ranOut');
    expect(hadEarlierUse).not.toHaveBeenCalled();
  });

  it('asks on the first use ever', async () => {
    expect(await ratingPromptReason(change(12, 11), 'scan', async () => false)).toBe('firstUse');
  });

  it('stays quiet on later uses', async () => {
    expect(await ratingPromptReason(change(12, 11), 'scan', async () => true)).toBeNull();
  });

  it('never asks for adds, counts, no-ops or auto-deduct', async () => {
    const hadEarlierUse = vi.fn(async () => false);
    expect(await ratingPromptReason(change(0, 2), 'manual', hadEarlierUse)).toBeNull();
    expect(await ratingPromptReason({ ...change(3, 0), type: 'adjust' }, 'manual', hadEarlierUse)).toBeNull();
    expect(await ratingPromptReason(change(0, 0), 'manual', hadEarlierUse)).toBeNull();
    expect(await ratingPromptReason(change(1, 0), 'auto', hadEarlierUse)).toBeNull();
    expect(hadEarlierUse).not.toHaveBeenCalled();
  });

  it('stays quiet when the check fails', async () => {
    expect(
      await ratingPromptReason(change(3, 2), 'manual', async () => {
        throw new Error('offline');
      }),
    ).toBeNull();
  });
});

describe('promptPets', () => {
  const pets = [
    { id: 'a', name: 'Miso', archived: false },
    { id: 'b', name: 'Biscuit', archived: false },
    { id: 'c', name: 'Old', archived: true },
  ];

  it('asks about the pets that eat it, sorted, skipping archived ones', () => {
    expect(promptPets(['c', 'a'], pets).map((p) => p.id)).toEqual(['a']);
  });

  it('asks about every active pet when none are set', () => {
    expect(promptPets([], pets).map((p) => p.id)).toEqual(['b', 'a']);
    expect(promptPets(['c'], pets).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('latestRatingByPet', () => {
  it('keeps the newest rating per pet', () => {
    const ratings = [
      { id: '1', petId: 'a', reaction: 'ok' as const, createdAt: new Date('2026-01-01') },
      { id: '2', petId: 'a', reaction: 'loved' as const, createdAt: new Date('2026-02-01') },
      { id: '3', petId: 'b', reaction: 'refused' as const, createdAt: new Date('2026-01-15') },
    ];
    const latest = latestRatingByPet(ratings);
    expect(latest.get('a')?.id).toBe('2');
    expect(latest.get('b')?.id).toBe('3');
    expect(latest.size).toBe(2);
  });
});

describe('validateNote', () => {
  it('trims, and turns empty into null', () => {
    expect(validateNote('  picky about gravy ')).toEqual({ ok: true, value: 'picky about gravy' });
    expect(validateNote('   ')).toEqual({ ok: true, value: null });
  });

  it('keeps it within 500 characters', () => {
    expect(validateNote('x'.repeat(501))).toEqual({ ok: false, error: 'Keep it under 500 characters.' });
  });
});
