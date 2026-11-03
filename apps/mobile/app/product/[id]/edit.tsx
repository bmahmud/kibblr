import { productFormValues } from '@kibblr/core';
import type { ProductFields } from '@kibblr/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { usePreferredWeightUnit, useProduct } from '@/features/inventory/hooks';
import { ProductForm } from '@/features/inventory/product-form';
import { updateProduct } from '@/firebase/repositories/products';
import { useTheme } from '@/theme';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { householdId } = useSignedIn();
  const unit = usePreferredWeightUnit();
  const toast = useToast();
  const product = useProduct(id);
  const { colors } = useTheme();

  if (product.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (product.status === 'error' || product.data === null) {
    return (
      <EmptyState
        title="Product not found"
        body={product.status === 'error' ? product.message : 'It may have been removed.'}
      />
    );
  }

  async function save(fields: ProductFields) {
    try {
      await updateProduct(householdId, id, fields);
      router.back();
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    }
  }

  return (
    <ProductForm
      key={product.data.id}
      unit={unit}
      submitLabel="Save"
      onSubmit={save}
      initial={productFormValues(product.data, unit)}
    />
  );
}
