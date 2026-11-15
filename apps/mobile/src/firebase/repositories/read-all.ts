import { getDocs } from 'firebase/firestore';
import type { Query } from 'firebase/firestore';

/**
 * Reads a converted query once, for the data export. Like the live
 * listeners, a document that fails the schema is skipped, not fatal.
 */
export async function readAll<T>(q: Query<T>, kind: string): Promise<T[]> {
  const snapshot = await getDocs(q);
  const items: T[] = [];
  for (const document of snapshot.docs) {
    try {
      items.push(document.data());
    } catch (error) {
      console.warn(`Skipping ${kind} ${document.id}: it does not match the schema.`, error);
    }
  }
  return items;
}
