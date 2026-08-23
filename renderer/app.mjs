import { formatMoney, formatValue, numberOrNaN } from './formatters.mjs';

const $ = (selector) => document.querySelector(selector);
const MASKED_API_KEY = 'organizations/************************************/apiKeys/************************************';
const MASKED_API_SECRET = '-----BEGIN EC PRIVATE KEY-----\n*****************************************************************\n*****************************************************************\n*********************************/Q==\n-----END EC PRIVATE KEY-----\n';
const MASKED_GENERIC_CREDENTIAL = '****************************************************************';
const EXCHANGES = {
  binance: { label: 'Binance Global', mark: 'B', logo: '/assets/images/binance.png', market: 'PERPETUALS', keyLabel: 'API key', secretLabel: 'API secret', keyPlaceholder: 'Paste your Binance API key', secretPlaceholder: 'Paste your Binance API secret', help: 'Use a read-only Futures API key. Trading permission is not required.' },
  binance_us: { label: 'Binance US', mark: 'U', logo: '/assets/images/binance_us.png', market: 'SPOT', keyLabel: 'API key', secretLabel: 'API secret', keyPlaceholder: 'Paste your Binance US API key', secretPlaceholder: 'Paste your Binance US API secret', help: 'Use a read-only Binance US API key. Trading permission is not required.' },
  coinbase: { label: 'Coinbase', mark: 'C', logo: '/assets/images/coinbase logo.png', market: 'SPOT', keyLabel: 'CDP API key name', secretLabel: 'EC private key (PEM)', keyPlaceholder: 'organizations/{org_id}/apiKeys/{key_id}', secretPlaceholder: '-----BEGIN EC PRIVATE KEY-----\nPaste your private key here\n-----END EC PRIVATE KEY-----', help: 'Paste the complete CDP EC private key, including BEGIN and END lines. Trading permission is not required.' },
};

const BOT_PARAMETERS = [
  { key: 'POSITION_UPDATE_INTERVAL_MS', label: 'Position update interval (ms)', type: 'number', step: '250' },
  { key: 'TAKE_PROFIT_PERCENTAGE_OF_CAPITAL', label: 'Take profit percentage of capital', type: 'number', step: '0.1' },
  { key: 'PORCENTAJE_DCA_RELATIVO', label: 'DCA relative percentage', type: 'number', step: '1' },
  { key: 'DCA_DISTANCE_MULTIPLIERS', label: 'DCA distance multipliers', type: 'text', placeholder: '[1, 2]' },
  { key: 'SL_DISTANCE_MULTIPLIER', label: 'Stop-loss distance multiplier', type: 'number', step: '0.1' },
  { key: 'DCA_QTY_INCREMENT_PCT', label: 'DCA quantity increment (%)', type: 'number', step: '1' },
  { key: 'MIN_DCA_DISTANCE_PCT', label: 'Minimum DCA distance (%)', type: 'number', step: '0.1' },
  { key: 'MAX_OPEN_POSITIONS', label: 'Maximum open positions', type: 'number', step: '1' },
  { key: 'STOP_LOSS_PERCENTAGE', label: 'Stop-loss percentage', type: 'number', step: '0.1' },
  { key: 'DCA_PERCENT_INCREMENT', label: 'DCA percentage increment', type: 'number', step: '0.1' },
  { key: 'BREAKEVEN_ROI_THRESHOLD', label: 'Breakeven ROI threshold', type: 'number', step: '0.01' },
  { key: 'AUTO_SHUTDOWN_MINUTES', label: 'Auto-shutdown (minutes)', type: 'number', step: '1' },
];

const state = {
  exchange: 'coinbase',
  hasCredentials: false,
  running: false,
  config: null,
  account: { balance: null, marginAvailable: null, totalMargin: null, positions: [], orders: [], updatedAt: null },
  hermesStatus: 'checking',
  agentEnabled: false,
  refreshing: false,
  chatBusy: false,
  chatHistory: [],
  selectedPositionKey: null,
  conversationId: `desktop-${crypto.randomUUID()}`,
};

let automaticParameterQueue = Promise.resolve();
let automaticCloseTimer = null;

const elements = {
  exchange: $('#exchange-select'), exchangeMark: $('#exchange-mark'),
  runtimeSignal: $('#local-runtime-signal'), runtimeLabel: $('#local-runtime-label'),
  botStatus: $('#bot-status'), statusDetail: $('#status-detail'), statusOrbit: $('#status-orbit'),
  start: $('#start-bot'), stop: $('#stop-bot'), refresh: $('#refresh-data'),
  balance: $('#metric-balance'), margin: $('#metric-margin'), total: $('#metric-total'), positionCount: $('#metric-positions'), market: $('#metric-market'),
  positions: $('#positions-body'), ordersBody: $('#orders-body'), positionsTab: $('#positions-tab'), ordersTab: $('#orders-tab'), positionsPanel: $('#positions-panel'), ordersPanel: $('#orders-panel'), closePosition: $('#close-position'),
  activity: $('#activity-log'), toast: $('#toast-region'), clearActivity: $('#clear-activity'),
  settings: $('#settings-dialog'), settingsOpen: $('#open-settings'),
  help: $('#help-dialog'), helpOpen: $('#open-help'), helpMinimize: $('#help-minimize'), helpMaximize: $('#help-maximize'),
  agentToggle: $('#agent-toggle'), agentToggleState: $('#agent-toggle-state'),
  agentPreferencesInput: $('#agent-preferences'), agentPreferencesSave: $('#save-agent-preferences'), agentPreferencesStatus: $('#agent-preferences-status'),  parametersCard: $('#parameters-card'), parametersGrid: $('#parameters-grid'), parametersOpen: $('#open-parameters'), parametersDialog: $('#parameters-dialog'), parametersForm: $('#parameters-form'), parametersFields: $('#parameters-fields'), parametersStatus: $('#parameters-status'),
  hermesInstallStatus: $('#hermes-install-status'), hermesRuntimeStatus: $('#hermes-runtime-status'), hermesConnectionStatus: $('#hermes-connection-status'),
  hermesSummary: $('#hermes-setup-summary p'), hermesPrimary: $('#hermes-primary-action'), hermesCheck: $('#check-hermes'),
  agentStatus: $('#agent-status'), agentChat: $('#agent-chat'), agentForm: $('#agent-form'), agentInput: $('#agent-input'), agentContext: $('#agent-context-label'), sendAgent: $('#send-agent'),
  apiDialog: $('#api-dialog'), apiForm: $('#api-form'), apiStatus: $('#api-key-status'), apiKey: $('#exchange-api-key'), apiSecret: $('#exchange-api-secret'),
  keyLabel: $('#credential-key-label'), secretLabel: $('#credential-secret-label'), credentialHelp: $('#credential-help'), deleteKeys: $('#delete-api-keys'),
};

