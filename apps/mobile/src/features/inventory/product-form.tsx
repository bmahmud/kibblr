import {
  CATEGORIES,
  CONTAINERS,
  CONTAINER_LABELS,
  defaultContainer,
  defaultSizeUnit,
  validateProductForm,
} from '@kibblr/core';
import type {
  Container,
  DisplayUnit,
  ProductFields,
  ProductFormErrors,
  ProductFormInput,
  WeightUnit,
} from '@kibblr/core';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { ProductImage } from '@/components/product-image';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/theme';

import { CATEGORY_DISPLAY } from './category';

const CONTAINER_OPTIONS = CONTAINERS.map((value) => ({
  value,
  label: CONTAINER_LABELS[value].one[0]?.toUpperCase() + CONTAINER_LABELS[value].one.slice(1),
}));

/** The household's own units first. */
const SIZE_UNITS: Record<WeightUnit, readonly DisplayUnit[]> = {
  lb: ['oz', 'lb', 'floz', 'cup', 'g', 'kg', 'ml'],
  kg: ['g', 'kg', 'ml', 'oz', 'lb', 'floz', 'cup'],
};

type Props = {
  initial: ProductFormInput;
  unit: WeightUnit;
  submitLabel: string;
  onSubmit: (fields: ProductFields, startingCount: number) => Promise<void>;
  /** A scanned barcode, shown read-only. */
  barcode?: string | null;
  /** Set when the barcode lookup filled the form in: its photo and which database it came from. */
  lookup?: { imageUrl: string | null; sourceLabel: string } | null;
};

/** New and Edit product (spec section 6.4). Stock is counted in packages; the size is just for reference. */
export function ProductForm({ initial, unit, submitLabel, onSubmit, barcode = null, lookup = null }: Props) {
  const { colors, spacing, typography } = useTheme();
  const [form, setForm] = useState<ProductFormInput>(initial);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  // A new product's container follows its type until it is picked by hand.
  const [containerPicked, setContainerPicked] = useState(initial.mode === 'edit');
  const creating = form.mode === 'create';
  const container = CONTAINER_LABELS[form.container];

  function update(patch: Partial<ProductFormInput>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function changeContainer(next: Container) {
    update(form.sizeValue.trim() ? { container: next } : { container: next, sizeUnit: defaultSizeUnit(next, unit) });
  }

  async function submit() {
    const result = validateProductForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(result.fields, result.startingCount);
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
        {lookup ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {lookup.imageUrl ? (
              <ProductImage imageUrl={lookup.imageUrl} icon={CATEGORY_DISPLAY[form.category].icon} size={64} />
            ) : null}
            <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
              Filled in from {lookup.sourceLabel}. Check the details before saving.
              {barcode ? `
Barcode ${barcode}` : ''}
            </Text>
          </View>
        ) : barcode ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Barcode {barcode} · not in your inventory yet
          </Text>
        ) : null}
        <TextField
          label="Name"
          value={form.name}
          onChangeText={(name) => update({ name })}
          error={errors.name}
          placeholder="Salmon Feast"
          autoCapitalize="words"
        />
        <TextField
          label="Brand (optional)"
          value={form.brand}
          onChangeText={(brand) => update({ brand })}
          error={errors.brand}
          autoCapitalize="words"
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Type</Text>
          <Chips
            label="Type"
            options={CATEGORIES.map((value) => ({
              value,
              label: `${CATEGORY_DISPLAY[value].icon} ${CATEGORY_DISPLAY[value].label}`,
            }))}
            selected={form.category}
            onSelect={(category) => {
              update({ category });
              if (!containerPicked) {
                changeContainer(defaultContainer(category));
              }
            }}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Comes in a</Text>
          <Chips
            label="Comes in a"
            scroll
            options={CONTAINER_OPTIONS}
            selected={form.container}
            onSelect={(next) => {
              setContainerPicked(true);
              changeContainer(next);
            }}
          />
        </View>

        <AmountInput
          label={`Size of one ${container.one} (optional)`}
          units={SIZE_UNITS[unit]}
          value={form.sizeValue}
          onChangeValue={(sizeValue) => update({ sizeValue })}
          unit={form.sizeUnit}
          onChangeUnit={(sizeUnit) => update({ sizeUnit })}
          error={errors.size}
          placeholder={form.container === 'bag' ? '16' : '3'}
        />

        {creating ? (
          <TextField
            label={`How many ${container.many} on hand now`}
            value={form.startingCount}
            onChangeText={(startingCount) => update({ startingCount })}
            error={errors.startingCount}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : null}

        <Button label={submitLabel} onPress={() => void submit()} busy={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
