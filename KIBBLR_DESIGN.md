# Kibblr: Design Spec

A personal pet food inventory app. Scan a barcode to add stock, scan again (or tap) to use it, get warned before you run out, and record whether your pet liked the food and whether to reorder.

> **For Claude Code:** Read this whole file before writing code. Build in the phases at the bottom, one phase at a time, and stop for review after each. Where this spec says "decision", it is settled; where it says "open question", ask me.

---

## 1. Goals and non-goals

**Goals**
- Know exactly what pet food is at home, per product, in real units.
- Add stock by scanning; remove stock by scanning or manual entry. Manual add/subtract is always available.
- Warn me before I run out (on-device notifications).
- Record per-pet ratings and a clear "reorder / skip" verdict per product.
- Run as a standalone app on my iPhone (TestFlight), no dev server.

**Non-goals (for now)**
- Public App Store release, subscriptions, affiliate links.
- Server-pushed notifications (design leaves room for it, see section 11).
- Android polish (should still work, but iOS is the target).

---

## 2. Stack (final)

| Layer | Choice |
|---|---|
| App | React Native + Expo (latest stable SDK at scaffold time), TypeScript strict, expo-router |
| Database | Firebase Firestore (JS SDK, not react-native-firebase) |
| Auth | Firebase Auth, email/password (see decision D2) |
| Barcode lookup API | Cloudflare Worker (Hono) + KV cache |
| Local state | Zustand (UI state only; Firestore snapshots are the source of truth for data) |
| Validation | Zod |
| Camera/scanning | expo-camera (`CameraView` + `onBarcodeScanned`) |
| Notifications | expo-notifications (local scheduling only) |
| Other Expo libs | expo-haptics, expo-secure-store, @react-native-async-storage/async-storage |
| Builds | EAS Build, EAS Submit to TestFlight, EAS Update for JS-only fixes |
| Code | GitHub; GitHub Actions for lint, typecheck, tests |
| Tests | Jest (jest-expo) for app logic, Vitest for the Worker, Firebase emulator + `@firebase/rules-unit-testing` for security rules |

**Decisions**
- **D1.** Firebase JS SDK, so it works in Expo Go during early development.
- **D2.** Email/password auth, **not anonymous**. Anonymous UIDs are tied to the install, so reinstalling the app would orphan all data. Sign in with Apple can be added later.
- **D3.** Data model uses a `households` root even though I am the only user, so sharing with family later needs no migration.
- **D4.** All stock changes go through one function that writes an event and updates the product in a single Firestore transaction (section 5.3). No screen writes `onHand` directly.

---

## 3. Repository layout

npm workspaces monorepo (Expo auto-configures Metro for monorepos in recent SDKs).

```
kibblr/
├─ apps/
│  └─ mobile/                  # Expo app
│     ├─ app/                  # expo-router routes
│     │  ├─ (auth)/sign-in.tsx
│     │  ├─ (tabs)/
│     │  │  ├─ index.tsx       # Inventory
│     │  │  ├─ shopping.tsx    # Shopping list
│     │  │  ├─ pets.tsx
│     │  │  └─ settings.tsx
│     │  ├─ scan.tsx           # Full-screen scanner (modal)
│     │  ├─ product/[id].tsx
│     │  ├─ product/new.tsx
│     │  └─ history.tsx
│     ├─ src/
│     │  ├─ firebase/          # init, auth, converters, repositories
│     │  ├─ features/          # inventory, scan, pets, ratings, notifications
│     │  ├─ components/
│     │  ├─ theme/             # design tokens
│     │  └─ lib/
│     ├─ app.config.ts
│     └─ eas.json
├─ workers/
│  └─ barcode-api/             # Cloudflare Worker (Hono)
│     ├─ src/index.ts
│     ├─ test/
│     └─ wrangler.toml
├─ packages/
│  └─ core/                    # Pure TS, no RN/Firebase imports
│     └─ src/                  # types + zod schemas, units, gtin, runway
├─ firebase/
│  ├─ firebase.json
│  ├─ firestore.rules
│  └─ firestore.indexes.json
├─ .github/workflows/ci.yml
├─ CLAUDE.md                   # short conventions file (section 13)
└─ KIBBLR_DESIGN.md            # this file
```

