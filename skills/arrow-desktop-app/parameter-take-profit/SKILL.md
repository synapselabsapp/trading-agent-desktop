---
name: parameter-take-profit
description: "Use for Arrow desktop app take-profit changes."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, take profit]
    related_skills: []
---
# Arrow desktop app — take profit

Contract: `{"type":"set_parameter","key":"TAKE_PROFIT_PERCENTAGE_OF_CAPITAL","value":5}`.

Use the exact key and route the confirmed update through `bot:config` save; never bypass `sanitizeBotConfig`.

Verify valid and out-of-range values, persistence for the selected exchange, focused tests, and Electron smoke.