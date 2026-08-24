---
name: exchange-binance-us
description: "Use for Arrow desktop app Binance US actions."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Binance US, exchange]
    related_skills: []
---
# Arrow desktop app — Binance US

Use only for the `set_exchange` action with `value: "binance_us"`.

Contract: `{"type":"set_exchange","value":"binance_us"}`.

Binance US maps to spot balances. Preserve the selected exchange in renderer state, refresh credentials, monitor status, bot parameters, and account data. Do not send orders for a selection change.

Verify with Arrow desktop app contract tests and a fresh Electron smoke.