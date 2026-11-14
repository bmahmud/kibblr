import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type ChipOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly ChipOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  /** Read out before the options, e.g. "Category". */
  label: string;
  disabled?: boolean;
  /** Scroll horizontally instead of wrapping (for long rows like filters). */
  scroll?: boolean;
};

/** A single-select row of pills: filters, units, segmented choices. */
export function Chips<T extends string>({ options, selected, onSelect, label, disabled = false, scroll = false }: Props<T>) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  const chips = options.map((option) => {
    const active = option.value === selected;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={() => onSelect(option.value)}
        // Compact pill; the slop keeps the full touch target.
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => ({
          minHeight: touchTarget - 12,
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        })}>
        <Text
          style={[
            active ? typography.bodyStrong : typography.body,
            { color: active ? colors.onPrimary : colors.text },
          ]}>
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        contentContainerStyle={{ gap: spacing.sm }}>
        {chips}
      </ScrollView>
    );
  }
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {chips}
    </View>
  );
}

type MultiProps<T extends string> = {
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
  /** Read out before the options, e.g. "Who eats it". */
  label: string;
  disabled?: boolean;
};

/** A multi-select row of pills, e.g. the pets that eat a product. Keeps the options' order. */
export function MultiChips<T extends string>({ options, selected, onChange, label, disabled = false }: MultiProps<T>) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  function toggle(value: T) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(next);
  }

  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: active, disabled }}
            disabled={disabled}
            onPress={() => toggle(option.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => ({
              minHeight: touchTarget - 12,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : colors.surface,
              opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            })}>
            <Text
              style={[
                active ? typography.bodyStrong : typography.body,
                { color: active ? colors.onPrimary : colors.text },
              ]}>
              {active ? `✓ ${option.label}` : option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
