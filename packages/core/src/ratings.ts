import { activePets } from './pets';
import type { EventMethod, Pet, Rating, Reaction, Verdict } from './schemas';
import type { StockChange } from './stock';

export const REACTION_LABELS: Record<Reaction, string> = {
  loved: 'Loved',
  ok: 'OK',
  refused: 'Refused',
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  reorder: 'Reorder',
  skip: 'Skip',
  undecided: 'Undecided',
};

/** Why to ask "How did {pet} like it?" (spec section 6.5). */
export type RatingPromptReason = 'ranOut' | 'firstUse';

/**
 * Whether a stock change should prompt for a rating. Running out wins; a
 * first use is a remove when the ledger has no earlier one. `hadEarlierUse`
 * is only called when it matters, and a failed check means "don't ask".
 * Auto-deduct never asks: nobody is there to answer.
 */
export async function ratingPromptReason(
  change: Pick<StockChange, 'before' | 'after' | 'type'>,
  method: EventMethod,
  hadEarlierUse: () => Promise<boolean>,
): Promise<RatingPromptReason | null> {
  if (change.type !== 'remove' || method === 'auto') {
    return null;
  }
  if (change.after === 0 && change.before > 0) {
    return 'ranOut';
  }
  try {
    return (await hadEarlierUse()) ? null : 'firstUse';
  } catch {
    return null;
  }
}

/** The pets to ask about: those that eat it, or every active pet when none of those are active. */
export function promptPets<T extends Pick<Pet, 'name' | 'archived'> & { id: string }>(
  petIds: readonly string[],
  pets: readonly T[],
): T[] {
  const active = activePets(pets);
  const eaters = active.filter((pet) => petIds.includes(pet.id));
  return eaters.length > 0 ? eaters : active;
}

/** Each pet's newest rating, by pet id. */
export function latestRatingByPet<T extends Pick<Rating, 'petId' | 'createdAt'>>(
  ratings: readonly T[],
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const rating of ratings) {
    const current = latest.get(rating.petId);
    if (!current || rating.createdAt > current.createdAt) {
      latest.set(rating.petId, rating);
    }
  }
  return latest;
}

export const NOTE_MAX = 500;

/** A rating comment or verdict note: trimmed, at most 500 characters, empty is null. */
export function validateNote(text: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = text.trim();
  if (value.length > NOTE_MAX) {
    return { ok: false, error: `Keep it under ${NOTE_MAX} characters.` };
  }
  return { ok: true, value: value || null };
}
