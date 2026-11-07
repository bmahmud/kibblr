import { newPetDraft } from '@kibblr/core';
import type { PetFields } from '@kibblr/core';
import { router } from 'expo-router';

import { useToast } from '@/components/toast';
import { useSignedIn } from '@/features/auth/auth-provider';
import { inventoryErrorMessage } from '@/features/inventory/errors';
import { PetForm } from '@/features/pets/pet-form';
import { createPet } from '@/firebase/repositories/pets';

export default function NewPetScreen() {
  const { householdId } = useSignedIn();
  const toast = useToast();

  async function save(fields: PetFields) {
    try {
      await createPet(householdId, newPetDraft(fields));
    } catch (error) {
      toast.show({ message: inventoryErrorMessage(error), tone: 'error' });
      return;
    }
    toast.show({ message: `Added ${fields.name}.` });
    router.back();
  }

  return <PetForm initial={{ name: '', species: 'cat' }} submitLabel="Add pet" onSubmit={save} />;
}
