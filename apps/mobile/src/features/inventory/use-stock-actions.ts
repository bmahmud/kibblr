import { undoDelta } from '@kibblr/core';
import type { EventMethod } from '@kibblr/core';

import { useToast } from '@/components/toast';
import type { ToastOptions } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { maybePromptRating } from '@/features/ratings/prompt';

import { inventoryErrorMessage } from './errors';
import { stockChangeMessage } from './messages';
import { applyStockChange, setOnHand } from './stock';
import type { StockChangeResult } from './stock';

/**
 * Stock changes with the toast and Undo (spec section 6.10). Each action
 * resolves to the result, or null if it failed (the message already says why).
 *
 * A use that empties a product, or is its first, then asks for a rating
 * (spec section 6.5).
 *
 * `notify` replaces the toast where it can't be seen, such as the scanner,
 * a full-screen modal that covers it.
 */
export function useStockActions(notify?: (options: ToastOptions) => void) {
  const { user, householdId } = useSignedIn();
  const toast = useToast();
  const show = notify ?? toast.show;
  const ctx = { householdId, uid: user.uid };

  async function undo(result: StockChangeResult, method: EventMethod) {
    try {
      await applyStockChange(ctx, {
        productId: result.product.id,
        delta: undoDelta(result.change.applied),
        method,
        note: 'undo',
      });
      show({ message: `Undid the change to ${result.product.name}.` });
    } catch (error) {
      show({ message: inventoryErrorMessage(error), tone: 'error' });
    }
  }

  async function run(write: () => Promise<StockChangeResult>, method: EventMethod) {
    try {
      const result = await write();
      const message = stockChangeMessage(result.change, result.product);
      show(
        result.eventId === null
          ? { message }
          : { message, action: { label: 'Undo', onPress: () => void undo(result, method) } },
      );
      // Undo comes through `undo` above, so it never prompts.
      void maybePromptRating(householdId, result, method);
      return result;
    } catch (error) {
      show({ message: inventoryErrorMessage(error), tone: 'error' });
      return null;
    }
  }

  return {
    /** Adds (positive) or removes (negative) packages. */
    change: (productId: string, delta: number, method: EventMethod = 'manual') =>
      run(() => applyStockChange(ctx, { productId, delta, method }), method),
    setOnHand: (productId: string, target: number) => run(() => setOnHand(ctx, { productId, target }), 'manual'),
  };
}
