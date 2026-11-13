import { CONTAINER_LABELS, formatCount, formatSize, shoppingList, shoppingListText } from '@kibblr/core';
import type { Product, ShoppingItem, WithId } from '@kibblr/core';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { StatusBadge } from '@/components/status-badge';
import { useToast } from '@/components/toast';
import { VerdictBadge } from '@/components/verdict-badge';
import { TabHeader } from '@/components/tab-header';
import { CATEGORY_DISPLAY } from '@/features/inventory/category';
import { useHouseholdSettings, useProducts } from '@/features/inventory/hooks';
import { useTheme } from '@/theme';

/**
 * What to buy (spec section 6.6): low and out products, most urgent first.
 * Ones marked skip sit in a collapsed section, so I notice I still need a replacement.
 */
export default function ShoppingScreen() {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const settings = useHouseholdSettings();
  const toast = useToast();
  const [showSkipped, setShowSkipped] = useState(false);
  const unit = settings.preferredWeightUnit;

  const { toBuy, notReordering } = shoppingList(products.status === 'ready' ? products.data : [], settings);

  function share() {
    Share.share({ message: shoppingListText(toBuy, unit) }).catch(() =>
      toast.show({ message: "Couldn't open the share sheet.", tone: 'error' }),
    );
  }

  async function act(product: WithId<Product>) {
    if (product.reorderUrl) {
      try {
        await Linking.openURL(product.reorderUrl);
      } catch {
        toast.show({ message: "Couldn't open the store link.", tone: 'error' });
      }
      return;
    }
    const name = [product.brand, product.name].filter(Boolean).join(' ');
    await Clipboard.setStringAsync(name);
    toast.show({ message: `Copied “${name}”.` });
  }

  function row({ product, status, runway }: ShoppingItem<WithId<Product>>) {
    const label = CONTAINER_LABELS[product.container];
    const left = status === 'out' ? 'None left' : `${formatCount(product.onHand, product.container)} left`;
    const detail = [
      product.brand,
      product.size ? `${formatSize(product.size, unit)} ${label.one}` : null,
      left,
      runway === null || status === 'out'
        ? null
        : `~${Math.floor(runway)} ${Math.floor(runway) === 1 ? 'day' : 'days'}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const action = product.reorderUrl ? 'Open store link' : 'Copy name';

    return (
      <View key={product.id} style={{ borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${product.name}, ${detail}`}
          accessibilityHint="Opens the product"
          onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}>
          <ProductImage imageUrl={product.imageUrl} photo={product.photo} icon={CATEGORY_DISPLAY[product.category].icon} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {detail}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <StatusBadge status={status} />
              <VerdictBadge verdict={product.verdict} />
            </View>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole={product.reorderUrl ? 'link' : 'button'}
          accessibilityLabel={`${action}: ${product.name}`}
          onPress={() => void act(product)}
          style={({ pressed }) => ({
            minHeight: touchTarget,
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}>
          <Text style={[typography.bodyStrong, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: (Platform.OS === 'android' ? insets.top : 0) + spacing.lg,
        gap: spacing.sm,
        paddingBottom: spacing.xxl * 3,
      }}>
      <TabHeader title="Shopping">
        {toBuy.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share the list"
            onPress={share}
            style={{ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.primary }]}>Share</Text>
          </Pressable>
        ) : null}
      </TabHeader>

      {products.status === 'loading' ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : null}
      {products.status === 'error' ? <EmptyState title="Couldn't load" body={products.message} /> : null}
      {products.status === 'ready' && toBuy.length === 0 ? (
        <EmptyState
          title="Nothing is running low"
          body="Products show up here when they're low or out, unless you've marked them Skip."
        />
      ) : null}

      {toBuy.map(row)}

      {notReordering.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showSkipped }}
            accessibilityHint="Low products you marked Skip"
            onPress={() => setShowSkipped((open) => !open)}
            style={{ minHeight: touchTarget, justifyContent: 'center', marginTop: spacing.md }}>
            <Text
              style={[typography.caption, { color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }]}>
              {showSkipped ? '▾' : '▸'} Not reordering · {notReordering.length}
            </Text>
          </Pressable>
          {showSkipped ? notReordering.map(row) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
