'use strict';

const { sanitizeBotConfig } = require('./bot-config.cjs');

const ALLOWED_EXCHANGES = new Set(['binance', 'binance_us', 'coinbase']);
const ALLOWED_MONITOR_VALUES = new Set(['start', 'stop']);
const ALLOWED_PARAMETER_KEYS = new Set([
  'POSITION_UPDATE_INTERVAL_MS',
  'TAKE_PROFIT_PERCENTAGE_OF_CAPITAL',
  'PORCENTAJE_DCA_RELATIVO',
  'DCA_DISTANCE_MULTIPLIERS',
  'SL_DISTANCE_MULTIPLIER',
  'DCA_QTY_INCREMENT_PCT',
  'MIN_DCA_DISTANCE_PCT',
  'MAX_OPEN_POSITIONS',
  'STOP_LOSS_PERCENTAGE',
  'DCA_PERCENT_INCREMENT',
  'BREAKEVEN_ROI_THRESHOLD',
  'AUTO_SHUTDOWN_MINUTES',
]);
const CONVERSATION_PATTERN = /^[a-z0-9][a-z0-9-]{7,79}$/i;
const ASSISTANT_POLICY = `# Arrow Agent

You are the bounded in-app risk assistant for Synapse Labs Trading Bot Desktop. Your user-facing name is Arrow Agent. Never mention the runtime name or internal transport in a user-facing reply.

The host application sends an authoritative, sanitized snapshot of the current Synapse state with every turn. Analyze only that snapshot and the user's message. Never claim to inspect files, source code, credentials, screens, browsers, devices, or external systems.
- The snapshot's botConfig object is the authoritative current value for all twelve local Configure parameters. Use it when answering configuration questions; do not infer missing parameter values from conversation history.

Security boundary:
- You have no usable tools. Do not request or attempt to use tools.
- You cannot modify application code, files, credentials, orders, wallets, or operating-system state.
- You cannot execute trades or suggest new entries.
- You may analyze existing positions, account exposure, liquidation distance, stop-loss/take-profit management, and the current monitor state.
- You may request only the reversible controls exposed to the user in Synapse: selecting the active exchange, starting or stopping the local monitor, and changing one of the twelve local bot parameters listed below.
- Parameter changes use the exact key from Configure and are validated by the host against the same bounds as the Configure dialog.
- Request an action only when the user explicitly asks for that change. Otherwise return no actions.

Return exactly one JSON object and no markdown or surrounding prose:
{"reply":"Concise user-facing answer","actions":[]}

Allowed action objects:
- {"type":"set_exchange","value":"binance"}
- {"type":"set_exchange","value":"binance_us"}
- {"type":"set_exchange","value":"coinbase"}
- {"type":"set_monitor","value":"start"}
- {"type":"set_monitor","value":"stop"}
- {"type":"set_parameter","key":"POSITION_UPDATE_INTERVAL_MS","value":1000}
- {"type":"set_parameter","key":"TAKE_PROFIT_PERCENTAGE_OF_CAPITAL","value":5}
- {"type":"set_parameter","key":"PORCENTAJE_DCA_RELATIVO","value":20}
- {"type":"set_parameter","key":"DCA_DISTANCE_MULTIPLIERS","value":[1,2]}
- {"type":"set_parameter","key":"SL_DISTANCE_MULTIPLIER","value":3.5}
- {"type":"set_parameter","key":"DCA_QTY_INCREMENT_PCT","value":25}
- {"type":"set_parameter","key":"MIN_DCA_DISTANCE_PCT","value":0}
- {"type":"set_parameter","key":"MAX_OPEN_POSITIONS","value":1}
- {"type":"set_parameter","key":"STOP_LOSS_PERCENTAGE","value":20}
- {"type":"set_parameter","key":"DCA_PERCENT_INCREMENT","value":2}
- {"type":"set_parameter","key":"BREAKEVEN_ROI_THRESHOLD","value":0.02}
- {"type":"set_parameter","key":"AUTO_SHUTDOWN_MINUTES","value":0}

The host validates every action. Explicit parameter and monitor actions may apply automatically after the user requests them; Close position requires a selected position in the host UI. Never invent additional action types or fields. Never include secrets in the reply. Respond in the same language the user writes in.
`;

