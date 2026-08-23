const crypto = require('node:crypto');

const EXCHANGES = new Set(['binance', 'binance_us', 'coinbase']);
const USD_ASSETS = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'FDUSD']);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCoinbasePrivateKey(value) {
  let secret = String(value || '').trim();
  if (secret.startsWith('"') && secret.endsWith('"')) {
    try {
      const decoded = JSON.parse(secret);
      if (typeof decoded === 'string') secret = decoded;
    } catch {}
  }
  return secret
    .replace(/\\r\\n/g, '\r\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .trim();
}

function validateCredentials(exchange, input) {
  if (!EXCHANGES.has(exchange)) throw new Error('Unsupported exchange.');
  const key = String(input?.key || '').trim();
  let secret = String(input?.secret || '').trim();
  if (!key || key.length > 512) throw new Error('API key is required.');
  if (!secret || secret.length > 16384) throw new Error('API secret is required.');
  if (/[\r\n]/.test(key)) throw new Error('API key must use a single line.');
  if (exchange === 'coinbase') {
    secret = normalizeCoinbasePrivateKey(secret);
    if (!/^-----BEGIN (?:EC )?PRIVATE KEY-----[\s\S]+-----END (?:EC )?PRIVATE KEY-----$/.test(secret)) {
      throw new Error('Coinbase requires an EC private key in PEM format.');
    }
    try {
      const keyObject = crypto.createPrivateKey(secret);
      if (keyObject.asymmetricKeyType !== 'ec') throw new Error('Not an EC key.');
    } catch {
      throw new Error('Coinbase requires a valid EC private key in PEM format.');
    }
  }
  return { key, secret };
}

function signBinanceParams(params, secret) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const raw = query.toString();
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return `${raw}&signature=${signature}`;
}

function buildCoinbaseJwt({ keyName, privateKey, method, host, path, now = Math.floor(Date.now() / 1000), nonce = crypto.randomBytes(16).toString('hex') }) {
  const header = { alg: 'ES256', kid: keyName, nonce, typ: 'JWT' };
  const payload = { sub: keyName, iss: 'cdp', nbf: now, exp: now + 120, uri: `${String(method).toUpperCase()} ${host}${path}` };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${signature.toString('base64url')}`;
}

function normalizeBinanceFuturesAccount(account = {}) {
  const positions = (Array.isArray(account.positions) ? account.positions : [])
    .map((position) => {
      const qty = number(position.positionAmt);
      if (!qty) return null;
      const suppliedMark = number(position.markPrice, NaN);
      const notional = number(position.notional, NaN);
      const mark = Number.isFinite(suppliedMark) && suppliedMark > 0
        ? suppliedMark
        : Number.isFinite(notional) ? Math.abs(notional / qty) : null;
      return {
        symbol: String(position.symbol || ''),
        side: qty > 0 ? 'LONG' : 'SHORT',
        qty: Math.abs(qty),
        entry: number(position.entryPrice),
        mark,
        pnl: number(position.unrealizedProfit),
        leverage: number(position.leverage),
        liquidationPrice: number(position.liquidationPrice),
      };
    })
    .filter(Boolean);
  return {
    balance: number(account.totalWalletBalance),
    marginAvailable: number(account.availableBalance),
    totalMargin: number(account.totalMarginBalance),
    positions,
    orders: [],
  };
}

function normalizeBinanceSpotAccount(account = {}, prices = {}) {
  let balance = 0;
  let marginAvailable = 0;
  const positions = [];
  for (const item of Array.isArray(account.balances) ? account.balances : []) {
    const asset = String(item.asset || '').toUpperCase();
    const free = number(item.free);
    const locked = number(item.locked);
    const qty = free + locked;
    if (!asset || qty <= 0) continue;
    if (USD_ASSETS.has(asset)) {
      balance += qty;
      marginAvailable += free;
      continue;
    }
    const symbol = `${asset}USD`;
    const mark = number(prices[symbol] ?? prices[`${asset}USDT`], NaN);
    if (Number.isFinite(mark)) balance += qty * mark;
    positions.push({ symbol, side: 'LONG', qty, entry: null, mark: Number.isFinite(mark) ? mark : null, pnl: null, leverage: null, liquidationPrice: null });
  }
  return { balance, marginAvailable, totalMargin: balance, positions, orders: [] };
}

function normalizeCoinbaseAccounts(payload = {}, prices = {}) {
  let balance = 0;
  let marginAvailable = 0;
  const positions = [];
  for (const account of Array.isArray(payload.accounts) ? payload.accounts : []) {
    const asset = String(account.currency || '').toUpperCase();
    const free = number(account.available_balance?.value);
    const hold = number(account.hold?.value);
    const qty = free + hold;
    if (!asset || qty <= 0) continue;
    if (USD_ASSETS.has(asset)) {
      balance += qty;
      marginAvailable += free;
      continue;
    }
    const mark = number(prices[asset], NaN);
    if (Number.isFinite(mark)) balance += qty * mark;
    positions.push({ symbol: `${asset}-USD`, side: 'LONG', qty, entry: null, mark: Number.isFinite(mark) ? mark : null, pnl: null, leverage: null, liquidationPrice: null });
  }
  return { balance, marginAvailable, totalMargin: balance, positions, orders: [] };
}

async function readJson(response) {
  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw }; }
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_details || `Exchange returned HTTP ${response.status}.`;
    const error = new Error(String(message).slice(0, 500));
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function exchangeRequest(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, {
    method: options.method || 'GET',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    body: options.body,
    redirect: 'manual',
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(20000) : undefined,
  });
  if (response.status >= 300 && response.status < 400) throw new Error('Exchange redirects are not allowed.');
  return readJson(response);
}

async function directFetch(fetchImpl, url, options = {}) {
  return exchangeRequest(fetchImpl, url, { ...options, method: 'GET' });
}

async function fetchExchangeAccount(exchange, input, fetchImpl = fetch, now = Date.now()) {
  const credentials = validateCredentials(exchange, input);
  if (exchange === 'binance') {
    const query = signBinanceParams({ timestamp: now, recvWindow: 5000 }, credentials.secret);
    const payload = await directFetch(fetchImpl, `https://fapi.binance.com/fapi/v3/account?${query}`, {
      headers: { 'X-MBX-APIKEY': credentials.key },
    });
    return normalizeBinanceFuturesAccount(payload);
  }
  if (exchange === 'binance_us') {
    const query = signBinanceParams({ timestamp: now, recvWindow: 5000 }, credentials.secret);
    const [account, tickers] = await Promise.all([
      directFetch(fetchImpl, `https://api.binance.us/api/v3/account?${query}`, { headers: { 'X-MBX-APIKEY': credentials.key } }),
      directFetch(fetchImpl, 'https://api.binance.us/api/v3/ticker/price'),
    ]);
    const prices = Object.fromEntries((Array.isArray(tickers) ? tickers : []).map((ticker) => [ticker.symbol, number(ticker.price, NaN)]));
    return normalizeBinanceSpotAccount(account, prices);
  }

  const host = 'api.coinbase.com';
  const accountsPath = '/api/v3/brokerage/accounts';
  const accountsToken = buildCoinbaseJwt({ keyName: credentials.key, privateKey: credentials.secret, method: 'GET', host, path: accountsPath, now: Math.floor(now / 1000) });
  const accounts = await directFetch(fetchImpl, `https://${host}${accountsPath}?limit=250`, { headers: { Authorization: `Bearer ${accountsToken}` } });
  const assets = [...new Set((Array.isArray(accounts.accounts) ? accounts.accounts : [])
    .map((account) => String(account.currency || '').toUpperCase())
    .filter((asset) => asset && !USD_ASSETS.has(asset)))].slice(0, 30);
  const priceEntries = await Promise.all(assets.map(async (asset) => {
    const productPath = `/api/v3/brokerage/products/${encodeURIComponent(asset)}-USD`;
    const token = buildCoinbaseJwt({ keyName: credentials.key, privateKey: credentials.secret, method: 'GET', host, path: productPath, now: Math.floor(now / 1000) });
    try {
      const product = await directFetch(fetchImpl, `https://${host}${productPath}`, { headers: { Authorization: `Bearer ${token}` } });
      return [asset, number(product.price, NaN)];
    } catch {
      return [asset, NaN];
    }
  }));
  return normalizeCoinbaseAccounts(accounts, Object.fromEntries(priceEntries));
}

