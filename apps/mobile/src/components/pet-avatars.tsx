import { petInitials } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

const SIZE = 28;

/** Small overlapping initials for the pets that eat a product (spec section 6.2). */
export function PetAvatars({ names }: { names: readonly string[] }) {
  const { colors, radius, typography } = useTheme();
  if (names.length === 0) {
    return null;
  }

  return (
    <View accessible accessibilityLabel={`Eaten by ${names.join(', ')}`} style={{ flexDirection: 'row' }}>
      {names.map((name, index) => (
        <View
          key={`${name}-${index}`}
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: index === 0 ? 0 : -8,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: colors.surface,
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>{petInitials(name)}</Text>
        </View>
      ))}
    </View>
  );
}
