import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** How long a toast (and its Undo) stays up (spec section 6.10). */
export const TOAST_MS = 6000;

/** Clears the tab bar so the toast never covers it. */
const TAB_BAR_CLEARANCE = 64;

export type ToastOptions = {
  message: string;
  action?: { label: string; onPress: () => void };
  tone?: 'default' | 'error';
};

type ToastContextValue = {
  show: (toast: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** One toast at a time; a new one replaces the current one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const nextId = useRef(0);

  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: ++nextId.current });
    AccessibilityInfo.announceForAccessibility(options.message);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView toast={toast} onDismiss={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastOptions; onDismiss: () => void }) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: insets.bottom + TAB_BAR_CLEARANCE,
      }}>
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget,
          paddingLeft: spacing.lg,
          paddingRight: toast.action ? spacing.xs : spacing.lg,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          // Inverted surface so it stands out in both light and dark mode.
          backgroundColor: toast.tone === 'error' ? colors.statusOut : colors.text,
        }}>
        <Pressable style={{ flex: 1, paddingVertical: spacing.sm }} onPress={onDismiss} accessibilityHint="Dismisses">
          <Text style={[typography.body, { color: colors.background }]}>{toast.message}</Text>
        </Pressable>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            onPress={() => {
              onDismiss();
              toast.action?.onPress();
            }}
            style={({ pressed }) => ({
              minHeight: touchTarget,
              minWidth: touchTarget,
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={[typography.bodyStrong, { color: colors.primary }]}>{toast.action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}