function boundedText(value, max = 200) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizePosition(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    symbol: boundedText(source.symbol, 30),
    side: boundedText(source.side, 12),
    size: finiteNumber(source.size),
    entryPrice: finiteNumber(source.entryPrice),
    markPrice: finiteNumber(source.markPrice),
    unrealizedPnl: finiteNumber(source.unrealizedPnl),
    liquidationPrice: finiteNumber(source.liquidationPrice),
    leverage: finiteNumber(source.leverage),
    riskPercent: finiteNumber(source.riskPercent),
  };
}

function sanitizeOrder(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    symbol: boundedText(source.symbol, 30),
    side: boundedText(source.side, 12),
    type: boundedText(source.type, 30),
    status: boundedText(source.status, 20),
    price: finiteNumber(source.price),
    quantity: finiteNumber(source.quantity),
    reduceOnly: source.reduceOnly === true,
  };
}

function detectLanguage(message, history = []) {
  const text = [message, ...history.map((item) => item.content || '')].join(' ').toLowerCase();
  const spanish = (text.match(/[áéíóúñ¿¡]|\b(?:el|la|los|las|que|qué|cambia|cambiar|ahora|porcentaje|posición|posicion|stop|loss|aplicó|aplico)\b/g) || []).length;
  const english = (text.match(/\b(?:the|change|set|now|percent|position|what|stop|loss|apply|applied)\b/g) || []).length;
  return spanish >= english ? 'es' : 'en';
}

function sanitizeConversationAction(value) {
  const source = value && typeof value === 'object' ? value : {};
  const type = boundedText(source.type, 40);
  if (type === 'set_parameter' && ALLOWED_PARAMETER_KEYS.has(boundedText(source.key, 80))) {
    const key = boundedText(source.key, 80);
    try {
      return { type, key, value: sanitizeBotConfig({ [key]: source.value })[key] };
    } catch { return null; }
  }
  if (type === 'set_exchange' && ALLOWED_EXCHANGES.has(boundedText(source.value, 40))) {
    return { type, value: boundedText(source.value, 40) };
  }
  if (type === 'set_monitor' && ALLOWED_MONITOR_VALUES.has(boundedText(source.value, 40))) {
    return { type, value: boundedText(source.value, 40) };
  }
  return null;
}

function sanitizeConversationHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-15).map((item) => {
    const source = item && typeof item === 'object' ? item : {};
    const role = source.role === 'user' ? 'user' : source.role === 'assistant' ? 'assistant' : '';
    if (!role) return null;
    const content = boundedText(source.content, 1000);
    if (!content) return null;
    const actions = Array.isArray(source.actions)
      ? source.actions.slice(0, 3).map(sanitizeConversationAction).filter(Boolean)
      : [];
    return actions.length ? { role, content, actions } : { role, content };
  }).filter((item) => item && item.content);
}

function sanitizeAssistantRequest(input) {
  const source = input && typeof input === 'object' ? input : {};
  const conversationId = boundedText(source.conversationId, 80);
  if (!CONVERSATION_PATTERN.test(conversationId)) throw new Error('A valid Arrow Agent conversation ID is required.');
  const message = boundedText(source.message, 2000);
  if (!message) throw new Error('An Arrow Agent message is required.');

  const raw = source.context && typeof source.context === 'object' ? source.context : {};
  // Accept both shapes during the renderer/backend transition. The canonical
  // shape is input.history; context.history remains a safe fallback.
  const history = sanitizeConversationHistory(source.history ?? raw.history);
  const language = detectLanguage(message, history);
  const exchange = ALLOWED_EXCHANGES.has(raw.exchange) ? raw.exchange : 'coinbase';
  const account = raw.account && typeof raw.account === 'object' ? raw.account : {};
  let botConfig = null;
  if (raw.botConfig && typeof raw.botConfig === 'object' && !Array.isArray(raw.botConfig)) {
    try { botConfig = sanitizeBotConfig(raw.botConfig); } catch { botConfig = null; }
  }
  return {
    conversationId,
    message,
    language,
    history,
    context: {
      exchange,
      language,
      exchangeLabel: boundedText(raw.exchangeLabel, 40),
      monitorRunning: raw.monitorRunning === true,
      hasCredentials: raw.hasCredentials === true,
      botConfig,
      account: {
        balance: finiteNumber(account.balance),
        available: finiteNumber(account.available),
        totalValue: finiteNumber(account.totalValue),
      },
      positions: Array.isArray(raw.positions) ? raw.positions.slice(0, 20).map(sanitizePosition) : [],
      orders: Array.isArray(raw.orders) ? raw.orders.slice(0, 20).map(sanitizeOrder) : [],
      updatedAt: boundedText(raw.updatedAt, 40),
    },
  };
}

