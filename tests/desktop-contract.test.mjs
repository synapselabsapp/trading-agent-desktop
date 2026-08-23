import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const text = (relative) => readFile(join(appRoot, relative), 'utf8');

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}

test('the desktop app is local-only and contains no VPS, wallet, or bot backend route', async () => {
  const files = (await walk(appRoot)).filter((path) => /\.(?:cjs|mjs|js|html|json|md)$/i.test(path) && !path.startsWith(join(appRoot, 'tests')));
  const joined = (await Promise.all(files.map((path) => readFile(path, 'utf8')))).join('\n');
  for (const forbidden of ['synapselabs.app', 'Synapse VPS', 'Arrow AI', '/bot/', 'wallet:connect', 'synapse:request']) {
    assert.doesNotMatch(joined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.equal(files.some((path) => /wallet-connect\.(?:html|css|mjs)$/i.test(path)), false);
});

test('the renderer offers one guided Hermes Agent onboarding path', async () => {
  const html = await text('renderer/index.html');
  const renderer = await text('renderer/app.mjs');
  assert.doesNotMatch(html, /name="agent-mode"|value="cloud"|id="connect-wallet"/);
  assert.doesNotMatch(html, /Advanced setup|Gateway URL|Gateway token|Agent ID/i);
  assert.match(html, /<button id="manage-api-keys" class="primary-gradient-bg"[^>]*>API Setup<\/button>/);
  assert.match(html, /<button id="open-settings" class="primary-gradient-bg"[^>]*>Agent Setup<\/button>/);
  assert.match(html, /id="agent-preferences"/);
  assert.match(html, /id="save-agent-preferences"[^>]*>Save personalization<\/button>/);
  assert.match(html, /id="agent-toggle"/);
  assert.match(html, /AI Agent \(Arrow\)/);
  assert.match(html, /id="agent-toggle-state"/);
  assert.doesNotMatch(html, /class="rail-nav"|data-target="workspace"|data-target="positions-card"/);
  assert.doesNotMatch(renderer, /querySelectorAll\('\[data-target\]'\)|rail-link/);
  assert.match(html, /assistant-chat\.cjs/);
  assert.doesNotMatch(html, /Bot settings|API credentials/);
  assert.doesNotMatch(renderer, /API credentials/);
  assert.match(html, /class="parameters-rail"/);
  assert.match(html, /id="parameters-grid"/);
  assert.match(html, /id="open-parameters" class="assistant-gradient-bg"[^>]*>Configure<\/button>/);
  assert.doesNotMatch(html, /id="parameters-card"/);
  assert.match(html, /id="parameters-dialog"/);
  assert.match(html, /id="parameters-fields"/);
  assert.match(html, /id="hermes-install-status"/);
  assert.match(html, /id="hermes-runtime-status"/);
  assert.match(html, /id="hermes-primary-action"/);
  assert.match(html, /id="check-hermes"/);
  assert.match(html, /Hermes Agent/);
  const agentPanel = html.slice(html.indexOf('<aside id="agent-panel"'), html.indexOf('</aside>', html.indexOf('<aside id="agent-panel"')));
  assert.match(agentPanel, /<img class="agent-brand-logo" src="\/assets\/images\/arrow logo\.png"[^>]*alt="Arrow Agent">/);
  assert.match(agentPanel, /src="\/assets\/images\/Arrow Bot\.png"[^>]*alt="Arrow Agent"/);
  const visibleAgentPanel = agentPanel.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(visibleAgentPanel, /Hermes Agent|runtime/i);
  const mainSurface = html.slice(html.indexOf('<div class="desktop-shell">'), html.indexOf('<dialog id="settings-dialog"'));
  const visibleMainSurface = mainSurface.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(visibleMainSurface, /Hermes Agent|runtime setup/i);
  assert.match(mainSurface, /Arrow Agent/);
  assert.match(agentPanel, /id="agent-status"[^>]*>STANDBY<\/span>/);
  assert.doesNotMatch(renderer, /gatewayUrl|gatewayToken|agentId|requestRuntime/);
  assert.match(renderer, /hermesPrimary\.textContent = 'Continue in Synapse'/);
  assert.match(renderer, /hermesPrimary\.dataset\.action = 'continue'/);
  assert.match(renderer, /action === 'continue'[\s\S]*settings\.close\(\)/);
});

test('exchange credentials and Hermes integration stay behind secure IPC', async () => {
  const main = await text('main.cjs');
  const preload = await text('preload.cjs');
  assert.match(main, /safeStorage/);
  assert.match(main, /ipcMain\.handle\(['"]exchange:credentials['"]/);
  assert.match(main, /if \(action === 'update'\)/);
  assert.match(main, /existing\.key/);
  assert.match(main, /existing\.secret/);
  assert.match(main, /ipcMain\.handle\(['"]exchange:account['"]/);
  assert.match(main, /ipcMain\.handle\(['"]exchange:close-position['"]/);
  assert.match(main, /closeExchangePosition/);
  assert.match(main, /ipcMain\.handle\(['"]monitor:start['"]/);
  assert.match(main, /ipcMain\.handle\(['"]monitor:stop['"]/);
  assert.match(main, /ipcMain\.handle\(['"]hermes:status['"]/);
  assert.match(main, /ipcMain\.handle\(['"]hermes:setup['"]/);
  assert.match(main, /ipcMain\.handle\(['"]bot:config['"]/);
  assert.match(main, /ipcMain\.handle\(['"]agent:preferences['"]/);
  assert.match(main, /injectAssistantPreferences/);
  assert.match(main, /readAgentPreferences/);
  assert.match(main, /getBotConfig|saveBotConfig/);
  assert.match(main, /shell\.openExternal/);
  assert.doesNotMatch(main, /webSecurity:\s*false|assistant:request/);
  assert.match(preload, /hermesStatus/);
  assert.match(preload, /hermesSetup/);
  assert.match(preload, /assistantChat/);
  assert.match(preload, /botConfig/);
  assert.match(preload, /agentPreferences/);
  assert.match(preload, /exchangeCredentials/);
  assert.match(preload, /closePosition/);
  assert.doesNotMatch(preload, /requestRuntime|requestSynapse|connectWallet/);
});

test('Arrow Agent conversations stay inside Synapse with a restricted IPC bridge', async () => {
  const html = await text('renderer/index.html');
  const renderer = await text('renderer/app.mjs');
  const main = await text('main.cjs');
  const preload = await text('preload.cjs');
  assert.match(html, /id="agent-chat"/);
  assert.match(html, /id="send-agent"[^>]*>Send<\/button>/);
  assert.match(html, /Only controls already available in Synapse/i);
  assert.match(html, /id="close-position"[^>]*disabled>Close position<\/button>/);
  assert.match(html, /id="positions-tab"[^>]*>Open positions<\/button>/);
  assert.match(html, /id="orders-tab"[^>]*>Pending Orders<\/button>/);
  assert.match(html, /id="orders-panel"/);
  assert.match(html, /id="orders-body"/);
  assert.match(html, /<th>Reduce Only<\/th>/);
  assert.match(html, /<th>Select<\/th>/);
  assert.match(renderer, /assistantChat\(/);
  assert.match(renderer, /chatHistory/);
  assert.match(renderer, /history: state\.chatHistory\.slice\(-15\)/);
  assert.match(renderer, /botConfig: state\.config/);
  assert.match(renderer, /function enableNativeTextEditing/);
  assert.match(renderer, /\['copy', 'cut', 'paste', 'contextmenu'\]/);
  assert.match(renderer, /enableNativeTextEditing\(elements\.apiKey, elements\.apiSecret, elements\.agentInput\)/);
  assert.match(renderer, /updateChatHistoryMessage/);
  assert.match(renderer, /selectedPositionKey/);
  assert.match(renderer, /closeSelectedPosition/);
  assert.match(renderer, /window\.synapseDesktop\.closePosition/);
  assert.match(renderer, /scheduleAutomaticClosePosition/);
  assert.match(renderer, /scheduleAutomaticAction/);
  assert.match(renderer, /Position close applied automatically/);
  assert.match(renderer, /scheduleAutomaticAction/);
  assert.match(renderer, /setTimeout\(resolve, 300\)/);
  assert.match(renderer, /Action applied automatically/);
  assert.match(renderer, /botConfig\(/);
  assert.match(renderer, /agentPreferences\(/);
  assert.match(renderer, /saveAgentPreferences/);
  assert.match(renderer, /initAgentMode/);
  assert.match(renderer, /synapse:agent_enabled/);
  assert.match(renderer, /Turn on AI Agent \(Arrow\)/);
  assert.match(renderer, /renderParameters/);
  assert.match(renderer, /function renderPendingOrders/);
  assert.match(renderer, /function setDataView/);
  assert.match(renderer, /state\.account\.orders/);
  assert.match(renderer, /elements\.ordersTab\.addEventListener/);
  assert.match(renderer, /saveParameters/);
  assert.match(renderer, /set_parameter/);
  assert.match(renderer, /unsupported bot parameter/);
  assert.match(renderer, /botConfig\(\{ action: 'save', exchange: state\.exchange, config \}\)/);
  assert.match(renderer, /appendChatMessage/);
  assert.match(renderer, /agentInput\.addEventListener\(['"]keydown['"]/);
  assert.match(renderer, /event\.shiftKey/);
  assert.match(renderer, /event\.preventDefault\(\)/);
  assert.match(renderer, /agentForm\.requestSubmit\(\)/);
  assert.match(renderer, /applyAssistantAction/);
  assert.doesNotMatch(renderer, /routeDetail|agent-route-detail/);
  assert.match(main, /ipcMain\.handle\(['"]assistant:chat['"]/);
  assert.doesNotMatch(main, /buildLocalGreetingReply/);
  assert.match(main, /const request = sanitizeAssistantRequest\(input\);[\s\S]*parseLocalParameterRequest\(request\.message, request\.history\)/);
  assert.match(main, /classifyAssistantTransportError/);
  assert.match(main, /assistantTransportBlock/);
  assert.match(main, /--assistant-greeting-smoke/);
  assert.match(main, /responseMessages/);
  assert.match(main, /buildHermesArgs/);
  assert.match(preload, /assistantChat:\s*\(input\)\s*=>\s*ipcRenderer\.invoke\(['"]assistant:chat['"]/);
  const exposedBridge = preload.slice(preload.indexOf('contextBridge.exposeInMainWorld'));
  assert.doesNotMatch(exposedBridge, /\bipcRenderer\s*[,}]/);
});

test('the UI preserves Synapse identity using only assets contained in the app', async () => {
  const html = await text('renderer/index.html');
  assert.doesNotMatch(html, /<header\b|<footer\b/i);
  assert.match(html, /href="\/assets\/css\/style\.css"/);
  assert.match(html, /src="\/assets\/images\/Logo Synapse Labs new\.png"/);
  assert.match(html, /src="\/assets\/images\/Arrow Bot AI pro\.png"/);
  const localStyle = await text('assets/css/style.css');
  assert.match(localStyle, /SYNAPSE LABS - GLOBAL STYLES/);
  const appStyle = await text('renderer/app.css');
  assert.match(appStyle, /\.agent-panel[^{]*\{[^}]*grid-template-rows: auto minmax\(0,1fr\) auto/);
  assert.match(appStyle, /\.agent-chat[^{]*\{[^}]*overflow-y: auto/);
  for (const relative of [
    'assets/images/Logo Synapse Labs new.png',
    'assets/images/Arrow Bot AI pro.png',
    'assets/images/Favicon Synapse Labs.ico',
  ]) {
    const asset = await readFile(join(appRoot, relative));
    assert.ok(asset.length > 1000, `${relative} must be bundled in the app`);
  }
});

test('Electron serves renderer and assets from the downloadable app folder', async () => {
  const main = await text('main.cjs');
  assert.match(main, /const APP_ROOT = __dirname;/);
  assert.match(main, /const PAGE_PATH = ['"]\/renderer\/index\.html['"]/);
  assert.match(main, /path\.join\(APP_ROOT, ['"]assets['"], ['"]images['"], ['"]Favicon Synapse Labs\.ico['"]\)/);
  assert.doesNotMatch(main, /path\.resolve\(__dirname, ['"]\.\.\/\.\.['"]\)/);
});

test('source distribution remains Electron-from-source with no project executable', async () => {
  const pkg = JSON.parse(await text('package.json'));
  assert.equal(pkg.main, 'main.cjs');
  assert.equal(pkg.scripts.start, 'electron .');
  assert.ok(pkg.devDependencies.electron);
  assert.equal('electron-builder' in pkg.devDependencies, false);
  const files = await walk(appRoot);
  assert.equal(files.filter((path) => path.toLowerCase().endsWith('.exe')).length, 0);
});

test('API credential dialog adapts to local exchange credentials', async () => {
  const html = await text('renderer/index.html');
  const renderer = await text('renderer/app.mjs');
  assert.match(html, /id="credential-key-label"/);
  assert.match(html, /id="credential-secret-label"/);
  assert.match(html, /id="exchange-api-secret"[^>]*textarea|<textarea[^>]*id="exchange-api-secret"/i);
  assert.match(html, /encrypted on this computer/i);
  assert.match(renderer, /elements\.apiStatus\.textContent = `Could not save local credentials:/);
  assert.match(renderer, /Correct the fields and try again/);
  assert.doesNotMatch(renderer, /catch \(error\) \{\s*elements\.apiKey\.value = '';/);
  assert.match(renderer, /const MASKED_API_KEY =/);
  assert.match(renderer, /const MASKED_API_SECRET =/);
  assert.match(renderer, /const MASKED_GENERIC_CREDENTIAL = '[*]+'/);
  assert.match(renderer, /function credentialMaskValues/);
  assert.match(renderer, /state\.exchange === 'coinbase'/);
  assert.match(renderer, /field === elements\.apiKey\) field\.type = masked && showMaskAsText \? 'text' : 'password'/);
  assert.match(renderer, /prepareCredentialFields/);
  assert.match(renderer, /keyMasked \|\| secretMasked \? 'update' : 'set'/);
  assert.match(renderer, /Existing credentials remain saved locally/);
  assert.match(html, /placeholder="organizations\/\{org_id\}\/apiKeys\/\{key_id\}"/);
  assert.match(html, /placeholder="-----BEGIN EC PRIVATE KEY-----[\s\S]*Paste your private key here/);
});
