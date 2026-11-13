import type { Pet, Product, Species } from './schemas';

export const PET_NAME_MAX = 40;

export const SPECIES_LABELS: Record<Species, string> = {
  cat: 'Cat',
  dog: 'Dog',
  other: 'Other',
};

/** The pet fields the Add / Edit pet form edits. */
export type PetFields = Pick<Pet, 'name' | 'species' | 'photo'>;

export type PetFormResult = { ok: true; fields: PetFields } | { ok: false; errors: { name?: string } };

export function validatePetForm(input: PetFields): PetFormResult {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, errors: { name: 'Enter a name.' } };
  }
  if (name.length > PET_NAME_MAX) {
    return { ok: false, errors: { name: `Keep the name under ${PET_NAME_MAX} characters.` } };
  }
  return { ok: true, fields: { name, species: input.species, photo: input.photo } };
}

/** A new pet; `createdAt` is set on write. */
export type PetDraft = Omit<Pet, 'createdAt'>;

export function newPetDraft(fields: PetFields): PetDraft {
  return { ...fields, archived: false };
}

/** Pets that can be picked or asked about: not archived, by name (spec section 6.7: archive, never delete). */
export function activePets<T extends Pick<Pet, 'name' | 'archived'>>(pets: readonly T[]): T[] {
  return pets
    .filter((pet) => !pet.archived)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * A pet's foods (spec section 6.7): the products it eats and the ones it has
 * rated, by name. A rated product isn't always eaten ("refused"), but its
 * rating still belongs on the pet's page.
 */
export function petFoods<T extends Pick<Product, 'name' | 'petIds' | 'ratedBy'>>(
  products: readonly T[],
  petId: string,
): T[] {
  return products
    .filter((p) => p.petIds.includes(petId) || p.ratedBy.includes(petId))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** One or two letters for a pet's avatar: "Miso" → "M", "mr whiskers" → "MW". */
export function petInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
