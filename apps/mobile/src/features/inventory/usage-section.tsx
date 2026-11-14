import {
  CONTAINER_LABELS,
  effectiveRate,
  formatCount,
  formatRunway,
  runwayDays,
  usagePatch,
  validateUsageForm,
} from '@kibblr/core';
import type { LowStockMode, Product, UsageFormInput, WithId } from '@kibblr/core';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { useNextReminder } from '@/features/notifications/hooks';
import type { NextReminder } from '@/features/notifications/hooks';
import { updateProduct } from '@/firebase/repositories/products';
import { useTheme } from '@/theme';

import { inventoryErrorMessage } from './errors';
import { useHouseholdSettings } from './hooks';

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const QUICK_AMOUNTS = [
  { value: '0.5', label: '½' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
] as const;

type Props = {
  product: WithId<Product>;
  /** The saved values; the parent remounts this with a new key when they change. */
  initial: UsageFormInput;
  learned: number | null;
};

/**
 * Usage and the low-stock rule (spec section 6.4): how much a day, auto-deduct,
 * when to warn, and the runway and next reminder that follow from them.
 */
export function UsageSection({ product, initial, learned }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const { householdId } = useSignedIn();
  const settings = useHouseholdSettings();
  const toast = useToast();
  const reminder = useNextReminder(product);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<'dailyUsage' | 'lowStock', string>>>({});
  const [saving, setSaving] = useState(false);

  const label = CONTAINER_LABELS[product.container];
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const hasAmount = form.dailyUsage.trim() !== '';
  const runway = runwayDays(product, learned);
  const rate = effectiveRate(product, learned);

  const modeOptions: { value: LowStockMode; label: string }[] = [
    { value: 'default', label: `Default (${String(settings.defaultLowStockDays)} days)` },
    { value: 'days', label: 'Days left' },
    { value: 'amount', label: `${capitalize(label.many)} left` },
  ];

  async function save() {
    const result = validateUsageForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateProduct(householdId, product.id, usagePatch(product, result.fields, new Date()));
      toast.show({ message: 'Saved usage.' });
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const muted = [typography.caption, { color: colors.textMuted }];

  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>Usage</Text>
        <Text style={muted}>
          {runway !== null && rate !== null
            ? `${formatRunway(runway)} left at ${formatCount(rate, product.container)} a day${
                product.dailyUsage === null ? ', learned from your use' : ''
              }.`
            : 'Set how much you use a day to see how long it lasts.'}
        </Text>
      </View>

      <TextField
        label={`${capitalize(label.many)} a day`}
        value={form.dailyUsage}
        onChangeText={(dailyUsage) => setForm({ ...form, dailyUsage })}
        error={errors.dailyUsage}
        keyboardType="decimal-pad"
        placeholder={learned !== null ? `About ${String(Math.round(learned * 100) / 100)}` : 'Not set'}
      />
      <Chips
        label={`Quick ${label.many} a day`}
        options={QUICK_AMOUNTS}
        selected={QUICK_AMOUNTS.find((q) => Number(q.value) === Number(form.dailyUsage))?.value ?? null}
        onSelect={(dailyUsage) => setForm({ ...form, dailyUsage })}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.body, { color: colors.text, opacity: hasAmount ? 1 : 0.5 }]}>Auto-deduct</Text>
          <Text style={muted}>
            {hasAmount ? 'Takes the daily amount off each day, when you open Kibblr.' : 'Set a daily amount first.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Auto-deduct"
          value={form.autoDeduct && hasAmount}
          disabled={!hasAmount}
          onValueChange={(autoDeduct) => setForm({ ...form, autoDeduct })}
          trackColor={{ true: colors.primary, false: colors.border }}
          ios_backgroundColor={colors.border}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{"Warn me when it's low"}</Text>
        <Chips
          label="Low-stock rule"
          options={modeOptions}
          selected={form.lowStockMode}
          onSelect={(lowStockMode) => setForm({ ...form, lowStockMode })}
        />
        {form.lowStockMode === 'default' ? null : (
          <TextField
            label={form.lowStockMode === 'days' ? 'Days of food left' : `${capitalize(label.many)} left`}
            value={form.lowStockValue}
            onChangeText={(lowStockValue) => setForm({ ...form, lowStockValue })}
            error={errors.lowStock}
            keyboardType="decimal-pad"
            placeholder={form.lowStockMode === 'days' ? '7' : '2'}
          />
        )}
      </View>

      <Text style={muted}>{reminderText(reminder)}</Text>

      {dirty ? <Button label="Save usage" onPress={() => void save()} busy={saving} /> : null}
    </View>
  );
}

function reminderText(reminder: NextReminder): string {
  switch (reminder.kind) {
    case 'scheduled':
      return `Next reminder: ${reminder.at.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}.`;
    case 'sent':
      return 'Reminded already. You get another when the count changes.';
    case 'none':
      return 'No reminder until Kibblr knows how fast it goes.';
    case 'off':
      return 'Reminders are off on this phone (Settings).';
  }
}
