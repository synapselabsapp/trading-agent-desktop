const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLOWED_PARAMETER_KEYS,
  ASSISTANT_POLICY,
  detectLanguage,
  buildAssistantPrompt,
  buildHermesArgs,
  classifyAssistantTransportError,
  parseHermesResult,
  parseLocalParameterRequest,
  sanitizeAssistantRequest,
} = require('../assistant-chat.cjs');

const liveRequest = {
  conversationId: 'desktop-12345678',
  message: '¿Qué posición necesita protección primero?',
  context: {
    exchange: 'binance',
    exchangeLabel: 'Binance Global',
    monitorRunning: true,
    hasCredentials: true,
    botConfig: {
      POSITION_UPDATE_INTERVAL_MS: 1000,
      TAKE_PROFIT_PERCENTAGE_OF_CAPITAL: 6,
      STOP_LOSS_PERCENTAGE: 20,
      DCA_DISTANCE_MULTIPLIERS: [1, 2],
      apiSecret: 'must-not-leak',
    },
    account: { balance: 1500.25, available: 900, totalValue: 1550 },
    positions: [{
      symbol: 'BTCUSDT', side: 'LONG', size: 0.05, entryPrice: 61000,
      markPrice: 62000, unrealizedPnl: 50, liquidationPrice: 47000,
      leverage: 3, riskPercent: 1.2, apiSecret: 'must-not-leak',
    }],
    orders: [{ symbol: 'BTCUSDT', side: 'SELL', type: 'STOP_MARKET', status: 'NEW', price: 59000, quantity: 0.05, reduceOnly: true, token: 'must-not-leak' }],
    updatedAt: '2026-08-17T13:00:00.000Z',
    apiKey: 'must-not-leak',
    credentials: { key: 'must-not-leak', secret: 'must-not-leak' },
  },
  gatewayToken: 'must-not-leak',
};

test('assistant request contains only current non-secret Synapse state', () => {
  const clean = sanitizeAssistantRequest(liveRequest);
  assert.equal(clean.message, liveRequest.message);
  assert.equal(clean.context.exchange, 'binance');
  assert.equal(clean.context.positions[0].symbol, 'BTCUSDT');
  assert.equal(clean.context.orders[0].reduceOnly, true);
  assert.equal(clean.context.hasCredentials, true);
  assert.equal(clean.context.botConfig.TAKE_PROFIT_PERCENTAGE_OF_CAPITAL, 6);
  assert.equal(clean.context.botConfig.STOP_LOSS_PERCENTAGE, 20);
  assert.deepEqual(clean.context.botConfig.DCA_DISTANCE_MULTIPLIERS, [1, 2]);
  const serialized = JSON.stringify(clean);
  assert.doesNotMatch(serialized, /must-not-leak|apiKey|apiSecret|gatewayToken|"credentials"|"token"/i);
});

test('assistant prompt includes live state and the closed user-control allowlist', () => {
  const prompt = buildAssistantPrompt(sanitizeAssistantRequest(liveRequest));
  assert.match(prompt, /BTCUSDT/);
  assert.match(prompt, /set_exchange/);
  assert.match(prompt, /set_monitor/);
  assert.match(prompt, /current authoritative snapshot/i);
  assert.match(prompt, /botConfig/);
  assert.match(prompt, /TAKE_PROFIT_PERCENTAGE_OF_CAPITAL/);
  assert.doesNotMatch(prompt, /must-not-leak|apiSecret|gatewayToken/i);
  assert.match(ASSISTANT_POLICY, /user-facing name is Arrow Agent/i);
  assert.match(ASSISTANT_POLICY, /no usable tools/i);
});

test('assistant preserves language and recent conversation history', () => {
  const request = sanitizeAssistantRequest({
    ...liveRequest,
    message: 'stop loss',
    history: [
      { role: 'user', content: 'cambia el stop loss al 5%' },
      { role: 'assistant', content: 'Se aplicó stop-loss percentage al 5.' },
      { role: 'user', content: '¿qué valor quedó?' },
    ],
  });
  assert.equal(request.language, 'es');
  assert.equal(request.history.length, 3);
  assert.equal(detectLanguage('change stop loss to 5', []), 'en');
  const prompt = buildAssistantPrompt(request);
  assert.match(prompt, /respond only in Spanish/i);
  assert.match(prompt, /Recent conversation history/);
  assert.match(prompt, /cambia el stop loss al 5%/);
});

test('assistant accepts renderer history and resolves numeric follow-ups from applied actions', () => {
  const request = sanitizeAssistantRequest({
    ...liveRequest,
    message: 'el que pusiste en 7',
    context: {
      ...liveRequest.context,
      history: [
        { role: 'user', content: 'cambia el stop loss al 7' },
        {
          role: 'assistant',
          content: 'Se aplicó Stop-loss percentage al 7.',
          actions: [{ type: 'set_parameter', key: 'STOP_LOSS_PERCENTAGE', value: 7 }],
        },
        { role: 'user', content: 'ahora al 2' },
        { role: 'assistant', content: '¿A qué parámetro te refieres?' },
        { role: 'user', content: 'el que pusiste en 7' },
      ],
    },
  });
  assert.equal(request.history.length, 5);
  assert.deepEqual(request.history[1].actions, [{ type: 'set_parameter', key: 'STOP_LOSS_PERCENTAGE', value: 7 }]);
  assert.deepEqual(parseLocalParameterRequest(request.message, request.history), {
    reply: 'Solicito cambiar stop-loss percentage al 2.',
    actions: [{ type: 'set_parameter', key: 'STOP_LOSS_PERCENTAGE', value: 2 }],
  });
  assert.deepEqual(parseLocalParameterRequest('ahora al 2', request.history.slice(0, 2)), {
    reply: 'Solicito cambiar stop-loss percentage al 2.',
    actions: [{ type: 'set_parameter', key: 'STOP_LOSS_PERCENTAGE', value: 2 }],
  });
});

