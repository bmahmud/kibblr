import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/button';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAuth, useSignedIn } from '@/features/auth/auth-provider';
import { useHousehold } from '@/features/auth/use-household';
import { useTheme } from '@/theme';

// Only the account section exists for now; the rest of Settings is Phase 7.
export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useSignedIn();
  const household = useHousehold();
  const { colors, typography } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <PlaceholderScreen title="Settings" phase={7}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>Account</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>Signed in as {user.email}</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        Household: {household.status === 'ready' ? household.household.name : household.status === 'error' ? household.message : '…'}
      </Text>
      <Button label="Sign out" variant="secondary" onPress={() => void handleSignOut()} busy={signingOut} />
    </PlaceholderScreen>
  );
}