`packages/core` holds everything that must be unit-tested without a device: unit conversion, GTIN normalization and validation, runway/low-stock math, and the Zod schemas shared by the app and the Worker.

---

## 4. Domain concepts

- **Product**: a specific food (brand + name + type), optionally linked to a barcode. Types: dry, wet, pate, treat, supplement, other.
- **Container**: what one package is: can, pouch, tray, bag, box, tub, bottle or item.
- **On hand**: how many packages of a product I have ("12 cans", "1.5 bags"), never its weight. Stored as a number of packages rounded to hundredths, so float drift never accumulates.
- **Size**: optional net weight or volume of one package (e.g. a 3 oz can), stored in `g` or `ml` and shown in lb/oz/fl oz or kg/g/ml. Reference only; no stock math uses it.
- **Scan step**: one scan adds one package. For multipacks, the scan screen has a quantity multiplier (x1, x12, custom).
- **Event**: immutable ledger entry for every stock change. History and consumption-rate learning are built on it.
- **Rating**: a pet's reaction to a product (loved / ok / refused) with an optional comment.
- **Verdict**: my explicit decision on a product: `reorder`, `skip`, or `undecided`. Ratings inform it; I set it.

---

## 5. Data model (Firestore)

All documents live under `households/{hid}`. Timestamps are Firestore `Timestamp`. Stock amounts are numbers of packages.

### 5.1 Collections

```
households/{hid}
  name: string
  memberUids: string[]                 # [uid] for now
  settings: {
    defaultLowStockDays: number        # default 7
    notifyHour: number                 # local hour for alerts, default 9
    preferredWeightUnit: 'lb' | 'kg'
  }
  createdAt: Timestamp

households/{hid}/pets/{petId}
  name: string
  species: 'cat' | 'dog' | 'other'
  photo: string | null                 # 256 px JPEG data URI, at most 200 000 chars
  archived: boolean
  createdAt: Timestamp

households/{hid}/products/{productId}
  barcode: string | null               # normalized GTIN-13, null if manual
  name: string
  brand: string
  category: 'dry' | 'wet' | 'pate' | 'treat' | 'supplement' | 'other'
  container: 'can' | 'pouch' | 'tray' | 'bag' | 'box' | 'tub' | 'bottle' | 'item'
  size: { amount: number, unit: 'g' | 'ml' } | null   # one package's net weight/volume, display only
  onHand: number                       # packages; never negative; hundredths
  dailyUsage: number | null            # packages per day, all pets combined
  autoDeduct: boolean                  # apply dailyUsage automatically
  lastAutoDeductAt: Timestamp | null
  lowStock: { mode: 'days' | 'amount', value: number } | null   # null = household default
  petIds: string[]                     # pets that eat this
  ratedBy: string[]                    # pets with a rating of this, for the Pets view
  verdict: 'reorder' | 'skip' | 'undecided'
  verdictNote: string | null
  reorderUrl: string | null            # where I buy it
  imageUrl: string | null
  photo: string | null                 # my own photo, 384 px JPEG data URI; shown instead of imageUrl
  source: 'manual' | 'lookup'
  archived: boolean
  createdAt: Timestamp
  updatedAt: Timestamp

households/{hid}/products/{productId}/ratings/{ratingId}
  petId: string
  reaction: 'loved' | 'ok' | 'refused'
  comment: string | null
  createdAt: Timestamp

households/{hid}/events/{eventId}      # append-only
  productId: string
  petId: string | null
  type: 'add' | 'remove' | 'adjust'
  method: 'scan' | 'manual' | 'feeding' | 'auto'
  delta: number                        # signed, packages
  onHandAfter: number
  note: string | null
  createdAt: Timestamp
  createdBy: string                    # uid
```

### 5.2 Indexes
- `events`: `productId ASC, createdAt DESC` and `createdAt DESC`.
- `products`: single-field index on `barcode` is automatic.

