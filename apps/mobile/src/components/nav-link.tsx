import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  href: Href;
  label: string;
};

/**
 * Full-width tappable link that meets the minimum touch target. A plain
 * Pressable rather than `<Link asChild>`: Link's slot drops a style function,
 * which loses the background and padding.
 */
export function NavLink({ href, label }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        minHeight: touchTarget,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}>
      <Text style={[typography.bodyStrong, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}