function enableNativeTextEditing(...fields) {
  for (const field of fields.filter(Boolean)) {
    field.dataset.nativeTextEditing = 'enabled';
    for (const eventName of ['copy', 'cut', 'paste', 'contextmenu']) {
      field.addEventListener(eventName, (event) => event.stopPropagation());
    }
    field.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'x', 'v'].includes(key)) event.stopPropagation();
    });
  }
}

function errorMessage(result, fallback = 'Local operation failed.') {
  return result?.payload?.error?.message || fallback;
}

function requireOk(result, fallback) {
  if (!result?.ok) throw new Error(errorMessage(result, fallback));
  return result.payload;
}

function setHermesStep(element, text, kind = '') {
  element.textContent = text;
  element.className = `hermes-step-state ${kind}`.trim();
}

function renderHermesStatus(payload = {}) {
  state.hermesStatus = payload.status || 'not-installed';
  const installed = state.hermesStatus !== 'not-installed';
  const ready = state.hermesStatus === 'ready';
  setHermesStep(elements.hermesInstallStatus, installed ? 'READY' : 'ACTION NEEDED', installed ? 'ready' : 'action');
  setHermesStep(elements.hermesRuntimeStatus, ready ? 'READY' : installed ? 'ACTION NEEDED' : 'WAITING', ready ? 'ready' : installed ? 'action' : '');
  setHermesStep(elements.hermesConnectionStatus, ready ? 'READY' : 'WAITING', ready ? 'ready' : '');
  elements.hermesPrimary.disabled = false;
  if (!installed) {
    elements.hermesSummary.textContent = 'Install Hermes Agent with the official installer, then return here and press Check again.';
    elements.hermesPrimary.textContent = 'Open Hermes installation guide';
    elements.hermesPrimary.dataset.action = 'download';
  } else if (!ready) {
    elements.hermesSummary.textContent = 'Hermes Agent was found but is not ready. Finish its setup, then press Check again.';
    elements.hermesPrimary.textContent = 'Open Hermes setup guide';
    elements.hermesPrimary.dataset.action = 'setup';
  } else {
    elements.hermesSummary.textContent = `Hermes Agent is ready${payload.version ? ` · ${payload.version}` : ''}. Continue in Synapse.`;
    elements.hermesPrimary.textContent = 'Continue in Synapse';
    elements.hermesPrimary.dataset.action = 'continue';
  }
  renderAgentMode();
}

function renderAgentMode() {
  const enabled = state.agentEnabled;
  const ready = state.hermesStatus === 'ready';
  const usable = enabled && ready && !state.chatBusy;
  elements.agentToggle.checked = enabled;
  elements.agentToggleState.textContent = enabled ? ready ? 'Active · Arrow ready' : 'Active · Setup needed' : 'Inactive · Normal mode';
  elements.agentInput.disabled = !usable;
  elements.sendAgent.disabled = !usable;
  if (!state.chatBusy) {
    elements.agentInput.placeholder = enabled
      ? ready ? 'Example: Which position needs protection first?' : 'Complete Agent Setup to enable Arrow assistance.'
      : 'Turn on AI Agent (Arrow) to start.';
  }
  elements.agentStatus.className = `agent-status ${enabled && ready ? 'online' : ''}`;
  elements.agentStatus.textContent = enabled && ready ? 'LIVE' : 'STANDBY';
}

function initAgentMode() {
  try {
    const modeVersion = localStorage.getItem('synapse:agent_mode_version');
    if (modeVersion !== '2') {
      state.agentEnabled = true;
      localStorage.setItem('synapse:agent_mode_version', '2');
      localStorage.setItem('synapse:agent_enabled', '1');
    } else {
      state.agentEnabled = localStorage.getItem('synapse:agent_enabled') !== '0';
    }
  } catch { state.agentEnabled = true; }
  elements.agentToggle.addEventListener('change', () => {
    state.agentEnabled = elements.agentToggle.checked;
    try { localStorage.setItem('synapse:agent_enabled', state.agentEnabled ? '1' : '0'); } catch {}
    renderAgentMode();
    toast(state.agentEnabled ? 'Arrow Agent assistance enabled.' : 'Normal mode enabled.', 'success');
    log(state.agentEnabled ? 'Arrow Agent assistance enabled.' : 'Arrow Agent assistance disabled.', state.agentEnabled ? 'success' : 'warn');
  });
  renderAgentMode();
}

