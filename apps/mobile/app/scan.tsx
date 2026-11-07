import { parseMultiplier, shouldHandleScan } from '@kibblr/core';
import type { BarcodeHint, LastScan } from '@kibblr/core';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { TextField } from '@/components/text-field';
import { QuickUsePanel } from '@/features/scan/quick-use-panel';
import { ResultCard } from '@/features/scan/result-card';
import { useScanSettings } from '@/features/scan/scan-store';
import type { ScanMode } from '@/features/scan/scan-store';
import { useScanFlow } from '@/features/scan/use-scan-flow';
import { useTheme } from '@/theme';

const BARCODE_TYPES: BarcodeHint[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

const MODES: { value: ScanMode; label: string }[] = [
  { value: 'add', label: 'Add' },
  { value: 'use', label: 'Use' },
];

type MultiplierChoice = '1' | '2' | '12' | 'custom';

const MULTIPLIERS: { value: MultiplierChoice; label: string }[] = [
  { value: '1', label: 'x1' },
  { value: '2', label: 'x2' },
  { value: '12', label: 'x12' },
  { value: 'custom', label: 'Custom' },
];

function noop() {}

function isBarcodeHint(type: string): type is BarcodeHint {
  return (BARCODE_TYPES as string[]).includes(type);
}

/** Full-screen scanner (spec section 6.3). */
export default function ScanScreen() {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const mode = useScanSettings((s) => s.mode);
  const setMode = useScanSettings((s) => s.setMode);
  const flow = useScanFlow();
  const showResult = flow.show;

  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  // Starts at x1 every session (spec open question 4).
  const [choice, setChoice] = useState<MultiplierChoice>('1');
  const [customText, setCustomText] = useState('');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const lastScan = useRef<LastScan | null>(null);

  // Pause the camera while New product is open on top, and turn the torch off.
  // Also pick up what New product reported, since its toast would be hidden behind the scanner.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      const { handoff, setHandoff } = useScanSettings.getState();
      if (handoff) {
        showResult(handoff);
        setHandoff(null);
      }
      return () => {
        setFocused(false);
        setTorch(false);
      };
    }, [showResult]),
  );

  const multiplier = choice === 'custom' ? parseMultiplier(customText) : Number(choice);

  function onScanned({ data, type }: BarcodeScanningResult) {
    if (!focused || flow.pendingUse || multiplier === null) {
      return;
    }
    const now = Date.now();
    if (!shouldHandleScan(lastScan.current, data, now)) {
      return;
    }
    if (flow.handle(data, mode, multiplier, isBarcodeHint(type) ? type : undefined)) {
      lastScan.current = { code: data, at: now };
    }
  }

  function submitTyped() {
    if (multiplier === null || !typed.trim()) {
      return;
    }
    if (flow.handle(typed, mode, multiplier)) {
      setTyped('');
      setTyping(false);
    }
  }

  const pill = {
    minHeight: touchTarget,
    minWidth: touchTarget,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  };

  const camera = permission?.granted ? (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      active={focused}
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
      onBarcodeScanned={focused ? onScanned : undefined}
    />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {camera}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={() => router.back()}
          style={pill}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Close</Text>
        </Pressable>
        {permission?.granted ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Torch"
            accessibilityState={{ checked: torch }}
            onPress={() => setTorch((on) => !on)}
            style={[pill, torch ? { backgroundColor: colors.primary } : null]}>
            <Text style={[typography.bodyStrong, { color: torch ? colors.onPrimary : colors.text }]}>
              {torch ? 'Torch on' : 'Torch'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}>
        {permission === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : permission.granted ? (
          <View
            accessible
            accessibilityLabel="Point the camera at a barcode"
            style={{
              width: '80%',
              aspectRatio: 1.8,
              borderRadius: radius.lg,
              borderWidth: 3,
              borderColor: flow.busy ? colors.statusLow : colors.primary,
            }}
          />
        ) : (
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Text style={[typography.title, { color: colors.text, textAlign: 'center' }]}>Scan barcodes</Text>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Kibblr uses the camera only to read barcodes on cans and bags. Nothing is recorded.
            </Text>
            <Button
              label={permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
              onPress={() => void (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            />
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              You can still type a barcode below.
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{
            maxHeight: 460,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            backgroundColor: colors.surface,
          }}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.md,
          }}>
          {flow.pendingUse ? (
            <QuickUsePanel pending={flow.pendingUse} onUse={flow.applyUse} onCancel={flow.cancelUse} />
          ) : (
            <>
              {flow.busy && !flow.lookingUp ? <ActivityIndicator color={colors.primary} /> : null}
              {flow.lookingUp ? (
                <ResultCard
                  sticky
                  result={{
                    message: 'Not in your inventory yet. Looking it up…',
                    action: { label: 'Skip', onPress: flow.skipLookup },
                  }}
                  onDismiss={noop}
                />
              ) : null}
              {flow.result ? <ResultCard result={flow.result} onDismiss={flow.dismiss} /> : null}

              <Chips label="Scan mode" options={MODES} selected={mode} onSelect={setMode} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {mode === 'add' ? 'Each scan adds' : 'Each scan uses'}
                {multiplier === null ? '…' : ` ${multiplier}`}
              </Text>
              <Chips label="Quantity per scan" options={MULTIPLIERS} selected={choice} onSelect={setChoice} />
              {choice === 'custom' ? (
                <TextField
                  label="Quantity per scan"
                  value={customText}
                  onChangeText={setCustomText}
                  error={customText && multiplier === null ? 'Enter a whole number from 1 to 99.' : undefined}
                  keyboardType="number-pad"
                  placeholder="24"
                />
              ) : null}

              {typing ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: spacing.sm,
                  }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Barcode number"
                      value={typed}
                      onChangeText={setTyped}
                      keyboardType="number-pad"
                      placeholder="012345678905"
                      autoFocus
                      returnKeyType="go"
                      onSubmitEditing={submitTyped}
                    />
                  </View>
                  <Button label="Go" onPress={submitTyped} disabled={flow.busy || multiplier === null} />
                </View>
              ) : (
                <Button label="Type a barcode" variant="link" onPress={() => setTyping(true)} />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
