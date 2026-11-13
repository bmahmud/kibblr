import type { Pet } from '@kibblr/core';
import { View } from 'react-native';

import { PetPhoto } from '@/features/pets/pet-photo';
import { useTheme } from '@/theme';

const SIZE = 28;

/** Small overlapping photos (or initials) for the pets that eat a product (spec section 6.2). */
export function PetAvatars({ pets }: { pets: readonly (Pick<Pet, 'name' | 'species' | 'photo'> & { id: string })[] }) {
  const { colors, radius } = useTheme();
  if (pets.length === 0) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel={`Eaten by ${pets.map((pet) => pet.name).join(', ')}`}
      style={{ flexDirection: 'row' }}>
      {pets.map((pet, index) => (
        <View
          key={pet.id}
          style={{
            marginLeft: index === 0 ? 0 : -8,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: colors.surface,
          }}>
          <PetPhoto pet={pet} size={SIZE} />
        </View>
      ))}
    </View>
  );
}
