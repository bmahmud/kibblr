import { formatCount, formatSize, stockTotals } from '@kibblr/core';
import type { StockTotalsProduct, WeightUnit } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  /** The products the list shows, so the totals follow search and filters. */
  products: readonly StockTotalsProduct[];
  unit: WeightUnit;
  filtered: boolean;
};

/** Everything on hand at a glance, at the top of Inventory: "18 cans · 2 bags", about 25 lb. */
export function StockSummary({ products, unit, filtered }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const totals = stockTotals(products);
  const counts = totals.containers.map((c) => formatCount(c.count, c.container)).join(' · ');
  const amounts = [totals.weight, totals.volume].filter((size) => size !== null).map((size) => formatSize(size, unit));
  const amount =
    amounts.length > 0 ? `${totals.unsized > 0 ? 'At least' : 'About'} ${amounts.join(' and ')} in all` : null;
  const label = filtered ? 'In stock · matching filters' : 'In stock';

  return (
    <View
      accessible
      accessibilityLabel={[label, counts || 'Nothing', amount].filter(Boolean).join('. ')}
      style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.title, { color: colors.text }]}>{counts || 'Nothing in stock'}</Text>
      {amount ? <Text style={[typography.caption, { color: colors.textMuted }]}>{amount}</Text> : null}
    </View>
  );
}
