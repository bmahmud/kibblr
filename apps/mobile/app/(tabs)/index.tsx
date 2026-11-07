import { CATEGORIES, activePets, groupInventory } from '@kibblr/core';
import type { Category } from '@kibblr/core';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { EmptyState } from '@/components/empty-state';
import { TextField } from '@/components/text-field';
import { CATEGORY_DISPLAY } from '@/features/inventory/category';
import { useHouseholdSettings, useProducts } from '@/features/inventory/hooks';
import { InventoryRow } from '@/features/inventory/inventory-row';
import { useStockActions } from '@/features/inventory/use-stock-actions';
import { usePets } from '@/features/pets/hooks';
import { useTheme } from '@/theme';

type CategoryFilter = Category | 'all';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORIES.map((value) => ({
    value,
    label: `${CATEGORY_DISPLAY[value].icon} ${CATEGORY_DISPLAY[value].label}`,
  })),
];

export default function InventoryScreen() {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const settings = useHouseholdSettings();
  const actions = useStockActions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const pets = usePets();
  const [petFilter, setPetFilter] = useState<string>('all');

  const allPets = pets.status === 'ready' ? pets.data : [];
  const filterPets = activePets(allPets);
  // Archived pets drop out of the avatars too.
  const petNames = new Map(filterPets.map((pet) => [pet.id, pet.name]));
  // A pet archived while selected falls back to everyone.
  const petId = filterPets.some((pet) => pet.id === petFilter) ? petFilter : null;

  const all = products.status === 'ready' ? products.data : [];
  const { lowOrOut, ok } = groupInventory(all, settings, {
    query,
    category: category === 'all' ? null : category,
    petId,
  });
  const sections = [
    { title: `Low / Out · ${lowOrOut.length}`, data: lowOrOut },
    { title: `In stock · ${ok.length}`, data: ok },
  ].filter((section) => section.data.length > 0);

  const header = (
    <View
      style={{
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: colors.background,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.display, { color: colors.text, flex: 1 }]}>
          Inventory
        </Text>
        <Link href="/scan" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan"
            style={{
              minHeight: touchTarget,
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
            }}>
            <Text style={[typography.bodyStrong, { color: colors.primary }]}>Scan</Text>
          </Pressable>
        </Link>
        <Link href="/product/new" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add product"
            hitSlop={{ top: 4, bottom: 4 }}
            style={{
              minHeight: touchTarget - 8,
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
            }}>
            <Text style={[typography.bodyStrong, { color: colors.onPrimary }]}>+ Add</Text>
          </Pressable>
        </Link>
      </View>
      {all.length > 0 ? (
        <>
          <TextField
            label="Search"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or brand"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          <Chips label="Category" options={CATEGORY_FILTERS} selected={category} onSelect={setCategory} scroll />
          {filterPets.length > 0 ? (
            <Chips
              label="Pet"
              options={[
                { value: 'all', label: 'All pets' },
                ...filterPets.map((pet) => ({ value: pet.id, label: pet.name })),
              ]}
              selected={petId ?? 'all'}
              onSelect={setPetFilter}
              scroll
            />
          ) : null}
        </>
      ) : null}
    </View>
  );

  function empty() {
    if (products.status === 'loading') {
      return <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />;
    }
    if (products.status === 'error') {
      return <EmptyState title="Couldn't load" body={products.message} />;
    }
    if (all.length === 0) {
      return (
        <EmptyState
          title="Add your first product"
          body="Add the cans and bags you have at home, then count them down as you use them.">
          <Button label="Add a product" onPress={() => router.push('/product/new')} />
        </EmptyState>
      );
    }
    return <EmptyState title="No matches" body="Try another search, category or pet." />;
  }

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: Platform.OS === 'android' ? insets.top : 0,
        // Room for the tab bar and the undo toast.
        paddingBottom: spacing.xxl * 3,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      sections={sections}
      keyExtractor={(item) => item.product.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty()}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          style={[
            typography.caption,
            {
              color: colors.textMuted,
              fontWeight: '600',
              textTransform: 'uppercase',
              paddingHorizontal: spacing.lg,
              letterSpacing: 0.5,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
            },
          ]}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <InventoryRow
          product={item.product}
          status={item.status}
          unit={settings.preferredWeightUnit}
          petNames={item.product.petIds.flatMap((id) => {
            const name = petNames.get(id);
            return name ? [name] : [];
          })}
          onAdd={() => void actions.change(item.product.id, 1)}
          onUse={() => void actions.change(item.product.id, -1)}
        />
      )}
    />
  );
}
