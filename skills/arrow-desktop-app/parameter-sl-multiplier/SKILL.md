---
name: parameter-sl-multiplier
description: "Use for Arrow desktop app stop-loss multiplier changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, stop loss]
    related_skills: []
---
# Arrow desktop app — stop-loss distance multiplier

Contract: `{"type":"set_parameter","key":"SL_DISTANCE_MULTIPLIER","value":3.5}`.

Use exact-key allowlisting, confirmation, and `bot:config` save with host-side bounds validation.

Verify valid/invalid values, persistence, focused tests, and Electron smoke.