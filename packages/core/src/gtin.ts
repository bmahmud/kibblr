/**
 * Barcode normalization (spec sections 6.3 and 7.2). Every barcode is stored
 * and looked up as a GTIN-13, so the same product matches whether it was read
 * as UPC-A, EAN-13, EAN-8 or UPC-E, or typed in by hand.
 */

/** The barcode symbologies the scanner reads; only UPC-E changes how a code is read. */
export type BarcodeHint = 'ean13' | 'ean8' | 'upc_a' | 'upc_e';

/** True when the last digit is the correct GS1 check digit for the rest. */
export function isValidGtin(digits: string): boolean {
  if (!/^\d{8,14}$/.test(digits)) {
    return false;
  }
  let sum = 0;
  // Weights alternate 3, 1 from the digit next to the check digit.
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** Expands an 8-digit UPC-E (number system 0 or 1) to its 12-digit UPC-A, or null. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) {
    return null;
  }
  const ns = code.slice(0, 1);
  const d = code.slice(1, 7);
  const check = code.slice(7);
  const last = d.slice(5);
  let body: string;
  if (last === '0' || last === '1' || last === '2') {
    body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  } else if (last === '3') {
    body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  } else if (last === '4') {
    body = `${d.slice(0, 4)}00000${d.slice(4, 5)}`;
  } else {
    body = `${d.slice(0, 5)}0000${last}`;
  }
  return `${ns}${body}${check}`;
}

/**
 * Raw scanned or typed text to a valid GTIN-13, or null. Strips non-digits,
 * expands UPC-E, drops a GTIN-14's leading zero, left-pads and checks the
 * check digit. `hint` is the type the scanner reported, if any.
 */
export function normalizeGtin(raw: string, hint?: BarcodeHint): string | null {
  const digits = raw.replace(/\D/g, '');

  let code: string | null = digits;
  if (digits.length === 8 && (hint === 'upc_e' || (hint === undefined && !isValidGtin(digits)))) {
    code = expandUpcE(digits);
  } else if (digits.length === 14) {
    code = digits.startsWith('0') ? digits.slice(1) : null;
  }

  if (code === null || ![8, 12, 13].includes(code.length) || !isValidGtin(code)) {
    return null;
  }
  return code.padStart(13, '0');
}

// EAN-13 symbol tables: each digit is 7 modules (1 = bar).
const L_CODES = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const G_CODES = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const R_CODES = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
/** The first digit isn't drawn; it picks L or G for each digit of the left half. */
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/**
 * The 95 modules of an EAN-13 symbol, left to right (true = bar), for drawing
 * a product's barcode. Null unless `gtin` is a valid GTIN-13.
 */
export function ean13Modules(gtin: string): boolean[] | null {
  if (!/^\d{13}$/.test(gtin) || !isValidGtin(gtin)) {
    return null;
  }
  const digits = [...gtin].map(Number);
  const parity = PARITY[digits[0] ?? 0] ?? PARITY[0];
  let bits = '101';
  for (let i = 1; i <= 6; i++) {
    const table = parity?.[i - 1] === 'G' ? G_CODES : L_CODES;
    bits += table[digits[i] ?? 0];
  }
  bits += '01010';
  for (let i = 7; i <= 12; i++) {
    bits += R_CODES[digits[i] ?? 0];
  }
  bits += '101';
  return [...bits].map((bit) => bit === '1');
}

/** A GTIN-13 grouped as it is printed under the bars: "4 006381 333931". */
export function formatGtin13(gtin: string): string {
  return `${gtin.slice(0, 1)} ${gtin.slice(1, 7)} ${gtin.slice(7)}`;
}
