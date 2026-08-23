const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  buildCoinbaseJwt,
  closeExchangePosition,
  fetchExchangeAccount,
  normalizeBinanceFuturesAccount,
  normalizeBinanceSpotAccount,
  normalizeCoinbaseAccounts,
  signBinanceParams,
  validateCredentials,
} = require('../local-exchanges.cjs');

test('Binance query signing uses HMAC SHA-256 without exposing the secret', () => {
  const signed = signBinanceParams({ timestamp: 1700000000000, recvWindow: 5000 }, 'top-secret');
  const query = 'timestamp=1700000000000&recvWindow=5000';
  const expected = crypto.createHmac('sha256', 'top-secret').update(query).digest('hex');
  assert.equal(signed, `${query}&signature=${expected}`);
  assert.equal(signed.includes('top-secret'), false);
});

test('credential validation distinguishes Binance and Coinbase key formats', () => {
  assert.deepEqual(validateCredentials('binance', { key: ' key ', secret: ' secret ' }), { key: 'key', secret: 'secret' });
  assert.deepEqual(validateCredentials('binance_us', { key: 'key', secret: 'secret' }), { key: 'key', secret: 'secret' });
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privateKeyPem = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
  assert.deepEqual(validateCredentials('coinbase', { key: 'organizations/o/apiKeys/k', secret: privateKeyPem }), { key: 'organizations/o/apiKeys/k', secret: privateKeyPem.trim() });
  assert.throws(() => validateCredentials('coinbase', { key: 'key', secret: 'not-a-pem' }), /private key/i);
  assert.throws(() => validateCredentials('unknown', { key: 'a', secret: 'b' }), /unsupported/i);
});

test('Coinbase credential validation restores escaped PEM newlines and JSON strings', () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
  const keyName = 'organizations/test/apiKeys/key';
  assert.equal(validateCredentials('coinbase', { key: keyName, secret: pem.replace(/\r?\n/g, '\\n') }).secret, pem.trim());
  assert.equal(validateCredentials('coinbase', { key: keyName, secret: JSON.stringify(pem) }).secret, pem.trim());
});

test('Binance Futures account is normalized into local dashboard fields', () => {
  const result = normalizeBinanceFuturesAccount({
    totalWalletBalance: '1250.50', availableBalance: '900.25', totalMarginBalance: '1270.75',
    positions: [
      { symbol: 'BTCUSDT', positionAmt: '0.01', entryPrice: '60000', notional: '620', unrealizedProfit: '20', leverage: '5', liquidationPrice: '49000' },
      { symbol: 'ETHUSDT', positionAmt: '0' },
    ],
  });
  assert.equal(result.balance, 1250.5);
  assert.equal(result.marginAvailable, 900.25);
  assert.equal(result.totalMargin, 1270.75);
  assert.deepEqual(result.positions, [{ symbol: 'BTCUSDT', side: 'LONG', qty: 0.01, entry: 60000, mark: 62000, pnl: 20, leverage: 5, liquidationPrice: 49000 }]);
});

test('Binance Futures closes only the selected position with a reduce-only market order', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ orderId: 123 }) };
  };
  const result = await closeExchangePosition('binance', { key: 'api-key', secret: 'api-secret' }, { symbol: 'BTCUSDT', side: 'LONG', qty: 0.01 }, fakeFetch, 1700000000000);
  assert.deepEqual(result, { exchange: 'binance', symbol: 'BTCUSDT', side: 'SELL', quantity: 0.01, orderId: 123 });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/fapi\.binance\.com\/fapi\/v1\/order\?/);
  assert.match(calls[0].url, /side=SELL/);
  assert.match(calls[0].url, /type=MARKET/);
  assert.match(calls[0].url, /reduceOnly=true/);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-MBX-APIKEY'], 'api-key');
});

test('Coinbase closes the selected spot holding with a market IOC sell', async () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const credentials = { key: 'organizations/test/apiKeys/key', secret: privateKey.export({ type: 'sec1', format: 'pem' }).toString() };
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ success_response: { order_id: 'order-123' } }) };
  };
  const result = await closeExchangePosition('coinbase', credentials, { symbol: 'ETH-USD', side: 'LONG', qty: 0.5 }, fakeFetch, 1700000000000);
  assert.deepEqual(result, { exchange: 'coinbase', symbol: 'ETH-USD', side: 'SELL', quantity: 0.5, orderId: 'order-123' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.coinbase.com/api/v3/brokerage/orders');
  assert.equal(calls[0].options.method, 'POST');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.order_configuration, { market_market_ioc: { base_size: '0.5' } });
  assert.equal(body.product_id, 'ETH-USD');
  assert.equal(body.side, 'SELL');
  assert.match(calls[0].options.headers.Authorization, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
});

