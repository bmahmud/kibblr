import { CONTAINER_LABELS, formatCount, formatSize } from '@kibblr/core';
import type { Product, StockStatus, WeightUnit, WithId } from '@kibblr/core';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { StatusBadge } from '@/components/status-badge';
import { useTheme } from '@/theme';

type Props = {
  product: WithId<Product>;
  status: StockStatus;
  unit: WeightUnit;
  /** One package either way (the swipe step). `unit` is only for the size line. */
  onAdd: () => void;
  onUse: () => void;
};

/**
 * Swipe right to reveal + (add a package), left to reveal − (use a package),
 * then tap the action (spec section 6.2). The same two actions are offered
 * to screen readers as accessibility actions.
 */
export function InventoryRow({ product, status, unit, onAdd, onUse }: Props) {
  const { colors, spacing, typography, touchTarget } = useTheme();
  const onHand = formatCount(product.onHand, product.container);
  const one = CONTAINER_LABELS[product.container].one;
  const subtitle = [product.brand, product.size ? `${formatSize(product.size, unit)} ${one}` : null]
    .filter(Boolean)
    .join(' · ');

  function action(label: string, color: string, onPress: () => void, methods: SwipeableMethods) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 1 ${one}`}
        onPress={() => {
          methods.close();
          onPress();
        }}
        style={({ pressed }) => ({
          width: 96,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: color,
          opacity: pressed ? 0.8 : 1,
        })}>
        <Text style={[typography.title, { color: colors.onPrimary }]}>{label === 'Add' ? '+1' : '−1'}</Text>
        <Text style={[typography.caption, { color: colors.onPrimary }]} numberOfLines={1}>
          {one}
        </Text>
      </Pressable>
    );
  }

  return (
    <Swipeable
      friction={2}
      leftThreshold={48}
      rightThreshold={48}
      renderLeftActions={(_progress, _translation, methods) => action('Add', colors.statusOk, onAdd, methods)}
      renderRightActions={(_progress, _translation, methods) =>
        action('Use', product.onHand === 0 ? colors.textMuted : colors.statusLow, onUse, methods)
      }>
      <Link href={{ pathname: '/product/[id]', params: { id: product.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${product.name}${subtitle ? `, ${subtitle}` : ''}, ${onHand} on hand, ${status}`}
          accessibilityHint="Opens the product. Swipe for quick add or use."
          accessibilityActions={[
            { name: 'increment', label: `Add 1 ${one}` },
            { name: 'decrement', label: `Use 1 ${one}` },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') {
              onAdd();
            } else if (event.nativeEvent.actionName === 'decrement') {
              onUse();
            }
          }}
          style={({ pressed }) => ({
            minHeight: touchTarget + spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          })}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
              {product.name}
            </Text>
            {subtitle ? (
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{onHand}</Text>
            <StatusBadge status={status} />
          </View>
        </Pressable>
      </Link>
    </Swipeable>
  );
}
