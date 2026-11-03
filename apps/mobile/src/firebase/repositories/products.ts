import { productSchema } from '@kibblr/core';
import type { Product, ProductDraft, WithId } from '@kibblr/core';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';

export const productConverter = zodConverter(productSchema);

export const productsPath = (householdId: string) => collection(db, 'households', householdId, 'products');
export const productPath = (householdId: string, productId: string) =>
  doc(db, 'households', householdId, 'products', productId);

/**
 * Fields an edit may change. `onHand` is left out on purpose: every stock
 * change goes through `applyStockChange` (spec D4).
 */
export type ProductPatch = Partial<Omit<Product, 'onHand' | 'createdAt' | 'updatedAt'>>;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Live list of products, non-archived unless asked (History needs archived
 * ones for their names). A document that fails the schema is skipped, not fatal.
 */
export function watchProducts(
  householdId: string,
  options: { includeArchived: boolean },
  onNext: (products: WithId<Product>[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const base = productsPath(householdId);
  const q = (options.includeArchived ? query(base) : query(base, where('archived', '==', false))).withConverter(
    productConverter,
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const products: WithId<Product>[] = [];
      for (const document of snapshot.docs) {
        try {
          products.push(document.data());
        } catch (error) {
          console.warn(`Skipping product ${document.id}: it does not match the schema.`, error);
        }
      }
      onNext(products);
    },
    onError,
  );
}

/** Live product; `onNext(null)` if it does not exist. */
export function watchProduct(
  householdId: string,
  productId: string,
  onNext: (product: WithId<Product> | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    productPath(householdId, productId).withConverter(productConverter),
    (snapshot) => {
      try {
        onNext(snapshot.exists() ? snapshot.data() : null);
      } catch (error) {
        onError(toError(error));
      }
    },
    onError,
  );
}

/** Creates a product with nothing on hand; starting stock is added with `applyStockChange`. */
export async function createProduct(householdId: string, draft: ProductDraft): Promise<string> {
  const ref = await addDoc(productsPath(householdId), {
    ...draft,
    onHand: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(householdId: string, productId: string, patch: ProductPatch): Promise<void> {
  // The type already excludes it; this guards against a cast slipping through.
  if ('onHand' in patch) {
    throw new Error('updateProduct cannot change onHand.');
  }
  await updateDoc(productPath(householdId, productId), { ...patch, updatedAt: serverTimestamp() });
}

export function setProductArchived(householdId: string, productId: string, archived: boolean): Promise<void> {
  return updateProduct(householdId, productId, { archived });
}
