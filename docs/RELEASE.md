# Releasing Kibblr to TestFlight

Run these from `apps/mobile`, signed in to your own Expo and Apple accounts. Nothing here needs a Mac: EAS builds in the cloud.

## One-time setup

1. **Log in and link the project**

   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   `init` creates the `kibblr` project in your Expo account and prints its project ID. `app.config.ts` is TypeScript, so EAS can't write the ID itself. Paste it into `EAS_PROJECT_ID` at the top of `app.config.ts` and commit. That also turns on EAS Update for builds made afterwards.

2. **Give the builds the app's public config**

   Cloud builds don't see the git-ignored `.env`. Push its values to each EAS environment:

   ```sh
   npx eas-cli@latest env:push --environment production --path .env
   npx eas-cli@latest env:push --environment preview --path .env
   ```

   The values are all `EXPO_PUBLIC_*`, so they're public by design (they end up in the app bundle). Choose "plain text" or "sensitive" visibility if asked; don't choose "secret", because `EXPO_PUBLIC_*` values must be readable at build time.

   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`
   - `EXPO_PUBLIC_API_URL`

   Check them with `npx eas-cli@latest env:list --environment production`.

## Each release

3. **Build**

   ```sh
   npx eas-cli@latest build -p ios --profile production
   ```

   The first time, EAS asks to sign in to your Apple account. It registers the bundle ID `com.bmahmud.kibblr` and creates the distribution certificate and provisioning profile. Let it manage them. The build number goes up by itself (`autoIncrement`, with versions stored on EAS).

4. **Submit to TestFlight**

   ```sh
   npx eas-cli@latest submit -p ios --latest
   ```

   The first time, it creates the app in App Store Connect. The name "Kibblr" must be free; if it's taken, change the app name in App Store Connect, not the bundle ID. The build then goes through Apple's processing, usually 10 to 30 minutes.

5. **Install**

   In App Store Connect, go to Kibblr > TestFlight > Internal Testing. Add yourself as a tester, then install from the TestFlight app on your iPhone.

TestFlight builds expire after 90 days (spec section 12). Rebuild and resubmit before then.

## JavaScript-only fixes (EAS Update)

Once `EAS_PROJECT_ID` is set and a build includes it, a JS-only change can skip the build:

```sh
npx eas-cli@latest update --channel production --environment production --message "Fix ..."
```

The app picks it up on its next launch or two. An update only reaches builds with the same app `version` (`runtimeVersion` policy `appVersion`). So bump `version` in `app.config.ts` when native code or config changes, and make a new build.

## Profiles (`eas.json`)

- `production`: TestFlight and the App Store.
- `preview`: an internal build you install straight from the EAS page (register the iPhone with `eas device:create` first).
- `development`: a dev client. Run `npx expo install expo-dev-client` before the first use.