async function refreshHermesStatus({ quiet = false } = {}) {
  elements.hermesCheck.disabled = true;
  elements.hermesPrimary.disabled = true;
  if (!quiet) elements.hermesSummary.textContent = 'Checking Hermes Agent installation and local configuration…';
  try {
    renderHermesStatus(requireOk(await window.synapseDesktop.hermesStatus(), 'Could not inspect Hermes Agent.'));
  } catch (error) {
    state.hermesStatus = 'not-installed';
    elements.hermesSummary.textContent = error.message;
    renderAgentMode();
    if (!quiet) toast(error.message, 'error');
  } finally {
    elements.hermesCheck.disabled = false;
  }
}

async function refreshAgentPreferences({ quiet = false } = {}) {
  try {
    const payload = requireOk(await window.synapseDesktop.agentPreferences({ action: 'get' }), 'Could not load Arrow Agent personalization.');
    elements.agentPreferencesInput.value = payload.instructions || '';
    elements.agentPreferencesStatus.textContent = payload.instructions ? 'Personalization saved locally.' : 'No local personalization saved.';
  } catch (error) {
    elements.agentPreferencesStatus.textContent = error.message;
    if (!quiet) toast(error.message, 'error');
  }
}

async function saveAgentPreferences() {
  elements.agentPreferencesSave.disabled = true;
  try {
    const payload = requireOk(await window.synapseDesktop.agentPreferences({
      action: 'save',
      instructions: elements.agentPreferencesInput.value,
    }), 'Could not save Arrow Agent personalization.');
    elements.agentPreferencesInput.value = payload.instructions || '';
    elements.agentPreferencesStatus.textContent = 'Personalization saved locally.';
    toast('Arrow Agent personalization saved locally.', 'success');
    log('Arrow Agent personalization updated.');
  } catch (error) {
    elements.agentPreferencesStatus.textContent = error.message;
    toast(error.message, 'error');
  } finally {
    elements.agentPreferencesSave.disabled = false;
  }
}

function toast(message, type = '') {
  const node = document.createElement('div');
  node.className = `toast ${type}`.trim();
  node.textContent = message;
  elements.toast.append(node);
  setTimeout(() => node.remove(), 3800);
}

function log(message, kind = 'success') {
  const item = document.createElement('li');
  item.innerHTML = `<time>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span class="activity-${kind}"></span><p></p>`;
  item.querySelector('p').textContent = message;
  elements.activity.prepend(item);
  while (elements.activity.children.length > 20) elements.activity.lastElementChild.remove();
}

function riskLabel(position) {
  const mark = numberOrNaN(position.mark);
  const liquidation = numberOrNaN(position.liquidationPrice);
  if (!Number.isFinite(mark) || !Number.isFinite(liquidation) || mark <= 0 || liquidation <= 0) return 'N/A';
  const distance = Math.abs(mark - liquidation) / mark;
  if (distance < 0.08) return 'CRITICAL';
  if (distance < 0.18) return 'HIGH';
  return 'NORMAL';
}

function positionKey(position) {
  return `${String(position.symbol || '')}:${String(position.side || '')}`;
}

function selectedPosition() {
  return (state.account.positions || []).find((position) => positionKey(position) === state.selectedPositionKey) || null;
}

function updateClosePositionState() {
  if (!elements.closePosition) return;
  elements.closePosition.disabled = !state.hasCredentials || !selectedPosition();
}

function renderPositions() {
  const positions = state.account.positions || [];
  elements.positions.replaceChildren();
  if (!positions.length) {
    state.selectedPositionKey = null;
    if (automaticCloseTimer) {
      clearTimeout(automaticCloseTimer);
      automaticCloseTimer = null;
    }
    const row = document.createElement('tr');
    row.className = 'empty-row';
    row.innerHTML = `<td colspan="8">${state.hasCredentials ? 'No open positions found on the selected exchange.' : 'Configure API access to load positions.'}`;
    elements.positions.append(row);
  } else {
    for (const position of positions) {
      const key = positionKey(position);
      const row = document.createElement('tr');
      row.className = `position-row${key === state.selectedPositionKey ? ' selected' : ''}`;
      const pnl = numberOrNaN(position.pnl);
      const pnlClass = !Number.isFinite(pnl) ? '' : pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      row.innerHTML = `
        <td class="position-select-cell"></td><td class="position-symbol"></td><td class="side-${String(position.side || '').toLowerCase()}"></td><td></td><td></td><td></td><td class="${pnlClass}"></td><td class="risk-chip"></td>`;
      const selector = document.createElement('input');
      selector.className = 'position-select';
      selector.type = 'radio';
      selector.name = 'open-position-selection';
      selector.value = key;
      selector.checked = key === state.selectedPositionKey;
      selector.setAttribute('aria-label', `Select ${position.symbol || 'open position'}`);
      selector.addEventListener('change', () => {
        state.selectedPositionKey = key;
        elements.positions.querySelectorAll('.position-row').forEach((item) => item.classList.toggle('selected', item === row));
        updateClosePositionState();
        scheduleAutomaticClosePosition();
      });
      row.children[0].append(selector);
      const cells = row.children;
      cells[1].textContent = position.symbol || '—';
      cells[2].textContent = position.side || '—';
      cells[3].textContent = formatValue(position.qty, 8);
      cells[4].textContent = formatMoney(position.entry);
      cells[5].textContent = formatMoney(position.mark);
      cells[6].textContent = Number.isFinite(pnl) ? `${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}` : '—';
      cells[7].textContent = riskLabel(position);
      elements.positions.append(row);
    }
  }
  elements.positionCount.textContent = String(positions.length);
  elements.agentContext.textContent = `${positions.length} position${positions.length === 1 ? '' : 's'} in context`;
  updateClosePositionState();
}

