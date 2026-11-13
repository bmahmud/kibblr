import { DEFAULT_HOUSEHOLD_SETTINGS } from '@kibblr/core';
import type { HouseholdSettings, Product, StockEvent, WeightUnit, WithId } from '@kibblr/core';

import { watchEvents } from '@/firebase/repositories/events';
import { watchProduct, watchProducts } from '@/firebase/repositories/products';
import { useSignedIn } from '@/features/auth/auth-provider';
import { useHousehold } from '@/features/auth/use-household';
import { useSubscription } from '@/lib/use-subscription';

import { usePendingDeletes } from './pending-delete';

/** Live products: non-archived, or all of them for History. */
export function useProducts(options: { includeArchived?: boolean } = {}) {
  const { householdId } = useSignedIn();
  const includeArchived = options.includeArchived ?? false;
  const products = useSubscription<WithId<Product>[]>(
    `products:${householdId}:${includeArchived ? 'all' : 'active'}`,
    (onNext, onError) => watchProducts(householdId, { includeArchived }, onNext, onError),
    "Couldn't load your products.",
  );
  // Products waiting out their Undo toast are already gone as far as I can see.
  const pending = usePendingDeletes((state) => state.ids);
  if (products.status !== 'ready' || pending.length === 0) {
    return products;
  }
  return { ...products, data: products.data.filter((product) => !pending.includes(product.id)) };
}

/** The household's settings for stock status; defaults until it has loaded. */
export function useHouseholdSettings(): HouseholdSettings {
  const household = useHousehold();
  return household.status === 'ready' ? household.household.settings : DEFAULT_HOUSEHOLD_SETTINGS;
}

/** Live single product (archived ones too); data is null if it doesn't exist. */
export function useProduct(productId: string) {
  const { householdId } = useSignedIn();
  return useSubscription<WithId<Product> | null>(
    `product:${householdId}:${productId}`,
    (onNext, onError) => watchProduct(householdId, productId, onNext, onError),
    "Couldn't load this product.",
  );
}

/** Live events, newest first, optionally for one product. */
export function useEvents(options: { productId?: string | null; max: number }) {
  const { householdId } = useSignedIn();
  const { productId = null, max } = options;
  return useSubscription<WithId<StockEvent>[]>(
    `events:${householdId}:${productId ?? '*'}:${max}`,
    (onNext, onError) => watchEvents(householdId, { productId, max }, onNext, onError),
    "Couldn't load the history.",
  );
}

/** The household's display unit. */
export function usePreferredWeightUnit(): WeightUnit {
  return useHouseholdSettings().preferredWeightUnit;
}
