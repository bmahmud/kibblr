import type { LowStockAlert } from '@kibblr/core';
import * as Notifications from 'expo-notifications';

import { cancelLowStockAlerts, syncLowStockAlerts } from './low-stock';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn((request: { identifier: string }) => Promise.resolve(request.identifier)),
}));

const mocked = jest.mocked(Notifications);

function alert(productId: string, date: Date, body = `Running low on ${productId}.`): LowStockAlert {
  return { id: `lowstock:${productId}`, productId, date, title: productId, body };
}

function pending(identifier: string, at: number, body = 'Running low on x.') {
  return { identifier, content: { title: 'x', body, data: { productId: 'x', at } }, trigger: null };
}

const nov17 = new Date(2026, 10, 17, 9);
const nov20 = new Date(2026, 10, 20, 9);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncLowStockAlerts', () => {
  it('schedules new reminders for the date, with the product to open', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    await expect(syncLowStockAlerts([alert('a', nov17)])).resolves.toBe(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'lowstock:a',
      content: { title: 'a', body: 'Running low on a.', data: { productId: 'a', at: nov17.getTime() } },
      trigger: { type: 'date', date: nov17, channelId: 'low-stock' },
    });
  });

  it('leaves unchanged reminders alone and moves the ones whose date changed', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      pending('lowstock:a', nov17.getTime(), 'Running low on a.'),
      pending('lowstock:b', nov17.getTime(), 'Running low on b.'),
    ] as unknown as Notifications.NotificationRequest[]);

    await syncLowStockAlerts([alert('a', nov17), alert('b', nov20)]);

    expect(mocked.cancelScheduledNotificationAsync.mock.calls).toEqual([['lowstock:b']]);
    expect(mocked.scheduleNotificationAsync.mock.calls.map(([r]) => r.identifier)).toEqual(['lowstock:b']);
  });

  it('reschedules when the text changes, and cancels reminders no longer wanted', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      pending('lowstock:a', nov17.getTime(), 'Running low on a.'),
      pending('lowstock:gone', nov17.getTime()),
      pending('something-else', nov17.getTime()),
    ] as unknown as Notifications.NotificationRequest[]);

    await syncLowStockAlerts([alert('a', nov17, 'Running low on a. You usually reorder this.')]);

    expect(mocked.cancelScheduledNotificationAsync.mock.calls).toEqual([['lowstock:a'], ['lowstock:gone']]);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('cancelLowStockAlerts', () => {
  it('cancels only low-stock reminders', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      pending('lowstock:a', 1),
      pending('other', 1),
    ] as unknown as Notifications.NotificationRequest[]);
    await cancelLowStockAlerts();
    expect(mocked.cancelScheduledNotificationAsync.mock.calls).toEqual([['lowstock:a']]);
  });
});