### 5.3 The one write path for stock changes

`applyStockChange({ productId, delta, method, petId?, note? })` in `src/features/inventory/stock.ts`:

1. `runTransaction`: read product; compute `next = max(0, onHand + delta)`; if clamped, record the real applied delta.
2. In the same transaction: update `onHand`/`updatedAt` and create the event with `onHandAfter`.
3. Return `{ before, after, eventId }` so the UI can offer **Undo** (which calls `applyStockChange` with the inverse delta, `method` preserved, note `"undo"`).
4. After commit, call `rescheduleLowStockNotification(product)`.

Removing more than what is on hand clamps to 0 and the UI tells me.

### 5.4 Security rules (`firebase/firestore.rules`)

Rules are the only real protection (the Firebase web config is not secret). Events are append-only.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isMember(hid) {
      return request.auth != null &&
        request.auth.uid in get(/databases/$(database)/documents/households/$(hid)).data.memberUids;
    }

    match /households/{hid} {
      allow read: if isMember(hid);
      allow create: if request.auth != null
        && request.resource.data.memberUids == [request.auth.uid];
      // membership is immutable for now
      allow update: if isMember(hid)
        && request.resource.data.memberUids == resource.data.memberUids;
      allow delete: if false;

      match /pets/{id}     { allow read, write: if isMember(hid); }
      match /products/{id} {
        allow read, write: if isMember(hid);
        match /ratings/{rid} { allow read, write: if isMember(hid); }
      }
      match /events/{id} {
        allow read, create: if isMember(hid);
        allow update, delete: if false;
      }
    }
  }
}
```

Write rules tests with the emulator: non-member denied, member allowed, event update/delete denied, `memberUids` cannot be changed.

---

## 6. Screens and flows

### 6.1 Navigation
Tabs: **Inventory**, **Shopping**, **Pets**, **Settings**. A floating **Scan** button on Inventory opens the scanner modal. Product detail and History are pushed screens.

### 6.2 Inventory (home)
- List of non-archived products grouped by status: **Low / Out**, **OK**.
- Each row: name, brand and size (e.g. "Fancy Feast · 3 oz can"), on-hand count (e.g. "12 cans"), runway ("~9 days" when `dailyUsage` is known), verdict badge, pet avatars.
- Search and filter by pet and category.
- Row swipe: quick **-** (use) and **+** (add) one package.
- Pull to refresh is unnecessary (live snapshots) but harmless.

### 6.3 Scanner (`scan.tsx`)
- Full-screen camera, `barcodeScannerSettings.barcodeTypes: ['ean13','ean8','upc_a','upc_e']`.
- Persistent segmented control: **Add** | **Use**. Mode is remembered between launches.
- Debounce: ignore the same code for 2 seconds. Haptic on successful scan.
- Torch toggle, and a **Enter manually** button that opens the manual flow.
- Flow on scan, after normalizing the code to GTIN-13:
  1. Query `products` where `barcode == code` and `archived == false`.
  2. **Found + Add mode:** `applyStockChange(+1 * multiplier, method: 'scan')`. Show a toast: "Added 1 can of Salmon Feast. Undo". Multiplier chip row (x1, x2, x12, custom) stays on screen.
  3. **Found + Use mode:** default action removes one `dailyUsage` day if known, otherwise opens a quick sheet: `1/4 | 1/2 | 1 package | custom`. Applies with `method: 'scan'` and shows Undo.
  4. **Not found:** call the Worker (section 7). On hit, open **New product** prefilled; on miss, open it empty with only the barcode filled. After save, apply the pending add if the mode was Add.
  5. **Use mode + not found:** tell me this barcode is not in inventory; offer to create it.
- If the Worker is unreachable, fall through to the empty manual form. Scanning must never be blocked by the network.

### 6.4 Product detail
- Header: name, brand, image, on-hand count, size, runway.
- Tapping the image takes or picks my own photo (or removes it). Lookup packshots are shown whole on a white tile, not cropped.
- **Barcode**: the GTIN-13 drawn as an EAN-13 symbol with its digits, and Copy.
- **Archive** or **Delete**. Delete asks first, then waits out the 6-second Undo toast before removing the product and its ratings. Its events stay (the ledger is append-only); History skips them.
- Big **+ / -** buttons (one package) plus a free-entry number of packages (Use, Add, Set on hand). Every path calls `applyStockChange`.
- New / Edit product: name, brand, type, container (defaults from type: wet and pate → can, dry and treat → bag), optional size, and on create how many are on hand now.
- **Usage**: daily amount, auto-deduct toggle, which pets eat it.
- **Low-stock rule**: household default or custom (days / amount).
- **Feedback**: per-pet rating buttons (loved / ok / refused), comment field, **Verdict** control (Reorder / Skip / Undecided) with a note, optional `reorderUrl`.
- Recent events list (last 20) with link to full History.

### 6.5 Rating prompt
Prompt "How did {pet} like it?" at two moments, both dismissible and never blocking:
- When `onHand` reaches 0 for a product.
- The first time a product is used (Use mode) after being added.
Prompt has three reaction buttons, an optional comment, and a Reorder / Skip / Undecided chip row.
- "First used" means the change is the product's first `remove` event in the ledger. Any use counts (scanner, product detail, swipe); `auto` and Undo never prompt.
- Each prompt shows at most once per product per app session, as a sheet over whatever is open (the scanner included).
- It asks about the product's `petIds`, or every active pet when none are set, with a chip to pick between them.

### 6.6 Shopping tab
- Products that are low/out **and** verdict is not `skip`, sorted by runway.
- Products low/out with verdict `skip` appear in a collapsed "Not reordering" section so I notice if I still need an alternative.
- Row action: **Open store link** (`reorderUrl`) or copy product name.
- Share list as text.

### 6.7 Pets
CRUD for pets; archive instead of delete. Per-pet view lists products they eat and their ratings.
- "Products they eat" means the product's `petIds` or `ratedBy` includes the pet, so a rating always shows on the pet's page.
- A pet can have a photo, taken or picked and cropped square. It is stored on the pet document as a small JPEG (no Cloud Storage), and shown wherever the pet appears.

### 6.8 Settings
Notification toggle and hour, default low-stock days, weight unit, sign out, export data (JSON via share sheet), app version.
- **Appearance** (System / Light / Dark) and **Color theme** (Kibble, Ocean, Sage, Berry; each tints backgrounds and the accent, in light and dark). Saved per phone, not per household. Built ahead of Phase 7.

### 6.9 History
Chronological events with filter by product and pet; each row shows delta, method, and note.

### 6.10 UX rules
- Every destructive or inventory-changing action is undoable via toast for 6 seconds, except archive (reversible from settings).
- Empty states explain the next step ("Scan your first bag").
- Dark mode supported through theme tokens. Large touch targets; one-hand use.
- Every tab starts with the Kibblr mark above its title.
- Offline: the Firestore JS SDK in React Native uses an in-memory cache only, so writes made offline are queued while the app stays open but are lost if the app is killed. Show a small "Offline" banner when `NetInfo` reports no connection and warn before exiting the scanner with pending writes.

---

## 7. Cloudflare Worker: barcode lookup (`workers/barcode-api`)

Purpose: hide the third-party API key, normalize results, and cache so each barcode is looked up once.

### 7.1 Endpoint
`GET /v1/barcode/:code`
- Header: `Authorization: Bearer <Firebase ID token>`.
- `200`: `{ barcode, name, brand, category?, container?, size?: { amount, unit: 'g' | 'ml' }, imageUrl?, source, cached }`. Here `source` is the database that answered (`openpetfoodfacts | openfoodfacts | upcitemdb`), not the product's `manual | lookup`. The schema is `barcodeLookupSchema` in `packages/core`.
- `404`: `{ error: "not_found" }`: every upstream said it doesn't know the code (cached 1 day).
- `400`: invalid code. `401`: bad token. `429`: rate limited. `502`: an upstream failed and none found it (not cached).
- `GET /health` for a trivial check (no auth).

### 7.2 Behavior
1. **Verify token** with `jose` against Google's public keys (JWKS at `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`). Check `iss = https://securetoken.google.com/<FIREBASE_PROJECT_ID>`, `aud = <FIREBASE_PROJECT_ID>`, expiry.
2. **Normalize** the code with `packages/core` (strip non-digits, left-pad to 13, validate GTIN check digit).
3. **KV cache** key `bc:<gtin13>`. Hits cached 30 days; misses cached 1 day.
4. **Upstreams, in order** (stop at first usable result):
   1. Open Pet Food Facts
   2. Open Food Facts
   3. UPCitemdb (uses secret key if provided, otherwise the trial endpoint)
   Each upstream call has a 3-second timeout. Map every response into the common shape; parse package size text (e.g. "12 lb", "5.5 oz") with the shared unit parser. Verify each upstream's current API and terms while implementing, and handle partial data gracefully (name only is fine).
