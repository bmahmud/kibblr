import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { EmptyState } from '@/components/empty-state';
import { EventRow } from '@/features/inventory/event-row';
import { useEvents, useProducts } from '@/features/inventory/hooks';
import { useTheme } from '@/theme';

const PAGE = 50;

/** Every stock change, newest first, optionally for one product (spec section 6.9). */
export default function HistoryScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { colors, spacing } = useTheme();
  const [max, setMax] = useState(PAGE);
  // Archived products too, so their old events still have names and containers.
  const products = useProducts({ includeArchived: true });
  const events = useEvents({ productId: productId ?? null, max });

  const byId = new Map(products.status === 'ready' ? products.data.map((p) => [p.id, p]) : []);
  const filterOptions = [
    { value: 'all', label: 'All products' },
    ...(products.status === 'ready'
      ? products.data
          .filter((p) => !p.archived || p.id === productId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({ value: p.id, label: p.name }))
      : []),
  ];

  const list = events.status === 'ready' ? events.data : [];

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 3 }}
      data={list}
      keyExtractor={(event) => event.id}
      ListHeaderComponent={
        <View style={{ paddingVertical: spacing.md }}>
          <Chips
            label="Product"
            scroll
            options={filterOptions}
            selected={productId ?? 'all'}
            onSelect={(value) => {
              setMax(PAGE);
              router.setParams({ productId: value === 'all' ? undefined : value });
            }}
          />
        </View>
      }
      ListEmptyComponent={
        events.status === 'loading' ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
        ) : events.status === 'error' ? (
          <EmptyState title="Couldn't load" body={events.message} />
        ) : (
          <EmptyState title="Nothing yet" body="Every add and use shows up here." />
        )
      }
      renderItem={({ item }) => {
        const product = byId.get(item.productId);
        // Containers come from the product; while products load, rows wait rather than guess.
        return product ? (
          <EventRow
            event={item}
            container={product.container}
            productName={productId ? undefined : product.name}
          />
        ) : null;
      }}
      ListFooterComponent={
        list.length === max ? (
          <View style={{ paddingTop: spacing.lg }}>
            <Button label="Load more" variant="secondary" onPress={() => setMax((n) => n + PAGE)} />
          </View>
        ) : undefined
      }
    />
  );
}
