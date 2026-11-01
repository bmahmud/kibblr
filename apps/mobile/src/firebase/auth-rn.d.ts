import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

// firebase/auth's public types are the web build's, which omit this export.
// At runtime Metro resolves @firebase/auth through its "react-native" export
// condition, whose build does export it.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