const LOCAL_PARAMETER_REQUESTS = [
  { key: 'SL_DISTANCE_MULTIPLIER', label: 'stop-loss distance multiplier', aliases: ['stop-loss distance multiplier', 'stop loss distance multiplier', 'multiplicador de distancia del stop loss'] },
  { key: 'DCA_DISTANCE_MULTIPLIERS', label: 'DCA distance multipliers', aliases: ['DCA distance multipliers', 'multiplicadores de distancia DCA'] },
  { key: 'TAKE_PROFIT_PERCENTAGE_OF_CAPITAL', label: 'take profit percentage', aliases: ['take profit percentage', 'porcentaje de take profit', 'take profit'] },
  { key: 'STOP_LOSS_PERCENTAGE', label: 'stop-loss percentage', aliases: ['stop-loss percentage', 'stop loss percentage', 'porcentaje de stop loss', 'stop-loss', 'stop loss'] },
  { key: 'POSITION_UPDATE_INTERVAL_MS', label: 'position update interval', aliases: ['position update interval', 'intervalo de actualización de posición', 'intervalo de actualizacion de posicion'] },
  { key: 'PORCENTAJE_DCA_RELATIVO', label: 'relative DCA percentage', aliases: ['relative DCA percentage', 'porcentaje DCA relativo', 'DCA relativo'] },
  { key: 'DCA_QTY_INCREMENT_PCT', label: 'DCA quantity increment', aliases: ['DCA quantity increment', 'incremento de cantidad DCA'] },
  { key: 'MIN_DCA_DISTANCE_PCT', label: 'minimum DCA distance', aliases: ['minimum DCA distance', 'distancia DCA mínima', 'distancia DCA minima'] },
  { key: 'MAX_OPEN_POSITIONS', label: 'maximum open positions', aliases: ['maximum open positions', 'máximo de posiciones abiertas', 'maximo de posiciones abiertas'] },
  { key: 'DCA_PERCENT_INCREMENT', label: 'DCA percentage increment', aliases: ['DCA percentage increment', 'incremento porcentual DCA'] },
  { key: 'BREAKEVEN_ROI_THRESHOLD', label: 'breakeven ROI threshold', aliases: ['breakeven ROI threshold', 'umbral ROI de breakeven'] },
  { key: 'AUTO_SHUTDOWN_MINUTES', label: 'auto-shutdown minutes', aliases: ['auto-shutdown minutes', 'auto shutdown minutes', 'minutos de apagado automático', 'minutos de apagado automatico'] },
];

