export {
  BASE_UNITS,
  DISPLAY_UNITS,
  UNIT_LABELS,
  baseUnitOf,
  defaultSizeUnit,
  formatNumber,
  formatSize,
  fromBase,
  isBaseUnit,
  parseNumber,
  roundBase,
  sizeDisplayUnit,
  toBase,
} from './units';
export type { BaseUnit, DisplayUnit, Size } from './units';

export { CONTAINER_LABELS, defaultContainer, formatCount, formatCountDelta, roundCount } from './count';

export * from './schemas';

export { DEFAULT_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_SETTINGS, newHousehold } from './household';
export type { NewHousehold } from './household';

export { MIN_PASSWORD_LENGTH, validateCredentials } from './auth';
export type { AuthMode, CredentialErrors, CredentialInput } from './auth';

export { computeAdjustment, computeStockChange, undoDelta } from './stock';
export type { StockChange } from './stock';

export { groupInventory, runwayDays, stockStatus } from './inventory';
export type { InventoryFilter, InventoryItem, InventoryProduct, StockStatus } from './inventory';

export { newProductDraft, productFormValues, validateProductForm } from './product-form';
export type { ProductDraft, ProductFields, ProductFormErrors, ProductFormInput, ProductFormResult } from './product-form';

export { formatRelativeTime } from './time';

export { ean13Modules, expandUpcE, formatGtin13, isValidGtin, normalizeGtin } from './gtin';
export type { BarcodeHint } from './gtin';

export { QUICK_USE, SCAN_DEBOUNCE_MS, parseMultiplier, scanUseAction, shouldHandleScan } from './scan';
export type { LastScan } from './scan';

export { parseSizeText } from './size';

export { LOOKUP_SOURCES, LOOKUP_SOURCE_LABELS, barcodeLookupSchema, lookupFormInput } from './lookup';
export type { BarcodeLookup, LookupSource } from './lookup';

export { PET_NAME_MAX, SPECIES_LABELS, activePets, newPetDraft, petFoods, petInitials, validatePetForm } from './pets';
export type { PetDraft, PetFields, PetFormResult } from './pets';

export {
  NOTE_MAX,
  REACTION_LABELS,
  VERDICT_LABELS,
  latestRatingByPet,
  promptPets,
  ratingPromptReason,
  validateNote,
} from './ratings';
export type { RatingPromptReason } from './ratings';

export { shoppingList, shoppingListText } from './shopping';
export type { ShoppingItem, ShoppingProduct } from './shopping';
