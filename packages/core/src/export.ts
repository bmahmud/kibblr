import type { Household, Pet, Product, Rating, StockEvent, WithId } from './schemas';

/**
 * Data export (spec section 6.8): everything in the household as JSON, for
 * the share sheet. Photos are flagged, not embedded (each can be 200 KB).
 */

export type ExportInput = {
  household: WithId<Household>;
  pets: readonly WithId<Pet>[];
  products: readonly WithId<Product>[];
  /** Ratings live under their product; the repository adds `productId`. */
  ratings: readonly (WithId<Rating> & { productId: string })[];
  events: readonly WithId<StockEvent>[];
};

/** Dates as ISO strings, so the value round-trips through JSON. */
type Jsonable<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

type WithoutPhoto<T> = Omit<Jsonable<T>, 'photo'> & { hasPhoto: boolean };

export type KibblrExport = {
  app: 'kibblr';
  version: 1;
  exportedAt: string;
  household: Jsonable<Omit<WithId<Household>, 'memberUids'>>;
  pets: WithoutPhoto<WithId<Pet>>[];
  products: WithoutPhoto<WithId<Product>>[];
  ratings: Jsonable<WithId<Rating> & { productId: string }>[];
  events: Jsonable<WithId<StockEvent>>[];
};

function jsonable<T extends object>(value: T): Jsonable<T> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    out[key] = field instanceof Date ? field.toISOString() : field;
  }
  return out as Jsonable<T>;
}

function withoutPhoto<T extends { photo: string | null }>(value: T): WithoutPhoto<T> {
  const { photo, ...rest } = value;
  return { ...jsonable(rest), hasPhoto: photo !== null } as WithoutPhoto<T>;
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function buildExport(input: ExportInput, now: Date): KibblrExport {
  // Member ids are account identifiers, not pantry data.
  const { id, name, settings, createdAt } = input.household;
  return {
    app: 'kibblr',
    version: 1,
    exportedAt: now.toISOString(),
    household: jsonable({ id, name, settings, createdAt }),
    pets: [...input.pets].sort(byId).map(withoutPhoto),
    products: [...input.products].sort(byId).map(withoutPhoto),
    ratings: [...input.ratings].sort(byId).map(jsonable),
    events: [...input.events].sort(byId).map(jsonable),
  };
}

/** "kibblr-export-2026-11-15.json", by the local date. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `kibblr-export-${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * History filtered to one pet (spec section 6.9). Few events name a pet, so
 * this also keeps events for the foods the pet eats or has rated.
 */
export function eventsForPet<T extends Pick<StockEvent, 'productId' | 'petId'>>(
  events: readonly T[],
  products: readonly (Pick<Product, 'petIds' | 'ratedBy'> & { id: string })[],
  petId: string,
): T[] {
  const foods = new Set(products.filter((p) => p.petIds.includes(petId) || p.ratedBy.includes(petId)).map((p) => p.id));
  return events.filter((event) => event.petId === petId || foods.has(event.productId));
}
