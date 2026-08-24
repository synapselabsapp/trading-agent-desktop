---
name: exchange-logo-selector
description: "Use for Arrow desktop exchange selector logos."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, exchange logos, Binance, Coinbase, selector]
    related_skills: [exchange-name-size, desktop-app-packaging]
---
# Arrow desktop app — exchange selector logos

Use when the Active Exchange selector should show the selected exchange logo instead of an initial.

## Contract

- Binance Global uses `assets/images/binance.png`.
- Binance US uses `assets/images/binance_us.png`.
- Coinbase uses `assets/images/coinbase logo.png`.
- Logos are rendered at 28×28px inside the 42px selector mark so they remain centered without changing selector height.
- The renderer updates the logo when the selected exchange changes.
- If an asset fails to load, the existing exchange initial remains as a fallback.

## Verification

Review the selector visually for all three exchanges and confirm the image assets are bundled locally. If accepted, run focused desktop contracts and Electron smoke.
