import { REACTION_LABELS } from '@kibblr/core';
import type { Reaction } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { REACTION_ICONS } from './reactions';

/** A pet's reaction as a pill: green for Loved, red for Refused, muted for OK or not rated. */
export function ReactionBadge({ reaction }: { reaction: Reaction | null }) {
  const { colors, radius, spacing, typography } = useTheme();
  const color = reaction === 'loved' ? colors.statusOk : reaction === 'refused' ? colors.statusOut : colors.textMuted;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
      }}>
      {reaction ? <Text style={typography.caption}>{REACTION_ICONS[reaction]}</Text> : null}
      <Text style={[typography.caption, { color, fontWeight: '600' }]}>
        {reaction ? REACTION_LABELS[reaction] : 'Not rated yet'}
      </Text>
    </View>
  );
}