function validatePositionForClose(position) {
  const source = position && typeof position === 'object' ? position : {};
  const symbol = String(source.symbol || '').trim().toUpperCase();
  const side = String(source.side || '').trim().toUpperCase();
  const qty = Number(source.qty);
  if (!/^[A-Z0-9._-]{2,50}$/.test(symbol)) throw new Error('A valid position symbol is required.');
  if (!['LONG', 'SHORT'].includes(side)) throw new Error('A valid position side is required.');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('A positive position quantity is required.');
  return { symbol, side, qty };
}

async function closeExchangePosition(exchange, input, position, fetchImpl = fetch, now = Date.now()) {
  const credentials = validateCredentials(exchange, input);
  const selected = validatePositionForClose(position);
  const orderSide = selected.side === 'LONG' ? 'SELL' : 'BUY';
  if (exchange === 'binance') {
    const query = signBinanceParams({
      symbol: selected.symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: selected.qty,
      reduceOnly: 'true',
      timestamp: now,
      recvWindow: 5000,
    }, credentials.secret);
    const payload = await exchangeRequest(fetchImpl, `https://fapi.binance.com/fapi/v1/order?${query}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': credentials.key },
    });
    return { exchange, symbol: selected.symbol, side: orderSide, quantity: selected.qty, orderId: payload.orderId || null };
  }
  if (exchange === 'binance_us') {
    if (selected.side !== 'LONG') throw new Error('Binance US spot positions can only be closed from a LONG holding.');
    const query = signBinanceParams({
      symbol: selected.symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: selected.qty,
      timestamp: now,
      recvWindow: 5000,
    }, credentials.secret);
    const payload = await exchangeRequest(fetchImpl, `https://api.binance.us/api/v3/order?${query}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': credentials.key },
    });
    return { exchange, symbol: selected.symbol, side: orderSide, quantity: selected.qty, orderId: payload.orderId || null };
  }
  if (selected.side !== 'LONG') throw new Error('Coinbase spot positions can only be closed from a LONG holding.');
  const orderPath = '/api/v3/brokerage/orders';
  const token = buildCoinbaseJwt({ keyName: credentials.key, privateKey: credentials.secret, method: 'POST', host: 'api.coinbase.com', path: orderPath, now: Math.floor(now / 1000) });
  const payload = await exchangeRequest(fetchImpl, 'https://api.coinbase.com/api/v3/brokerage/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_order_id: crypto.randomUUID(),
      product_id: selected.symbol,
      side: orderSide,
      order_configuration: { market_market_ioc: { base_size: String(selected.qty) } },
    }),
  });
  return {
    exchange,
    symbol: selected.symbol,
    side: orderSide,
    quantity: selected.qty,
    orderId: payload.success_response?.order_id || payload.order_id || null,
  };
}

module.exports = {
  buildCoinbaseJwt,
  closeExchangePosition,
  fetchExchangeAccount,
  normalizeBinanceFuturesAccount,
  normalizeBinanceSpotAccount,
  normalizeCoinbaseAccounts,
  signBinanceParams,
  validateCredentials,
};
