---
name: parameter-dca-qty
description: "Use for Arrow desktop app DCA quantity changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, DCA]
    related_skills: []
---
# Arrow desktop app — DCA quantity increment

Contract: `{"type":"set_parameter","key":"DCA_QTY_INCREMENT_PCT","value":25}`.

Apply only after confirmation through `bot:config` save; `sanitizeBotConfig` owns numeric bounds.

Verify normalization, rejection, persistence, focused tests, and Electron smoke.