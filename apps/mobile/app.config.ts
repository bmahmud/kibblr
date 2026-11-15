import type { ExpoConfig } from 'expo/config';

// Bundle ID owner confirmed 2026-11-15 (spec section 15, open question 1).
// It can't change once the app is in App Store Connect.
const BUNDLE_ID = 'com.bmahmud.kibblr';

// The EAS project this app builds and updates under. `eas init` prints it;
// it is an identifier, not a secret. Until it is set, builds have no EAS Update.
const EAS_PROJECT_ID = '';

// The Kibblr orange behind the icon and splash.
const BRAND = '#C8742E';

const config: ExpoConfig = {
  name: 'Kibblr',
  slug: 'kibblr',
  scheme: 'kibblr',
  version: '1.0.0',
  // An update reaches only builds with the same app version (spec section 12: EAS Update for JS-only fixes).
  runtimeVersion: { policy: 'appVersion' },
  ...(EAS_PROJECT_ID
    ? { updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` }, extra: { eas: { projectId: EAS_PROJECT_ID } } }
    : {}),
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    icon: './assets/expo.icon',
    supportsTablet: false,
    // Only HTTPS and the OS's own encryption: no export compliance questions per build.
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: BRAND,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'Kibblr uses the camera to scan pet food barcodes.',
        // Barcodes only: no video or audio is recorded.
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Kibblr uses your photos to set a picture of your pet.',
        cameraPermission: 'Kibblr uses the camera to take a picture of your pet.',
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        // Low-stock reminders are scheduled on the phone (spec section 9): no push, so no APNs entitlement.
        enableRemoteNotifications: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: BRAND,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
