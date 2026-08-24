---
name: parameter-breakeven-roi
description: "Use for Arrow desktop app breakeven ROI changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, parameter, breakeven]
    related_skills: []
---
# Arrow desktop app — breakeven ROI threshold

Contract: `{"type":"set_parameter","key":"BREAKEVEN_ROI_THRESHOLD","value":0.02}`.

Require confirmation and route the exact key through `bot:config` save; host validation is authoritative.

Verify valid/invalid values, persistence, focused tests, and Electron smoke.