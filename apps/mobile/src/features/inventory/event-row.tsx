import { formatCount, formatCountDelta, formatRelativeTime } from '@kibblr/core';
import type { Container, EventMethod, StockEvent } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

const METHOD_LABELS: Record<EventMethod, string> = {
  scan: 'Scan',
  manual: 'Manual',
  feeding: 'Feeding',
  auto: 'Auto',
};

type Props = {
  event: StockEvent;
  container: Container;
  /** Shown in History, where events from many products are mixed. */
  productName?: string;
};

/** One ledger entry: delta, method, note and when (spec section 6.9). */
export function EventRow({ event, container, productName }: Props) {
  const { colors, spacing, typography } = useTheme();
  const delta = formatCountDelta(event.delta, container);
  const change = event.type === 'adjust' ? `Set to ${formatCount(event.onHandAfter, container)}` : delta;
  const detail = [METHOD_LABELS[event.method], event.type === 'adjust' ? delta : null, event.note]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      accessible
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        {productName ? (
          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {productName}
          </Text>
        ) : null}
        <Text style={[typography.body, { color: event.delta < 0 ? colors.statusLow : colors.statusOk }]}>{change}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{formatRelativeTime(event.createdAt)}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatCount(event.onHandAfter, container)} left
        </Text>
      </View>
    </View>
  );
}
