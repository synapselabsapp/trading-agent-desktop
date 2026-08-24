---
name: live-agent-status
description: "Use for Arrow desktop live status indicator."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, LIVE, status, pulsing green, animation]
    related_skills: [browser-style-data-tabs, desktop-app-packaging]
---
# Arrow desktop app — LIVE agent status

Use when the active Arrow Agent avatar status should communicate a live connection in English.

## Contract

- When Arrow is enabled and Hermes is ready, the avatar badge text is `LIVE`.
- The `LIVE` text pulses on the opposite phase from the external badge glow, transitioning between vibrant green `#00fa6e` and dark green `#166534` without white.
- During a request, `THINKING` remains cyan and does not use the green pulse.
- Inactive or unavailable state remains `STANDBY`.
- `prefers-reduced-motion: reduce` disables the pulse animation.

## Verification

Review the fresh Electron surface visually before further refinement. If accepted, run focused desktop contracts and Electron smoke; do not broaden the change into unrelated layout work.
