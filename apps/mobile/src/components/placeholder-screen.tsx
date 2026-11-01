import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** Which build phase fills this screen in (spec section 14). */
  phase: number;
  children?: ReactNode;
};

/** Temporary stand-in for screens not built yet. Remove once every route is real. */
export function PlaceholderScreen({ title, phase, children }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { padding: spacing.xl, gap: spacing.lg }]}>
      <Text style={[typography.title, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>Coming in Phase {phase}.</Text>
      {children ? <View style={{ gap: spacing.md }}>{children}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
