import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ToastOptions } from '@/components/toast';

export type ScanMode = 'add' | 'use';

type ScanSettings = {
  mode: ScanMode;
  setMode: (mode: ScanMode) => void;
  /**
   * A result from a screen opened over the scanner (New product), for the
   * scanner's card to show when it is back in view. Not persisted.
   */
  handoff: ToastOptions | null;
  setHandoff: (handoff: ToastOptions | null) => void;
};

/**
 * Scanner UI state that survives relaunches (spec section 6.3: the Add/Use
 * mode is remembered). The multiplier is not stored: it starts at x1 each
 * time, so a stray scan never adds a whole case.
 */
export const useScanSettings = create<ScanSettings>()(
  persist(
    (set) => ({
      mode: 'add',
      setMode: (mode) => set({ mode }),
      handoff: null,
      setHandoff: (handoff) => set({ handoff }),
    }),
    {
      name: 'kibblr.scan',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ mode }) => ({ mode }),
    },
  ),
);
