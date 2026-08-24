const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { URL } = require('node:url');
const { closeExchangePosition, fetchExchangeAccount, validateCredentials } = require('./local-exchanges.cjs');
const { buildHermesSetupUrl, classifyHermesStatus } = require('./hermes-agent.cjs');
const {
  buildAssistantPrompt,
  buildHermesArgs,
  classifyAssistantTransportError,
  parseHermesResult,
  parseLocalParameterRequest,
  sanitizeAssistantRequest,
} = require('./assistant-chat.cjs');
const { getBotConfig, saveBotConfig } = require('./bot-config.cjs');
const { injectAssistantPreferences, readAgentPreferences, saveAgentPreferences } = require('./agent-preferences.cjs');

const execFileAsync = promisify(execFile);

const APP_ROOT = __dirname;
const PAGE_PATH = '/renderer/index.html';
const ALLOWED_EXCHANGES = new Set(['binance', 'binance_us', 'coinbase']);
const monitorState = new Map();
const SMOKE_MODE = process.argv.includes('--smoke-test');
const ASSISTANT_SMOKE = process.argv.includes('--assistant-smoke');
const ASSISTANT_GREETING_SMOKE = process.argv.includes('--assistant-greeting-smoke');
let staticServer = null;
let windowRef = null;
let ipcRegistered = false;
let hermesCommandPromise = null;
let assistantTransportBlock = null;

if (SMOKE_MODE) app.disableHardwareAcceleration();

function exchangeId(value) {
  const exchange = String(value || '');
  if (!ALLOWED_EXCHANGES.has(exchange)) throw Object.assign(new Error('Unsupported exchange.'), { status: 400 });
  return exchange;
}

function vaultPath() {
  return path.join(app.getPath('userData'), 'exchange-credentials.dpapi.json');
}

function botConfigPath() {
  return path.join(app.getPath('userData'), 'bot-config.json');
}

function agentPreferencesPath() {
  return path.join(app.getPath('userData'), 'agent-preferences.json');
}

function readVault() {
  const file = vaultPath();
  if (!fs.existsSync(file)) return {};
  let encrypted;
  try { encrypted = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('The local credential vault is unreadable.'); }
  if (!encrypted || encrypted.version !== 1 || typeof encrypted.records !== 'object') throw new Error('The local credential vault has an invalid format.');
  return encrypted.records;
}

function writeVault(records) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is not available.');
  const file = vaultPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ version: 1, records }, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}

function decryptCredential(exchange) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is not available.');
  const encoded = readVault()[exchange];
  if (!encoded) return null;
  try {
    const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    return validateCredentials(exchange, JSON.parse(decrypted));
  } catch {
    throw new Error(`Stored credentials for ${exchange} cannot be decrypted by this Windows user.`);
  }
}

function saveCredential(exchange, input) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is not available.');
  const credentials = validateCredentials(exchange, input);
  const records = readVault();
  records[exchange] = safeStorage.encryptString(JSON.stringify(credentials)).toString('base64');
  writeVault(records);
}

function deleteCredential(exchange) {
  const records = readVault();
  delete records[exchange];
  writeVault(records);
}

async function commandSucceeds(file, args, timeout = 3000) {
  try {
    const result = await execFileAsync(file, args, { windowsHide: true, timeout, encoding: 'utf8' });
    return { ok: true, stdout: result.stdout || '' };
  } catch {
    return { ok: false, stdout: '' };
  }
}

