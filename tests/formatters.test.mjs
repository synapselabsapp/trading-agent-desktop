import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatValue, numberOrNaN } from '../renderer/formatters.mjs';

test('missing account values render as unavailable instead of invented zeroes', () => {
  for (const value of [null, undefined, '', Number.NaN]) {
    assert.equal(formatMoney(value), '—');
    assert.equal(formatValue(value), '—');
    assert.equal(Number.isNaN(numberOrNaN(value)), true);
  }
});

test('real zeroes and numeric values remain visible', () => {
  assert.equal(formatMoney(0), '$0.00');
  assert.match(formatMoney(1234.5), /^\$1,234\.50$/);
  assert.equal(formatValue(0), '0');
  assert.equal(numberOrNaN('2.5'), 2.5);
});
