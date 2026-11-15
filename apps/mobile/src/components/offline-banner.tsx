import { useNetInfo } from '@react-native-community/netinfo';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/** False only when the phone reports no connection; unknown counts as online. */
export function useOnline(): boolean {
  return useNetInfo().isConnected !== false;
}

/**
 * Shown while offline (spec section 6.10). Stock changes are Firestore
 * transactions, which need the server, so they fail rather than queue.
 */
export function OfflineBanner() {
  const online = useOnline();
  const { colors, radius, spacing, typography } = useTheme();
  if (online) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.statusLow,
        backgroundColor: colors.surfaceRaised,
      }}>
      <Text style={[typography.bodyStrong, { color: colors.statusLow }]}>Offline</Text>
      <Text style={[typography.caption, { flex: 1, color: colors.text }]}>
        Adding and using stock needs a connection.
      </Text>
    </View>
  );
}
