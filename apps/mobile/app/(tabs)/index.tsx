import { BASE_UNITS } from '@kibblr/core';
import { Text } from 'react-native';

import { NavLink } from '@/components/nav-link';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useTheme } from '@/theme';

export default function InventoryScreen() {
  const { colors, typography } = useTheme();

  return (
    <PlaceholderScreen title="Inventory" phase={2}>
      {/* Proves @kibblr/core resolves through the workspace in Metro. */}
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Base units from @kibblr/core: {BASE_UNITS.join(', ')}
      </Text>
      <NavLink href="/scan" label="Scan" />
      <NavLink href="/product/new" label="New product" />
      <NavLink href={{ pathname: '/product/[id]', params: { id: 'example' } }} label="Product detail" />
      <NavLink href="/history" label="History" />
      <NavLink href="/sign-in" label="Sign in" />
    </PlaceholderScreen>
  );
}
