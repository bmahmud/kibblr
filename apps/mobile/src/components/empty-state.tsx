import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** Explains the next step (spec section 6.10). */
  body: string;
  children?: ReactNode;
};

export function EmptyState({ title, body, children }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <Text style={[typography.title, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>{body}</Text>
      {children ? <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>{children}</View> : null}
    </View>
  );
}
