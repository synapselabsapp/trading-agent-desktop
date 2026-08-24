---
name: exchange-binance
description: "Use for Arrow desktop app Binance Global actions."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Binance, exchange]
    related_skills: []
---
# Arrow desktop app — Binance Global

Use only for the `set_exchange` action with `value: "binance"`.

Contract: `{"type":"set_exchange","value":"binance"}`.

Binance Global maps to Futures/perpetuals. Preserve the selected exchange in renderer state, refresh credentials, monitor status, bot parameters, and account data. Do not send orders for a selection change.

Verify with the Arrow desktop app contract tests and a fresh Electron smoke; no live exchange call is required for selection verification.