import { REACTIONS, REACTION_LABELS, VERDICTS, VERDICT_LABELS, promptPets, validateNote } from '@kibblr/core';
import type { Pet, Product, Reaction, Verdict, WithId } from '@kibblr/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { useProduct } from '@/features/inventory/hooks';
import { usePets } from '@/features/pets/hooks';
import type { RatingSheetReason } from '@/features/ratings/prompt';
import { REACTION_ICONS } from '@/features/ratings/reactions';
import { updateProduct } from '@/firebase/repositories/products';
import { addRating } from '@/firebase/repositories/ratings';
import { useTheme } from '@/theme';

const VERDICT_OPTIONS = VERDICTS.map((value) => ({ value, label: VERDICT_LABELS[value] }));

function isReason(value: string | undefined): value is RatingSheetReason {
  return value === 'ranOut' || value === 'firstUse' || value === 'manual';
}

/**
 * "How did {pet} like it?" (spec section 6.5): a sheet over whatever is open,
 * the scanner included. Swipe it away or tap Not now; nothing waits on it.
 */
export default function RateScreen() {
  const params = useLocalSearchParams<{ productId: string; reason?: string; petId?: string }>();
  const product = useProduct(params.productId);
  const pets = usePets();
  const { colors, spacing } = useTheme();

  if (product.status === 'loading' || pets.status === 'loading') {
    return <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />;
  }
  if (product.status === 'error' || product.data === null) {
    return <Message text={product.status === 'error' ? product.message : 'This product no longer exists.'} />;
  }
  return (
    <RatingSheet
      product={product.data}
      pets={pets.status === 'ready' ? pets.data : []}
      reason={isReason(params.reason) ? params.reason : 'manual'}
      initialPetId={params.petId ?? null}
    />
  );
}

function Message({ text }: { text: string }) {
  const { colors, spacing, typography } = useTheme();
  return <Text style={[typography.body, { color: colors.textMuted, padding: spacing.xl }]}>{text}</Text>;
}

type SheetProps = {
  product: WithId<Product>;
  pets: WithId<Pet>[];
  reason: RatingSheetReason;
  initialPetId: string | null;
};

function RatingSheet({ product, pets, reason, initialPetId }: SheetProps) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const { householdId } = useSignedIn();
  const asked = promptPets(product.petIds, pets);
  // Opened from a pet's row: that pet, even if it isn't listed as eating this.
  const chosen = pets.find((pet) => pet.id === initialPetId);
  const candidates = chosen && !asked.some((pet) => pet.id === chosen.id) ? [chosen, ...asked] : asked;

  const [petId, setPetId] = useState<string | null>(chosen?.id ?? candidates[0]?.id ?? null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | undefined>(undefined);
  const [verdict, setVerdict] = useState<Verdict>(product.verdict);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pet = candidates.find((p) => p.id === petId) ?? null;
  const changed = reaction !== null || verdict !== product.verdict;
  const title =
    reason === 'ranOut'
      ? `You're out of ${product.name}`
      : reason === 'firstUse'
        ? `First time trying ${product.name}`
        : `Rate ${product.name}`;

  async function save() {
    const note = validateNote(comment);
    if (!note.ok) {
      setCommentError(note.error);
      return;
    }
    setCommentError(undefined);
    setSaveError(null);
    setSaving(true);
    try {
      if (reaction !== null && pet) {
        await addRating(householdId, product.id, { petId: pet.id, reaction, comment: note.value });
      }
      if (verdict !== product.verdict) {
        await updateProduct(householdId, product.id, { verdict });
      }
    } catch (error) {
      setSaveError(inventoryErrorMessage(error));
      setSaving(false);
      return;
    }
    router.back();
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>

      {pet ? (
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>How did {pet.name} like it?</Text>
          {candidates.length > 1 ? (
            <Chips
              label="Pet"
              options={candidates.map((p) => ({ value: p.id, label: p.name }))}
              selected={petId}
              onSelect={setPetId}
              scroll
            />
          ) : null}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Reaction"
            style={{ flexDirection: 'row', gap: spacing.sm }}>
            {REACTIONS.map((value) => {
              const active = reaction === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={REACTION_LABELS[value]}
                  accessibilityState={{ selected: active }}
                  onPress={() => setReaction(active ? null : value)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: touchTarget * 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.xs,
                    borderRadius: radius.lg,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.surfaceRaised : colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Text style={typography.display}>{REACTION_ICONS[value]}</Text>
                  <Text style={[active ? typography.bodyStrong : typography.body, { color: colors.text }]}>
                    {REACTION_LABELS[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {reaction !== null ? (
            <TextField
              label="Comment (optional)"
              value={comment}
              onChangeText={setComment}
              error={commentError}
              placeholder="Only licks the gravy"
              multiline
            />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Add your pets to record how each one liked it.
          </Text>
          <Button label="Add a pet" variant="secondary" onPress={() => router.replace('/pet/new')} />
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>Buy it again?</Text>
        <Chips label="Verdict" options={VERDICT_OPTIONS} selected={verdict} onSelect={setVerdict} />
      </View>

      {saveError ? <Text style={[typography.body, { color: colors.statusOut }]}>{saveError}</Text> : null}
      <Button label="Save" onPress={() => void save()} busy={saving} disabled={!changed} />
      <Button label="Not now" variant="link" onPress={() => router.back()} />
    </ScrollView>
  );
}
