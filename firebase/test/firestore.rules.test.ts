import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  type Firestore,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  runTransaction,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const OWNER = 'owner-uid';
const STRANGER = 'stranger-uid';
const HID = 'household-1';

let env: RulesTestEnvironment;

/**
 * rules-unit-testing hands back the compat Firestore type; at runtime it works
 * with the modular API (as its own docs show), so narrow it in one place.
 */
function db(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore;
}

const owner = () => db(env.authenticatedContext(OWNER));
const stranger = () => db(env.authenticatedContext(STRANGER));
const anon = () => db(env.unauthenticatedContext());

const householdData = (memberUids: string[] = [OWNER]) => ({
  name: 'Home',
  memberUids,
  settings: { defaultLowStockDays: 7, notifyHour: 9, preferredWeightUnit: 'lb' },
  createdAt: Timestamp.now(),
});

const eventData = (createdBy: string) => ({
  productId: 'prod-1',
  petId: null,
  type: 'add',
  method: 'manual',
  delta: 12,
  onHandAfter: 12,
  note: null,
  createdAt: serverTimestamp(),
  createdBy,
});

/** Just the fields the rules check; the app's Zod schema covers the rest. */
const productData = (overrides: Record<string, unknown> = {}) => ({
  name: 'Food',
  container: 'can',
  onHand: 12,
  ...overrides,
});

/** Seed documents with rules off. */
async function seed(write: (fs: Firestore) => Promise<void>) {
  await env.withSecurityRulesDisabled((ctx) => write(db(ctx)));
}

async function seedHousehold() {
  await seed(async (fs) => {
    await setDoc(doc(fs, `households/${HID}`), householdData());
    await setDoc(doc(fs, `users/${OWNER}`), { householdId: HID });
    await setDoc(doc(fs, `households/${HID}/products/prod-1`), productData());
    await setDoc(doc(fs, `households/${HID}/products/prod-1/ratings/r1`), { reaction: 'loved' });
    await setDoc(doc(fs, `households/${HID}/pets/pet-1`), { name: 'Miso' });
    await setDoc(doc(fs, `households/${HID}/events/e1`), { ...eventData(OWNER), createdAt: Timestamp.now() });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kibblr',
    // Host and port come from FIRESTORE_EMULATOR_HOST, set by `firebase emulators:exec`.
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('signed-out users', () => {
  it('cannot read or create anything', async () => {
    await seedHousehold();
    await assertFails(getDoc(doc(anon(), `households/${HID}`)));
    await assertFails(getDoc(doc(anon(), `households/${HID}/products/prod-1`)));
    await assertFails(getDoc(doc(anon(), `users/${OWNER}`)));
    await assertFails(setDoc(doc(anon(), 'households/new'), householdData([])));
  });
});

describe('household bootstrap', () => {
  it('lets a user create their household and pointer in one batch', async () => {
    const fs = owner();
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'households/fresh'), { ...householdData(), createdAt: serverTimestamp() });
    batch.set(doc(fs, `users/${OWNER}`), { householdId: 'fresh' });
    await assertSucceeds(batch.commit());
  });

  it('rejects a household that lists someone else as a member', async () => {
    await assertFails(setDoc(doc(owner(), 'households/fresh'), householdData([STRANGER])));
    await assertFails(setDoc(doc(owner(), 'households/fresh'), householdData([OWNER, STRANGER])));
  });

  it("rejects a user pointer to a household they don't belong to", async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(stranger(), `users/${STRANGER}`), { householdId: HID }));
  });

  it('rejects a user pointer to a household that does not exist', async () => {
    await assertFails(setDoc(doc(owner(), `users/${OWNER}`), { householdId: 'nope' }));
  });

  it('rejects extra fields on the user pointer', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), `users/${OWNER}`), { householdId: HID, admin: true }));
  });
});

describe('users/{uid}', () => {
  it('is readable only by its owner', async () => {
    await seedHousehold();
    await assertSucceeds(getDoc(doc(owner(), `users/${OWNER}`)));
    await assertFails(getDoc(doc(stranger(), `users/${OWNER}`)));
  });

  it('cannot be written for another uid', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(stranger(), `users/${OWNER}`), { householdId: HID }));
  });

  it('cannot be deleted', async () => {
    await seedHousehold();
    await assertFails(deleteDoc(doc(owner(), `users/${OWNER}`)));
  });
});

describe('households/{hid}', () => {
  it('members can read and update settings', async () => {
    await seedHousehold();
    await assertSucceeds(getDoc(doc(owner(), `households/${HID}`)));
    await assertSucceeds(updateDoc(doc(owner(), `households/${HID}`), { 'settings.notifyHour': 8 }));
  });

  it('non-members cannot read or update', async () => {
    await seedHousehold();
    await assertFails(getDoc(doc(stranger(), `households/${HID}`)));
    await assertFails(updateDoc(doc(stranger(), `households/${HID}`), { name: 'Mine now' }));
  });

  it('memberUids cannot be changed, even by a member', async () => {
    await seedHousehold();
    await assertFails(updateDoc(doc(owner(), `households/${HID}`), { memberUids: [OWNER, STRANGER] }));
    await assertFails(updateDoc(doc(owner(), `households/${HID}`), { memberUids: [] }));
  });

  it('cannot be deleted', async () => {
    await seedHousehold();
    await assertFails(deleteDoc(doc(owner(), `households/${HID}`)));
  });

  it('a non-member cannot take over an existing household by re-creating it', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(stranger(), `households/${HID}`), householdData([STRANGER])));
  });
});

