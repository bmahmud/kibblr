import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { firebaseConfig } from './config';

type FirebaseServices = { app: FirebaseApp; auth: Auth; db: Firestore };

function init(): FirebaseServices {
  // Fast Refresh can re-run this module; initializeAuth/initializeFirestore
  // throw if called twice for the same app, so reuse what already exists.
  if (getApps().length > 0) {
    const app = getApp();
    return { app, auth: getAuth(app), db: getFirestore(app) };
  }

  const app = initializeApp(firebaseConfig);
  // Without AsyncStorage persistence the session is lost on every restart.
  const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  return { app, auth, db };
}

export const { app, auth, db } = init();
