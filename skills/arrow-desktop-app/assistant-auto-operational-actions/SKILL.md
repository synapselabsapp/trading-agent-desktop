---
name: assistant-auto-operational-actions
description: "Use for Arrow desktop app automatic monitor/close actions."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Assistant, monitor, close position, auto-apply]
    related_skills: [monitor-start, monitor-stop, position-closing]
---
# Arrow desktop app — automatic operational actions

Use when explicit Assistant actions must apply without a second click.

## Contract

- `set_monitor` Start/Stop actions auto-apply after the 300 ms visual transition.
- Close position auto-applies after 300 ms only after one position is selected.
- The action button remains visible and changes to `Applied`.
- Host IPC and live-state validation remain mandatory.
- Exchange switching is not auto-applied by this behavior.

## Verification

Run focused Assistant and desktop-contract tests, `node --check`, and `npm run smoke`. Confirm monitor actions use the existing credential/running-state guards, close uses selection and live-position revalidation, and no live exchange action is used in tests.
