'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DEFAULT_BOT_CONFIG,
  getBotConfig,
  sanitizeBotConfig,
  saveBotConfig,
} = require('../bot-config.cjs');

test('bot config exposes the VPS defaults', () => {
  const config = sanitizeBotConfig();
  assert.deepEqual(config, DEFAULT_BOT_CONFIG);
  assert.equal(config.POSITION_UPDATE_INTERVAL_MS, 5000);
  assert.deepEqual(config.DCA_DISTANCE_MULTIPLIERS, [1, 2]);
  assert.equal(config.AUTO_SHUTDOWN_MINUTES, 0);
});

test('bot config persists independently for each exchange', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-bot-config-'));
  const file = path.join(dir, 'bot-config.json');
  try {
    const saved = saveBotConfig(file, 'binance', {
      POSITION_UPDATE_INTERVAL_MS: '1500',
      DCA_DISTANCE_MULTIPLIERS: '[1, 2.5]',
    });
    assert.equal(saved.POSITION_UPDATE_INTERVAL_MS, 1500);
    assert.deepEqual(saved.DCA_DISTANCE_MULTIPLIERS, [1, 2.5]);
    assert.equal(getBotConfig(file, 'binance').POSITION_UPDATE_INTERVAL_MS, 1500);
    assert.equal(getBotConfig(file, 'coinbase').POSITION_UPDATE_INTERVAL_MS, 5000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bot config rejects unsafe or malformed values', () => {
  assert.throws(() => sanitizeBotConfig({ POSITION_UPDATE_INTERVAL_MS: 10 }), /POSITION_UPDATE_INTERVAL_MS/);
  assert.throws(() => sanitizeBotConfig({ MAX_OPEN_POSITIONS: 101 }), /MAX_OPEN_POSITIONS/);
  assert.throws(() => sanitizeBotConfig({ DCA_DISTANCE_MULTIPLIERS: 'not-json' }), /DCA_DISTANCE_MULTIPLIERS/);
});
