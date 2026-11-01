# Kibblr

Personal pet food inventory app. The full spec is `KIBBLR_DESIGN.md`. Build one phase at a time (section 14) and stop for review after each. "Decision" in the spec is settled; "open question" (section 15) means ask first.

## Layout

- `apps/mobile`: Expo app (SDK 58, expo-router). Routes are in `app/`, everything else in `src/`.
- `packages/core`: pure TypeScript domain logic (`@kibblr/core`). No React Native, Expo or Firebase imports; ESLint enforces this.
- `workers/barcode-api`: Cloudflare Worker (Phase 4). `firebase/`: rules and indexes (Phase 1).

## Commands (run from the repo root)

- `npm run check`: lint, typecheck and tests across all workspaces. Run it before every commit.
- `npm run lint` / `npm run typecheck` / `npm test`
- `npm start -w @kibblr/mobile`: Expo dev server
- In `apps/mobile`, add app dependencies with `npx expo install <pkg>` so versions match the SDK.

## Conventions

- TypeScript strict, no `any`. Zod-parse all data from Firestore and the Worker at the boundary.
- Pure logic goes in `packages/core` with unit tests written first (Vitest). App tests use Jest (`jest-expo`).
- All stock changes go through `applyStockChange`. Never write `onHand` anywhere else.
- Firestore access only through `src/firebase/repositories`; screens use hooks, never raw SDK calls.
- Colors, spacing and type come from `src/theme` (`useTheme()`). No hard-coded hex values in components.
- No secrets in the app bundle. `EXPO_PUBLIC_*` values are public by design.
- Small commits, one phase per branch.
- Do not add a dependency without saying why.
- Expo APIs change every SDK. Check the SDK 58 docs instead of relying on memory (see `apps/mobile/AGENTS.md`).
