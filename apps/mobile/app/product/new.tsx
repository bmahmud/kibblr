import {
  LOOKUP_SOURCE_LABELS,
  defaultContainer,
  defaultSizeUnit,
  lookupFormInput,
  newProductDraft,
  normalizeGtin,
  parseMultiplier,
} from '@kibblr/core';
import type { ProductFields, ProductFormInput } from '@kibblr/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { usePreferredWeightUnit } from '@/features/inventory/hooks';
import { ProductForm } from '@/features/inventory/product-form';
import { useStockActions } from '@/features/inventory/use-stock-actions';
import { useScanSettings } from '@/features/scan/scan-store';
import { createProduct } from '@/firebase/repositories/products';

/**
 * New product, by hand or from the scanner. The scanner passes the unknown
 * `barcode`, its quantity per scan as `count`, and `method=scan`, and leaves
 * what the barcode lookup found (if anything) in the scan store's `prefill`.
 */
export default function NewProductScreen() {
  const params = useLocalSearchParams<{
    barcode?: string;
    count?: string;
    method?: string;
  }>();
  const barcode = params.barcode ? normalizeGtin(params.barcode) : null;
  const fromScan = params.method === 'scan';
  const { householdId } = useSignedIn();
  const unit = usePreferredWeightUnit();
  const toast = useToast();
  const setHandoff = useScanSettings((s) => s.setHandoff);
  // Read once: the form keeps its own state from here on.
  const [prefill] = useState(() => {
    const found = useScanSettings.getState().prefill;
    return found && found.barcode === barcode ? found : null;
  });
  useEffect(() => () => useScanSettings.getState().setPrefill(null), []);
  // From the scanner, results go back to its card: the toast would be hidden behind it.
  const notify = fromScan ? setHandoff : toast.show;
  const actions = useStockActions(notify);

  async function save(fields: ProductFields, startingCount: number) {
    let productId: string;
    try {
      productId = await createProduct(
        householdId,
        newProductDraft(fields, barcode, prefill ? { imageUrl: prefill.imageUrl ?? null } : undefined),
      );
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return;
    }
    // Starting stock goes through the ledger like any other change, so
    // History begins with the first can. Its message (with Undo) says what happened.
    if (startingCount > 0) {
      await actions.change(productId, startingCount, fromScan ? 'scan' : 'manual');
    } else {
      notify({ message: `Added ${fields.name}.` });
    }
    router.back();
  }

  const startingCount = String((params.count ? parseMultiplier(params.count) : null) ?? 1);
  const initial: ProductFormInput = prefill
    ? lookupFormInput(prefill, unit, startingCount)
    : {
        mode: 'create',
        name: '',
        brand: '',
        category: 'wet',
        container: defaultContainer('wet'),
        sizeValue: '',
        sizeUnit: defaultSizeUnit(defaultContainer('wet'), unit),
        startingCount,
        petIds: [],
        reorderUrl: '',
      };

  return (
    <ProductForm
      unit={unit}
      submitLabel="Add product"
      onSubmit={save}
      barcode={barcode}
      lookup={prefill ? { imageUrl: prefill.imageUrl ?? null, sourceLabel: LOOKUP_SOURCE_LABELS[prefill.source] } : null}
      initial={initial}
    />
  );
}
