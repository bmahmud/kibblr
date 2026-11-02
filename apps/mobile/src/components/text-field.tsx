import type { Ref } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TextInputInstance, TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | undefined;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, error, ref, ...input }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          typography.body,
          {
            minHeight: touchTarget,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.statusOut : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
          },
        ]}
        {...input}
      />
      {error ? <Text style={[typography.caption, { color: colors.statusOut }]}>{error}</Text> : null}
    </View>
  );
}
