import { defaultInputUnit, formatAmount, parseNumber, stockStatus, toBase } from '@kibblr/core';
import type { DisplayUnit, Product, WithId } from '@kibblr/core';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { NavLink } from '@/components/nav-link';
import { StatusBadge } from '@/components/status-badge';
import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { EventRow } from '@/features/inventory/event-row';
import { useEvents, useHouseholdSettings, useProduct } from '@/features/inventory/hooks';
import { useStockActions } from '@/features/inventory/use-stock-actions';
import { setProductArchived } from '@/firebase/repositories/products';
import { useTheme } from '@/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const { colors } = useTheme();

  if (product.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (product.status === 'error' || product.data === null) {
    return (
      <EmptyState
        title="Product not found"
        body={product.status === 'error' ? product.message : 'It may have been removed.'}
      />
    );
  }
  return <ProductDetail product={product.data} />;
}

function ProductDetail({ product }: { product: WithId<Product> }) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const { householdId } = useSignedIn();
  const settings = useHouseholdSettings();
  const unit = settings.preferredWeightUnit;
  const actions = useStockActions();
  const toast = useToast();
  const events = useEvents({ productId: product.id, max: 20 });

  const [amount, setAmount] = useState('');
  const [chosenUnit, setChosenUnit] = useState<DisplayUnit | null>(null);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const amountUnit = chosenUnit ?? defaultInputUnit(product.baseUnit, unit);

  async function step(delta: number) {
    setBusy(true);
    await actions.change(product.id, delta);
    setBusy(false);
  }

  async function applyAmount(kind: 'add' | 'use' | 'set') {
    const value = parseNumber(amount);
    if (value === null) {
      setAmountError('Enter an amount, like 2 or 0.5.');
      return;
    }
    const base = toBase(value, amountUnit);
    if (kind !== 'set' && base === 0) {
      setAmountError('Enter an amount more than 0.');
      return;
    }
    setAmountError(undefined);
    setBusy(true);
    const result =
      kind === 'set' ? await actions.setOnHand(product.id, base) : await actions.change(product.id, kind === 'add' ? base : -base);
    setBusy(false);
    if (result) {
      setAmount('');
    }
  }

  async function archive() {
    try {
      await setProductArchived(householdId, product.id, true);
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return;
    }
    toast.show({
      message: `Archived ${product.name}.`,
      action: {
        label: 'Undo',
        onPress: () =>
          void setProductArchived(householdId, product.id, false).catch((error: unknown) =>
            toast.show({ message: inventoryErrorMessage(error), tone: 'error' }),
          ),
      },
    });
    router.back();
  }

  const section = { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: product.name,
          headerRight: () => (
            <Link href={{ pathname: '/product/[id]/edit', params: { id: product.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit product"
                style={{ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
                <Text style={[typography.body, { color: colors.primary }]}>Edit</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 3 }}>
        <View style={{ gap: spacing.xs }}>
          {product.archived ? (
            <Text style={[typography.caption, { color: colors.statusLow }]}>Archived</Text>
          ) : null}
          {product.brand ? <Text style={[typography.body, { color: colors.textMuted }]}>{product.brand}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={[typography.display, { color: colors.text }]} accessibilityLabel="On hand">
              {formatAmount(product.onHand, product.baseUnit, unit)}
            </Text>
            <StatusBadge status={stockStatus(product, settings)} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            on hand · package is {product.packageLabel}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              label={`− ${product.packageLabel}`}
              variant="secondary"
              onPress={() => void step(-product.packageAmount)}
              disabled={busy || product.onHand === 0}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={`+ ${product.packageLabel}`} onPress={() => void step(product.packageAmount)} disabled={busy} />
          </View>
        </View>

        <View style={section}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Custom amount</Text>
          <AmountInput
            label="Amount"
            baseUnit={product.baseUnit}
            value={amount}
            onChangeValue={setAmount}
            unit={amountUnit}
            onChangeUnit={setChosenUnit}
            error={amountError}
            placeholder="0"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Use" variant="secondary" onPress={() => void applyAmount('use')} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Add" variant="secondary" onPress={() => void applyAmount('add')} disabled={busy} />
            </View>
            <View style={{ flex: 1.4 }}>
              <Button label="Set on hand" variant="secondary" onPress={() => void applyAmount('set')} disabled={busy} />
            </View>
          </View>
        </View>

        <View style={section}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Recent activity</Text>
          {events.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
          {events.status === 'error' ? (
            <Text style={[typography.body, { color: colors.statusOut }]}>{events.message}</Text>
          ) : null}
          {events.status === 'ready' && events.data.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>
              No changes yet. Add or use some above.
            </Text>
          ) : null}
          {events.status === 'ready'
            ? events.data.map((event) => (
                <EventRow key={event.id} event={event} baseUnit={product.baseUnit} unit={unit} />
              ))
            : null}
          <NavLink href={{ pathname: '/history', params: { productId: product.id } }} label="Full history" />
        </View>

        {product.archived ? null : <Button label="Archive product" variant="link" onPress={() => void archive()} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
