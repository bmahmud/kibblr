import { VERDICT_LABELS } from '@kibblr/core';
import type { Verdict } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/** Reorder or Skip; nothing for Undecided, so the list stays quiet until I decide. */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { colors, radius, spacing, typography } = useTheme();
  if (verdict === 'undecided') {
    return null;
  }
  const color = verdict === 'reorder' ? colors.verdictReorder : colors.verdictSkip;

  return (
    <View
      accessibilityLabel={`Verdict ${VERDICT_LABELS[verdict]}`}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
      }}>
      <Text style={[typography.caption, { color, fontWeight: '600' }]}>
        {verdict === 'reorder' ? '↻ ' : '✕ '}
        {VERDICT_LABELS[verdict]}
      </Text>
    </View>
  );
}