5. Basic per-user rate limit (Workers Rate Limiting binding if available; otherwise skip and rely on cache).

### 7.3 Config
- `wrangler.toml`: KV namespace binding `BARCODE_CACHE`; var `FIREBASE_PROJECT_ID`.
- Secret via `wrangler secret put UPCITEMDB_KEY` (optional).
- Deploy with `wrangler deploy`; app reads `EXPO_PUBLIC_API_URL`.
- Tests (Vitest): normalization, token rejection, cache hit/miss, upstream fallback, timeout handling with mocked `fetch`.

---

## 8. Consumption and low-stock logic (`packages/core`)

All functions are pure and unit-tested.

- `runwayDays(product, learnedRate?)`: `onHand / effectiveRate`; `null` if no rate. `effectiveRate = dailyUsage ?? learnedRate`.
- `isLow(product, household)`:
  - mode `days`: `runwayDays <= value` (if runway is null, fall back to `onHand <= 1`: the last package is low).
  - mode `amount`: `onHand <= value` (packages).
  - Out is `onHand === 0`.
- `learnedRate(events)`: from `remove` events with method `scan|manual|feeding` over the last 30 days, `sum(delta) / days_covered`. Needs at least 7 days of data; otherwise `null`. Phase 6.
- `autoDeduct`: on app foreground, for each product with `autoDeduct && dailyUsage`, compute whole days since `lastAutoDeductAt` and call `applyStockChange` once with `method: 'auto'`, then set `lastAutoDeductAt`. Idempotent per day.
- Package counts: format with container plurals ("1 can", "12 cans", "1.5 bags"); round to hundredths when stored.
- Size units (lb, oz, kg, g, cup, fl oz, ml) with parse/format helpers: stored as whole g/ml, displayed with one decimal.

