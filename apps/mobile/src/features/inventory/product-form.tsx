import { CATEGORIES, defaultInputUnit, validateProductForm } from '@kibblr/core';
import type { BaseUnit, Category, ProductFields, ProductFormErrors, ProductFormInput, WeightUnit } from '@kibblr/core';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/theme';

const CATEGORY_LABELS: Record<Category, string> = {
  dry: 'Dry',
  wet: 'Wet',
  treat: 'Treat',
  supplement: 'Supplement',
  other: 'Other',
};

const MEASURES: { value: BaseUnit; label: string }[] = [
  { value: 'g', label: 'By weight' },
  { value: 'ml', label: 'By volume' },
  { value: 'count', label: 'By count' },
];

type Props = {
  initial: ProductFormInput;
  unit: WeightUnit;
  submitLabel: string;
  onSubmit: (fields: ProductFields, startingAmount: number) => Promise<void>;
};

/** New and Edit product (spec section 6.4). The base unit is fixed once a product exists. */
export function ProductForm({ initial, unit, submitLabel, onSubmit }: Props) {
  const { colors, spacing, typography } = useTheme();
  const [form, setForm] = useState<ProductFormInput>(initial);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const creating = form.mode === 'create';

  function update(patch: Partial<ProductFormInput>) {
    setForm((current) => ({ ...current, ...patch }));
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
      await onSubmit(result.fields, result.startingAmount);
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
          onChangeText={(name) => update({ name })}
          error={errors.name}
          placeholder="Chicken & Rice"
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
          <Text style={[typography.caption, { color: colors.textMuted }]}>Category</Text>
          <Chips
            label="Category"
            options={CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
            selected={form.category}
            onSelect={(category) => update({ category })}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Measured</Text>
          <Chips
            label="Measured"
            options={MEASURES}
            selected={form.baseUnit}
            disabled={!creating}
            onSelect={(baseUnit) => update({ baseUnit, packageUnit: defaultInputUnit(baseUnit, unit) })}
          />
          {creating ? null : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Fixed once a product exists, so its history stays in one unit.
            </Text>
          )}
        </View>

        <AmountInput
          label={form.baseUnit === 'count' ? 'Items per package' : 'Package size'}
          baseUnit={form.baseUnit}
          value={form.packageSize}
          onChangeValue={(packageSize) => update({ packageSize })}
          unit={form.packageUnit}
          onChangeUnit={(packageUnit) => update({ packageUnit })}
          error={errors.packageSize}
          placeholder={form.baseUnit === 'count' ? '1' : '12'}
        />

        {creating ? (
          <TextField
            label="Packages on hand now"
            value={form.startingPackages}
            onChangeText={(startingPackages) => update({ startingPackages })}
            error={errors.startingPackages}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : null}

        <Button label={submitLabel} onPress={() => void submit()} busy={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
