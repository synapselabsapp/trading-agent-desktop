---
name: parameter-dca-relative
description: "Use for Arrow desktop app relative DCA changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, DCA]
    related_skills: []
---
# Arrow desktop app — relative DCA percentage

Contract: `{"type":"set_parameter","key":"PORCENTAJE_DCA_RELATIVO","value":20}`.

Use the exact key, require user confirmation, and save through `bot:config`; host validation remains authoritative.

Verify normalization, bounds rejection, selected-exchange persistence, focused tests, and Electron smoke.