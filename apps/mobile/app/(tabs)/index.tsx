import { Text } from 'react-native';

import { NavLink } from '@/components/nav-link';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useHousehold } from '@/features/auth/use-household';
import { useTheme } from '@/theme';

export default function InventoryScreen() {
  const household = useHousehold();
  const { colors, typography } = useTheme();

  return (
    <PlaceholderScreen title="Inventory" phase={2}>
      {/* Shows the Phase 1 household bootstrap worked. */}
      <Text style={[typography.body, { color: household.status === 'error' ? colors.statusOut : colors.textMuted }]}>
        {household.status === 'ready'
          ? `Signed in, household "${household.household.name}"`
          : household.status === 'error'
            ? household.message
            : 'Loading household…'}
      </Text>
      <NavLink href="/scan" label="Scan" />
      <NavLink href="/product/new" label="New product" />
      <NavLink href={{ pathname: '/product/[id]', params: { id: 'example' } }} label="Product detail" />
      <NavLink href="/history" label="History" />
    </PlaceholderScreen>
  );
}
