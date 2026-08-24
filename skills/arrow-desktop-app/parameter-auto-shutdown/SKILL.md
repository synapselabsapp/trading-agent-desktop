---
name: parameter-auto-shutdown
description: "Use for Arrow desktop app auto-shutdown changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, shutdown]
    related_skills: []
---
# Arrow desktop app — auto-shutdown minutes

Contract: `{"type":"set_parameter","key":"AUTO_SHUTDOWN_MINUTES","value":0}`.

Use integer validation from `sanitizeBotConfig`, require confirmation, and save through `bot:config`.

Verify valid/invalid values, persistence, focused tests, and Electron smoke.