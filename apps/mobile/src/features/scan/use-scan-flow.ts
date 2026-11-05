import { formatCount, normalizeGtin, scanUseAction } from '@kibblr/core';
import type { BarcodeHint, BarcodeLookup, Product, WithId } from '@kibblr/core';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { lookupBarcode } from '@/api/barcode';
import type { ToastOptions } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { useStockActions } from '@/features/inventory/use-stock-actions';
import { findProductsByBarcode, setProductArchived } from '@/firebase/repositories/products';

import { useScanSettings } from './scan-store';
import type { ScanMode } from './scan-store';

/** What the result card shows: the same shape as a toast, so stock actions can report to it. */
export type ScanResult = ToastOptions;

/** A bag or tub scanned in Use mode, waiting for "how much?". */
export type PendingUse = { product: WithId<Product>; multiplier: number };

function haptic(kind: 'success' | 'warning') {
  void Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
  ).catch(() => undefined);
}

/** An unknown barcode waiting on the lookup Worker. */
export type PendingLookup = { barcode: string; count: number };

/** New product for an unknown barcode, starting from what the lookup found, if anything. */
function openNewProduct(barcode: string, count: number, found: BarcodeLookup | null) {
  useScanSettings.getState().setPrefill(found);
  router.push({
    pathname: '/product/new',
    params: { barcode, count: String(count), method: 'scan' },
  });
}

/**
 * One scanned or typed barcode, end to end (spec section 6.3). Results go to
 * the scanner's own card, because the scanner modal covers the app's toast.
 */
export function useScanFlow() {
  const { householdId } = useSignedIn();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pendingUse, setPendingUse] = useState<PendingUse | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState<PendingLookup | null>(null);
  // Bumped by Skip, so a lookup that answers late is ignored.
  const lookupAttempt = useRef(0);
  // A ref as well as state: scans arrive faster than a re-render.
  const busyRef = useRef(false);
  const actions = useStockActions(setResult);
  // Stable, so the result card's 6-second timer isn't restarted by re-renders.
  const dismiss = useCallback(() => setResult(null), []);

  async function exclusive(task: () => Promise<void>) {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /** A scan's stock change, with the new count added to the card. True if it went through. */
  async function change(product: WithId<Product>, delta: number): Promise<boolean> {
    const outcome = await actions.change(product.id, delta, 'scan');
    if (outcome === null) {
      return false;
    }
    if (outcome.eventId !== null) {
      const left = `${formatCount(outcome.after, product.container)} on hand now.`;
      setResult((current) => current && { ...current, message: `${current.message} ${left}` });
    }
    return true;
  }

  /** Looks an unknown barcode up (spec section 6.3, step 4), then opens New product either way. */
  async function lookUpAndCreate(barcode: string, count: number) {
    const attempt = ++lookupAttempt.current;
    setResult(null);
    setLookingUp({ barcode, count });
    const found = await lookupBarcode(barcode);
    if (attempt !== lookupAttempt.current) {
      return;
    }
    setLookingUp(null);
    openNewProduct(barcode, count, found);
  }

  /** Stop waiting for the lookup and type the product in. */
  function skipLookup() {
    const pending = lookingUp;
    if (!pending) {
      return;
    }
    lookupAttempt.current++;
    setLookingUp(null);
    openNewProduct(pending.barcode, pending.count, null);
  }

  /** Returns false when the code was ignored because another scan is still running. */
  function handle(raw: string, mode: ScanMode, multiplier: number, hint?: BarcodeHint): boolean {
    if (busyRef.current) {
      return false;
    }
    void exclusive(async () => {
      setPendingUse(null);
      const barcode = normalizeGtin(raw, hint);
      if (barcode === null) {
        haptic('warning');
        setResult({
          message: "That barcode doesn't look right. Check the digits and try again.",
          tone: 'error',
        });
        return;
      }

      let found: Awaited<ReturnType<typeof findProductsByBarcode>>;
      try {
        found = await findProductsByBarcode(householdId, barcode);
      } catch (error) {
        haptic('warning');
        setResult({ message: inventoryErrorMessage(error), tone: 'error' });
        return;
      }

      const product = found.active[0];
      if (product) {
        if (mode === 'add') {
          if (await change(product, multiplier)) {
            haptic('success');
          }
        } else if (scanUseAction(product.container) === 'ask') {
          haptic('success');
          setResult(null);
          setPendingUse({ product, multiplier });
        } else if (await change(product, -multiplier)) {
          haptic('success');
        }
        return;
      }

      haptic('warning');
      const archived = found.archived[0];
      if (archived) {
        setResult({
          message: `${archived.name} is archived.`,
          action: { label: 'Restore', onPress: () => void restore(archived) },
        });
      } else if (mode === 'add') {
        await lookUpAndCreate(barcode, multiplier);
      } else {
        setResult({
          message: "This barcode isn't in your inventory.",
          action: {
            label: 'Create it',
            onPress: () => void exclusive(() => lookUpAndCreate(barcode, 1)),
          },
        });
      }
    });
    return true;
  }

  async function restore(product: WithId<Product>) {
    try {
      await setProductArchived(householdId, product.id, false);
      setResult({
        message: `Restored ${product.name} with ${formatCount(product.onHand, product.container)}. Scan it again to add or use.`,
      });
    } catch (error) {
      setResult({ message: inventoryErrorMessage(error), tone: 'error' });
    }
  }

  /** The answer to the quick sheet: packages per item, times the multiplier. */
  function applyUse(amount: number) {
    const pending = pendingUse;
    if (!pending) {
      return;
    }
    setPendingUse(null);
    void exclusive(async () => {
      await change(pending.product, -amount * pending.multiplier);
    });
  }

  return {
    handle,
    applyUse,
    cancelUse: () => setPendingUse(null),
    skipLookup,
    lookingUp,
    dismiss,
    /** Show a result that came from elsewhere, e.g. New product. */
    show: setResult,
    result,
    pendingUse,
    busy,
  };
}
