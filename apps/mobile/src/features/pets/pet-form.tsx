import { SPECIES, SPECIES_LABELS, validatePetForm } from '@kibblr/core';
import type { PetFields } from '@kibblr/core';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { PET_PHOTO_SIZE, pickPhoto } from '@/features/photos/pick-photo';
import type { PhotoSource } from '@/features/photos/pick-photo';
import { useTheme } from '@/theme';

import { PetPhoto } from './pet-photo';
import { SPECIES_ICONS } from './species';

const PHOTO_ERRORS = {
  denied: 'Allow camera access in Settings to take a photo.',
  tooLarge: 'That photo is too large. Try another.',
} as const;

const SPECIES_OPTIONS = SPECIES.map((value) => ({ value, label: `${SPECIES_ICONS[value]} ${SPECIES_LABELS[value]}` }));

type Props = {
  initial: PetFields;
  submitLabel: string;
  onSubmit: (fields: PetFields) => Promise<void>;
};

/** New and Edit pet (spec section 6.7). */
export function PetForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const [form, setForm] = useState<PetFields>(initial);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState<PhotoSource | null>(null);

  async function choosePhoto(source: PhotoSource) {
    setPhotoError(null);
    setLoadingPhoto(source);
    try {
      const result = await pickPhoto(source, PET_PHOTO_SIZE);
      if (result.status === 'picked') {
        setForm((current) => ({ ...current, photo: result.photo }));
      } else if (result.status !== 'canceled') {
        setPhotoError(PHOTO_ERRORS[result.status]);
      }
    } catch {
      setPhotoError("Couldn't load that photo.");
    } finally {
      setLoadingPhoto(null);
    }
  }

  async function submit() {
    const result = validatePetForm(form);
    if (!result.ok) {
      setError(result.errors.name);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await onSubmit(result.fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={form.photo ? 'Change photo' : 'Add a photo'}
            accessibilityHint="Opens your photo library"
            disabled={loadingPhoto !== null}
            onPress={() => void choosePhoto('library')}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <PetPhoto pet={{ name: form.name || '?', species: form.species, photo: form.photo }} size={128} />
            {loadingPhoto ? (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceRaised,
                  opacity: 0.85,
                }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
            <View
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                borderWidth: 3,
                borderColor: colors.background,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={typography.body}>📷</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
            <Button
              label="Take photo"
              variant="link"
              disabled={loadingPhoto !== null}
              onPress={() => void choosePhoto('camera')}
            />
            <Button
              label="Choose photo"
              variant="link"
              disabled={loadingPhoto !== null}
              onPress={() => void choosePhoto('library')}
            />
            {form.photo ? (
              <Button
                label="Remove"
                variant="link"
                disabled={loadingPhoto !== null}
                onPress={() => setForm((current) => ({ ...current, photo: null }))}
              />
            ) : null}
          </View>
          {photoError ? (
            <Text accessibilityRole="alert" style={[typography.body, { color: colors.statusOut, textAlign: 'center' }]}>
              {photoError}
            </Text>
          ) : null}
        </View>
        <TextField
          label="Name"
          value={form.name}
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          error={error}
          placeholder="Miso"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Species</Text>
          <Chips
            label="Species"
            options={SPECIES_OPTIONS}
            selected={form.species}
            onSelect={(species) => setForm((current) => ({ ...current, species }))}
          />
        </View>
        <Button label={submitLabel} onPress={() => void submit()} busy={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
