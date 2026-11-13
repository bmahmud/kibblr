import { CONTAINER_LABELS, formatCount, formatSize, roundCount } from '@kibblr/core';
import type { Product, StockStatus, WeightUnit, WithId } from '@kibblr/core';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PetAvatars } from '@/components/pet-avatars';
import { ProductImage } from '@/components/product-image';
import { StatusBadge } from '@/components/status-badge';
import { VerdictBadge } from '@/components/verdict-badge';
import { useTheme } from '@/theme';

import { CATEGORY_DISPLAY } from './category';

type Props = {
  product: WithId<Product>;
  status: StockStatus;
  /** Only for the size line. */
  unit: WeightUnit;
  /** The pets that eat it, for the avatars. */
  pets: ComponentProps<typeof PetAvatars>['pets'];
  /** One package either way (the swipe step). */
  onAdd: () => void;
  onUse: () => void;
};

const ACTION_WIDTH = 88;

/**
 * A product card. Swipe right to reveal +1, left to reveal −1, then tap the
 * action (spec section 6.2). The same two actions are offered to screen
 * readers as accessibility actions.
 *
 * The card is a plain Pressable, not `<Link asChild>`: Link's slot drops a
 * style function, which loses the card's background and layout.
 */
export function InventoryRow({ product, status, unit, pets, onAdd, onUse }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const label = CONTAINER_LABELS[product.container];
  const count = roundCount(product.onHand);
  const onHand = formatCount(product.onHand, product.container);
  const category = CATEGORY_DISPLAY[product.category];
  const subtitle = [product.brand, product.size ? `${formatSize(product.size, unit)} ${label.one}` : null]
    .filter(Boolean)
    .join(' · ');

  function action(kind: 'add' | 'use', methods: SwipeableMethods) {
    const add = kind === 'add';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${add ? 'Add' : 'Use'} 1 ${label.one}`}
        onPress={() => {
          methods.close();
          (add ? onAdd : onUse)();
        }}
        style={({ pressed }) => ({
          width: ACTION_WIDTH,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          backgroundColor: add ? colors.statusOk : colors.primary,
          opacity: pressed ? 0.85 : product.onHand === 0 && !add ? 0.5 : 1,
        })}>
        <Text style={[typography.title, { color: colors.onPrimary }]}>{add ? '+1' : '−1'}</Text>
        <Text style={[typography.caption, { color: colors.onPrimary, fontWeight: '600' }]}>{label.one}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}>
      <Swipeable
        friction={2}
        leftThreshold={48}
        rightThreshold={48}
        renderLeftActions={(_progress, _translation, methods) => action('add', methods)}
        renderRightActions={(_progress, _translation, methods) => action('use', methods)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${product.name}${subtitle ? `, ${subtitle}` : ''}, ${onHand} on hand, ${status}`}
          accessibilityHint="Opens the product. Swipe for quick add or use."
          accessibilityActions={[
            { name: 'increment', label: `Add 1 ${label.one}` },
            { name: 'decrement', label: `Use 1 ${label.one}` },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') {
              onAdd();
            } else if (event.nativeEvent.actionName === 'decrement') {
              onUse();
            }
          }}
          onPress={() =>
            router.push({
              pathname: '/product/[id]',
              params: { id: product.id },
            })
          }
          style={({ pressed }) => ({
            minHeight: touchTarget + spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}>
          <ProductImage imageUrl={product.imageUrl} photo={product.photo} icon={category.icon} size={44} />

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
              {product.name}
            </Text>
            {subtitle ? (
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {status === 'ok' && product.verdict === 'undecided' && pets.length === 0 ? null : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                {status === 'ok' ? null : <StatusBadge status={status} />}
                <VerdictBadge verdict={product.verdict} />
                <PetAvatars pets={pets} />
              </View>
            )}
          </View>

          <View style={{ alignItems: 'flex-end', minWidth: 48 }}>
            <Text
              style={[
                typography.title,
                {
                  color: status === 'out' ? colors.statusOut : colors.text,
                  fontVariant: ['tabular-nums'],
                },
              ]}>
              {String(count)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {count === 1 ? label.one : label.many}
            </Text>
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}
