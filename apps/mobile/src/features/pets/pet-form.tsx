import { SPECIES, SPECIES_LABELS, validatePetForm } from '@kibblr/core';
import type { PetFields } from '@kibblr/core';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/theme';

import { SPECIES_ICONS } from './species';

const SPECIES_OPTIONS = SPECIES.map((value) => ({ value, label: `${SPECIES_ICONS[value]} ${SPECIES_LABELS[value]}` }));

type Props = {
  initial: PetFields;
  submitLabel: string;
  onSubmit: (fields: PetFields) => Promise<void>;
};

/** New and Edit pet (spec section 6.7). */
export function PetForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors, spacing, typography } = useTheme();
  const [form, setForm] = useState<PetFields>(initial);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

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
