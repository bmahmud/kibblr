import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_THEME, THEMES } from './tokens';
import type { ThemeId } from './tokens';

export type Appearance = 'system' | 'light' | 'dark';

type ThemePreferences = {
  themeId: ThemeId;
  appearance: Appearance;
  setThemeId: (themeId: ThemeId) => void;
  setAppearance: (appearance: Appearance) => void;
};

/**
 * The color theme and light/dark choice from Settings. Per phone, not per
 * household: two people can share a pantry and still pick their own colors.
 */
export const useThemePreferences = create<ThemePreferences>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME,
      appearance: 'system',
      setThemeId: (themeId) => set({ themeId }),
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: 'kibblr.theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ themeId, appearance }) => ({ themeId, appearance }),
      // A theme removed in a later version falls back to the default.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ThemePreferences>;
        return {
          ...current,
          themeId: THEMES.some((t) => t.id === saved.themeId) ? (saved.themeId as ThemeId) : current.themeId,
          appearance:
            saved.appearance === 'light' || saved.appearance === 'dark' ? saved.appearance : current.appearance,
        };
      },
    },
  ),
);
