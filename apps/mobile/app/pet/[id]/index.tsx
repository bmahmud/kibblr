import { REACTION_LABELS, SPECIES_LABELS, latestRatingByPet, petFoods } from '@kibblr/core';
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
import { PetPhoto } from '@/features/pets/pet-photo';
import { useRatings } from '@/features/ratings/hooks';
import { ReactionBadge } from '@/features/ratings/reaction-badge';
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
  const foods = products.status === 'ready' ? petFoods(products.data, pet.id) : [];
  const summary = [
    SPECIES_LABELS[pet.species],
    products.status === 'ready' ? `${foods.length} ${foods.length === 1 ? 'food' : 'foods'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 3 }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg }}>
          <Link href={{ pathname: '/pet/[id]/edit', params: { id: pet.id } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pet.photo ? `Change ${pet.name}'s photo` : `Add a photo of ${pet.name}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginBottom: spacing.sm })}>
              <PetPhoto pet={pet} size={128} />
              {pet.photo ? null : <PhotoBadge />}
            </Pressable>
          </Link>
          <Text accessibilityRole="header" style={[typography.display, { color: colors.text, textAlign: 'center' }]}>
            {pet.name}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{summary}</Text>
          {pet.archived ? (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceRaised,
              }}>
              <Text style={[typography.caption, { color: colors.statusLow, fontWeight: '600' }]}>Archived</Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text
            style={[typography.caption, { color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' }]}>
            Foods
          </Text>
          {products.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
          {products.status === 'ready' && foods.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.xl,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
              }}>
              <Text style={typography.display}>🍽️</Text>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>No foods yet</Text>
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
                Pick {pet.name} under “Who eats it” on a product, or rate a food for them.
              </Text>
              <View style={{ alignSelf: 'stretch', marginTop: spacing.sm }}>
                <Button label="Go to Inventory" variant="secondary" onPress={() => router.navigate('/')} />
              </View>
            </View>
          ) : null}
          {foods.length > 0 ? (
            <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' }}>
              {foods.map((product, index) => (
                <FoodRow key={product.id} product={product} petId={pet.id} first={index === 0} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Button
            label={pet.archived ? `Restore ${pet.name}` : 'Archive pet'}
            variant={pet.archived ? 'secondary' : 'link'}
            onPress={() => void setArchived(!pet.archived)}
          />
          {pet.archived ? null : (
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              Archived pets aren’t asked about or offered in pickers. Their ratings stay.
            </Text>
          )}
        </View>
      </ScrollView>
    </>
  );
}

/** A small camera mark on the photo, inviting a first photo. */
function PhotoBadge() {
  const { colors, radius, typography } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        borderWidth: 3,
        borderColor: colors.background,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={typography.caption}>📷</Text>
    </View>
  );
}

function FoodRow({ product, petId, first }: { product: WithId<Product>; petId: string; first: boolean }) {
  const { colors, spacing, typography, touchTarget } = useTheme();
  const ratings = useRatings(product.id, 20);
  const rating = ratings.status === 'ready' ? latestRatingByPet(ratings.data).get(petId) : undefined;
  const reaction = rating ? REACTION_LABELS[rating.reaction] : 'not rated yet';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${reaction}`}
      accessibilityHint="Opens the product"
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
      style={({ pressed }) => ({
        minHeight: touchTarget + spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingLeft: spacing.lg,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}>
      <ProductImage imageUrl={product.imageUrl} icon={CATEGORY_DISPLAY[product.category].icon} size={44} />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          alignSelf: 'stretch',
          paddingVertical: spacing.md,
          paddingRight: spacing.lg,
          // Separator inset past the image, like an iOS grouped list.
          borderTopWidth: first ? 0 : 1,
          borderTopColor: colors.border,
        }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <ReactionBadge reaction={rating?.reaction ?? null} />
            <VerdictBadge verdict={product.verdict} />
          </View>
          {rating?.comment ? (
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
              “{rating.comment}”
            </Text>
          ) : null}
        </View>
        <Text style={[typography.body, { color: colors.textMuted }]}>›</Text>
      </View>
    </Pressable>
  );
}
