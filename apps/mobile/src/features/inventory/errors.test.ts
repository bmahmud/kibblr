import { inventoryErrorMessage } from './errors';

const OFFLINE = "You're offline, so nothing changed. Try again when you're back online.";
const GENERIC = 'Something went wrong, so nothing changed. Please try again.';

describe('inventoryErrorMessage', () => {
  it.each([
    ['unavailable', OFFLINE],
    ['deadline-exceeded', OFFLINE],
    ['permission-denied', "You don't have access to this household."],
    ['not-found', 'This product no longer exists.'],
    ['aborted', 'Someone else changed this at the same time. Please try again.'],
  ])('maps %s', (code, message) => {
    expect(inventoryErrorMessage({ code, message: 'raw' })).toBe(message);
  });

  it('maps a missing product from the stock transaction', () => {
    const error = Object.assign(new Error('Product p1 does not exist.'), { name: 'ProductNotFoundError' });
    expect(inventoryErrorMessage(error)).toBe('This product no longer exists.');
  });

  it('falls back to a generic message', () => {
    expect(inventoryErrorMessage({ code: 'internal' })).toBe(GENERIC);
    expect(inventoryErrorMessage(new Error('boom'))).toBe(GENERIC);
    expect(inventoryErrorMessage('nope')).toBe(GENERIC);
    expect(inventoryErrorMessage(null)).toBe(GENERIC);
  });
});
