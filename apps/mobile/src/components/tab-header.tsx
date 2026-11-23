import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { OfflineBanner } from './offline-banner';

type Props = {
  title: string;
  /** Actions on the right of the title, like Scan or + Add. */
  children?: ReactNode;
};

/**
 * The top of every tab: the Kibblr name as the main heading, then the
 * screen's name with its actions, then the offline banner.
 */
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
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {/* A symbol, not the 🐾 emoji: the emoji has its own dark color and vanished on dark brand colors. */}
          <SymbolView name={{ ios: 'pawprint.fill', android: 'pets', web: 'pets' }} tintColor={colors.onPrimary} size={24} />
        </View>
        <Text style={[typography.display, { color: colors.primary }]}>Kibblr</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.textMuted, flex: 1 }]}>
          {title}
        </Text>
        {children}
      </View>
      <OfflineBanner />
    </View>
  );
}
