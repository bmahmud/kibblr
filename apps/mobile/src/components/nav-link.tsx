import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  href: Href;
  label: string;
};

/** Full-width tappable link that meets the minimum touch target. */
export function NavLink({ href, label }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
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
    </Link>
  );
}
