---
name: exchange-name-size
description: "Use for Arrow desktop exchange selector text size."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Active Exchange, selector, typography, visual design]
    related_skills: [desktop-app-packaging]
---
# Arrow desktop app — exchange selector text size

Use when the exchange names in the `ACTIVE EXCHANGE` selector need stronger readability.

## Contract

- The selected exchange name uses `0.87rem`, approximately 40% above the inherited `.62rem` control scale.
- Dropdown options use the same `0.87rem` size.
- The `ACTIVE EXCHANGE` label itself remains at its existing compact eyebrow size.
- Selector layout, colors, and exchange behavior remain unchanged.

## Verification

Review the fresh Electron surface visually for Binance Global, Binance US, and Coinbase. If accepted, run focused desktop contracts and Electron smoke; do not broaden the change into unrelated typography.
