import { buildExport, exportFileName } from '@kibblr/core';
import type { Household, WithId } from '@kibblr/core';
import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import { getEvents } from '@/firebase/repositories/events';
import { getPets } from '@/firebase/repositories/pets';
import { getProducts } from '@/firebase/repositories/products';
import { getRatings } from '@/firebase/repositories/ratings';

/**
 * Exports the household as JSON through the share sheet (spec section 6.8).
 * iOS shares a .json file, so it can be saved to Files; Android's share sheet
 * takes text only, so it gets the JSON as the message.
 *
 * Resolves to the counts exported, or null if the share sheet was dismissed.
 */
export async function exportHousehold(
  household: WithId<Household>,
): Promise<{ products: number; events: number } | null> {
  const householdId = household.id;
  const [pets, products, events] = await Promise.all([
    getPets(householdId),
    getProducts(householdId),
    getEvents(householdId),
  ]);
  const ratings = (
    await Promise.all(
      products.map(async (product) =>
        (await getRatings(householdId, product.id)).map((rating) => ({ ...rating, productId: product.id })),
      ),
    )
  ).flat();

  const now = new Date();
  const text = JSON.stringify(buildExport({ household, pets, products, ratings, events }, now), null, 2);

  let result;
  if (Platform.OS === 'ios') {
    const file = new File(Paths.cache, exportFileName(now));
    file.create({ overwrite: true });
    file.write(text);
    result = await Share.share({ url: file.uri });
  } else {
    result = await Share.share({ title: exportFileName(now), message: text });
  }
  return result.action === Share.dismissedAction ? null : { products: products.length, events: events.length };
}
