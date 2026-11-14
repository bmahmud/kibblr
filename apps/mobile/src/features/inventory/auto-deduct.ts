import { autoDeductPlan } from '@kibblr/core';
import type { Product, WithId } from '@kibblr/core';
import { useEffect, useEffectEvent, useRef } from 'react';
import { AppState } from 'react-native';

import { useSignedIn } from '@/features/auth/auth-provider';

import { useProducts } from './hooks';
import { applyAutoDeduct } from './stock';
import type { StockContext } from './stock';

/**
 * Applies auto-deduct to every product that is due (spec section 8). Each
 * product is its own transaction, which re-checks the plan, so running this
 * twice, or on two phones, deducts once. Failures (offline) wait for the next
 * foreground; auto never shows a toast or asks for a rating.
 */
export async function runAutoDeduct(
  ctx: StockContext,
  products: readonly WithId<Product>[],
  now: Date = new Date(),
): Promise<void> {
  for (const product of products) {
    if (product.archived || autoDeductPlan(product, now) === null) {
      continue;
    }
    try {
      await applyAutoDeduct(ctx, product.id, now);
    } catch (error) {
      console.warn(`Auto-deduct for ${product.id} failed; will retry on the next foreground.`, error);
    }
  }
}

/** Runs auto-deduct once the products have loaded, and each time the app comes to the foreground. */
export function useAutoDeduct(): void {
  const { user, householdId } = useSignedIn();
  const products = useProducts();
  const ready = products.status === 'ready';
  const running = useRef(false);

  const run = useEffectEvent(() => {
    if (products.status !== 'ready' || running.current) {
      return;
    }
    running.current = true;
    void runAutoDeduct({ householdId, uid: user.uid }, products.data).finally(() => {
      running.current = false;
    });
  });

  useEffect(() => {
    if (ready) {
      run();
    }
  }, [ready]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        run();
      }
    });
    return () => subscription.remove();
  }, []);
}
