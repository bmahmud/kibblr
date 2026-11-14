import { ean13Modules, formatGtin13 } from '@kibblr/core';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * A product's GTIN-13 drawn as a real EAN-13 symbol, dark bars on the white
 * image tile in every theme so a register scanner can read it off the screen.
 */
export function Barcode({ gtin, width }: { gtin: string; width: number }) {
  const { colors, spacing, typography } = useTheme();
  const modules = ean13Modules(gtin);
  if (!modules) {
    return null;
  }
  // Whole-pixel modules keep the bars crisp; the quiet zone is the padding.
  const module = Math.max(1, Math.floor((width - spacing.lg * 2) / modules.length));
  const runs: { on: boolean; length: number }[] = [];
  for (const on of modules) {
    const last = runs[runs.length - 1];
    if (last && last.on === on) {
      last.length += 1;
    } else {
      runs.push({ on, length: 1 });
    }
  }

  return (
    <View
      accessible
      accessibilityLabel={`Barcode ${gtin.split('').join(' ')}`}
      style={{
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.imageTile,
      }}>
      <View style={{ flexDirection: 'row', height: 64 }}>
        {runs.map((run, index) => (
          <View
            key={index}
            style={{ width: run.length * module, backgroundColor: run.on ? colors.barcodeInk : 'transparent' }}
          />
        ))}
      </View>
      <Text style={[typography.body, { color: colors.barcodeInk, fontVariant: ['tabular-nums'], letterSpacing: 2 }]}>
        {formatGtin13(gtin)}
      </Text>
    </View>
  );
}
