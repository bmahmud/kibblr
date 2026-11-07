import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  imageUrl: string | null | undefined;
  /** The category emoji, shown when there is no photo or it won't load. */
  icon: string;
  size: number;
};

/** A product's photo in a rounded tile. Decorative: the name next to it says what it is. */
export function ProductImage({ imageUrl, icon, size }: Props) {
  const { colors, radius, typography } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = imageUrl && imageUrl !== failedUrl ? imageUrl : null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 64 ? radius.lg : radius.md,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceRaised,
      }}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailedUrl(photo)}
        />
      ) : (
        <Text style={size >= 64 ? typography.display : typography.title}>{icon}</Text>
      )}
    </View>
  );
}
