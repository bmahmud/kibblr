import { NativeTabs } from 'expo-router/native-tabs';

import { useAutoDeduct } from '@/features/inventory/auto-deduct';
import { useLowStockScheduler, useReminderTaps } from '@/features/notifications/hooks';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <>
      <SignedInTasks />
      <NativeTabs
        backgroundColor={colors.surface}
        indicatorColor={colors.surfaceRaised}
        labelStyle={{ selected: { color: colors.primary } }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Inventory</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} md="inventory_2" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="shopping">
          <NativeTabs.Trigger.Label>Shopping</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} md="shopping_cart" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="pets">
          <NativeTabs.Trigger.Label>Pets</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="pawprint.fill" md="pets" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}

/**
 * Work that runs while signed in, whatever screen is open: auto-deduct,
 * low-stock reminders and reminder taps. Its own component, so the data it
 * watches doesn't re-render the tab bar.
 */
function SignedInTasks() {
  useAutoDeduct();
  useLowStockScheduler();
  useReminderTaps();
  return null;
}
