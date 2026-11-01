import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useTheme } from '@/theme';

export default function ScanScreen() {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  return (
    <PlaceholderScreen title="Scan" phase={3}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={{
          minHeight: touchTarget,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
        }}>
        <Text style={[typography.bodyStrong, { color: colors.onPrimary }]}>Close</Text>
      </Pressable>
    </PlaceholderScreen>
  );
}
