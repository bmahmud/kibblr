import { defaultInputUnit, newProductDraft } from '@kibblr/core';
import type { ProductFields } from '@kibblr/core';
import { router } from 'expo-router';

import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { usePreferredWeightUnit } from '@/features/inventory/hooks';
import { ProductForm } from '@/features/inventory/product-form';
import { useStockActions } from '@/features/inventory/use-stock-actions';
import { createProduct } from '@/firebase/repositories/products';

export default function NewProductScreen() {
  const { householdId } = useSignedIn();
  const unit = usePreferredWeightUnit();
  const toast = useToast();
  const actions = useStockActions();

  async function save(fields: ProductFields, startingAmount: number) {
    let productId: string;
    try {
      productId = await createProduct(householdId, newProductDraft(fields));
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return;
    }
    // Starting stock goes through the ledger like any other change, so
    // History begins with the first bag. Its toast (with Undo) says what happened.
    if (startingAmount > 0) {
      await actions.change(productId, startingAmount);
    } else {
      toast.show({ message: `Added ${fields.name}.` });
    }
    router.back();
  }

  return (
    <ProductForm
      unit={unit}
      submitLabel="Add product"
      onSubmit={save}
      initial={{
        mode: 'create',
        name: '',
        brand: '',
        category: 'dry',
        baseUnit: 'g',
        packageSize: '',
        packageUnit: defaultInputUnit('g', unit),
        startingPackages: '1',
      }}
    />
  );
}
