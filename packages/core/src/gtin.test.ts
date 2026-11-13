import { describe, expect, it } from 'vitest';

import { ean13Modules, expandUpcE, formatGtin13, isValidGtin, normalizeGtin } from './gtin';

describe('isValidGtin', () => {
  it('accepts codes with a correct check digit', () => {
    expect(isValidGtin('4006381333931')).toBe(true); // EAN-13
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
    expect(isValidGtin('12345670')).toBe(true); // EAN-8
  });

  it('rejects a wrong check digit', () => {
    expect(isValidGtin('4006381333932')).toBe(false);
    expect(isValidGtin('036000291453')).toBe(false);
  });
});

describe('expandUpcE', () => {
  it('expands each UPC-E pattern to UPC-A', () => {
    expect(expandUpcE('04252614')).toBe('042100005264'); // last digit 0-2
    expect(expandUpcE('01234531')).toBe('012300000451'); // last digit 3
    expect(expandUpcE('01218905')).toBe('012000001895'); // last digit 0-2
    expect(expandUpcE('06543217')).toBe('065100004327');
  });

  it('only expands number systems 0 and 1', () => {
    expect(expandUpcE('24252614')).toBeNull();
  });

  it('rejects anything that is not 8 digits', () => {
    expect(expandUpcE('0425261')).toBeNull();
  });
});

describe('normalizeGtin', () => {
  it('keeps a valid EAN-13', () => {
    expect(normalizeGtin('4006381333931')).toBe('4006381333931');
  });

  it('left-pads UPC-A and EAN-8 to 13 digits', () => {
    expect(normalizeGtin('036000291452')).toBe('0036000291452');
    expect(normalizeGtin('12345670')).toBe('0000012345670');
  });

  it('drops the leading zero of a GTIN-14 that has one', () => {
    expect(normalizeGtin('04006381333931')).toBe('4006381333931');
    expect(normalizeGtin('14006381333938')).toBeNull();
  });

  it('strips spaces, dashes and other characters, as from typed input', () => {
    expect(normalizeGtin(' 0 36000-29145 2 ')).toBe('0036000291452');
  });

  it('expands UPC-E when the scanner says so, so it matches the same product printed as UPC-A', () => {
    expect(normalizeGtin('04252614', 'upc_e')).toBe('0042100005264');
    expect(normalizeGtin('042100005264')).toBe('0042100005264');
  });

  it('falls back to UPC-E for typed 8-digit codes that are not a valid EAN-8', () => {
    expect(normalizeGtin('04252614')).toBe('0042100005264');
  });

  it('returns null for a bad check digit, wrong length or no digits', () => {
    expect(normalizeGtin('4006381333932')).toBeNull();
    expect(normalizeGtin('12345')).toBeNull();
    expect(normalizeGtin('123456789012345')).toBeNull();
    expect(normalizeGtin('')).toBeNull();
    expect(normalizeGtin('abc')).toBeNull();
  });
});

describe('ean13Modules', () => {
  // Wikipedia's EAN-13 example, 4 006381 333931.
  const modules = ean13Modules('4006381333931') ?? [];

  it('is 95 modules with start, centre and end guards', () => {
    expect(modules).toHaveLength(95);
    const bits = modules.map((on) => (on ? '1' : '0')).join('');
    expect(bits.slice(0, 3)).toBe('101');
    expect(bits.slice(45, 50)).toBe('01010');
    expect(bits.slice(92)).toBe('101');
  });

  it('encodes the left half with the parity of the first digit and the right half with R codes', () => {
    const bits = modules.map((on) => (on ? '1' : '0')).join('');
    // First digit 4 is LGLLGG: 0 in L, 0 in G, 6 in L, 3 in L, 8 in G, 1 in G.
    expect(bits.slice(3, 45)).toBe(['0001101', '0100111', '0101111', '0111101', '0001001', '0110011'].join(''));
    // 333931 in R codes.
    expect(bits.slice(50, 92)).toBe(['1000010', '1000010', '1000010', '1110100', '1000010', '1100110'].join(''));
  });

  it('returns null for anything but a valid GTIN-13', () => {
    expect(ean13Modules('4006381333932')).toBeNull();
    expect(ean13Modules('036000291452')).toBeNull();
  });
});

describe('formatGtin13', () => {
  it('groups as printed under the bars', () => {
    expect(formatGtin13('4006381333931')).toBe('4 006381 333931');
  });
});
