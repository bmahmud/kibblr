import { describe, expect, it } from 'vitest';

import { activePets, newPetDraft, petInitials, validatePetForm } from './pets';
import { petSchema } from './schemas';

describe('validatePetForm', () => {
  it('trims the name and keeps the species', () => {
    expect(validatePetForm({ name: '  Miso ', species: 'cat' })).toEqual({
      ok: true,
      fields: { name: 'Miso', species: 'cat' },
    });
  });

  it('requires a name of at most 40 characters', () => {
    expect(validatePetForm({ name: '  ', species: 'dog' })).toEqual({
      ok: false,
      errors: { name: 'Enter a name.' },
    });
    expect(validatePetForm({ name: 'x'.repeat(41), species: 'dog' })).toEqual({
      ok: false,
      errors: { name: 'Keep the name under 40 characters.' },
    });
  });
});

describe('newPetDraft', () => {
  it('is a valid pet once it has a timestamp', () => {
    const draft = newPetDraft({ name: 'Miso', species: 'cat' });
    expect(draft).toEqual({ name: 'Miso', species: 'cat', archived: false });
    expect(petSchema.safeParse({ ...draft, createdAt: new Date() }).success).toBe(true);
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