function renderPendingOrders() {
  const orders = state.account.orders || [];
  elements.ordersBody.replaceChildren();
  if (!orders.length) {
    const row = document.createElement('tr');
    row.className = 'empty-row';
    row.innerHTML = `<td colspan="7">${state.hasCredentials ? 'No pending orders found on the selected exchange.' : 'Configure API access to load pending orders.'}`;
    elements.ordersBody.append(row);
    return;
  }
  for (const order of orders) {
    const row = document.createElement('tr');
    row.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td></td><td></td>';
    const cells = row.children;
    cells[0].textContent = order.symbol || '—';
    cells[1].textContent = order.side || '—';
    cells[2].textContent = order.type || '—';
    cells[3].textContent = formatMoney(order.price);
    cells[4].textContent = formatValue(order.quantity ?? order.qty, 8);
    cells[5].textContent = order.status || '—';
    cells[6].textContent = order.reduceOnly === true ? 'Yes' : 'No';
    elements.ordersBody.append(row);
  }
}

function setDataView(view) {
  const showPositions = view === 'positions';
  elements.positionsPanel.hidden = !showPositions;
  elements.ordersPanel.hidden = showPositions;
  elements.positionsTab.classList.toggle('active', showPositions);
  elements.ordersTab.classList.toggle('active', !showPositions);
  elements.positionsTab.setAttribute('aria-selected', String(showPositions));
  elements.ordersTab.setAttribute('aria-selected', String(!showPositions));
  elements.closePosition.hidden = !showPositions;
}

function renderAccount() {
  elements.balance.textContent = formatMoney(state.account.balance);
  elements.margin.textContent = formatMoney(state.account.marginAvailable);
  elements.total.textContent = formatMoney(state.account.totalMargin);
  renderPositions();
  renderPendingOrders();
}

function renderStatus() {
  elements.start.disabled = !state.hasCredentials || state.running;
  elements.stop.disabled = !state.running;
  if (elements.statusOrbit) elements.statusOrbit.className = state.running ? 'active' : 'inactive';
  elements.botStatus.textContent = state.running ? 'RUNNING' : state.hasCredentials ? 'READY' : 'OFFLINE';
  elements.statusDetail.textContent = state.running ? 'Direct local monitoring' : state.hasCredentials ? 'Monitor stopped' : 'Local credentials required';
  elements.runtimeSignal.className = 'signal online';
  elements.runtimeLabel.textContent = `Local runtime · ${EXCHANGES[state.exchange].label}`;
}

function renderExchange() {
  const exchange = EXCHANGES[state.exchange];
  elements.exchangeMark.replaceChildren();
  const logo = document.createElement('img');
  logo.src = exchange.logo;
  logo.alt = '';
  logo.addEventListener('error', () => { elements.exchangeMark.textContent = exchange.mark; }, { once: true });
  elements.exchangeMark.append(logo);
  elements.market.textContent = exchange.market;
  elements.keyLabel.textContent = exchange.keyLabel;
  elements.secretLabel.textContent = exchange.secretLabel;
  elements.apiKey.placeholder = exchange.keyPlaceholder || '';
  elements.apiSecret.placeholder = exchange.secretPlaceholder || '';
  elements.credentialHelp.textContent = `${exchange.help} Preserve the PEM line breaks; literal \\n separators copied from JSON or .env are normalized automatically. Credentials are encrypted on this computer by Windows and sent directly only to ${exchange.label}.`;
}

function formatParameterValue(value) {
  return Array.isArray(value) ? `[${value.join(', ')}]` : String(value);
}

function renderParameters(config = {}) {
  state.config = config;
  if (!elements.parametersGrid) return;
  elements.parametersGrid.replaceChildren();
  for (const parameter of BOT_PARAMETERS) {
    const row = document.createElement('div');
    row.className = 'parameter-row';
    const label = document.createElement('span');
    label.className = 'parameter-label';
    label.textContent = parameter.label;
    const value = document.createElement('strong');
    value.className = 'parameter-value';
    value.textContent = formatParameterValue(config[parameter.key]);
    row.append(label, value);
    elements.parametersGrid.append(row);
  }
}

function openParametersDialog() {
  if (!elements.parametersDialog || !elements.parametersFields) return;
  elements.parametersFields.replaceChildren();
  const config = state.config || {};
  for (const parameter of BOT_PARAMETERS) {
    const label = document.createElement('label');
    label.className = 'parameter-field';
    const title = document.createElement('span');
    title.textContent = parameter.label;
    const input = document.createElement('input');
    input.dataset.parameterKey = parameter.key;
    input.type = parameter.type;
    input.value = formatParameterValue(config[parameter.key] ?? '');
    if (parameter.step) input.step = parameter.step;
    if (parameter.placeholder) input.placeholder = parameter.placeholder;
    input.autocomplete = 'off';
    label.append(title, input);
    elements.parametersFields.append(label);
  }
  elements.parametersStatus.textContent = `Stored locally for ${EXCHANGES[state.exchange].label}.`;
  elements.parametersDialog.showModal();
}

async function refreshBotConfig({ quiet = false } = {}) {
  try {
    const payload = requireOk(await window.synapseDesktop.botConfig({ action: 'get', exchange: state.exchange }), 'Could not load local bot parameters.');
    renderParameters(payload.config);
  } catch (error) {
    if (elements.parametersGrid) elements.parametersGrid.innerHTML = '<p class="parameters-empty">Could not load local parameters.</p>';
    if (!quiet) toast(error.message, 'error');
  }
}