test('assistant history is bounded to the latest fifteen messages', () => {
  const history = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `message-${index}` }));
  const request = sanitizeAssistantRequest({
    ...liveRequest,
    message: 'message-19',
    history,
  });
  assert.equal(request.history.length, 15);
  assert.equal(request.history[0].content, 'message-5');
  assert.equal(request.history.at(-1).content, 'message-19');
});

test('a simple greeting is included in the Hermes prompt instead of answered locally', () => {
  const request = sanitizeAssistantRequest({ ...liveRequest, message: 'hola' });
  const prompt = buildAssistantPrompt(request);
  assert.match(prompt, /SYNAPSE IN-APP TURN/);
  assert.match(prompt, /User message: \"hola\"/);
  assert.match(prompt, /current authoritative snapshot/i);
});

test('Hermes invocation is one-shot and exposes only the harmless clarify toolset', () => {
  const args = buildHermesArgs('safe prompt');
  assert.deepEqual(args.slice(0, 2), ['-z', 'safe prompt']);
  assert.deepEqual(args.slice(2), ['--toolsets', 'clarify', '--ignore-rules', '--reasoning', 'low']);
  assert.throws(() => buildHermesArgs(''), /prompt/i);
});

test('transport failures become clear user-facing errors without infrastructure names', () => {
  const usage = new Error('Command failed');
  usage.stderr = "You've reached the provider usage limit. Next reset in 3 days, Aug 20 at 12:01 AM EDT.";
  const result = classifyAssistantTransportError(usage);
  assert.equal(result.kind, 'usage-limit');
  assert.match(result.message, /usage limit/i);
  assert.match(result.message, /Aug 20 at 12:01 AM EDT/i);
  assert.doesNotMatch(result.message, /token|secret/i);
});

test('Hermes JSON exposes a reply and only validated user-adjustable actions', () => {
  const stdout = JSON.stringify({
    reply: 'Puedo cambiar Coinbase después de tu confirmación.',
    actions: [
      { type: 'set_exchange', value: 'coinbase' },
      { type: 'set_monitor', value: 'stop' },
      { type: 'modify_app', value: 'remove-guards' },
      { type: 'set_api_key', value: 'secret' },
    ],
  });
  assert.deepEqual(parseHermesResult(stdout), {
    reply: 'Puedo cambiar Coinbase después de tu confirmación.',
    actions: [
      { type: 'set_exchange', value: 'coinbase' },
      { type: 'set_monitor', value: 'stop' },
    ],
  });
});

test('all Configure parameters are allowlisted, normalized, and reject unsafe values', () => {
  const values = {
    POSITION_UPDATE_INTERVAL_MS: 1250,
    TAKE_PROFIT_PERCENTAGE_OF_CAPITAL: 6.5,
    PORCENTAJE_DCA_RELATIVO: 25,
    DCA_DISTANCE_MULTIPLIERS: [1, 2.5],
    SL_DISTANCE_MULTIPLIER: 4,
    DCA_QTY_INCREMENT_PCT: 30,
    MIN_DCA_DISTANCE_PCT: 1,
    MAX_OPEN_POSITIONS: 2,
    STOP_LOSS_PERCENTAGE: 15,
    DCA_PERCENT_INCREMENT: 3,
    BREAKEVEN_ROI_THRESHOLD: 0.05,
    AUTO_SHUTDOWN_MINUTES: 60,
  };
  assert.equal(ALLOWED_PARAMETER_KEYS.size, 12);
  for (const [key, value] of Object.entries(values)) {
    const parsed = parseHermesResult(JSON.stringify({ reply: 'Cambio propuesto.', actions: [{ type: 'set_parameter', key, value }] }));
    assert.deepEqual(parsed.actions, [{ type: 'set_parameter', key, value }], key);
  }
  const invalid = parseHermesResult(JSON.stringify({ reply: 'No.', actions: [
    { type: 'set_parameter', key: 'NOT_A_PARAMETER', value: 1 },
    { type: 'set_parameter', key: 'MAX_OPEN_POSITIONS', value: 101 },
    { type: 'set_parameter', key: 'DCA_DISTANCE_MULTIPLIERS', value: [0] },
  ] }));
  assert.deepEqual(invalid.actions, []);
});

test('explicit parameter changes use the local fast path without Hermes', () => {
  assert.deepEqual(parseLocalParameterRequest('cambia el stop loss al 10%'), {
    reply: 'Solicito cambiar stop-loss percentage al 10.',
    actions: [{ type: 'set_parameter', key: 'STOP_LOSS_PERCENTAGE', value: 10 }],
  });
  assert.deepEqual(parseLocalParameterRequest('set the take profit percentage to 7.5'), {
    reply: 'Requesting take profit percentage = 7.5.',
    actions: [{ type: 'set_parameter', key: 'TAKE_PROFIT_PERCENTAGE_OF_CAPITAL', value: 7.5 }],
  });
  assert.equal(parseLocalParameterRequest('¿cuál es el stop loss actual?'), null);
  assert.deepEqual(parseLocalParameterRequest('stop loss', [{ role: 'user', content: 'cambia ahora a 10' }]), {
    reply: 'Solicito cambiar stop-loss percentage al 10.',
    actions: [{ type: 'set_parameter', key: 'STOP_LOSS_PERCENTAGE', value: 10 }],
  });
});

test('malformed Hermes output is rejected instead of executed', () => {
  assert.throws(() => parseHermesResult('{"status":"error"}'), /reply|empty/i);
  assert.throws(() => parseHermesResult('not json'), /structured/i);
});
