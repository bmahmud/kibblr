import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  /** The packshot from the barcode lookup. */
  imageUrl: string | null | undefined;
  /** My own photo (a JPEG data URI); wins over `imageUrl`. */
  photo?: string | null;
  /** The category emoji, shown when there is no image or it won't load. */
  icon: string;
  size: number;
};

/**
 * A product's picture in a rounded tile. Decorative: the name next to it says what it is.
 *
 * My own photo fills the tile. A lookup packshot is shown whole on a white
 * tile: they are shot on white in every shape, and cropping cuts off the label.
 */
export function ProductImage({ imageUrl, photo, icon, size }: Props) {
  const { colors, radius, typography } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const packshot = !photo && imageUrl && imageUrl !== failedUrl ? imageUrl : null;
  const inset = Math.round(size * 0.08);

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
        backgroundColor: packshot ? colors.imageTile : colors.surfaceRaised,
      }}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} contentFit="cover" />
      ) : packshot ? (
        <Image
          source={{ uri: packshot }}
          style={{ width: size - inset * 2, height: size - inset * 2 }}
          contentFit="contain"
          transition={150}
          onError={() => setFailedUrl(packshot)}
        />
      ) : (
        <Text style={size >= 64 ? typography.display : typography.title}>{icon}</Text>
      )}
    </View>
  );
}
