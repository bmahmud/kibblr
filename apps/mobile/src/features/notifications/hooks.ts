import { lowStockAlertAt, effectiveRate, planLowStockAlerts } from '@kibblr/core';
import type { FiredAlerts, Product, WithId } from '@kibblr/core';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useHousehold } from '@/features/auth/use-household';
import { useHouseholdSettings, useLearnedRates, useProducts } from '@/features/inventory/hooks';

import {
  cancelLowStockAlerts,
  notificationPermission,
  reminderProductId,
  requestNotificationPermission,
  syncLowStockAlerts,
} from './low-stock';
import { useNotificationPreferences } from './preferences';

function sameFired(a: FiredAlerts, b: FiredAlerts): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key]?.onHand === b[key]?.onHand && a[key]?.at === b[key]?.at)
  );
}

/**
 * Keeps this phone's pending low-stock reminders in step with the data (spec
 * section 9). It replans whenever a product, a learned rate, a household
 * setting or the toggle changes, and on every foreground. A stock change is
 * a product change, so each `applyStockChange` reschedules, as do edits and
 * changes made on another phone.
 */
export function useLowStockScheduler(): void {
  const products = useProducts();
  const rates = useLearnedRates();
  const household = useHousehold();
  const settings = useHouseholdSettings();
  const { enabled, fired, setFired } = useNotificationPreferences();
  const [foreground, setForeground] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setForeground((n) => n + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  // Signing out unmounts this: leave no reminders for a household I can't open.
  useEffect(
    () => () => {
      void cancelLowStockAlerts().catch((error: unknown) => console.warn("Couldn't cancel reminders.", error));
    },
    [],
  );

  const data = products.status === 'ready' ? products.data : null;
  const loaded = household.status === 'ready';

  useEffect(() => {
    let cancelled = false;
    // Snapshots arrive in bursts (a stock change touches the product and the events); plan once.
    const timer = setTimeout(() => {
      void (async () => {
        if (!enabled) {
          await cancelLowStockAlerts();
          return;
        }
        if (!data || !loaded || (await notificationPermission()) !== 'granted' || cancelled) {
          return;
        }
        const plan = planLowStockAlerts(data, rates, settings, new Date(), fired);
        await syncLowStockAlerts(plan.alerts);
        if (!cancelled && !sameFired(plan.fired, fired)) {
          setFired(plan.fired);
        }
      })().catch((error: unknown) => console.warn("Couldn't schedule low-stock reminders.", error));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, data, loaded, rates, settings, fired, setFired, foreground]);
}

/** Opens the product when a low-stock reminder is tapped, including the one that launched the app. */
export function useReminderTaps(): void {
  useEffect(() => {
    function open(response: Notifications.NotificationResponse) {
      const productId = reminderProductId(response.notification);
      if (productId) {
        router.push({ pathname: '/product/[id]', params: { id: productId } });
        Notifications.clearLastNotificationResponse();
      }
    }
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);
}

/**
 * Asks for notification permission the first time a scan succeeds (spec
 * section 9: after the first successful scan, never at launch). Once only.
 */
export function askForRemindersAfterScan(): void {
  const { asked, enabled, setAsked } = useNotificationPreferences.getState();
  if (asked || !enabled) {
    return;
  }
  setAsked();
  void requestNotificationPermission().catch((error: unknown) =>
    console.warn("Couldn't ask for notification permission.", error),
  );
}

export type NextReminder =
  | { kind: 'scheduled'; at: Date }
  /** Already low and already reminded at this count. */
  | { kind: 'sent' }
  /** The rate is unknown, so there's nothing to predict. */
  | { kind: 'none' }
  | { kind: 'off' };

/** When this phone will remind me about a product: the same plan the scheduler uses. */
export function useNextReminder(product: WithId<Product>): NextReminder {
  const rates = useLearnedRates();
  const settings = useHouseholdSettings();
  const { enabled, fired } = useNotificationPreferences();
  if (!enabled) {
    return { kind: 'off' };
  }
  const now = new Date();
  const [alert] = planLowStockAlerts([product], rates, settings, now, fired).alerts;
  if (alert) {
    return { kind: 'scheduled', at: alert.date };
  }
  const rate = effectiveRate(product, rates.get(product.id));
  return !product.archived && lowStockAlertAt(product, settings, rate, now) ? { kind: 'sent' } : { kind: 'none' };
}
