import { UNIT_LABELS } from '@kibblr/core';
import type { DisplayUnit } from '@kibblr/core';
import { View } from 'react-native';

import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  units: readonly DisplayUnit[];
  value: string;
  onChangeValue: (text: string) => void;
  unit: DisplayUnit;
  onChangeUnit: (unit: DisplayUnit) => void;
  error?: string | undefined;
  placeholder?: string;
};

/** A number field plus a row of unit chips. */
export function AmountInput({ label, units, value, onChangeValue, unit, onChangeUnit, error, placeholder }: Props) {
  const { spacing } = useTheme();

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
      <Chips
        label={`${label} unit`}
        scroll
        options={units.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
        selected={unit}
        onSelect={onChangeUnit}
      />
    </View>
  );
}