---

## 9. Notifications (`expo-notifications`, local only)

- Ask permission after the first successful scan, not at launch.
- For each product with a known runway: schedule one date-triggered notification at `(predicted runout date) - lowStockDays`, at `settings.notifyHour` local time. Identifier `lowstock:<productId>`. Body names the product and mentions the verdict ("You usually reorder this").
- **Reschedule** (cancel + schedule) after every `applyStockChange`, on product edit, on app foreground, and when settings change.
- If the date is already past and the product is still low, fire a single notification the next `notifyHour`, then do not repeat until stock changes.
- Products with verdict `skip` get a different message: "Running low on X (marked skip). Pick an alternative."
- iOS allows at most 64 pending local notifications; schedule only the soonest 50 products.
- Tapping a notification deep-links to the product (or the Shopping tab).

---

## 10. Auth and bootstrap

- `src/firebase/init.ts`: `initializeApp`, then `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` (without this, sessions are lost on every restart), `initializeFirestore(app, { experimentalAutoDetectLongPolling: true })` for React Native reliability.
- Config from `EXPO_PUBLIC_FIREBASE_*` env vars (`.env`, git-ignored; `.env.example` committed).
- On first sign-in with no household: create `households/{hid}` with `memberUids: [uid]` and defaults; store `hid` in `users/{uid}` (`{ householdId }`) so it can be found again; rules for `users/{uid}` allow only that uid.
- Auth gate in the root layout redirects to `(auth)/sign-in` when signed out.
- Add `users/{uid}` rule to the rules file when implementing this step.