describe('subcollections', () => {
  const paths = [`households/${HID}/products/prod-1`, `households/${HID}/products/prod-1/ratings/r1`, `households/${HID}/pets/pet-1`];

  it.each(paths)('members can read and write %s', async (path) => {
    await seedHousehold();
    await assertSucceeds(getDoc(doc(owner(), path)));
    await assertSucceeds(setDoc(doc(owner(), path), { name: 'changed' }, { merge: true }));
  });

  it.each(paths)('non-members cannot read or write %s', async (path) => {
    await seedHousehold();
    await assertFails(getDoc(doc(stranger(), path)));
    await assertFails(setDoc(doc(stranger(), path), { name: 'changed' }, { merge: true }));
  });
});

describe('pets (photo size)', () => {
  const petPath = `households/${HID}/pets/pet-1`;
  const photo = (length: number) => 'data:image/jpeg;base64,' + 'A'.repeat(length - 23);

  it('accepts no photo, a null photo, or one up to 200 000 characters', async () => {
    await seedHousehold();
    await assertSucceeds(setDoc(doc(owner(), petPath), { name: 'Miso' }));
    await assertSucceeds(setDoc(doc(owner(), petPath), { name: 'Miso', photo: null }));
    await assertSucceeds(setDoc(doc(owner(), petPath), { name: 'Miso', photo: photo(200_000) }));
  });

  it('rejects a larger photo or one that is not a string', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), petPath), { name: 'Miso', photo: photo(200_001) }));
    await assertFails(setDoc(doc(owner(), petPath), { name: 'Miso', photo: 42 }));
  });
});

describe('events (append-only)', () => {
  const eventPath = `households/${HID}/events/e2`;

  it('members can read and create events stamped with their uid and the server time', async () => {
    await seedHousehold();
    await assertSucceeds(getDoc(doc(owner(), `households/${HID}/events/e1`)));
    await assertSucceeds(setDoc(doc(owner(), eventPath), eventData(OWNER)));
  });

  it('non-members cannot read or create events', async () => {
    await seedHousehold();
    await assertFails(getDoc(doc(stranger(), `households/${HID}/events/e1`)));
    await assertFails(setDoc(doc(stranger(), eventPath), eventData(STRANGER)));
  });

  it('rejects an event attributed to someone else', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), eventPath), eventData(STRANGER)));
  });

  it('rejects a client-chosen createdAt', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), eventPath), { ...eventData(OWNER), createdAt: Timestamp.now() }));
  });

  it('cannot be updated or deleted, even by a member', async () => {
    await seedHousehold();
    await assertFails(updateDoc(doc(owner(), `households/${HID}/events/e1`), { delta: 999 }));
    await assertFails(deleteDoc(doc(owner(), `households/${HID}/events/e1`)));
  });
});

describe('products (stock fields)', () => {
  const newPath = `households/${HID}/products/prod-2`;
  const existing = `households/${HID}/products/prod-1`;

  it('members can create a product with valid stock fields', async () => {
    await seedHousehold();
    await assertSucceeds(setDoc(doc(owner(), newPath), productData({ onHand: 0 })));
  });

  it('rejects negative on hand, on create and update', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), newPath), productData({ onHand: -1 })));
    await assertFails(updateDoc(doc(owner(), existing), { onHand: -0.5 }));
  });

  it('rejects a missing or non-numeric on hand', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), newPath), { name: 'Food', container: 'can' }));
    await assertFails(updateDoc(doc(owner(), existing), { onHand: '12' }));
  });

  it('rejects a missing or non-string container', async () => {
    await seedHousehold();
    await assertFails(setDoc(doc(owner(), newPath), { name: 'Food', onHand: 0 }));
    await assertFails(updateDoc(doc(owner(), existing), { container: 3 }));
  });

  it('allows the stock transaction: product update plus event create together', async () => {
    await seedHousehold();
    const fs = owner();
    const productRef = doc(fs, existing);
    await assertSucceeds(
      runTransaction(fs, async (tx) => {
        const snapshot = await tx.get(productRef);
        const onHand = (snapshot.data()?.onHand as number) - 1;
        tx.update(productRef, { onHand, updatedAt: serverTimestamp() });
        tx.set(doc(fs, `households/${HID}/events/e3`), {
          ...eventData(OWNER),
          type: 'remove',
          delta: -1,
          onHandAfter: onHand,
        });
      }),
    );
  });
});
