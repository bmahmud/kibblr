import {
  REACTION_LABELS,
  VERDICTS,
  VERDICT_LABELS,
  formatRelativeTime,
  latestRatingByPet,
  promptPets,
  validateNote,
} from '@kibblr/core';
import type { Product, Verdict, WithId } from '@kibblr/core';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { usePets } from '@/features/pets/hooks';
import { updateProduct } from '@/firebase/repositories/products';
import { useTheme } from '@/theme';

import { useRatings } from './hooks';
import { openRatingSheet } from './prompt';
import { REACTION_ICONS } from './reactions';

const VERDICT_OPTIONS = VERDICTS.map((value) => ({ value, label: VERDICT_LABELS[value] }));

/**
 * Product detail's Feedback (spec section 6.4): each pet's latest reaction,
 * the verdict with its note, the store link and past ratings.
 */
export function FeedbackSection({ product }: { product: WithId<Product> }) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const { householdId } = useSignedIn();
  const toast = useToast();
  const pets = usePets();
  const ratings = useRatings(product.id, 20);
  const [note, setNote] = useState(product.verdictNote ?? '');
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [savingNote, setSavingNote] = useState(false);

  const allPets = pets.status === 'ready' ? pets.data : [];
  const asked = promptPets(product.petIds, allPets);
  const history = ratings.status === 'ready' ? ratings.data : [];
  const latest = latestRatingByPet(history);
  const petName = (petId: string) => allPets.find((pet) => pet.id === petId)?.name ?? 'A pet';
  const noteChanged = note.trim() !== (product.verdictNote ?? '');

  async function setVerdict(verdict: Verdict) {
    if (verdict === product.verdict) {
      return;
    }
    try {
      await updateProduct(householdId, product.id, { verdict });
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    }
  }

  async function saveNote() {
    const result = validateNote(note);
    if (!result.ok) {
      setNoteError(result.error);
      return;
    }
    setNoteError(undefined);
    setSavingNote(true);
    try {
      await updateProduct(householdId, product.id, { verdictNote: result.value });
      setNote(result.value ?? '');
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    } finally {
      setSavingNote(false);
    }
  }

  function openStore(url: string) {
    Linking.openURL(url).catch(() => toast.show({ message: "Couldn't open the store link.", tone: 'error' }));
  }

  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>Feedback</Text>

      {asked.length === 0 ? (
        <Button label="Rate it" variant="secondary" onPress={() => openRatingSheet(product.id, 'manual')} />
      ) : (
        asked.map((pet) => {
          const rating = latest.get(pet.id);
          return (
            <Pressable
              key={pet.id}
              accessibilityRole="button"
              accessibilityLabel={`${pet.name}: ${rating ? REACTION_LABELS[rating.reaction] : 'not rated yet'}`}
              accessibilityHint="Rates this product for this pet"
              onPress={() => openRatingSheet(product.id, 'manual', pet.id)}
              style={({ pressed }) => ({
                minHeight: touchTarget,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.surfaceRaised : colors.background,
              })}>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{pet.name}</Text>
              <Text style={[typography.body, { color: rating ? colors.text : colors.textMuted }]}>
                {rating ? `${REACTION_ICONS[rating.reaction]} ${REACTION_LABELS[rating.reaction]}` : 'Rate'}
              </Text>
            </Pressable>
          );
        })
      )}

      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Buy it again?</Text>
        <Chips
          label="Verdict"
          options={VERDICT_OPTIONS}
          selected={product.verdict}
          onSelect={(v) => void setVerdict(v)}
        />
      </View>
      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        error={noteError}
        placeholder="Miso prefers the turkey one"
        multiline
      />
      {noteChanged ? (
        <Button label="Save note" variant="secondary" onPress={() => void saveNote()} busy={savingNote} />
      ) : null}
      {product.reorderUrl ? (
        <Button label="Open store link" variant="secondary" onPress={() => openStore(product.reorderUrl ?? '')} />
      ) : null}

      {ratings.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
      {ratings.status === 'error' ? (
        <Text style={[typography.body, { color: colors.statusOut }]}>{ratings.message}</Text>
      ) : null}
      {history.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Ratings</Text>
          {history.map((rating) => (
            <View key={rating.id} style={{ gap: 2 }}>
              <Text style={[typography.body, { color: colors.text }]}>
                {REACTION_ICONS[rating.reaction]} {petName(rating.petId)} · {REACTION_LABELS[rating.reaction]}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {[rating.comment, formatRelativeTime(rating.createdAt)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
