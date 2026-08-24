---
name: parameter-position-interval
description: "Use for Arrow desktop app position interval changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, monitoring]
    related_skills: []
---
# Arrow desktop app — position update interval

Contract: `{"type":"set_parameter","key":"POSITION_UPDATE_INTERVAL_MS","value":1000}`.

Use the exact key; let `sanitizeBotConfig` enforce integer bounds. Apply only after user confirmation through the existing `bot:config` save IPC.

Verify normalization, invalid-range rejection, renderer update, focused tests, and Electron smoke.