import type { StockStatus } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

const LABELS: Record<StockStatus, string> = { out: 'Out', low: 'Low', ok: 'OK' };

export function StatusBadge({ status }: { status: StockStatus }) {
  const { colors, radius, spacing, typography } = useTheme();
  const color = status === 'out' ? colors.statusOut : status === 'low' ? colors.statusLow : colors.statusOk;

  return (
    <View
      accessibilityLabel={`Stock ${LABELS[status]}`}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: color,
      }}>
      <Text style={[typography.caption, { color, fontWeight: '600' }]}>{LABELS[status]}</Text>
    </View>
  );
}
