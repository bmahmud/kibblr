import { SPECIES_LABELS, activePets } from '@kibblr/core';
import type { Pet, WithId } from '@kibblr/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { useProducts } from '@/features/inventory/hooks';
import { usePets } from '@/features/pets/hooks';
import { SPECIES_ICONS } from '@/features/pets/species';
import { useTheme } from '@/theme';

/** Pets (spec section 6.7): add, open, and archived ones kept out of the way. */
export default function PetsScreen() {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const pets = usePets();
  const products = useProducts();
  const [showArchived, setShowArchived] = useState(false);

  const all = pets.status === 'ready' ? pets.data : [];
  const active = activePets(all);
  const archived = all
    .filter((pet) => pet.archived)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const foodCount = (petId: string) =>
    products.status === 'ready' ? products.data.filter((p) => p.petIds.includes(petId)).length : null;

  function row(pet: WithId<Pet>) {
    const count = foodCount(pet.id);
    const detail = [SPECIES_LABELS[pet.species], count === null ? null : `${count} ${count === 1 ? 'food' : 'foods'}`]
      .filter(Boolean)
      .join(' · ');
    return (
      <Pressable
        key={pet.id}
        accessibilityRole="button"
        accessibilityLabel={`${pet.name}, ${detail}`}
        onPress={() => router.push({ pathname: '/pet/[id]', params: { id: pet.id } })}
        style={({ pressed }) => ({
          minHeight: touchTarget + spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          opacity: pet.archived ? 0.7 : 1,
        })}>
        <Text style={typography.title}>{SPECIES_ICONS[pet.species]}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{pet.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
        </View>
        <Text style={[typography.body, { color: colors.textMuted }]}>›</Text>
      </Pressable>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.display, { color: colors.text, flex: 1 }]}>
          Pets
        </Text>
        {active.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add pet"
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => router.push('/pet/new')}
            style={{
              minHeight: touchTarget - 8,
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
            }}>
            <Text style={[typography.bodyStrong, { color: colors.onPrimary }]}>+ Add</Text>
          </Pressable>
        ) : null}
      </View>

      {pets.status === 'loading' ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : null}
      {pets.status === 'error' ? <EmptyState title="Couldn't load" body={pets.message} /> : null}
      {pets.status === 'ready' && active.length === 0 ? (
        <EmptyState
          title="Add your first pet"
          body="Then pick who eats each food, and Kibblr will ask how they liked it when it runs out.">
          <Button label="Add a pet" onPress={() => router.push('/pet/new')} />
        </EmptyState>
      ) : null}

      {active.map(row)}

      {archived.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            onPress={() => setShowArchived((open) => !open)}
            style={{ minHeight: touchTarget, justifyContent: 'center', marginTop: spacing.md }}>
            <Text
              style={[typography.caption, { color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }]}>
              {showArchived ? '▾' : '▸'} Archived · {archived.length}
            </Text>
          </Pressable>
          {showArchived ? archived.map(row) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
