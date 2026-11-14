import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TabHeader } from '@/components/tab-header';
import { useToast } from '@/components/toast';
import { useAuth, useSignedIn } from '@/features/auth/auth-provider';
import { useHousehold } from '@/features/auth/use-household';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { useHouseholdSettings } from '@/features/inventory/hooks';
import { notificationPermission, requestNotificationPermission } from '@/features/notifications/low-stock';
import type { PermissionState } from '@/features/notifications/low-stock';
import { useNotificationPreferences } from '@/features/notifications/preferences';
import { updateHouseholdSettings } from '@/firebase/repositories/households';
import { THEMES, useTheme, useThemePreferences } from '@/theme';
import type { Appearance, ColorTheme } from '@/theme';

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Reminders, appearance, color theme and account; the rest of Settings is Phase 7.
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
        <Text style={sectionTitle}>Reminders</Text>
        <ReminderSettings />
      </View>

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

function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' });
}

/**
 * Low-stock reminders (spec sections 6.8 and 9). On or off is this phone's
 * choice; the hour and the default warning are the household's.
 */
function ReminderSettings() {
  const { colors, radius, spacing, typography } = useTheme();
  const { householdId } = useSignedIn();
  const household = useHousehold();
  const settings = useHouseholdSettings();
  const toast = useToast();
  const { enabled, setEnabled } = useNotificationPreferences();
  const [permission, setPermission] = useState<PermissionState | null>(null);

  // Permission can change in the phone's Settings while Kibblr is in the background.
  useEffect(() => {
    const check = () => void notificationPermission().then(setPermission, () => setPermission(null));
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check();
      }
    });
    return () => subscription.remove();
  }, []);

  async function toggle(on: boolean) {
    setEnabled(on);
    if (on) {
      setPermission(await requestNotificationPermission());
    }
  }

  function save(patch: { notifyHour?: number; defaultLowStockDays?: number }) {
    updateHouseholdSettings(householdId, patch).catch((error: unknown) =>
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' }),
    );
  }

  const ready = household.status === 'ready';
  const blocked = enabled && permission === 'denied';
  const days = settings.defaultLowStockDays;

  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.body, { color: colors.text }]}>Low-stock reminders</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {blocked ? "Notifications are off for Kibblr in your phone's Settings." : 'On this phone.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Low-stock reminders"
          value={enabled}
          onValueChange={(on) => void toggle(on)}
          trackColor={{ true: colors.primary, false: colors.border }}
          ios_backgroundColor={colors.border}
        />
      </View>
      {blocked ? (
        <Button label="Open phone Settings" variant="link" onPress={() => void Linking.openSettings()} />
      ) : null}
      {enabled && permission === 'undetermined' ? (
        <Button
          label="Allow notifications"
          variant="link"
          onPress={() => void requestNotificationPermission().then(setPermission)}
        />
      ) : null}

      <Stepper
        label="Remind me at"
        value={formatHour(settings.notifyHour)}
        disabled={!ready}
        onDecrement={() => save({ notifyHour: (settings.notifyHour + 23) % 24 })}
        onIncrement={() => save({ notifyHour: (settings.notifyHour + 1) % 24 })}
      />
      <Stepper
        label="Warn me with"
        value={`${String(days)} ${days === 1 ? 'day' : 'days'} left`}
        disabled={!ready}
        onDecrement={days > 1 ? () => save({ defaultLowStockDays: days - 1 }) : undefined}
        onIncrement={days < 365 ? () => save({ defaultLowStockDays: days + 1 }) : undefined}
      />
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Your household shares the hour and the warning. A product can set its own warning.
      </Text>
    </View>
  );
}

/** A value with minus and plus buttons, for small ranges like an hour or a number of days. */
function Stepper({
  label,
  value,
  disabled,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onDecrement: (() => void) | undefined;
  onIncrement: (() => void) | undefined;
}) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();

  function step(text: string, name: string, onPress: (() => void) | undefined) {
    const off = disabled || !onPress;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} ${label.toLowerCase()}`}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={onPress}
        style={({ pressed }) => ({
          width: touchTarget,
          height: touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceRaised,
          opacity: off ? 0.4 : pressed ? 0.7 : 1,
        })}>
        <Text style={[typography.title, { color: colors.text }]}>{text}</Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (disabled) {
          return;
        }
        (event.nativeEvent.actionName === 'increment' ? onIncrement : onDecrement)?.();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Text style={[typography.body, { flex: 1, color: colors.text }]}>{label}</Text>
      {step('−', 'Decrease', onDecrement)}
      <Text style={[typography.bodyStrong, { minWidth: 96, textAlign: 'center', color: colors.text }]}>{value}</Text>
      {step('+', 'Increase', onIncrement)}
    </View>
  );
}
