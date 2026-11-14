import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FiredAlerts } from '@kibblr/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NotificationPreferences = {
  /** Low-stock reminders on this phone. Permission is per phone too, so this isn't a household setting. */
  enabled: boolean;
  /** Whether the permission prompt has been shown after a scan (spec section 9: never at launch). */
  asked: boolean;
  /** Past-due reminders already scheduled, so each fires once per on-hand count (spec section 9). */
  fired: FiredAlerts;
  setEnabled: (enabled: boolean) => void;
  setAsked: () => void;
  setFired: (fired: FiredAlerts) => void;
};

export const useNotificationPreferences = create<NotificationPreferences>()(
  persist(
    (set) => ({
      enabled: true,
      asked: false,
      fired: {},
      setEnabled: (enabled) => set({ enabled }),
      setAsked: () => set({ asked: true }),
      setFired: (fired) => set({ fired }),
    }),
    {
      name: 'kibblr.notifications',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ enabled, asked, fired }) => ({ enabled, asked, fired }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<NotificationPreferences>;
        return {
          ...current,
          enabled: typeof saved.enabled === 'boolean' ? saved.enabled : current.enabled,
          asked: saved.asked === true,
          fired: isFired(saved.fired) ? saved.fired : {},
        };
      },
    },
  ),
);

function isFired(value: unknown): value is FiredAlerts {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (entry: unknown) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { onHand?: unknown }).onHand === 'number' &&
        typeof (entry as { at?: unknown }).at === 'number',
    )
  );
}
