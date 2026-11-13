import { describe, expect, it } from 'vitest';

import { activePets, newPetDraft, petFoods, petInitials, validatePetForm } from './pets';
import { PET_PHOTO_MAX, petSchema } from './schemas';

describe('validatePetForm', () => {
  it('trims the name and keeps the species', () => {
    expect(validatePetForm({ name: '  Miso ', species: 'cat', photo: null })).toEqual({
      ok: true,
      fields: { name: 'Miso', species: 'cat', photo: null },
    });
  });

  it('requires a name of at most 40 characters', () => {
    expect(validatePetForm({ name: '  ', species: 'dog', photo: null })).toEqual({
      ok: false,
      errors: { name: 'Enter a name.' },
    });
    expect(validatePetForm({ name: 'x'.repeat(41), species: 'dog', photo: null })).toEqual({
      ok: false,
      errors: { name: 'Keep the name under 40 characters.' },
    });
  });

  it('keeps the photo', () => {
    const photo = 'data:image/jpeg;base64,AAAA';
    expect(validatePetForm({ name: 'Miso', species: 'cat', photo })).toEqual({
      ok: true,
      fields: { name: 'Miso', species: 'cat', photo },
    });
  });
});

describe('newPetDraft', () => {
  it('is a valid pet once it has a timestamp', () => {
    const draft = newPetDraft({ name: 'Miso', species: 'cat', photo: null });
    expect(draft).toEqual({ name: 'Miso', species: 'cat', photo: null, archived: false });
    expect(petSchema.safeParse({ ...draft, createdAt: new Date() }).success).toBe(true);
  });
});

describe('petSchema photo', () => {
  const pet = { name: 'Miso', species: 'cat', archived: false, createdAt: new Date() };

  it('defaults to no photo for pets saved before photos existed', () => {
    expect(petSchema.parse(pet).photo).toBeNull();
  });

  it('accepts a small JPEG data URI only', () => {
    expect(petSchema.safeParse({ ...pet, photo: 'data:image/jpeg;base64,AAAA' }).success).toBe(true);
    expect(petSchema.safeParse({ ...pet, photo: 'https://example.com/miso.jpg' }).success).toBe(false);
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(PET_PHOTO_MAX);
    expect(petSchema.safeParse({ ...pet, photo: huge }).success).toBe(false);
  });
});

describe('petFoods', () => {
  const product = (id: string, name: string, petIds: string[], ratedBy: string[]) => ({ id, name, petIds, ratedBy });

  it('lists products the pet eats or has rated, by name', () => {
    const products = [
      product('1', 'Turkey', ['miso'], []),
      product('2', 'cod feast', [], ['miso', 'pickle']),
      product('3', 'Beef', ['pickle'], ['pickle']),
      product('4', 'Anchovy', ['miso'], ['miso']),
    ];
    expect(petFoods(products, 'miso').map((p) => p.id)).toEqual(['4', '2', '1']);
  });
});

describe('activePets', () => {
  it('drops archived pets and sorts by name, ignoring case', () => {
    const pets = [
      { id: '1', name: 'pickle', archived: false },
      { id: '2', name: 'Biscuit', archived: true },
      { id: '3', name: 'Miso', archived: false },
    ];
    expect(activePets(pets).map((p) => p.id)).toEqual(['3', '1']);
  });
});

describe('petInitials', () => {
  it.each([
    ['Miso', 'M'],
    ['mr whiskers', 'MW'],
    ['Sir Fluffy Pants', 'SF'],
    ['  Émile ', 'É'],
  ])('%s → %s', (name, initials) => {
    expect(petInitials(name)).toBe(initials);
  });
});
