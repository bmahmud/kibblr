import { defaultContainer, defaultSizeUnit, newProductDraft, normalizeGtin, parseMultiplier } from '@kibblr/core';
import type { ProductFields } from '@kibblr/core';
import { router, useLocalSearchParams } from 'expo-router';

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
 * `barcode`, its quantity per scan as `count`, and `method=scan`.
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
  // From the scanner, results go back to its card: the toast would be hidden behind it.
  const notify = fromScan ? setHandoff : toast.show;
  const actions = useStockActions(notify);

  async function save(fields: ProductFields, startingCount: number) {
    let productId: string;
    try {
      productId = await createProduct(householdId, newProductDraft(fields, barcode));
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

  return (
    <ProductForm
      unit={unit}
      submitLabel="Add product"
      onSubmit={save}
      barcode={barcode}
      initial={{
        mode: 'create',
        name: '',
        brand: '',
        category: 'wet',
        container: defaultContainer('wet'),
        sizeValue: '',
        sizeUnit: defaultSizeUnit(defaultContainer('wet'), unit),
        startingCount: String((params.count ? parseMultiplier(params.count) : null) ?? 1),
      }}
    />
  );
}
