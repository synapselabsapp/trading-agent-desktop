---
name: parameter-dca-percent
description: "Use for Arrow desktop app DCA increment changes."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, DCA]
    related_skills: []
---
# Arrow desktop app — DCA percentage increment

Contract: `{"type":"set_parameter","key":"DCA_PERCENT_INCREMENT","value":2}`.

Use exact-key allowlisting, confirmation, and `bot:config` save with `sanitizeBotConfig` validation.

Verify normalization, rejection, persistence, focused tests, and Electron smoke.