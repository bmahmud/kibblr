import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { TOAST_MS } from '@/components/toast';
import { useTheme } from '@/theme';

import type { ScanResult } from './use-scan-flow';

type Props = {
  result: ScanResult;
  onDismiss: () => void;
  /** Stays until replaced, e.g. while a lookup runs. */
  sticky?: boolean;
};

/** The scanner's stand-in for the toast: message plus Undo (or another action), gone after 6 seconds. */
export function ResultCard({ result, onDismiss, sticky = false }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const error = result.tone === 'error';

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(result.message);
  }, [result.message]);

  useEffect(() => {
    if (sticky) {
      return;
    }
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [result, onDismiss, sticky]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        paddingLeft: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceRaised,
        borderLeftWidth: 4,
        borderLeftColor: error ? colors.statusOut : colors.statusOk,
      }}>
      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{result.message}</Text>
      {result.action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const action = result.action;
            onDismiss();
            action?.onPress();
          }}
          style={{
            minHeight: touchTarget,
            justifyContent: 'center',
            paddingHorizontal: spacing.sm,
          }}>
          <Text style={[typography.bodyStrong, { color: colors.primary }]}>{result.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
