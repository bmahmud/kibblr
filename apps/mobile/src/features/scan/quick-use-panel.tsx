import { CONTAINER_LABELS, QUICK_USE, parseNumber, roundCount } from '@kibblr/core';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/theme';

import type { PendingUse } from './use-scan-flow';

const FRACTIONS: Record<(typeof QUICK_USE)[number], string> = {
  0.25: '¼',
  0.5: '½',
  1: '1',
};

type Props = {
  pending: PendingUse;
  onUse: (amount: number) => void;
  onCancel: () => void;
};

/** "How much did you use?" for a bag or tub scanned in Use mode (spec section 6.3, step 3). */
export function QuickUsePanel({ pending, onUse, onCancel }: Props) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const label = CONTAINER_LABELS[pending.product.container];
  const times = pending.multiplier > 1 ? ` × ${pending.multiplier}` : '';

  function applyCustom() {
    const value = parseNumber(custom);
    if (value === null || roundCount(value) === 0) {
      setError(`Enter how many ${label.many}, like 0.3.`);
      return;
    }
    onUse(roundCount(value));
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>
        How much {pending.product.name} did you use{times}?
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {QUICK_USE.map((amount) => (
          <Pressable
            key={amount}
            accessibilityRole="button"
            accessibilityLabel={`${amount} ${amount === 1 ? label.one : label.many}`}
            onPress={() => onUse(amount)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.primary : colors.surfaceRaised,
            })}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              {FRACTIONS[amount]} {label.one}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
        }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={`Other amount, in ${label.many}`}
            value={custom}
            onChangeText={setCustom}
            error={error}
            keyboardType="decimal-pad"
            placeholder="0.3"
          />
        </View>
        <Button label="Use" variant="secondary" onPress={applyCustom} />
      </View>
      <Button label="Cancel" variant="link" onPress={onCancel} />
    </View>
  );
}
