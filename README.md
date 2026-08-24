![Synapse Labs](assets/logo-synapse.png)

# Synapse Labs Trading Bot Desktop

Public repository: https://github.com/synapselabsapp/trading-agent-desktop

Self-contained Electron application that runs from source as a desktop window rather than as a PWA or manually opened web page.

## Local architecture

The application does not consume Synapse remote services. Its possible connections are:

- Binance Global: official API `https://fapi.binance.com`
- Binance US: official API `https://api.binance.us`
- Coinbase: official API `https://api.coinbase.com`
- Hermes Agent: local CLI installed on this computer for the Arrow Agent chat

The local monitor only reads account and position data. It does not create orders and does not require trading permissions.

## Self-contained files

The application does not depend on parent repository folders. All visual resources used by the app are included in:

- `assets/css/style.css`
- `assets/images/Logo Synapse Labs new.png`
- `assets/images/Arrow Bot AI pro.png`
- `assets/images/Favicon Synapse Labs.ico`

`main.cjs` serves `renderer/` and `assets/` from the `trading-agent-desktop` folder. The complete folder can be moved outside the repository without breaking logos, styles, or images.

## Run on Windows

### Simple option

Open this folder in File Explorer and double-click:

`START_APP.cmd`

The launcher checks Node/npm, installs Electron automatically if needed, opens the window, and closes the startup console.

### From a terminal

```bash
cd trading-agent-desktop
npm install
npm start
```

Requirements: Node.js 20 or later, Hermes Agent installed and configured, and the complete `trading-agent-desktop` folder.

## Arrow Agent skills

The app bundles the Synapse Arrow desktop skills in `skills/arrow-desktop-app/`. Immediately after Hermes Agent is detected, Synapse copies missing skills into `%HERMES_HOME%\\skills\\arrow-desktop-app` (by default `%LOCALAPPDATA%\\hermes\\skills\\arrow-desktop-app`). Existing user skill files are never overwritten.

If the copy cannot complete, Agent Setup shows the skills step and lets you retry before continuing to Arrow Agent.

## Configure Hermes Agent

`Agent Setup` checks whether `hermes.exe` is installed and available. If it is missing:

1. Click **Open Hermes installation guide**.
2. Install Hermes Agent using the official documentation.
3. Configure the provider/model through the official Hermes flow.
4. Return to Synapse and click **Check again**.
5. When all steps show `READY`, continue to Arrow Agent.

Synapse never copies, requests, or stores Hermes keys. For each question, the main process runs a local one-shot Hermes call with `--toolsets clarify`, `--ignore-rules`, and an explicit JSON-output policy. Terminal, file, browser, code, delegation, cron, and desktop-control toolsets are excluded from the chat bridge.

The agent receives a sanitized snapshot of the current state immediately before each message. It can only propose selecting an exchange or starting/stopping the monitor; Synapse validates those actions and requires explicit user confirmation before applying the same controls available in the UI.

See `docs/HERMES_AGENT_INTEGRATION.md` for details and troubleshooting.

## Exchange credentials

1. Select an exchange.
2. Open **API credentials**.
3. Use a read-only API key.
4. Save the credentials.

Binance Global and Binance US use an API key and API secret. Coinbase uses the full CDP API key name and its EC private key in PEM format.

Electron encrypts every record with Windows `safeStorage`. Decrypted credentials exist only in the main process during a request and never reach the message sent to Arrow Agent or Hermes.

## Security

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC limited to credentials, account, monitor, Hermes checks, the official guide, and validated chat
- External guide limited to the official Hermes Agent domain
- Chat exposes only the harmless `clarify` toolset; it does not give the model operational tools
- Exchange credentials are excluded from the renderer, logs, and agent context
- Responses are limited to text and allowlisted structured actions
- Proposed actions always require confirmation in the UI
- No permissions or code for executing orders

## Verification

```bash
npm run check
npm run smoke
npm run assistant-greeting-smoke
```

This project uses Electron from source. It has no electron-builder configuration, custom installer, binary release, or `dist` folder.

## License

This project is distributed under the MIT License. See `LICENSE` for the full text.
