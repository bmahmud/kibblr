import { create } from 'zustand';

import { TOAST_MS } from '@/components/toast';
import { deleteProduct } from '@/firebase/repositories/products';

type PendingDeletes = {
  /** Products deleted on screen whose Undo toast is still up. */
  ids: string[];
};

export const usePendingDeletes = create<PendingDeletes>()(() => ({ ids: [] }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function release(productId: string) {
  timers.delete(productId);
  usePendingDeletes.setState((state) => ({ ids: state.ids.filter((id) => id !== productId) }));
}

/**
 * Deletes a product once its Undo toast has gone (spec section 6.10: destructive
 * actions are undoable for 6 seconds). Until then it is only hidden, so Undo
 * needs no write. If the app is closed first, nothing is deleted.
 */
export function scheduleProductDelete(
  householdId: string,
  productId: string,
  onError: (error: unknown) => void,
): { undo: () => void } {
  usePendingDeletes.setState((state) => ({ ids: [...state.ids, productId] }));
  timers.set(
    productId,
    setTimeout(() => {
      deleteProduct(householdId, productId)
        .catch(onError)
        .finally(() => release(productId));
    }, TOAST_MS),
  );
  return {
    undo: () => {
      clearTimeout(timers.get(productId));
      release(productId);
    },
  };
}
