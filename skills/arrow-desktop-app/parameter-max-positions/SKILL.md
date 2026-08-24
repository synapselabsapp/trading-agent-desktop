---
name: parameter-max-positions
description: "Use for Arrow desktop app maximum position changes."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, positions]
    related_skills: []
---
# Arrow desktop app — maximum open positions

Contract: `{"type":"set_parameter","key":"MAX_OPEN_POSITIONS","value":1}`.

Use integer validation from `sanitizeBotConfig`, require confirmation, and save through `bot:config`.

Verify valid/invalid values, persistence, focused tests, and Electron smoke.