async function saveParameters(event) {
  event.preventDefault();
  const config = {};
  elements.parametersFields.querySelectorAll('input[data-parameter-key]').forEach((input) => {
    config[input.dataset.parameterKey] = input.value;
  });
  try {
    const payload = requireOk(await window.synapseDesktop.botConfig({ action: 'save', exchange: state.exchange, config }), 'Could not save local bot parameters.');
    renderParameters(payload.config);
    elements.parametersDialog.close();
    toast('Bot parameters saved locally.', 'success');
    log(`Bot parameters saved for ${EXCHANGES[state.exchange].label}.`);
  } catch (error) {
    elements.parametersStatus.textContent = error.message;
    toast(error.message, 'error');
  }
}

async function refreshCredentialStatus() {
  const payload = requireOk(await window.synapseDesktop.exchangeCredentials({ action: 'get', exchange: state.exchange }), 'Could not inspect local credentials.');
  state.hasCredentials = Boolean(payload.hasCredentials);
  elements.apiStatus.textContent = state.hasCredentials
    ? `${EXCHANGES[state.exchange].label} credentials are encrypted for this Windows user.`
    : `No local credentials saved for ${EXCHANGES[state.exchange].label}.`;
  elements.deleteKeys.hidden = !state.hasCredentials;
  renderStatus();
}

function credentialMaskValues() {
  const structural = state.exchange === 'coinbase';
  return {
    key: structural ? MASKED_API_KEY : MASKED_GENERIC_CREDENTIAL,
    secret: structural ? MASKED_API_SECRET : MASKED_GENERIC_CREDENTIAL,
    showKeyAsText: structural,
  };
}

function setCredentialFieldMasked(field, mask, masked, showMaskAsText = false) {
  field.dataset.masked = masked ? 'true' : 'false';
  field.dataset.maskValue = masked ? mask : '';
  if (field === elements.apiKey) field.type = masked && showMaskAsText ? 'text' : 'password';
  field.value = masked ? mask : '';
}

function clearCredentialFields() {
  const masks = credentialMaskValues();
  setCredentialFieldMasked(elements.apiKey, masks.key, false, masks.showKeyAsText);
  setCredentialFieldMasked(elements.apiSecret, masks.secret, false);
}

function prepareCredentialFields() {
  const masks = credentialMaskValues();
  setCredentialFieldMasked(elements.apiKey, masks.key, state.hasCredentials, masks.showKeyAsText);
  setCredentialFieldMasked(elements.apiSecret, masks.secret, state.hasCredentials);
}

function initCredentialFieldMasking() {
  for (const field of [elements.apiKey, elements.apiSecret]) {
    field.addEventListener('focus', () => {
      if (field.dataset.masked === 'true' && field.value === field.dataset.maskValue) field.select();
    });
    field.addEventListener('input', () => {
      if (field.dataset.masked === 'true' && field.value !== field.dataset.maskValue) {
        field.dataset.masked = 'false';
        if (field === elements.apiKey) field.type = 'password';
      }
    });
  }
}

async function refreshMonitorStatus() {
  const payload = requireOk(await window.synapseDesktop.monitorStatus(state.exchange), 'Could not read local monitor status.');
  state.running = Boolean(payload.running);
  renderStatus();
}

async function refreshAccount({ quiet = false } = {}) {
  if (state.refreshing || !state.hasCredentials) return;
  state.refreshing = true;
  elements.refresh.disabled = true;
  try {
    const payload = requireOk(await window.synapseDesktop.exchangeAccount(state.exchange), 'Could not read the exchange account.');
    state.account = payload;
    state.running = Boolean(payload.monitorRunning);
    renderAccount();
    renderStatus();
    if (!quiet) log(`Account refreshed directly from ${EXCHANGES[state.exchange].label}.`);
  } catch (error) {
    toast(error.message, 'error');
    if (!quiet) log(error.message, 'error');
  } finally {
    state.refreshing = false;
    elements.refresh.disabled = false;
  }
}

function scheduleAutomaticClosePosition() {
  if (automaticCloseTimer) clearTimeout(automaticCloseTimer);
  if (!state.hasCredentials || !selectedPosition()) return;
  automaticCloseTimer = setTimeout(() => {
    automaticCloseTimer = null;
    closeSelectedPosition().catch(() => {});
  }, 300);
}

async function closeSelectedPosition() {
  const position = selectedPosition();
  if (!position || !state.hasCredentials) return;
  if (elements.closePosition.dataset.applyState === 'applying' || elements.closePosition.dataset.applyState === 'applied') return;
  elements.closePosition.dataset.applyState = 'applying';
  elements.closePosition.disabled = true;
  elements.closePosition.textContent = 'Applying…';
  try {
    requireOk(await window.synapseDesktop.closePosition({
      exchange: state.exchange,
      position: { symbol: position.symbol, side: position.side, qty: position.qty },
    }), 'Could not close the selected position.');
    state.selectedPositionKey = null;
    log(`Position close order submitted for ${position.symbol}.`, 'warn');
    await refreshAccount({ quiet: true });
    elements.closePosition.textContent = 'Applied';
    elements.closePosition.dataset.applyState = 'applied';
    setTimeout(() => {
      if (elements.closePosition.dataset.applyState === 'applied') {
        delete elements.closePosition.dataset.applyState;
        elements.closePosition.textContent = 'Close position';
        updateClosePositionState();
      }
    }, 1200);
    toast('Position close applied automatically.', 'success');
  } catch (error) {
    delete elements.closePosition.dataset.applyState;
    elements.closePosition.disabled = false;
    elements.closePosition.textContent = 'Close position';
    toast(error.message, 'error');
    log(error.message, 'error');
  }
}

