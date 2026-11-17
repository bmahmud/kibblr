import { formatCount } from '@kibblr/core';
import type { Product, WithId } from '@kibblr/core';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { CATEGORY_DISPLAY } from '@/features/inventory/category';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { useProducts } from '@/features/inventory/hooks';
import { scheduleProductDelete } from '@/features/inventory/pending-delete';
import { setProductArchived } from '@/firebase/repositories/products';
import { useTheme } from '@/theme';

/** Archived products, to restore or delete (spec section 6.10: archive is reversible from Settings). */
export default function ArchivedProductsScreen() {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const { householdId } = useSignedIn();
  const toast = useToast();
  const products = useProducts({ includeArchived: true });
  const archived =
    products.status === 'ready'
      ? products.data.filter((p) => p.archived).sort((a, b) => a.name.localeCompare(b.name))
      : [];

  async function setArchived(product: WithId<Product>, value: boolean, undo: boolean) {
    try {
      await setProductArchived(householdId, product.id, value);
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return;
    }
    if (!undo) {
      toast.show({
        message: `Restored ${product.name} to Inventory.`,
        action: { label: 'Undo', onPress: () => void setArchived(product, true, true) },
      });
    }
  }

  function confirmDelete(product: WithId<Product>) {
    Alert.alert(`Delete ${product.name}?`, 'This removes it and its ratings. Its history entries are hidden.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const pending = scheduleProductDelete(householdId, product.id, (error) =>
            toast.show({ message: inventoryErrorMessage(error), tone: 'error' }),
          );
          toast.show({ message: `Deleted ${product.name}.`, action: { label: 'Undo', onPress: pending.undo } });
        },
      },
    ]);
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 3 }}
      data={archived}
      keyExtractor={(product) => product.id}
      ListEmptyComponent={
        products.status === 'loading' ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
        ) : products.status === 'error' ? (
          <EmptyState title="Couldn't load" body={products.message} />
        ) : (
          <EmptyState
            title="Nothing archived"
            body="Products you archive from their page wait here, in case you buy them again."
          />
        )
      }
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatCount(item.onHand, item.container)}`}
            accessibilityHint="Opens the product."
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: touchTarget,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}>
            <ProductImage
              imageUrl={item.imageUrl}
              photo={item.photo}
              icon={CATEGORY_DISPLAY[item.category].icon}
              size={44}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {[item.brand, formatCount(item.onHand, item.container)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Button label="Restore" variant="link" onPress={() => void setArchived(item, false, false)} />
            <Button label="Delete" variant="link" tone="danger" onPress={() => confirmDelete(item)} />
          </View>
        </View>
      )}
    />
  );
}