async function findHermesCommand() {
  if (hermesCommandPromise) return hermesCommandPromise;
  hermesCommandPromise = (async () => {
    const candidates = [];
    if (process.platform === 'win32') {
      const located = await commandSucceeds('where.exe', ['hermes.exe']);
      const first = String(located.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (first) candidates.push(first);
      const localAppData = process.env.LOCALAPPDATA || '';
      const userProfile = process.env.USERPROFILE || '';
      if (localAppData) candidates.push(path.join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'));
      if (userProfile) candidates.push(path.join(userProfile, 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'));
    } else {
      candidates.push('hermes');
    }
    const seen = new Set();
    for (const candidate of candidates) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      const result = await commandSucceeds(candidate, ['--version'], 5000);
      if (result.ok) return { command: candidate, version: String(result.stdout || '').trim().split(/\r?\n/)[0] };
    }
    hermesCommandPromise = null;
    return null;
  })();
  return hermesCommandPromise;
}

async function inspectHermes() {
  const runtime = await findHermesCommand();
  const installed = Boolean(runtime);
  return {
    status: classifyHermesStatus({ installed, healthy: installed }),
    installed,
    configured: installed,
    version: runtime?.version || null,
    architecture: process.arch,
    setupSupported: true,
  };
}

async function openHermesSetup(input) {
  const action = String(input?.action || '');
  if (action === 'continue') return { opened: false, targetKind: 'in-app' };
  const target = buildHermesSetupUrl(action);
  if (SMOKE_MODE) return { opened: true, targetKind: 'official-hermes-docs', dryRun: true };
  await shell.openExternal(target);
  return { opened: true, targetKind: 'official-hermes-docs' };
}

async function requestAssistant(input) {
  const request = sanitizeAssistantRequest(input);
  const localParameterAction = parseLocalParameterRequest(request.message, request.history);
  if (localParameterAction) return localParameterAction;

  if (assistantTransportBlock && assistantTransportBlock.expiresAt > Date.now()) {
    throw Object.assign(new Error(assistantTransportBlock.message), { status: 429 });
  }
  assistantTransportBlock = null;

  try {
    const runtime = await findHermesCommand();
    if (!runtime) throw Object.assign(new Error('Hermes Agent is not installed or is not available in PATH.'), { status: 503 });
    const prompt = injectAssistantPreferences(
      buildAssistantPrompt(request),
      readAgentPreferences(agentPreferencesPath()).instructions,
    );
    const result = await execFileAsync(runtime.command, buildHermesArgs(prompt), {
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'utf8',
    });
    return parseHermesResult(result.stdout);
  } catch (error) {
    if (/structured JSON|empty reply|invalid JSON/i.test(String(error?.message || ''))) throw error;
    const classified = classifyAssistantTransportError(error);
    if (classified.kind === 'usage-limit') {
      assistantTransportBlock = {
        message: classified.message,
        expiresAt: Date.now() + classified.cacheMs,
      };
    }
    const status = classified.kind === 'usage-limit' ? 429 : classified.kind === 'timeout' ? 504 : classified.kind === 'not-installed' ? 503 : 502;
    throw Object.assign(new Error(classified.message), { status });
  }
}

function failure(error, secrets = []) {
  let message = String(error?.message || 'Local request failed.');
  for (const secret of secrets) {
    if (secret && secret.length >= 4) message = message.split(secret).join('[REDACTED]');
  }
  message = message.replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, '[REDACTED]');
  return { ok: false, status: Number.isInteger(error?.status) ? error.status : 502, payload: { error: { message: message.slice(0, 500) } } };
}

function registerIpc() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('hermes:status', async () => {
    try { return { ok: true, status: 200, payload: await inspectHermes() }; } catch (error) { return failure(error); }
  });

  ipcMain.handle('hermes:setup', async (_event, input) => {
    try { return { ok: true, status: 200, payload: await openHermesSetup(input) }; } catch (error) { return failure(error); }
  });

  ipcMain.handle('assistant:chat', async (_event, input) => {
    try { return { ok: true, status: 200, payload: await requestAssistant(input) }; } catch (error) { return failure(error); }
  });

  ipcMain.handle('bot:config', async (_event, input) => {
    try {
      const exchange = exchangeId(input?.exchange);
      const action = String(input?.action || 'get');
      if (action === 'get') return { ok: true, status: 200, payload: { exchange, config: getBotConfig(botConfigPath(), exchange) } };
      if (action === 'save') return { ok: true, status: 200, payload: { exchange, config: saveBotConfig(botConfigPath(), exchange, input?.config) } };
      throw Object.assign(new Error('Bot configuration action is not allowed.'), { status: 403 });
    } catch (error) { return failure(error); }
  });

  ipcMain.handle('agent:preferences', async (_event, input) => {
    try {
      const action = String(input?.action || 'get');
      if (action === 'get') return { ok: true, status: 200, payload: readAgentPreferences(agentPreferencesPath()) };
      if (action === 'save') return { ok: true, status: 200, payload: saveAgentPreferences(agentPreferencesPath(), input) };
      throw Object.assign(new Error('Agent preferences action is not allowed.'), { status: 403 });
    } catch (error) { return failure(error); }
  });

  ipcMain.handle('exchange:credentials', async (_event, input) => {
    try {
      const exchange = exchangeId(input?.exchange);
      const action = String(input?.action || 'get');
      if (action === 'get') return { ok: true, status: 200, payload: { hasCredentials: Boolean(decryptCredential(exchange)), encryption: 'Windows safeStorage' } };
      if (action === 'set') {
        saveCredential(exchange, { key: input?.key, secret: input?.secret });
        return { ok: true, status: 200, payload: { hasCredentials: true, encryption: 'Windows safeStorage' } };
      }
      if (action === 'update') {
        const existing = decryptCredential(exchange);
        if (!existing) throw Object.assign(new Error('Save local API credentials for this exchange first.'), { status: 404 });
        saveCredential(exchange, {
          key: input?.key === undefined ? existing.key : input.key,
          secret: input?.secret === undefined ? existing.secret : input.secret,
        });
        return { ok: true, status: 200, payload: { hasCredentials: true, encryption: 'Windows safeStorage' } };
      }
      if (action === 'delete') {
        deleteCredential(exchange);
        monitorState.set(exchange, false);
        return { ok: true, status: 200, payload: { hasCredentials: false, encryption: 'Windows safeStorage' } };
      }
      throw Object.assign(new Error('Credential action is not allowed.'), { status: 403 });
    } catch (error) { return failure(error, [String(input?.key || ''), String(input?.secret || '')]); }
  });

  ipcMain.handle('exchange:account', async (_event, input) => {
    let credentials;
    try {
      const exchange = exchangeId(input?.exchange);
      credentials = decryptCredential(exchange);
      if (!credentials) throw Object.assign(new Error('Save local API credentials for this exchange first.'), { status: 404 });
      const account = await fetchExchangeAccount(exchange, credentials);
      return { ok: true, status: 200, payload: { ...account, exchange, monitorRunning: Boolean(monitorState.get(exchange)), updatedAt: new Date().toISOString() } };
    } catch (error) { return failure(error, [credentials?.key, credentials?.secret]); }
  });

  ipcMain.handle('exchange:close-position', async (_event, input) => {
    let credentials;
    try {
      const exchange = exchangeId(input?.exchange);
      credentials = decryptCredential(exchange);
      if (!credentials) throw Object.assign(new Error('Save local API credentials for this exchange first.'), { status: 404 });
      const requested = input?.position && typeof input.position === 'object' ? input.position : {};
      const liveAccount = await fetchExchangeAccount(exchange, credentials);
      const livePosition = (liveAccount.positions || []).find((position) => String(position.symbol) === String(requested.symbol) && String(position.side) === String(requested.side));
      if (!livePosition) throw Object.assign(new Error('The selected position is no longer open. Refresh positions and try again.'), { status: 409 });
      const requestedQty = Number(requested.qty);
      const liveQty = Number(livePosition.qty);
      const sameQuantity = Number.isFinite(requestedQty) && Number.isFinite(liveQty) && Math.abs(requestedQty - liveQty) <= Math.max(1e-8, Math.abs(liveQty) * 1e-8);
      if (!sameQuantity) throw Object.assign(new Error('The selected position changed. Refresh positions and confirm the current quantity.'), { status: 409 });
      const result = await closeExchangePosition(exchange, credentials, livePosition);
      return { ok: true, status: 200, payload: result };
    } catch (error) { return failure(error, [credentials?.key, credentials?.secret]); }
  });

  ipcMain.handle('monitor:status', async (_event, input) => {
    try {
      const exchange = exchangeId(input?.exchange);
      return { ok: true, status: 200, payload: { running: Boolean(monitorState.get(exchange)) } };
    } catch (error) { return failure(error); }
  });

  ipcMain.handle('monitor:start', async (_event, input) => {
    try {
      const exchange = exchangeId(input?.exchange);
      if (!decryptCredential(exchange)) throw Object.assign(new Error('Save local API credentials for this exchange first.'), { status: 404 });
      monitorState.set(exchange, true);
      return { ok: true, status: 200, payload: { running: true } };
    } catch (error) { return failure(error); }
  });

  ipcMain.handle('monitor:stop', async (_event, input) => {
    try {
      const exchange = exchangeId(input?.exchange);
      monitorState.set(exchange, false);
      return { ok: true, status: 200, payload: { running: false } };
    } catch (error) { return failure(error); }
  });
}

function sendStatic(response, status, body, type) {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      try {
        const target = new URL(request.url, 'http://127.0.0.1');
        const decoded = decodeURIComponent(target.pathname === '/' ? PAGE_PATH : target.pathname);
        const candidate = path.resolve(APP_ROOT, `.${decoded.replace(/\\/g, '/')}`);
        if (candidate !== APP_ROOT && !candidate.startsWith(`${APP_ROOT}${path.sep}`)) return sendStatic(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
        const stats = fs.statSync(candidate);
        const file = stats.isDirectory() ? path.join(candidate, 'index.html') : candidate;
        const ext = path.extname(file).toLowerCase();
        const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
        sendStatic(response, 200, fs.readFileSync(file), types[ext] || 'application/octet-stream');
      } catch {
        sendStatic(response, 404, 'Not found', 'text/plain; charset=utf-8');
      }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function createWindow(smoke = false) {
  staticServer = await startStaticServer();
  const { port } = staticServer.address();
  registerIpc();
  const win = new BrowserWindow({
    width: 1488,
    height: 965,
    minWidth: 1180,
    minHeight: 760,
    show: !smoke,
    backgroundColor: '#06070b',
    title: 'Synapse Labs Trading Bot',
    autoHideMenuBar: true,
    icon: path.join(APP_ROOT, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !smoke,
    },
  });
  windowRef = win;
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (new URL(navigationUrl).origin !== `http://127.0.0.1:${port}`) event.preventDefault();
  });
  await win.loadURL(`http://127.0.0.1:${port}${PAGE_PATH}`);

  if (smoke) {
    const errors = [];
    win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    const result = await win.webContents.executeJavaScript(`(() => ({
      ready: document.readyState,
      title: document.title,
      headerCount: document.querySelectorAll('header').length,
      footerCount: document.querySelectorAll('footer').length,
      sharedStyle: [...document.styleSheets].some((sheet) => sheet.href?.includes('/assets/css/style.css')),
      logoLoaded: document.querySelector('.brand-logo')?.complete && document.querySelector('.brand-logo')?.naturalWidth > 0,
      arrowAgentOnly: document.querySelector('#agent-panel h2')?.textContent.trim() === 'Arrow Agent'
        && !/runtime-only assistant/i.test(document.getElementById('agent-panel')?.innerText || '')
        && document.getElementById('agent-avatar')?.getAttribute('src') === '/assets/images/Arrow Bot.png'
        && !document.querySelector('[name="agent-mode"]'),
      guidedHermesSetup: document.getElementById('settings-dialog')?.innerText.includes('Hermes Agent')
        && Boolean(document.getElementById('hermes-install-status'))
        && Boolean(document.getElementById('hermes-runtime-status'))
        && Boolean(document.getElementById('hermes-primary-action'))
        && !document.getElementById('hermes-url')
        && !document.getElementById('hermes-token'),
      noLegacyRouteText: !/Backend-managed|Managed remote assistant/i.test(document.body.innerText),
      emptyMetricsUnavailable: ['metric-balance', 'metric-margin', 'metric-total'].every((id) => document.getElementById(id)?.textContent === '—'),
      bottomLayout: {
        viewport: innerHeight,
        shell: (() => { const r = document.querySelector('.desktop-shell')?.getBoundingClientRect(); return { top: r?.top, bottom: r?.bottom, height: r?.height }; })(),
        rail: (() => { const r = document.querySelector('.app-rail')?.getBoundingClientRect(); return { top: r?.top, bottom: r?.bottom, height: r?.height }; })(),
        panel: (() => { const r = document.querySelector('.agent-panel')?.getBoundingClientRect(); return { top: r?.top, bottom: r?.bottom, height: r?.height }; })(),
        form: (() => { const r = document.querySelector('.agent-form')?.getBoundingClientRect(); return { top: r?.top, bottom: r?.bottom, height: r?.height }; })(),
        sendButtonBottom: document.getElementById('send-agent')?.getBoundingClientRect().bottom,
        versionBottom: document.getElementById('desktop-version')?.getBoundingClientRect().bottom
      },
      bottomControlsVisible: document.getElementById('send-agent')?.getBoundingClientRect().bottom <= innerHeight - 12
        && document.getElementById('desktop-version')?.getBoundingClientRect().bottom <= innerHeight - 12,
      nativeTextEditing: ['exchange-api-key', 'exchange-api-secret', 'agent-input']
        .every((id) => document.getElementById(id)?.dataset.nativeTextEditing === 'enabled'),
      exchangeDataTabs: document.getElementById('positions-tab')?.textContent.trim() === 'Open positions'
        && document.getElementById('orders-tab')?.textContent.trim() === 'Pending Orders'
        && document.getElementById('positions-panel')?.hidden === false
        && document.getElementById('orders-panel')?.hidden === true
        && Boolean(document.getElementById('orders-body')),
      platform: window.synapseDesktop?.platform || null
    }))()`);
    const interactions = await win.webContents.executeJavaScript(`(async () => {
      const dialog = document.getElementById('settings-dialog');
      document.getElementById('open-settings').click();
      const dialogOpened = dialog.open;
      const hermesStatus = await window.synapseDesktop.hermesStatus();
      const hermesAction = await window.synapseDesktop.hermesSetup({ action: 'setup' });
      dialog.close();
      const credentials = await window.synapseDesktop.exchangeCredentials({ action: 'get', exchange: 'binance' });
      const monitor = await window.synapseDesktop.monitorStatus('binance');
      return {
        dialogOpened,
        dialogClosed: !dialog.open,
        hermesStatusAvailable: hermesStatus.ok && ['not-installed', 'setup-required', 'ready'].includes(hermesStatus.payload?.status),
        hermesActionAllowlisted: hermesAction.ok && hermesAction.payload?.dryRun === true && hermesAction.payload?.targetKind === 'official-hermes-docs',
        credentialVaultAvailable: credentials.ok && /safeStorage/i.test(credentials.payload?.encryption || ''),
        monitorLocal: monitor.ok && monitor.payload?.running === false
      };
    })()`);
    let assistantInteraction = null;
    if (ASSISTANT_GREETING_SMOKE) {
      assistantInteraction = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (test, timeout = 180000) => {
          const started = Date.now();
          while (!test()) {
            if (Date.now() - started > timeout) throw new Error('Greeting smoke timed out.');
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        };
        await waitFor(() => document.getElementById('agent-status')?.textContent === 'READY', 10000);
        const input = document.getElementById('agent-input');
        input.value = 'hola';
        document.getElementById('agent-form').requestSubmit();
        await waitFor(() => document.getElementById('send-agent')?.textContent === 'Send'
          && document.getElementById('agent-status')?.textContent === 'READY'
          && document.querySelectorAll('#agent-chat .chat-message').length >= 3);
        const messages = [...document.querySelectorAll('#agent-chat .chat-message p')].map((node) => node.textContent);
        const responseMessages = messages.slice(2);
        return {
          responseRendered: responseMessages.some((message) => Boolean(message.trim())),
          userRendered: messages.some((message) => message === 'hola'),
          noActions: document.querySelectorAll('.assistant-action-button').length === 0,
          inputCleared: input.value === '',
          readyRestored: document.getElementById('agent-status')?.textContent === 'READY',
          responseCount: responseMessages.length,
        };
      })()`);
    } else if (ASSISTANT_SMOKE) {
      assistantInteraction = await win.webContents.executeJavaScript(`(async () => {
      const waitFor = async (test, timeout = 160000) => {
        const started = Date.now();
        while (!test()) {
          if (Date.now() - started > timeout) throw new Error('Assistant smoke timed out.');
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      };
      await waitFor(() => document.getElementById('agent-status')?.textContent === 'READY', 10000);
      const exchange = document.getElementById('exchange-select');
      const beforeExchange = exchange.value;
      const input = document.getElementById('agent-input');
      input.value = 'Cambia el exchange activo a Coinbase';
      document.getElementById('agent-form').requestSubmit();
      await waitFor(() => document.querySelectorAll('.assistant-action-button').length > 0
        && document.getElementById('send-agent')?.textContent === 'Send'
        && document.getElementById('agent-status')?.textContent === 'READY');
      const messages = [...document.querySelectorAll('#agent-chat .chat-message p')].map((node) => node.textContent);
      const actionButtons = [...document.querySelectorAll('.assistant-action-button')];
      const actions = actionButtons.map((node) => node.textContent);
      const exchangeUnchangedBeforeConfirmation = beforeExchange === 'binance' && exchange.value === beforeExchange;
      actionButtons[0].click();
      await waitFor(() => exchange.value === 'coinbase' && actionButtons[0].textContent === 'Applied', 30000);
      return {
        responseRendered: messages.some((message) => /Coinbase/i.test(message)),
        confirmationRendered: actions.includes('Apply: switch to Coinbase'),
        exchangeUnchangedBeforeConfirmation,
        actionAppliedAfterConfirmation: exchange.value === 'coinbase',
        messageCount: messages.length,
        actions,
      };
    })()`);
    }
    const screenshotArg = process.argv.find((value) => value.startsWith('--smoke-screenshot='));
    let screenshot = null;
    if (screenshotArg) {
      if (ASSISTANT_SMOKE || ASSISTANT_GREETING_SMOKE) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      }
      screenshot = path.resolve(screenshotArg.slice('--smoke-screenshot='.length));
      const image = await win.webContents.capturePage();
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      fs.writeFileSync(screenshot, image.toPNG());
    }
    const encryptionProbe = safeStorage.encryptString('synapse-local-smoke');
    const encryptionRoundTrip = safeStorage.decryptString(encryptionProbe) === 'synapse-local-smoke';
    const smokePassed = result.ready === 'complete'
      && result.headerCount === 0
      && result.footerCount === 0
      && result.sharedStyle
      && result.logoLoaded
      && result.arrowAgentOnly
      && result.guidedHermesSetup
      && result.noLegacyRouteText
      && result.emptyMetricsUnavailable
      && result.bottomControlsVisible
      && result.nativeTextEditing
      && result.exchangeDataTabs
      && result.platform === 'win32'
      && encryptionRoundTrip
      && Object.values(interactions).every(Boolean)
      && ((!ASSISTANT_SMOKE && !ASSISTANT_GREETING_SMOKE)
        || Object.values(assistantInteraction).filter((value) => typeof value === 'boolean').every(Boolean))
      && errors.length === 0;
    console.log(JSON.stringify({ ...result, interactions, assistantInteraction, encryptionRoundTrip, staticOrigin: `http://127.0.0.1:${port}`, screenshot, smokePassed, errorCount: errors.length, consoleErrors: errors.slice(0, 20) }));
    win.destroy();
    staticServer.close();
    staticServer = null;
    return smokePassed ? 0 : 2;
  }

  win.on('closed', () => {
    windowRef = null;
    if (staticServer) { staticServer.close(); staticServer = null; }
  });
  return 0;
}

app.setAppUserModelId('app.synapselabs.tradingbot.source');
app.whenReady().then(async () => {
  const code = await createWindow(SMOKE_MODE);
  if (SMOKE_MODE) app.exit(code);
  else app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(false); });
}).catch((error) => { console.error(error); app.exit(1); });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (staticServer) staticServer.close(); });
