import { undoDelta } from '@kibblr/core';
import type { EventMethod } from '@kibblr/core';

import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';

import { inventoryErrorMessage } from './errors';
import { usePreferredWeightUnit } from './hooks';
import { stockChangeMessage } from './messages';
import { applyStockChange, setOnHand } from './stock';
import type { StockChangeResult } from './stock';

/**
 * Stock changes with the toast and Undo (spec section 6.10). Each action
 * resolves to the result, or null if it failed (the toast already says why).
 */
export function useStockActions() {
  const { user, householdId } = useSignedIn();
  const unit = usePreferredWeightUnit();
  const toast = useToast();
  const ctx = { householdId, uid: user.uid };

  async function undo(result: StockChangeResult, method: EventMethod) {
    try {
      await applyStockChange(ctx, {
        productId: result.product.id,
        delta: undoDelta(result.change.applied),
        method,
        note: 'undo',
      });
      toast.show({ message: `Undid the change to ${result.product.name}.` });
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    }
  }

  async function run(write: () => Promise<StockChangeResult>, method: EventMethod) {
    try {
      const result = await write();
      const message = stockChangeMessage(result.change, result.product, unit);
      toast.show(
        result.eventId === null
          ? { message }
          : { message, action: { label: 'Undo', onPress: () => void undo(result, method) } },
      );
      return result;
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return null;
    }
  }

  return {
    /** Adds (positive) or removes (negative) base units. */
    change: (productId: string, delta: number, method: EventMethod = 'manual') =>
      run(() => applyStockChange(ctx, { productId, delta, method }), method),
    setOnHand: (productId: string, target: number) => run(() => setOnHand(ctx, { productId, target }), 'manual'),
  };
}
