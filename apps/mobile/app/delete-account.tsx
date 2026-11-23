import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { OfflineBanner, useOnline } from '@/components/offline-banner';
import { TextField } from '@/components/text-field';
import { useSignedIn } from '@/features/auth/auth-provider';
import { deleteAccount } from '@/features/auth/delete-account';
import { authErrorMessage } from '@/features/auth/errors';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { useTheme } from '@/theme';

function isAuthError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('auth/')
  );
}

/**
 * Deletes the account and everything in the household (Settings > Delete
 * account). Asks for the password: Firebase needs a recent sign-in, and it
 * makes a slip much less likely.
 */
export default function DeleteAccountScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const { user, householdId } = useSignedIn();
  const online = useOnline();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);

  function confirm() {
    if (!password) {
      setError('Enter your password.');
      return;
    }
    Alert.alert('Delete your account?', 'Everything in Kibblr is deleted for good. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  async function remove() {
    setError(undefined);
    setDeleting(true);
    try {
      await deleteAccount(householdId, password);
    } catch (caught) {
      setDeleting(false);
      setError(isAuthError(caught) ? authErrorMessage(caught) : inventoryErrorMessage(caught));
    }
    // No navigation needed: deleting the login signs the app out, and the
    // root stack's auth guard swaps every signed-in screen for sign-in.
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <OfflineBanner />
      <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>This deletes, for good:</Text>
        <Text style={[typography.body, { color: colors.text }]}>
          {'• Every product, with its history and ratings\n• Your pets\n• Your login, '}
          {user.email}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Want a copy first? Use Export data in Settings before you delete.
        </Text>
      </View>
      <TextField
        label="Your password"
        value={password}
        onChangeText={(next) => {
          setPassword(next);
          setError(undefined);
        }}
        error={error}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={confirm}
      />
      <Button
        label="Delete account"
        tone="danger"
        variant="secondary"
        onPress={confirm}
        busy={deleting}
        disabled={!online}
      />
    </ScrollView>
  );
}
