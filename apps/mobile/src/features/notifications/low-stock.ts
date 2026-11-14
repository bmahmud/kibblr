import type { LowStockAlert } from '@kibblr/core';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local low-stock reminders (spec section 9) through expo-notifications.
 * Local only: no push token, which Expo Go supports on both platforms.
 */

const PREFIX = 'lowstock:';
const CHANNEL = 'low-stock';

/** Show reminders that arrive while the app is open, too. Called once at startup. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
  });
}

export type PermissionState = 'granted' | 'undetermined' | 'denied';

export async function notificationPermission(): Promise<PermissionState> {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) {
    return 'granted';
  }
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Asks for permission if it can still be asked. Android only shows the prompt
 * once a channel exists, so the channel is created first.
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  await ensureChannel();
  const current = await notificationPermission();
  if (current !== 'undetermined') {
    return current;
  }
  const status = await Notifications.requestPermissionsAsync();
  return status.granted ? 'granted' : 'denied';
}

/** Android delivers nothing on a channel that doesn't exist. Creating it again is a no-op. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Low stock',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** What a reminder carries: the product to open when tapped, and its time, to tell whether it moved. */
type AlertData = { productId: string; at: number };

function alertData(content: Notifications.NotificationContent): Partial<AlertData> {
  const data = content.data as Record<string, unknown> | null | undefined;
  return {
    productId: typeof data?.productId === 'string' ? data.productId : undefined,
    at: typeof data?.at === 'number' ? data.at : undefined,
  };
}

/** The product a tapped reminder is about, or null if it isn't a low-stock reminder. */
export function reminderProductId(notification: Notifications.Notification): string | null {
  if (!notification.request.identifier.startsWith(PREFIX)) {
    return null;
  }
  return alertData(notification.request.content).productId ?? null;
}

/**
 * Makes the pending reminders match `alerts`: cancels the ones that are no
 * longer wanted or have moved, and schedules the new ones. Reminders that
 * haven't changed are left alone. Returns the number scheduled.
 */
export async function syncLowStockAlerts(alerts: readonly LowStockAlert[]): Promise<number> {
  await ensureChannel();
  const wanted = new Map(alerts.map((alert) => [alert.id, alert]));
  const pending = await Notifications.getAllScheduledNotificationsAsync();

  const unchanged = new Set<string>();
  for (const request of pending) {
    if (!request.identifier.startsWith(PREFIX)) {
      continue;
    }
    const alert = wanted.get(request.identifier);
    // The body changes with the verdict and with running out.
    if (alert && alertData(request.content).at === alert.date.getTime() && request.content.body === alert.body) {
      unchanged.add(request.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }

  let scheduled = 0;
  for (const alert of alerts) {
    if (unchanged.has(alert.id)) {
      continue;
    }
    const data: AlertData = { productId: alert.productId, at: alert.date.getTime() };
    await Notifications.scheduleNotificationAsync({
      identifier: alert.id,
      content: { title: alert.title, body: alert.body, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alert.date, channelId: CHANNEL },
    });
    scheduled += 1;
  }
  return scheduled;
}

/** Cancels every pending low-stock reminder (notifications turned off, or signed out). */
export async function cancelLowStockAlerts(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of pending) {
    if (request.identifier.startsWith(PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}
