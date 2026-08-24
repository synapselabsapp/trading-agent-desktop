---
name: exchange-coinbase
description: "Use for Arrow desktop app Coinbase actions."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Coinbase, exchange]
    related_skills: []
---
# Arrow desktop app — Coinbase

Use only for the `set_exchange` action with `value: "coinbase"`.

Contract: `{"type":"set_exchange","value":"coinbase"}`.

Coinbase maps to spot balances and CDP PEM credentials. Preserve selected exchange, refresh credentials, monitor status, parameters, and account data. Do not send orders for selection.

Verify with Arrow desktop app contract tests and a fresh Electron smoke.