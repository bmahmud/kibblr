import type { Ref } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TextInputInstance, TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Keep the label for screen readers only, e.g. a search field whose placeholder says enough. */
  hideLabel?: boolean;
  error?: string | undefined;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, hideLabel = false, error, ref, ...input }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  // Words get spell check (underlined, tap for suggestions) and autocorrect;
  // numbers, emails, links and passwords get neither. A field can opt out,
  // e.g. names, which keep the underline but aren't "corrected".
  const words = !input.secureTextEntry && (input.keyboardType === undefined || input.keyboardType === 'default');

  return (
    <View style={{ gap: spacing.xs }}>
      {hideLabel ? null : <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        spellCheck={words}
        autoCorrect={words}
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
