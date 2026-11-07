import { REACTION_LABELS, SPECIES_LABELS, latestRatingByPet } from '@kibblr/core';
import type { Pet, Product, WithId } from '@kibblr/core';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { useToast } from '@/components/toast';
import { VerdictBadge } from '@/components/verdict-badge';
import { useSignedIn } from '@/features/auth/auth-provider';
import { CATEGORY_DISPLAY } from '@/features/inventory/category';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { useProducts } from '@/features/inventory/hooks';
import { usePets } from '@/features/pets/hooks';
import { SPECIES_ICONS } from '@/features/pets/species';
import { useRatings } from '@/features/ratings/hooks';
import { REACTION_ICONS } from '@/features/ratings/reactions';
import { setPetArchived } from '@/firebase/repositories/pets';
import { useTheme } from '@/theme';

export default function PetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pets = usePets();
  const { colors, spacing } = useTheme();

  if (pets.status === 'loading') {
    return <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />;
  }
  const pet = pets.status === 'ready' ? pets.data.find((p) => p.id === id) : undefined;
  if (!pet) {
    return (
      <EmptyState title="Pet not found" body={pets.status === 'error' ? pets.message : 'It may have been removed.'} />
    );
  }
  return <PetDetail pet={pet} />;
}

/** A pet's foods and how they liked each (spec section 6.7). */
function PetDetail({ pet }: { pet: WithId<Pet> }) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const { householdId } = useSignedIn();
  const toast = useToast();
  const products = useProducts();
  const foods = products.status === 'ready' ? products.data.filter((p) => p.petIds.includes(pet.id)) : [];
  foods.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  async function setArchived(archived: boolean) {
    try {
      await setPetArchived(householdId, pet.id, archived);
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return;
    }
    if (!archived) {
      toast.show({ message: `Restored ${pet.name}.` });
      return;
    }
    toast.show({
      message: `Archived ${pet.name}.`,
      action: {
        label: 'Undo',
        onPress: () =>
          void setPetArchived(householdId, pet.id, false).catch((error: unknown) =>
            toast.show({ message: inventoryErrorMessage(error), tone: 'error' }),
          ),
      },
    });
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: pet.name,
          headerRight: () => (
            <Link href={{ pathname: '/pet/[id]/edit', params: { id: pet.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit pet"
                style={{ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
                <Text style={[typography.body, { color: colors.primary }]}>Edit</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 3 }}>
        <View
          style={{
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.xl,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
          }}>
          <Text style={typography.display}>{SPECIES_ICONS[pet.species]}</Text>
          <Text style={[typography.title, { color: colors.text }]}>{pet.name}</Text>
          <Text style={[typography.caption, { color: pet.archived ? colors.statusLow : colors.textMuted }]}>
            {pet.archived ? 'Archived' : SPECIES_LABELS[pet.species]}
          </Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Eats</Text>
          {products.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
          {products.status === 'ready' && foods.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>
              No foods yet. Edit a product and pick {pet.name} under “Who eats it”.
            </Text>
          ) : null}
          {foods.map((product) => (
            <FoodRow key={product.id} product={product} petId={pet.id} />
          ))}
        </View>

        <Button
          label={pet.archived ? `Restore ${pet.name}` : 'Archive pet'}
          variant={pet.archived ? 'secondary' : 'link'}
          onPress={() => void setArchived(!pet.archived)}
        />
      </ScrollView>
    </>
  );
}

function FoodRow({ product, petId }: { product: WithId<Product>; petId: string }) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const ratings = useRatings(product.id, 20);
  const rating = ratings.status === 'ready' ? latestRatingByPet(ratings.data).get(petId) : undefined;
  const reaction = rating ? `${REACTION_ICONS[rating.reaction]} ${REACTION_LABELS[rating.reaction]}` : 'Not rated';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${reaction}`}
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
      style={({ pressed }) => ({
        minHeight: touchTarget + spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}>
      <ProductImage imageUrl={product.imageUrl} icon={CATEGORY_DISPLAY[product.category].icon} size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[typography.caption, { color: rating ? colors.text : colors.textMuted }]}>{reaction}</Text>
        {rating?.comment ? (
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
            {rating.comment}
          </Text>
        ) : null}
      </View>
      <VerdictBadge verdict={product.verdict} />
    </Pressable>
  );
}
