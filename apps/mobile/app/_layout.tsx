import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { useTheme, useThemePreferences } from '@/theme';

// Keep the splash up until the persisted session has been restored, so a
// signed-in user never sees the sign-in screen flash on launch.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const appearance = useThemePreferences((state) => state.appearance);

  // Light or Dark from Settings overrides the phone's setting for the whole
  // app, native tab bar, alerts and pickers included; System follows the phone.
  useEffect(() => {
    Appearance.setColorScheme(appearance === 'system' ? 'auto' : appearance);
  }, [appearance]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          <ToastProvider>
            <RootStack />
          </ToastProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { state } = useAuth();
  const signedIn = state.status === 'signedIn';

  useEffect(() => {
    if (state.status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [state.status]);

  // The sign-in screen also covers 'loading' after a tap and 'error', so it
  // stays mounted (keeping its spinner or retry) until the household is ready.
  // Back buttons show only the chevron: the tab group's route name, "(tabs)", is not a title.
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="product/[id]/index" options={{ title: 'Product' }} />
        <Stack.Screen name="product/[id]/edit" options={{ title: 'Edit product', presentation: 'modal' }} />
        <Stack.Screen name="product/new" options={{ title: 'New product', presentation: 'modal' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="pet/new" options={{ title: 'New pet', presentation: 'modal' }} />
        <Stack.Screen name="pet/[id]/index" options={{ title: 'Pet' }} />
        <Stack.Screen name="pet/[id]/edit" options={{ title: 'Edit pet', presentation: 'modal' }} />
        <Stack.Screen
          name="rate/[productId]"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
