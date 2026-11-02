import { DISPLAY_UNITS, UNIT_LABELS } from '@kibblr/core';
import type { BaseUnit, DisplayUnit } from '@kibblr/core';
import { View } from 'react-native';

import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  baseUnit: BaseUnit;
  value: string;
  onChangeValue: (text: string) => void;
  unit: DisplayUnit;
  onChangeUnit: (unit: DisplayUnit) => void;
  error?: string | undefined;
  placeholder?: string;
};

/** A number field plus the display units that fit the product's base unit. */
export function AmountInput({ label, baseUnit, value, onChangeValue, unit, onChangeUnit, error, placeholder }: Props) {
  const { spacing } = useTheme();
  const units = DISPLAY_UNITS[baseUnit];

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={label}
        value={value}
        onChangeText={onChangeValue}
        error={error}
        keyboardType="decimal-pad"
        placeholder={placeholder}
      />
      {units.length > 1 ? (
        <Chips
          label={`${label} unit`}
          options={units.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
          selected={unit}
          onSelect={onChangeUnit}
        />
      ) : null}
    </View>
  );
}
