import type { PetFields } from '@kibblr/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { usePets } from '@/features/pets/hooks';
import { PetForm } from '@/features/pets/pet-form';
import { updatePet } from '@/firebase/repositories/pets';
import { useTheme } from '@/theme';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { householdId } = useSignedIn();
  const toast = useToast();
  const pets = usePets();
  const { colors, spacing } = useTheme();

  if (pets.status === 'loading') {
    return <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />;
  }
  const pet = pets.status === 'ready' ? pets.data.find((p) => p.id === id) : undefined;
  if (!pet) {
    return (
      <EmptyState title="Pet not found" body={pets.status === 'error' ? pets.message : 'It may have been removed.'} />
    );
  }

  async function save(fields: PetFields) {
    try {
      await updatePet(householdId, id, fields);
      router.back();
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
    }
  }

  return <PetForm key={pet.id} initial={{ name: pet.name, species: pet.species, photo: pet.photo }} submitLabel="Save" onSubmit={save} />;
}
