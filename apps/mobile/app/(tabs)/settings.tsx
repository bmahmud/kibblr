import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TabHeader } from '@/components/tab-header';
import { useAuth, useSignedIn } from '@/features/auth/auth-provider';
import { useHousehold } from '@/features/auth/use-household';
import { THEMES, useTheme, useThemePreferences } from '@/theme';
import type { Appearance, ColorTheme } from '@/theme';

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Appearance, color theme and account; the rest of Settings is Phase 7.
export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useSignedIn();
  const household = useHousehold();
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { appearance, setAppearance } = useThemePreferences();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const section = { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface };
  const sectionTitle = [
    typography.caption,
    { color: colors.textMuted, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: (Platform.OS === 'android' ? insets.top : 0) + spacing.lg,
        gap: spacing.lg,
        paddingBottom: spacing.xxl * 3,
      }}>
      <TabHeader title="Settings" />

      <View style={{ gap: spacing.sm }}>
        <Text style={sectionTitle}>Appearance</Text>
        <View style={section}>
          <Chips label="Appearance" options={APPEARANCE_OPTIONS} selected={appearance} onSelect={setAppearance} />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={sectionTitle}>Color theme</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {THEMES.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={sectionTitle}>Account</Text>
        <View style={section}>
          <Text style={[typography.body, { color: colors.text }]}>{user.email}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Household:{' '}
            {household.status === 'ready'
              ? household.household.name
              : household.status === 'error'
                ? household.message
                : '…'}
          </Text>
          <Button label="Sign out" variant="secondary" onPress={() => void handleSignOut()} busy={signingOut} />
        </View>
      </View>
    </ScrollView>
  );
}

/** A theme as a tiny preview of itself: its background, a card and its accent, in the current light or dark. */
function ThemeCard({ theme }: { theme: ColorTheme }) {
  const { colors, radius, scheme, spacing, typography } = useTheme();
  const { themeId, setThemeId } = useThemePreferences();
  const selected = themeId === theme.id;
  const preview = scheme === 'dark' ? theme.dark : theme.light;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${theme.label} theme`}
      accessibilityState={{ selected }}
      onPress={() => setThemeId(theme.id)}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}>
      <View
        style={{
          height: 72,
          gap: spacing.xs,
          padding: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: preview.background,
        }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.sm,
            backgroundColor: preview.surface,
          }}>
          <View style={{ width: 14, height: 14, borderRadius: radius.pill, backgroundColor: preview.primary }} />
          <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: preview.surfaceRaised }} />
        </View>
        <View style={{ height: 14, width: '45%', borderRadius: radius.pill, backgroundColor: preview.primary }} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xs,
        }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{theme.label}</Text>
        {selected ? <Text style={[typography.bodyStrong, { color: colors.primary }]}>✓</Text> : null}
      </View>
    </Pressable>
  );
}
