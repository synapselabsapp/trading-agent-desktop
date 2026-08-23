'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BOT_CONFIG = Object.freeze({
  POSITION_UPDATE_INTERVAL_MS: 1000,
  TAKE_PROFIT_PERCENTAGE_OF_CAPITAL: 5,
  PORCENTAJE_DCA_RELATIVO: 20,
  DCA_DISTANCE_MULTIPLIERS: [1, 2],
  SL_DISTANCE_MULTIPLIER: 3.5,
  DCA_QTY_INCREMENT_PCT: 25,
  MIN_DCA_DISTANCE_PCT: 0,
  MAX_OPEN_POSITIONS: 1,
  STOP_LOSS_PERCENTAGE: 20,
  DCA_PERCENT_INCREMENT: 2,
  BREAKEVEN_ROI_THRESHOLD: 0.02,
  AUTO_SHUTDOWN_MINUTES: 0,
});

const BOT_CONFIG_FIELDS = Object.freeze({
  POSITION_UPDATE_INTERVAL_MS: { kind: 'integer', min: 250, max: 60000 },
  TAKE_PROFIT_PERCENTAGE_OF_CAPITAL: { kind: 'number', min: 0, max: 100 },
  PORCENTAJE_DCA_RELATIVO: { kind: 'number', min: 0, max: 100 },
  DCA_DISTANCE_MULTIPLIERS: { kind: 'array', minLength: 1, maxLength: 5, min: 0.01, max: 1000 },
  SL_DISTANCE_MULTIPLIER: { kind: 'number', min: 0.01, max: 1000 },
  DCA_QTY_INCREMENT_PCT: { kind: 'number', min: 0, max: 1000 },
  MIN_DCA_DISTANCE_PCT: { kind: 'number', min: 0, max: 100 },
  MAX_OPEN_POSITIONS: { kind: 'integer', min: 0, max: 100 },
  STOP_LOSS_PERCENTAGE: { kind: 'number', min: 0, max: 100 },
  DCA_PERCENT_INCREMENT: { kind: 'number', min: 0, max: 100 },
  BREAKEVEN_ROI_THRESHOLD: { kind: 'number', min: 0, max: 100 },
  AUTO_SHUTDOWN_MINUTES: { kind: 'integer', min: 0, max: 10080 },
});

function invalid(key, detail) {
  throw Object.assign(new Error(`Invalid bot parameter ${key}: ${detail}.`), { status: 400 });
}

function finite(value, key) {
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number)) invalid(key, 'expected a number');
  return number;
}

function parseArray(value, key) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch {
      parsed = value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(parsed)) invalid(key, 'expected a JSON array such as [1,2]');
  const values = parsed.map((item) => finite(item, key));
  const field = BOT_CONFIG_FIELDS[key];
  if (values.length < field.minLength || values.length > field.maxLength) invalid(key, `must contain ${field.minLength}-${field.maxLength} values`);
  if (values.some((item) => item < field.min || item > field.max)) invalid(key, `values must be between ${field.min} and ${field.max}`);
  return values;
}

function sanitizeBotConfig(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...DEFAULT_BOT_CONFIG };
  for (const [key, field] of Object.entries(BOT_CONFIG_FIELDS)) {
    if (source[key] === undefined || source[key] === null || source[key] === '') continue;
    if (field.kind === 'array') {
      result[key] = parseArray(source[key], key);
      continue;
    }
    const value = finite(source[key], key);
    if (field.kind === 'integer' && !Number.isInteger(value)) invalid(key, 'expected a whole number');
    if (value < field.min || value > field.max) invalid(key, `must be between ${field.min} and ${field.max}`);
    result[key] = value;
  }
  return result;
}

function readBotConfigs(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error('The local bot configuration file is unreadable.');
  }
}

function getBotConfig(file, exchange) {
  const records = readBotConfigs(file);
  return sanitizeBotConfig(records[exchange] || DEFAULT_BOT_CONFIG);
}

function saveBotConfig(file, exchange, input) {
  const records = readBotConfigs(file);
  const config = sanitizeBotConfig(input);
  records[exchange] = config;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(records, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
  return config;
}

module.exports = {
  BOT_CONFIG_FIELDS,
  DEFAULT_BOT_CONFIG,
  getBotConfig,
  readBotConfigs,
  sanitizeBotConfig,
  saveBotConfig,
};
