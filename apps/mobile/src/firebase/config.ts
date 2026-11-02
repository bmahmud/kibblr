import { z } from 'zod';

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` reads, so each
// variable is spelled out here rather than looked up dynamically.
const raw = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const ENV_NAMES: Record<keyof typeof raw, string> = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};

const firebaseConfigSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});

export type FirebaseConfig = z.infer<typeof firebaseConfigSchema>;

function readConfig(): FirebaseConfig {
  const result = firebaseConfigSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  const missing = result.error.issues
    .map((issue) => ENV_NAMES[issue.path[0] as keyof typeof raw])
    .filter((name): name is string => Boolean(name));
  throw new Error(
    `Missing Firebase config: ${missing.join(', ')}. Copy .env.example to apps/mobile/.env, fill it in, and restart Expo.`,
  );
}

export const firebaseConfig = readConfig();
