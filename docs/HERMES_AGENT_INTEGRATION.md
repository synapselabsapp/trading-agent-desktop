# Hermes Agent Integration

## Arrow Skills

When the app detects `hermes.exe`, it automatically copies the public skills included in `skills/arrow-desktop-app/` to `%HERMES_HOME%\skills\arrow-desktop-app`. The installation copies only missing files and preserves any existing user customizations.

If the copy fails, the Agent Setup flow shows an action to retry it before enabling Arrow Agent.

## Flow

1. Synapse detects `hermes.exe` with `where.exe` and known Hermes installer paths.
2. `Agent Setup` displays the detected version without reading keys or tokens.
3. If Hermes is missing, the button opens only the official installation guide:
   `https://hermes-agent.nousresearch.com/docs/getting-started/installation/`
4. The chat stays inside the `Arrow Agent` panel.
5. The main process runs Hermes with `-z`, `--toolsets clarify`, `--ignore-rules`, and `--reasoning low`.
6. Hermes must return a single JSON object `{ reply, actions }`. Synapse validates the JSON and removes any disallowed action.

## Tool Boundary

The bridge does not expose a URL, token, gateway session, or generic IPC. The one-shot receives only the `clarify` toolset, which is required to prevent a non-TTY execution from blocking if the model tries to ask for clarification. It does not receive terminal, file, browser, code, memory, skills, delegation, cron, or desktop-control access.

The prompt policy requires the model to analyze only the non-secret snapshot sent by Synapse. The model cannot claim to have inspected files, credentials, orders, screens, devices, or external systems.

## Allowed Snapshot

Before each message, Synapse builds and sanitizes again:

- selected exchange;
- monitor status;
- credential presence as a boolean;
- balance, available capital, and total value;
- open positions with symbol, side, size, entry, mark, PnL, leverage, liquidation, and risk distance;
- orders with symbol, side, type, status, price, quantity, and `reduceOnly`;
- update timestamp.

API keys, secrets, signatures, tokens, unknown fields, and encrypted content are neither accepted nor included.

## Actions

The model result may propose only:

- `set_exchange`: `binance`, `binance_us`, or `coinbase`;
- `set_monitor`: `start` or `stop`.

The main process validates the response. The renderer validates the label again and shows an `Apply` button; nothing changes until the user confirms and the corresponding control remains available in Synapse.

## Troubleshooting

- If `Hermes Agent is not installed` appears, install Hermes and reopen the application or press `Check again`.
- If Hermes is installed but Arrow Agent does not respond, run `hermes --version` and then `hermes doctor` from a terminal to review the configured provider/model.
- If the response is not JSON, Synapse rejects it and applies no actions.
- A provider limit is shown as temporary unavailability; infrastructure names and secrets are not displayed.

## Manual Verification

From the app directory:

```bash
npm run check
npm run smoke
npm run assistant-greeting-smoke
```

To test the same Hermes surface outside Electron without operational tools:

```bash
hermes -z "Return exactly: HERMES_PROBE" --toolsets clarify --ignore-rules --reasoning low
```