async function selectExchange(exchange) {
  state.exchange = exchange;
  elements.exchange.value = exchange;
  state.account = { balance: null, marginAvailable: null, totalMargin: null, positions: [], orders: [], updatedAt: null };
  renderExchange();
  renderAccount();
  try {
    await refreshBotConfig({ quiet: true });
    await refreshCredentialStatus();
    await refreshMonitorStatus();
    if (state.hasCredentials) await refreshAccount({ quiet: true });
  } catch (error) {
    toast(error.message, 'error');
    log(error.message, 'error');
  }
}

function assistantContext() {
  return {
    exchange: state.exchange,
    exchangeLabel: EXCHANGES[state.exchange].label,
    monitorRunning: state.running,
    hasCredentials: state.hasCredentials,
    botConfig: state.config,
    account: {
      balance: state.account.balance,
      available: state.account.marginAvailable,
      totalValue: state.account.totalMargin,
    },
    positions: (state.account.positions || []).map((position) => {
      const mark = numberOrNaN(position.mark);
      const liquidation = numberOrNaN(position.liquidationPrice);
      return {
        symbol: position.symbol,
        side: position.side,
        size: numberOrNaN(position.qty),
        entryPrice: numberOrNaN(position.entry),
        markPrice: mark,
        unrealizedPnl: numberOrNaN(position.pnl),
        liquidationPrice: liquidation,
        leverage: numberOrNaN(position.leverage),
        riskPercent: Number.isFinite(mark) && Number.isFinite(liquidation) && mark > 0
          ? Math.abs(mark - liquidation) / mark * 100
          : null,
      };
    }),
    orders: (state.account.orders || []).map((order) => ({
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      price: numberOrNaN(order.stopPrice ?? order.price),
      quantity: numberOrNaN(order.qty),
      reduceOnly: order.reduceOnly === true,
    })),
    updatedAt: state.account.updatedAt,
  };
}

function assistantActionLabel(action) {
  if (action.type === 'set_exchange' && EXCHANGES[action.value]) return `Apply: switch to ${EXCHANGES[action.value].label}`;
  if (action.type === 'set_monitor' && action.value === 'start') return 'Apply: start monitor';
  if (action.type === 'set_monitor' && action.value === 'stop') return 'Apply: stop monitor';
  if (action.type === 'set_parameter') {
    const parameter = BOT_PARAMETERS.find((item) => item.key === action.key);
    if (parameter) return `Apply: ${parameter.label} = ${formatParameterValue(action.value)}`;
  }
  return '';
}

function updateChatHistoryMessage(messageText, value) {
  if (!messageText) return;
  messageText.textContent = value;
  if (messageText.__arrowHistoryEntry) messageText.__arrowHistoryEntry.content = value;
}

async function applyAssistantAction(action, button, messageText = null) {
  const label = assistantActionLabel(action);
  if (!label) throw new Error('Arrow Agent requested an unsupported control.');
  if (button.dataset.applyState === 'applying' || button.dataset.applyState === 'applied') return;
  button.dataset.applyState = 'applying';
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Applying…';
  try {
    if (action.type === 'set_exchange') {
      if (state.exchange === action.value) throw new Error(`${EXCHANGES[action.value].label} is already selected.`);
      await selectExchange(action.value);
      log(`Arrow Agent control applied: ${EXCHANGES[action.value].label} selected.`);
    } else if (action.type === 'set_monitor' && action.value === 'start') {
      if (!state.hasCredentials || state.running) throw new Error('Start monitor is not currently available in the Synapse UI.');
      await startLocalMonitor();
    } else if (action.type === 'set_monitor' && action.value === 'stop') {
      if (!state.running) throw new Error('Stop monitor is not currently available in the Synapse UI.');
      await stopLocalMonitor();
    } else if (action.type === 'set_parameter') {
      const parameter = BOT_PARAMETERS.find((item) => item.key === action.key);
      if (!parameter) throw new Error('Arrow Agent requested an unsupported bot parameter.');
      const config = { ...(state.config || {}), [parameter.key]: action.value };
      const payload = requireOk(await window.synapseDesktop.botConfig({ action: 'save', exchange: state.exchange, config }), 'Could not save the requested bot parameter.');
      renderParameters(payload.config);
      log(`Arrow Agent control applied: ${parameter.label} updated for ${EXCHANGES[state.exchange].label}.`);
    } else {
      throw new Error('Arrow Agent requested an unsupported control.');
    }
    button.textContent = 'Applied';
    button.dataset.applyState = 'applied';
    if (action.type === 'set_parameter' && messageText) {
      const parameter = BOT_PARAMETERS.find((item) => item.key === action.key);
      updateChatHistoryMessage(messageText, `Se aplicó ${parameter?.label || action.key} al ${formatParameterValue(action.value)}.`);
    } else if (action.type === 'set_monitor' && messageText) {
      updateChatHistoryMessage(messageText, `Se aplicó ${action.value === 'start' ? 'Start monitor' : 'Stop monitor'}.`);
    }
    toast(['set_parameter', 'set_monitor'].includes(action.type) ? 'Action applied automatically.' : 'Synapse control updated after confirmation.', 'success');
  } catch (error) {
    delete button.dataset.applyState;
    button.disabled = false;
    button.textContent = original;
    if (action.type === 'set_parameter' && messageText) updateChatHistoryMessage(messageText, `No se pudo aplicar el cambio: ${error.message}`);
    toast(error.message, 'error');
    throw error;
  }
}

function scheduleAutomaticAction(action, button, messageText) {
  automaticParameterQueue = automaticParameterQueue
    .catch(() => {})
    .then(() => new Promise((resolve) => setTimeout(resolve, 300)))
    .then(() => applyAssistantAction(action, button, messageText))
    .catch(() => {});
}

