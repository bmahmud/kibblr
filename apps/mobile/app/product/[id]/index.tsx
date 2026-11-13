import { CONTAINER_LABELS, formatCount, formatSize, parseNumber, roundCount, stockStatus } from '@kibblr/core';
import type { Product, WithId } from '@kibblr/core';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Barcode } from '@/components/barcode';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { NavLink } from '@/components/nav-link';
import { ProductImage } from '@/components/product-image';
import { StatusBadge } from '@/components/status-badge';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { CATEGORY_DISPLAY } from '@/features/inventory/category';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { EventRow } from '@/features/inventory/event-row';
import { useEvents, useHouseholdSettings, useProduct } from '@/features/inventory/hooks';
import { scheduleProductDelete } from '@/features/inventory/pending-delete';
import { useStockActions } from '@/features/inventory/use-stock-actions';
import { PRODUCT_PHOTO_SIZE, askPhotoAction, pickPhoto } from '@/features/photos/pick-photo';
import { FeedbackSection } from '@/features/ratings/feedback-section';
import { setProductArchived, updateProduct } from '@/firebase/repositories/products';
import { useTheme } from '@/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const { colors } = useTheme();

  if (product.status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}>
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
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const { width } = useWindowDimensions();
  const label = CONTAINER_LABELS[product.container];

  async function step(delta: number) {
    setBusy(true);
    await actions.change(product.id, delta);
    setBusy(false);
  }

  async function applyAmount(kind: 'add' | 'use' | 'set') {
    const value = parseNumber(amount);
    if (value === null) {
      setAmountError('Enter a number, like 2 or 0.5.');
      return;
    }
    const count = roundCount(value);
    if (kind !== 'set' && count === 0) {
      setAmountError('Enter a number more than 0.');
      return;
    }
    setAmountError(undefined);
    setBusy(true);
    const result =
      kind === 'set'
        ? await actions.setOnHand(product.id, count)
        : await actions.change(product.id, kind === 'add' ? count : -count);
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
            toast.show({
              message: inventoryErrorMessage(error),
              tone: 'error',
            }),
          ),
      },
    });
    router.back();
  }

  async function changePhoto() {
    const action = await askPhotoAction(product.name, product.photo !== null);
    if (action === null) {
      return;
    }
    try {
      if (action === 'remove') {
        await updateProduct(householdId, product.id, { photo: null });
        return;
      }
      setLoadingPhoto(true);
      const result = await pickPhoto(action, PRODUCT_PHOTO_SIZE);
      if (result.status === 'picked') {
        await updateProduct(householdId, product.id, { photo: result.photo });
      } else if (result.status === 'denied') {
        toast.show({ message: 'Allow camera access in Settings to take a photo.', tone: 'error' });
      } else if (result.status === 'tooLarge') {
        toast.show({ message: 'That photo is too large. Try another.', tone: 'error' });
      }
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    } finally {
      setLoadingPhoto(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete ${product.name}?`, 'This removes it and its ratings. Its history entries are hidden.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  }

  function remove() {
    const pending = scheduleProductDelete(householdId, product.id, (error) =>
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' }),
    );
    toast.show({ message: `Deleted ${product.name}.`, action: { label: 'Undo', onPress: pending.undo } });
    router.back();
  }

  async function copyBarcode(gtin: string) {
    await Clipboard.setStringAsync(gtin);
    toast.show({ message: `Copied ${gtin}.` });
  }

  const section = {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: product.name,
          headerRight: () => (
            <Link
              href={{
                pathname: '/product/[id]/edit',
                params: { id: product.id },
              }}
              asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit product"
                style={{
                  minHeight: touchTarget,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.sm,
                }}>
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
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: spacing.xxl * 3,
        }}>
        <View
          style={[
            section,
            {
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.xl,
            },
          ]}>
          {product.archived ? <Text style={[typography.caption, { color: colors.statusLow }]}>Archived</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={product.photo ? 'Change photo' : 'Add your own photo'}
            disabled={loadingPhoto}
            onPress={() => void changePhoto()}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginBottom: spacing.sm })}>
            <ProductImage
              imageUrl={product.imageUrl}
              photo={product.photo}
              icon={CATEGORY_DISPLAY[product.category].icon}
              size={128}
            />
            <View
              style={{
                position: 'absolute',
                right: -spacing.sm,
                bottom: -spacing.sm,
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                borderWidth: 3,
                borderColor: colors.surface,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {loadingPhoto ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={typography.body}>📷</Text>
              )}
            </View>
          </Pressable>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {[CATEGORY_DISPLAY[product.category].icon, product.brand || CATEGORY_DISPLAY[product.category].label].join(
              ' ',
            )}
          </Text>
          <View
            accessible
            accessibilityLabel={`${formatCount(product.onHand, product.container)} on hand`}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: spacing.sm,
            }}>
            <Text style={[typography.display, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
              {String(roundCount(product.onHand))}
            </Text>
            <Text style={[typography.title, { color: colors.textMuted, fontWeight: '400' }]}>
              {roundCount(product.onHand) === 1 ? label.one : label.many}
            </Text>
          </View>
          <StatusBadge status={stockStatus(product, settings)} />
          {product.size ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {formatSize(product.size, unit)} per {label.one}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              label={`− 1 ${label.one}`}
              variant="secondary"
              onPress={() => void step(-1)}
              disabled={busy || product.onHand === 0}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={`+ 1 ${label.one}`} onPress={() => void step(1)} disabled={busy} />
          </View>
        </View>

        <View style={section}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Custom amount</Text>
          <TextField
            label={`Number of ${label.many}`}
            value={amount}
            onChangeText={setAmount}
            error={amountError}
            keyboardType="decimal-pad"
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

        <FeedbackSection product={product} />

        {product.barcode ? (
          <View style={[section, { paddingHorizontal: 0, paddingBottom: 0, overflow: 'hidden' }]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.lg,
              }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Barcode</Text>
              <Button label="Copy" variant="link" onPress={() => void copyBarcode(product.barcode ?? '')} />
            </View>
            <Barcode gtin={product.barcode} width={width - spacing.lg * 2} />
          </View>
        ) : null}

        <View style={section}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Recent activity</Text>
          {events.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
          {events.status === 'error' ? (
            <Text style={[typography.body, { color: colors.statusOut }]}>{events.message}</Text>
          ) : null}
          {events.status === 'ready' && events.data.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>No changes yet. Add or use some above.</Text>
          ) : null}
          {events.status === 'ready'
            ? events.data.map((event) => <EventRow key={event.id} event={event} container={product.container} />)
            : null}
          <NavLink href={{ pathname: '/history', params: { productId: product.id } }} label="Full history" />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl }}>
          {product.archived ? null : <Button label="Archive" variant="link" onPress={() => void archive()} />}
          <Button label="Delete" variant="link" tone="danger" onPress={confirmDelete} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
