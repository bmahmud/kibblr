# Kibblr

Personal pet food inventory app. The full spec is `KIBBLR_DESIGN.md`. Build one phase at a time (section 14) and stop for review after each. "Decision" in the spec is settled; "open question" (section 15) means ask first.

## Layout

- `apps/mobile`: Expo app (SDK 58, expo-router). Routes are in `app/`, everything else in `src/`.
- `packages/core`: pure TypeScript domain logic (`@kibblr/core`). No React Native, Expo or Firebase imports; ESLint enforces this.
- `firebase/` (`@kibblr/firebase`): Firestore rules, indexes and emulator tests.
- `workers/barcode-api` (`@kibblr/barcode-api`): Cloudflare Worker (Hono) for barcode lookup. `createApp` in `src/app.ts` takes its keys, upstreams and `fetch` as arguments so tests run in Node with mocks. The app calls it through `src/api/barcode.ts`.
- App Firebase code: `src/firebase/init.ts` (the only place Firebase is initialized), `src/firebase/auth.ts`, `src/firebase/converters.ts` (`zodConverter`: Timestamps become Dates, then the core schema parses), `src/firebase/repositories/`. Auth state comes from `useAuth()` / `useSignedIn()` in `src/features/auth`.

## Commands (run from the repo root)

- `npm run check`: lint, typecheck and tests across all workspaces. Run it before every commit.
- `npm run lint` / `npm run typecheck` / `npm test`
- `npm run test:rules`: Firestore rules tests on the emulator (needs Java 21+). Not part of `npm test`.
- `npm run deploy -w @kibblr/firebase`: deploy rules and indexes to the `kibblr` project (needs `firebase login`).
- `npm start -w @kibblr/mobile`: Expo dev server
- `npm run deploy -w @kibblr/barcode-api` / `npm run tail -w @kibblr/barcode-api`: deploy the Worker, watch its logs (needs `npx wrangler login`).
- In `apps/mobile`, add app dependencies with `npx expo install <pkg>` so versions match the SDK.

## Conventions

- TypeScript strict, no `any`. Zod-parse all data from Firestore and the Worker at the boundary.
- Pure logic goes in `packages/core` with unit tests written first (Vitest). App tests use Jest (`jest-expo`).
- All stock changes go through `applyStockChange` (`src/features/inventory/stock.ts`), which runs the one transaction in `src/firebase/repositories/stock.ts`. Never write `onHand` anywhere else. Stock math (clamping, rounding, units) lives in `@kibblr/core`.
- Stock changes made through `useStockActions` may open the rating sheet (`app/rate/[productId].tsx`, through `maybePromptRating` in `src/features/ratings/prompt.ts`). Undo and `auto` never do.
- Firestore access only through `src/firebase/repositories`; screens use hooks, never raw SDK calls.
- Any rules change gets an emulator test in `firebase/test/`.
- Colors, spacing and type come from `src/theme` (`useTheme()`). No hard-coded hex values in components.
- No secrets in the app bundle. `EXPO_PUBLIC_*` values are public by design.
- Small commits, one phase per branch.
- Do not add a dependency without saying why.
- Expo APIs change every SDK. Check the SDK 58 docs instead of relying on memory (see `apps/mobile/AGENTS.md`).