function appendChatMessage(role, message, actions = []) {
  const node = document.createElement('div');
  node.className = `chat-message ${role === 'user' ? 'user-message' : 'agent-message'}`;
  const label = document.createElement('span');
  label.textContent = role === 'user' ? 'YOU' : 'Arrow Agent';
  const text = document.createElement('p');
  text.textContent = message;
  const historyEntry = { role: role === 'user' ? 'user' : 'assistant', content: message };
  if (role !== 'user' && actions.length) historyEntry.actions = actions.slice(0, 3).map((action) => ({ ...action }));
  text.__arrowHistoryEntry = historyEntry;
  state.chatHistory.push(historyEntry);
  if (state.chatHistory.length > 15) state.chatHistory.splice(0, state.chatHistory.length - 15);
  node.append(label, text);
  if (role !== 'user' && actions.length) {
    const actionList = document.createElement('div');
    actionList.className = 'assistant-actions';
    for (const action of actions) {
      const actionLabel = assistantActionLabel(action);
      if (!actionLabel) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'assistant-action-button';
      button.textContent = actionLabel;
      const automaticAction = ['set_parameter', 'set_monitor'].includes(action.type);
      if (automaticAction) text.textContent = 'Aplicando…';
      button.addEventListener('click', () => applyAssistantAction(action, button, text).catch(() => {}));
      if (automaticAction) scheduleAutomaticAction(action, button, text);
      actionList.append(button);
    }
    if (actionList.childElementCount) node.append(actionList);
  }
  elements.agentChat.append(node);
  elements.agentChat.scrollTop = elements.agentChat.scrollHeight;
}

elements.exchange.addEventListener('change', () => selectExchange(elements.exchange.value));
elements.refresh.addEventListener('click', () => refreshAccount());
elements.clearActivity.addEventListener('click', () => elements.activity.replaceChildren());
elements.positionsTab.addEventListener('click', () => setDataView('positions'));
elements.ordersTab.addEventListener('click', () => setDataView('orders'));
setDataView('positions');

async function startLocalMonitor() {
  const payload = requireOk(await window.synapseDesktop.startMonitor(state.exchange), 'Could not start local monitoring.');
  state.running = Boolean(payload.running);
  renderStatus();
  log(`Local monitor started for ${EXCHANGES[state.exchange].label}.`);
  await refreshAccount({ quiet: true });
}

async function stopLocalMonitor() {
  const payload = requireOk(await window.synapseDesktop.stopMonitor(state.exchange), 'Could not stop local monitoring.');
  state.running = Boolean(payload.running);
  renderStatus();
  log(`Local monitor stopped for ${EXCHANGES[state.exchange].label}.`, 'warn');
}

elements.start.addEventListener('click', () => startLocalMonitor().catch((error) => { toast(error.message, 'error'); log(error.message, 'error'); }));
elements.stop.addEventListener('click', () => stopLocalMonitor().catch((error) => toast(error.message, 'error')));
elements.closePosition.addEventListener('click', () => closeSelectedPosition());

function resetHelpWindow() {
  elements.help.classList.remove('is-minimized', 'is-maximized');
  elements.helpMinimize.textContent = '−';
  elements.helpMinimize.title = 'Minimize help';
  elements.helpMinimize.setAttribute('aria-label', 'Minimize help');
  elements.helpMaximize.textContent = '□';
  elements.helpMaximize.title = 'Maximize help';
  elements.helpMaximize.setAttribute('aria-label', 'Maximize help');
}

function toggleHelpMinimize() {
  const minimized = !elements.help.classList.contains('is-minimized');
  elements.help.classList.toggle('is-minimized', minimized);
  if (minimized) elements.help.classList.remove('is-maximized');
  elements.helpMinimize.textContent = minimized ? '↗' : '−';
  elements.helpMinimize.title = minimized ? 'Restore help' : 'Minimize help';
  elements.helpMinimize.setAttribute('aria-label', minimized ? 'Restore help' : 'Minimize help');
  elements.helpMaximize.textContent = '□';
  elements.helpMaximize.title = 'Maximize help';
  elements.helpMaximize.setAttribute('aria-label', 'Maximize help');
}

function toggleHelpMaximize() {
  if (elements.help.classList.contains('is-minimized')) {
    elements.help.classList.remove('is-minimized');
    elements.helpMinimize.textContent = '−';
    elements.helpMinimize.title = 'Minimize help';
    elements.helpMinimize.setAttribute('aria-label', 'Minimize help');
  }
  const maximized = !elements.help.classList.contains('is-maximized');
  elements.help.classList.toggle('is-maximized', maximized);
  elements.helpMaximize.textContent = maximized ? '❐' : '□';
  elements.helpMaximize.title = maximized ? 'Restore help size' : 'Maximize help';
  elements.helpMaximize.setAttribute('aria-label', maximized ? 'Restore help size' : 'Maximize help');
}

elements.settingsOpen.addEventListener('click', () => {
  elements.settings.showModal();
  refreshHermesStatus();
  refreshAgentPreferences({ quiet: true });
});

elements.helpOpen.addEventListener('click', () => {
  window.location.href = '/renderer/trading_agent_help.html';
});

elements.helpMinimize.addEventListener('click', toggleHelpMinimize);
elements.helpMaximize.addEventListener('click', toggleHelpMaximize);
elements.help.addEventListener('close', resetHelpWindow);

elements.agentPreferencesSave.addEventListener('click', () => saveAgentPreferences());

