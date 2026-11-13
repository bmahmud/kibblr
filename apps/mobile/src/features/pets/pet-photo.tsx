import { petInitials } from '@kibblr/core';
import type { Pet } from '@kibblr/core';
import { Image, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { SPECIES_ICONS } from './species';

type Props = {
  pet: Pick<Pet, 'name' | 'species' | 'photo'>;
  size: number;
};

/**
 * A pet's photo in a circle; without one, the species emoji (or initials when
 * too small for an emoji to read). Decorative: the name is always next to it.
 */
export function PetPhoto({ pet, size }: Props) {
  const { colors, radius, typography } = useTheme();
  const small = size < 40;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceRaised,
      }}>
      {pet.photo ? (
        <Image source={{ uri: pet.photo }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : small ? (
        <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>{petInitials(pet.name)}</Text>
      ) : (
        <Text style={size >= 80 ? typography.display : typography.title}>{SPECIES_ICONS[pet.species]}</Text>
      )}
    </View>
  );
}