test('Binance US spot balances are normalized with local public prices', () => {
  const result = normalizeBinanceSpotAccount({ balances: [
    { asset: 'USD', free: '100', locked: '0' },
    { asset: 'BTC', free: '0.01', locked: '0' },
    { asset: 'ZERO', free: '0', locked: '0' },
  ] }, { BTCUSD: 65000 });
  assert.equal(result.balance, 750);
  assert.equal(result.marginAvailable, 100);
  assert.equal(result.totalMargin, 750);
  assert.deepEqual(result.positions, [{ symbol: 'BTCUSD', side: 'LONG', qty: 0.01, entry: null, mark: 65000, pnl: null, leverage: null, liquidationPrice: null }]);
});

test('Coinbase accounts are normalized without inventing entry price or PnL', () => {
  const result = normalizeCoinbaseAccounts({ accounts: [
    { currency: 'USD', available_balance: { value: '200' }, hold: { value: '10' } },
    { currency: 'ETH', available_balance: { value: '0.5' }, hold: { value: '0' } },
  ] }, { ETH: 3000 });
  assert.equal(result.balance, 1710);
  assert.equal(result.marginAvailable, 200);
  assert.equal(result.totalMargin, 1710);
  assert.deepEqual(result.positions, [{ symbol: 'ETH-USD', side: 'LONG', qty: 0.5, entry: null, mark: 3000, pnl: null, leverage: null, liquidationPrice: null }]);
});

test('Coinbase JWT contains the official CDP claims and a verifiable ES256 signature', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const keyName = 'organizations/test/apiKeys/key';
  const token = buildCoinbaseJwt({ keyName, privateKey: privateKey.export({ type: 'sec1', format: 'pem' }), method: 'GET', host: 'api.coinbase.com', path: '/api/v3/brokerage/accounts', now: 1700000000, nonce: '00112233445566778899aabbccddeeff' });
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  assert.deepEqual(decode(headerPart), { alg: 'ES256', kid: keyName, nonce: '00112233445566778899aabbccddeeff', typ: 'JWT' });
  assert.deepEqual(decode(payloadPart), { sub: keyName, iss: 'cdp', nbf: 1700000000, exp: 1700000120, uri: 'GET api.coinbase.com/api/v3/brokerage/accounts' });
  assert.equal(crypto.verify('sha256', Buffer.from(`${headerPart}.${payloadPart}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signaturePart, 'base64url')), true);
});

test('Binance Futures account is fetched directly without a Synapse intermediary', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ totalWalletBalance: '10', availableBalance: '8', totalMarginBalance: '11', positions: [] }) };
  };
  const result = await fetchExchangeAccount('binance', { key: 'api-key', secret: 'api-secret' }, fakeFetch, 1700000000000);
  assert.equal(result.balance, 10);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/fapi\.binance\.com\/fapi\/v3\/account\?/);
  assert.match(calls[0].url, /timestamp=1700000000000/);
  assert.match(calls[0].url, /signature=[a-f0-9]{64}/);
  assert.equal(calls[0].options.headers['X-MBX-APIKEY'], 'api-key');
  assert.doesNotMatch(calls[0].url, /synapse|arrow/i);
});

test('Binance US account and public prices are fetched directly', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const body = String(url).includes('/ticker/price')
      ? [{ symbol: 'BTCUSD', price: '65000' }]
      : { balances: [{ asset: 'USD', free: '100', locked: '0' }, { asset: 'BTC', free: '0.01', locked: '0' }] };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  const result = await fetchExchangeAccount('binance_us', { key: 'api-key', secret: 'api-secret' }, fakeFetch, 1700000000000);
  assert.equal(result.balance, 750);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/api\.binance\.us\/api\/v3\/account\?/);
  assert.equal(calls[0].options.headers['X-MBX-APIKEY'], 'api-key');
  assert.equal(calls[1].url, 'https://api.binance.us/api/v3/ticker/price');
});

test('Coinbase accounts and product prices are fetched directly with short-lived JWTs', async () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const credentials = { key: 'organizations/test/apiKeys/key', secret: privateKey.export({ type: 'sec1', format: 'pem' }).toString() };
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const body = String(url).endsWith('/accounts?limit=250')
      ? { accounts: [{ currency: 'USD', available_balance: { value: '100' }, hold: { value: '0' } }, { currency: 'ETH', available_balance: { value: '0.5' }, hold: { value: '0' } }] }
      : { price: '3000' };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  const result = await fetchExchangeAccount('coinbase', credentials, fakeFetch, 1700000000000);
  assert.equal(result.balance, 1600);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.coinbase.com/api/v3/brokerage/accounts?limit=250');
  assert.match(calls[0].options.headers.Authorization, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
  assert.equal(calls[1].url, 'https://api.coinbase.com/api/v3/brokerage/products/ETH-USD');
});