elements.parametersOpen.addEventListener('click', openParametersDialog);
elements.parametersForm.addEventListener('submit', saveParameters);

elements.hermesCheck.addEventListener('click', () => refreshHermesStatus());

elements.agentInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!elements.sendAgent.disabled) elements.agentForm.requestSubmit();
});

elements.hermesPrimary.addEventListener('click', async () => {
  const action = elements.hermesPrimary.dataset.action;
  if (!action) return;
  if (action === 'continue') {
    elements.settings.close();
    elements.agentInput.focus({ preventScroll: true });
    toast('Arrow Agent is ready in Synapse.', 'success');
    log('Arrow Agent setup completed.');
    return;
  }
  elements.hermesPrimary.disabled = true;
  try {
    requireOk(await window.synapseDesktop.hermesSetup({ action }), 'Could not open the Hermes Agent installation guide.');
    if (action === 'download') {
      elements.hermesSummary.textContent = 'The official Hermes Agent installation guide opened. Install it, then press Check again.';
    } else if (action === 'setup') {
      elements.hermesSummary.textContent = 'The Hermes Agent setup guide opened. Finish the local setup, then press Check again.';
    }
  } catch (error) {
    toast(error.message, 'error');
    elements.hermesSummary.textContent = error.message;
  } finally {
    elements.hermesPrimary.disabled = false;
  }
});

elements.agentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = elements.agentInput.value.trim();
  if (!message) return;
  if (!state.agentEnabled) {
    toast('Turn on AI Agent (Arrow) to start assistance.', 'error');
    return;
  }
  if (state.hermesStatus !== 'ready') {
    elements.settings.showModal();
    await refreshHermesStatus();
    toast('Finish the Hermes Agent setup first.', 'error');
    return;
  }
  if (state.chatBusy) return;
  state.chatBusy = true;
  elements.sendAgent.disabled = true;
  elements.sendAgent.textContent = 'Sending…';
  elements.agentInput.disabled = true;
  elements.agentStatus.className = 'agent-status online thinking';
  elements.agentStatus.textContent = 'THINKING';
  appendChatMessage('user', message);
  elements.agentInput.value = '';
  try {
    const payload = requireOk(await window.synapseDesktop.assistantChat({
      conversationId: state.conversationId,
      message,
      history: state.chatHistory.slice(-15),
      context: assistantContext(),
    }), 'Arrow Agent could not respond.');
    appendChatMessage('agent', payload.reply, payload.actions || []);
    log('Arrow Agent answered inside Synapse using the current non-secret app state.');
  } catch (error) {
    appendChatMessage('agent', `I could not complete that request: ${error.message}`);
    toast(error.message, 'error');
    log(error.message, 'error');
  } finally {
    state.chatBusy = false;
    elements.sendAgent.textContent = 'Send';
    renderAgentMode();
    elements.agentInput.focus({ preventScroll: true });
  }
});

$('#manage-api-keys').addEventListener('click', async () => {
  renderExchange();
  clearCredentialFields();
  try {
    await refreshCredentialStatus();
    prepareCredentialFields();
  } catch (error) {
    elements.apiStatus.textContent = error.message;
  }
  elements.apiDialog.showModal();
});

elements.apiForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const masks = credentialMaskValues();
  const keyMasked = elements.apiKey.dataset.masked === 'true' && elements.apiKey.value === masks.key;
  const secretMasked = elements.apiSecret.dataset.masked === 'true' && elements.apiSecret.value === masks.secret;
  if (keyMasked && secretMasked) {
    elements.apiDialog.close();
    toast('Existing credentials remain saved locally.', 'success');
    log(`Existing local credentials kept for ${EXCHANGES[state.exchange].label}.`);
    return;
  }
  const request = { action: keyMasked || secretMasked ? 'update' : 'set', exchange: state.exchange };
  if (!keyMasked) request.key = elements.apiKey.value;
  if (!secretMasked) request.secret = elements.apiSecret.value;
  try {
    requireOk(await window.synapseDesktop.exchangeCredentials(request), 'Could not save credentials locally.');
    clearCredentialFields();
    state.hasCredentials = true;
    elements.apiDialog.close();
    renderStatus();
    toast('Credentials encrypted locally for this Windows user.', 'success');
    log(`Local credentials saved for ${EXCHANGES[state.exchange].label}.`);
    await refreshAccount({ quiet: true });
  } catch (error) {
    elements.apiStatus.textContent = `Could not save local credentials: ${error.message}`;
    toast(error.message, 'error');
    log('Could not save local exchange credentials. Correct the fields and try again.', 'error');
  }
});

elements.deleteKeys.addEventListener('click', async () => {
  if (!confirm(`Delete locally encrypted credentials for ${EXCHANGES[state.exchange].label}?`)) return;
  try {
    requireOk(await window.synapseDesktop.exchangeCredentials({ action: 'delete', exchange: state.exchange }), 'Could not delete local credentials.');
    state.hasCredentials = false;
    state.running = false;
    state.account = { balance: null, marginAvailable: null, totalMargin: null, positions: [], orders: [], updatedAt: null };
    elements.apiDialog.close();
    renderAccount();
    renderStatus();
    toast('Local credentials deleted.', 'success');
    log(`Local credentials deleted for ${EXCHANGES[state.exchange].label}.`, 'warn');
  } catch (error) { toast(error.message, 'error'); }
});

document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close()));

setInterval(() => { if (state.running) refreshAccount({ quiet: true }); }, 20000);
enableNativeTextEditing(elements.apiKey, elements.apiSecret, elements.agentInput);
initCredentialFieldMasking();
initAgentMode();
selectExchange(state.exchange);
refreshHermesStatus({ quiet: true });
