import { validateCredentials } from '@kibblr/core';
import type { AuthMode, CredentialErrors } from '@kibblr/core';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/auth-provider';
import { authErrorMessage } from '@/features/auth/errors';
import { useTheme } from '@/theme';

export default function SignInScreen() {
  const { state, signIn, signUp, signOut, resetPassword, retry } = useAuth();
  const { colors, spacing, typography } = useTheme();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const signingUp = mode === 'signUp';
  // After a successful sign-in the auth state is 'loading' while the
  // household is fetched; keep the button busy through that too.
  const busy = submitting || state.status === 'loading';

  async function submit() {
    setNotice(null);
    setFormError(null);
    const errors = validateCredentials({ mode, email, password, confirm });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      await (signingUp ? signUp(email, password) : signIn(email, password));
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function forgotPassword() {
    setFormError(null);
    setNotice(null);
    const { email: emailError } = validateCredentials({ mode: 'signIn', email, password: 'x' });
    setFieldErrors(emailError ? { email: emailError } : {});
    if (emailError) {
      return;
    }
    try {
      await resetPassword(email);
      setNotice(`If there's an account for ${email.trim()}, a reset link is on its way.`);
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  function switchMode() {
    setMode(signingUp ? 'signIn' : 'signUp');
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
    setConfirm('');
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Text style={[typography.title, { color: colors.text }]}>Almost there</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{state.message}</Text>
          <Button label="Try again" onPress={retry} />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.display, { color: colors.text }]}>Kibblr</Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              {signingUp ? 'Create an account to keep your inventory safe.' : 'Sign in to your pet food inventory.'}
            </Text>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            textContentType={signingUp ? 'newPassword' : 'password'}
            returnKeyType={signingUp ? 'next' : 'go'}
            onSubmitEditing={() => (signingUp ? confirmRef.current?.focus() : void submit())}
            submitBehavior={signingUp ? 'submit' : 'blurAndSubmit'}
          />
          {signingUp ? (
            <TextField
              ref={confirmRef}
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              error={fieldErrors.confirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
          ) : null}

          {formError ? (
            <Text accessibilityRole="alert" style={[typography.body, { color: colors.statusOut }]}>
              {formError}
            </Text>
          ) : null}
          {notice ? <Text style={[typography.body, { color: colors.statusOk }]}>{notice}</Text> : null}

          <Button label={signingUp ? 'Create account' : 'Sign in'} onPress={() => void submit()} busy={busy} />
          <Button
            label={signingUp ? 'I already have an account' : 'Create an account'}
            variant="secondary"
            onPress={switchMode}
            disabled={busy}
          />
          {signingUp ? null : (
            <Button label="Forgot password?" variant="link" onPress={() => void forgotPassword()} disabled={busy} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
