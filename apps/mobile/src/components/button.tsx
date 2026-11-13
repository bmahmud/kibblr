import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  /** `danger` colors a secondary or link button's label for destructive actions, like Delete. */
  tone?: 'default' | 'danger';
  busy?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', tone = 'default', busy = false, disabled = false }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const inactive = disabled || busy;

  const background = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surface : 'transparent';
  const textColor = variant === 'primary' ? colors.onPrimary : tone === 'danger' ? colors.statusOut : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touchTarget,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.border,
        opacity: inactive ? 0.6 : pressed ? 0.8 : 1,
      })}>
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typography.bodyStrong, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}
