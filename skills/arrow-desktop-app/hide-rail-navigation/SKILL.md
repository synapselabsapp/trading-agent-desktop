---
name: hide-rail-navigation
description: "Use for Arrow desktop rail navigation removal."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, navigation, Overview, Positions, rail]
    related_skills: [desktop-app-packaging]
---
# Arrow desktop app — hidden rail navigation

Use when the Arrow desktop workspace should not show the `Overview` and `Positions` rail buttons.

## Contract

- The `Overview` and `Positions` buttons are absent from `renderer/index.html`.
- The unused `[data-target]` navigation listener is absent from `renderer/app.mjs`.
- The unused `.rail-nav` and `.rail-link` rules are absent from `renderer/app.css`.
- The underlying workspace and positions section remain available in the page; only the rail buttons/navigation affordance is removed.

## Verification

Run `node --check` on the renderer, focused desktop contract tests, and `npm run smoke`. Confirm no `.rail-nav`, `data-target="workspace"`, `data-target="positions-card"`, or `rail-link` references remain in the production navigation surface.
