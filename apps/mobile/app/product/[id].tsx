import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useTheme } from '@/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography } = useTheme();

  return (
    <PlaceholderScreen title="Product" phase={2}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>id: {id}</Text>
    </PlaceholderScreen>
  );
}
