---
name: parameter-stop-loss
description: "Use for Arrow desktop app stop-loss changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, stop loss]
    related_skills: []
---
# Arrow desktop app — stop-loss percentage

Contract: `{"type":"set_parameter","key":"STOP_LOSS_PERCENTAGE","value":20}`.

Apply only through confirmed `bot:config` save; never bypass host-side range validation.

Verify valid/invalid values, persistence, focused tests, and Electron smoke.