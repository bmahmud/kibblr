import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** Actions on the right of the title, like Scan or + Add. */
  children?: ReactNode;
};

/** The top of every tab: the Kibblr mark, then the screen's title and its actions. */
export function TabHeader({ title, children }: Props) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        accessible
        accessibilityLabel="Kibblr"
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={[typography.caption, { color: colors.onPrimary }]}>🐾</Text>
        </View>
        <Text style={[typography.bodyStrong, { color: colors.primary, letterSpacing: 0.5 }]}>Kibblr</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.display, { color: colors.text, flex: 1 }]}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}