function parseLocalParameterRequest(message, history = []) {
  const text = boundedText(message, 2000);
  const historyTexts = history.map((item) => boundedText(item?.content, 1000)).filter(Boolean);
  const command = /\b(cambia|cambiar|change|set|ajusta|ajustar|update|actualiza|actualizar|modifica|modificar|pon|poner|fija|fijar|setea|setear)\b/i.test(text);
  const historicalCommand = historyTexts.some((item) => /\b(cambia|cambiar|change|set|ajusta|ajustar|update|actualiza|actualizar|modifica|modificar|pon|poner|fija|fijar|setea|setear)\b/i.test(item));
  const currentHistoryIndex = [...history].map((item) => boundedText(item?.content, 2000)).lastIndexOf(text);
  const previousHistory = currentHistoryIndex >= 0 ? history.filter((_item, index) => index !== currentHistoryIndex) : history;
  const previousAction = [...previousHistory].reverse()
    .flatMap((item) => Array.isArray(item?.actions) ? item.actions : [])
    .find((action) => action?.type === 'set_parameter' && ALLOWED_PARAMETER_KEYS.has(action.key));
  const numbersIn = (value) => [...boundedText(value, 2000).matchAll(/[-+]?\d+(?:[.,]\d+)?/g)]
    .map((match) => Number(match[0].replace(',', '.')))
    .filter(Number.isFinite);
  const latestPreviousUserNumber = (excluded = null) => {
    for (const item of [...previousHistory].reverse()) {
      if (item?.role !== 'user') continue;
      const numbers = numbersIn(item.content).reverse();
      const value = numbers.find((candidate) => candidate !== excluded);
      if (value !== undefined) return value;
    }
    return null;
  };
  const referenceToPreviousParameter = /\b(?:el|la)\s+(?:que|mismo|misma)|\b(?:the one|the same)\b|\b(?:pusiste|pusieron|aplicaste|aplico|aplicó)\b/i.test(text);
  const candidates = LOCAL_PARAMETER_REQUESTS
    .flatMap((spec) => spec.aliases.map((alias) => ({ spec, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { spec, alias } of candidates) {
    const aliasPattern = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const match = aliasPattern.exec(text);
    if (!match) continue;
    const tail = text.slice(match.index + match[0].length);
    if (!command && !historicalCommand && !/(?:\bal\b|\ba\b|\ben\b|\bto\b|\bat\b|=|:)\s*(?:\[|[-+]?\d)/i.test(tail)) return null;
    let value;
    if (spec.key === 'DCA_DISTANCE_MULTIPLIERS') {
      const arrayMatch = tail.match(/\[[^\]]+\]/);
      if (!arrayMatch) continue;
      try { value = JSON.parse(arrayMatch[0].replace(/'/g, '"')); } catch { continue; }
    } else {
      let numbers = [...tail.matchAll(/[-+]?\d+(?:[.,]\d+)?/g)];
      if (!numbers.length) {
        const previous = [...previousHistory].reverse().map((item) => item?.content || '').find((item) => /[-+]?\d+(?:[.,]\d+)?/.test(item));
        numbers = previous ? [...previous.matchAll(/[-+]?\d+(?:[.,]\d+)?/g)] : [];
      }
      if (!numbers.length) continue;
      value = Number(numbers[numbers.length - 1][0].replace(',', '.'));
    }
    try {
      const normalized = sanitizeBotConfig({ [spec.key]: value })[spec.key];
      const display = Array.isArray(normalized) ? `[${normalized.join(', ')}]` : String(normalized);
      const spanish = detectLanguage(text, historyTexts.map((content) => ({ content }))) === 'es';
      return {
        reply: spanish ? `Solicito cambiar ${spec.label} al ${display}.` : `Requesting ${spec.label} = ${display}.`,
        actions: [{ type: 'set_parameter', key: spec.key, value: normalized }],
      };
    } catch {
      return null;
    }
  }

  // Resolve numeric follow-ups through the last applied parameter action.
  if (previousAction) {
    const currentNumbers = numbersIn(text);
    const value = referenceToPreviousParameter
      ? (latestPreviousUserNumber(previousAction.value) ?? currentNumbers.at(-1) ?? null)
      : (currentNumbers.at(-1) ?? null);
    const implicitFollowUp = /\b(?:ahora|now|al|a|en|to|at)\b/i.test(text);
    if (value !== null && (command || historicalCommand || implicitFollowUp || referenceToPreviousParameter)) {
      const spec = LOCAL_PARAMETER_REQUESTS.find((item) => item.key === previousAction.key);
      if (spec) {
        try {
          const normalized = sanitizeBotConfig({ [spec.key]: value })[spec.key];
          const spanish = detectLanguage(text, historyTexts.map((content) => ({ content }))) === 'es';
          const display = Array.isArray(normalized) ? `[${normalized.join(', ')}]` : String(normalized);
          return {
            reply: spanish ? `Solicito cambiar ${spec.label} al ${display}.` : `Requesting ${spec.label} = ${display}.`,
            actions: [{ type: 'set_parameter', key: spec.key, value: normalized }],
          };
        } catch { return null; }
      }
    }
  }
  return null;
}

function classifyAssistantTransportError(error) {
  const raw = [error?.message, error?.stderr, error?.stdout].filter(Boolean).join('\n');
  if (/subscription usage limit|usage limit|rate[_ -]?limit/i.test(raw)) {
    const reset = raw.match(/(?:Next reset(?:s)?(?: in [^,.]+,)?\s*)?([A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2} [AP]M [A-Z]{2,5})/i)?.[1] || '';
    return {
      kind: 'usage-limit',
      message: `Arrow Agent is temporarily unavailable because the AI service reached its usage limit.${reset ? ` The limit resets ${reset}.` : ' Try again later.'}`,
      cacheMs: 5 * 60 * 1000,
    };
  }
  if (error?.killed || error?.code === 'ETIMEDOUT' || /timed?\s*out/i.test(raw)) {
    return { kind: 'timeout', message: 'Arrow Agent took too long to respond. Try again.', cacheMs: 0 };
  }
  if (/not recognized|cannot find|enoent|no such file/i.test(raw)) {
    return { kind: 'not-installed', message: 'Hermes Agent is not installed or is not available in PATH.', cacheMs: 0 };
  }
  return { kind: 'runtime', message: 'Arrow Agent could not reach the configured local AI runtime.', cacheMs: 0 };
}

function buildAssistantPrompt(cleanRequest) {
  const request = sanitizeAssistantRequest(cleanRequest);
  return [
    'SYNAPSE IN-APP TURN',
    'You are running in a one-shot Hermes Agent call with no usable toolsets. Treat the following JSON as the current authoritative snapshot of Synapse. It contains no credentials.',
    'The host can offer only set_exchange, set_monitor, and validated set_parameter actions for the twelve local Configure fields.',
    'The current botConfig in the authoritative snapshot contains all available Configure values. Use it for parameter-state questions, even when a parameter was not mentioned in the recent chat.',
    `Language rule: respond only in ${request.language === 'es' ? 'Spanish' : 'English'}. Do not switch languages because parameter names are English.`,
    'Use the recent conversation history to resolve follow-up messages and pronouns before answering.',
    'Never request or use tools. Return the exact JSON envelope required by the policy.',
    `Conversation correlation: ${request.conversationId}`,
    `Recent conversation history: ${JSON.stringify(request.history)}`,
    `Current authoritative snapshot: ${JSON.stringify(request.context)}`,
    `User message: ${JSON.stringify(request.message)}`,
    `Policy: ${ASSISTANT_POLICY}`,
  ].join('\n');
}

function buildHermesArgs(prompt) {
  const message = boundedText(prompt, 30000);
  if (!message) throw new Error('An Arrow Agent prompt is required.');
  return [
    '-z', message,
    '--toolsets', 'clarify',
    '--ignore-rules',
    '--reasoning', 'low',
  ];
}

function extractJson(text) {
  const clean = boundedText(text, 16000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Arrow Agent did not return structured JSON.');
  try { return JSON.parse(clean.slice(start, end + 1)); } catch { throw new Error('Arrow Agent did not return structured JSON.'); }
}

function validateEnvelope(value) {
  const source = value && typeof value === 'object' ? value : {};
  const reply = boundedText(source.reply, 4000);
  if (!reply) throw new Error('Arrow Agent returned an empty reply.');
  const actions = [];
  const seen = new Set();
  for (const candidate of Array.isArray(source.actions) ? source.actions.slice(0, 10) : []) {
    if (!candidate || typeof candidate !== 'object') continue;
    const type = boundedText(candidate.type, 40);
    const valueText = boundedText(candidate.value, 40);
    const parameterKey = boundedText(candidate.key, 80);
    let normalizedValue = null;
    let valid = false;
    if (type === 'set_exchange' && ALLOWED_EXCHANGES.has(valueText)) {
      normalizedValue = valueText;
      valid = true;
    } else if (type === 'set_monitor' && ALLOWED_MONITOR_VALUES.has(valueText)) {
      normalizedValue = valueText;
      valid = true;
    } else if (type === 'set_parameter' && ALLOWED_PARAMETER_KEYS.has(parameterKey)) {
      try {
        normalizedValue = sanitizeBotConfig({ [parameterKey]: candidate.value })[parameterKey];
        valid = normalizedValue !== null && normalizedValue !== undefined;
      } catch {}
    }
    const key = type === 'set_parameter'
      ? `${type}:${parameterKey}:${JSON.stringify(normalizedValue)}`
      : `${type}:${valueText}`;
    if (!valid || seen.has(key)) continue;
    seen.add(key);
    actions.push(type === 'set_parameter'
      ? { type, key: parameterKey, value: normalizedValue }
      : { type, value: normalizedValue });
    if (actions.length === 3) break;
  }
  return { reply, actions };
}

function parseHermesResult(stdout) {
  return validateEnvelope(extractJson(stdout));
}

module.exports = {
  ALLOWED_EXCHANGES,
  ALLOWED_PARAMETER_KEYS,
  ASSISTANT_POLICY,
  buildAssistantPrompt,
  buildHermesArgs,
  classifyAssistantTransportError,
  parseHermesResult,
  detectLanguage,
  parseLocalParameterRequest,
  sanitizeAssistantRequest,
  validateEnvelope,
};
