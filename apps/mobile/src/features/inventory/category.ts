import type { Category } from '@kibblr/core';

/** How each food type is named and pictured across the app. */
export const CATEGORY_DISPLAY: Record<Category, { label: string; icon: string }> = {
  dry: { label: 'Dry', icon: '🥣' },
  wet: { label: 'Wet', icon: '🥫' },
  pate: { label: 'Pate', icon: '🐟' },
  treat: { label: 'Treat', icon: '🦴' },
  supplement: { label: 'Supplement', icon: '💊' },
  other: { label: 'Other', icon: '📦' },
};
