import type { Household, HouseholdSettings } from './schemas';

export const DEFAULT_HOUSEHOLD_NAME = 'Home';

/** Spec section 5.1 defaults; lb per open question 3 (answered 2026-11-01). */
export const DEFAULT_HOUSEHOLD_SETTINGS: Readonly<HouseholdSettings> = Object.freeze({
  defaultLowStockDays: 7,
  notifyHour: 9,
  preferredWeightUnit: 'lb',
});

/** Fields for a new household document. The repository adds `createdAt`. */
export type NewHousehold = Omit<Household, 'createdAt'>;

export function newHousehold(uid: string, name?: string): NewHousehold {
  if (!uid) {
    throw new Error('newHousehold: uid is required');
  }
  const trimmed = name?.trim();
  return {
    name: trimmed ? trimmed : DEFAULT_HOUSEHOLD_NAME,
    memberUids: [uid],
    settings: { ...DEFAULT_HOUSEHOLD_SETTINGS },
  };
}