---

## 11. Future-proofing (do not build yet)
- Add a second `memberUid` to share the household; rules already support it; add an invite flow.
- Server push: Cloud Function on `products` writes plus FCM, for when someone else uses up the last of the food.
- Smart scale, recall alerts, price-per-unit tracking, affiliate reorder links.

---

## 12. Build and release

- `app.config.ts`: name "Kibblr", slug `kibblr`, `ios.bundleIdentifier` `com.<owner>.kibblr` (**open question: confirm owner before first EAS build; hard to change later**), `expo-camera` plugin with a clear `cameraPermission` string, `expo-notifications` plugin.
- `eas.json` profiles: `development` (dev client, optional), `preview` (internal), `production` (auto-increment build number). Configure `eas update` channels matching profiles.
- Release path: Apple Developer enrollment (individual) -> `eas build -p ios --profile production` -> `eas submit -p ios` -> internal TestFlight tester. TestFlight builds expire after 90 days, so rebuild and resubmit before then.
- CI (`.github/workflows/ci.yml`): install, lint, typecheck, `packages/core` and Worker tests, Firestore rules tests with the emulator. Builds are triggered manually, not on every push.

---

## 13. Conventions (also put a short version in `CLAUDE.md`)

- TypeScript strict; no `any`. Zod-parse all data read from Firestore and from the Worker at the boundary.
- Pure logic lives in `packages/core` and gets unit tests first.
- All stock changes go through `applyStockChange`; never write `onHand` elsewhere.
- Firestore access only through `src/firebase/repositories`; screens use hooks, not raw SDK calls.
- No secrets in the app bundle. `EXPO_PUBLIC_*` values are public by design.
- Small commits; one phase per branch; run lint, typecheck, and tests before each commit.
- Do not add dependencies without saying why.

---

## 14. Build phases (stop for review after each)

**Phase 0: Scaffold.** Monorepo, Expo app with expo-router, `packages/core` wired in, theme tokens, CI, `.env.example`, `CLAUDE.md`. *Done when:* app opens in Expo Go and CI passes.

**Phase 1: Auth and data foundation.** Firebase init with persistence, sign-in/up, household bootstrap, Firestore rules + emulator tests, repositories, Zod schemas. *Done when:* I can sign up, kill the app, reopen it still signed in, and rules tests pass.

**Phase 2: Manual inventory.** Product CRUD, `applyStockChange` with undo, Inventory list, product detail with +/-, history, unit handling. *Done when:* manual add/use works, events are recorded, and `core` unit tests cover units and clamping.

**Phase 3: Scanning.** Scanner modal, Add/Use modes, multiplier, unknown-barcode manual flow (no Worker yet). *Done when:* scanning a known barcode adds/removes with undo, and an unknown barcode lets me create the product.

**Phase 4: Worker lookup.** Worker with auth, cache, upstream fallback, deploy; app integration with graceful failure. *Done when:* scanning a new barcode prefills the form and a repeat scan is served from cache.

**Phase 5: Pets, ratings, verdicts, shopping list.** Pet CRUD, rating prompts, verdict control, Shopping tab. *Done when:* running out of a product prompts for a rating and verdict, and the Shopping tab reflects it.

**Phase 6: Prediction and notifications.** `dailyUsage`, auto-deduct, runway, learned rate, local notification scheduling. *Done when:* a product with usage set schedules a notification for the right date and it reschedules after a stock change.

**Phase 7: Release.** Polish, empty states, data export, EAS profiles, first TestFlight build.

---

## 15. Open questions (ask me before assuming)
1. Bundle ID owner string.
2. ~~Which pets and species to seed on first run.~~ Answered: none. The Pets tab starts empty.
3. Preferred default units (lb/oz vs kg/g) on the input forms.
4. Whether wet food multipacks should default the scan multiplier to 12 or 1.
