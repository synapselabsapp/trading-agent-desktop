---
name: pending-orders-tab
description: "Use for Arrow desktop pending orders tab."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, pending orders, tabs, exchange data]
    related_skills: [hide-rail-navigation, desktop-app-packaging]
---
# Arrow desktop app — Pending Orders tab

Use when the Direct Exchange Data card must show `Open positions` and `Pending Orders` as sibling tabs.

## Contract

- `Open positions` and `Pending Orders` are accessible tabs in the Direct Exchange Data card.
- Open positions is active initially; the Pending Orders panel is hidden until selected.
- Pending orders render from `state.account.orders` with symbol, side, type, price, quantity, status, and reduce-only columns.
- The close-position control is hidden while Pending Orders is active and returns with Open positions.
- Empty pending-order state distinguishes missing credentials from an exchange with no pending orders.

## Verification

Run renderer/main syntax checks, focused desktop contracts, and `npm run smoke`. Smoke must report `exchangeDataTabs: true`, `smokePassed: true`, and zero renderer console errors.
