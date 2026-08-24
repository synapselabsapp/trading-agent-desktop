---
name: parameter-dca-multipliers
description: "Use for Arrow desktop app DCA multiplier changes."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, DCA]
    related_skills: []
---
# Arrow desktop app — DCA distance multipliers

Contract: `{"type":"set_parameter","key":"DCA_DISTANCE_MULTIPLIERS","value":[1,2]}`.

The value must remain an array accepted by `sanitizeBotConfig`. Require confirmation and save through `bot:config`.

Verify array normalization, malformed-array rejection, persistence, focused tests, and Electron smoke.