---
name: position-closing
description: "Use for Arrow desktop app position-closing changes."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Electron, positions, exchanges, IPC, safety]
    related_skills: [desktop-app-packaging, electron-hermes-agent-integration]
---

# Arrow desktop app position-closing

Feature-specific workflow for the Arrow desktop app when adding or changing the
Open positions selection and Close position flow. This skill is intentionally
separate from general Synapse, exchange, and Electron skills so the future
downloadable app can be identified by the `arrow-desktop-app` category.

## Scope and naming rule

- This skill applies only to the Arrow desktop app at the local trading-bot-desktop app.
- Every future functional Arrow desktop app change must create a new feature skill named `<feature>` inside the `arrow-desktop-app` category; do not hide a new behavior inside a generic Synapse skill.
- The skill name, description, tags, and body must identify the product as Arrow desktop app.
- A new visual-only adjustment may reuse this skill only when the behavior and safety contract are unchanged; a new functional behavior gets its own skill.

## Safety contract

- The Close position control is disabled until exactly one live position is selected.
- Selection is explicit through one radio control per rendered position row.
- Clicking or selecting Close position schedules the close automatically after 300 ms; selection remains mandatory.
- The main process re-fetches the selected exchange account before sending an order.
- The main process rejects a missing position or a changed quantity as stale state.
- Never test this flow against live credentials or a live exchange; use fake fetch responses and generated test keys.

## Implementation map

- `renderer/index.html`: Close position button in the Open positions heading and Select table column.
- `renderer/app.mjs`: `selectedPositionKey`, row radio selection, disabled-state logic, confirmation, IPC invocation, refresh after submission.
- `renderer/app.css`: right-aligned button inside the card padding; do not use a negative right margin that overlaps the border.
- `preload.cjs`: expose only the typed `closePosition` bridge method.
- `main.cjs`: validate exchange credentials, re-fetch live account state, reject stale selection, then call the exchange adapter.
- `local-exchanges.cjs`: exchange-specific market-close request with no credential exposure in return values or errors.

## Exchange behavior

- Binance Futures: opposite-side `MARKET` order with `reduceOnly=true`.
- Binance US spot: sell the selected LONG holding with a market order.
- Coinbase spot: sell the selected LONG holding using `market_market_ioc` and the product ID.
- SHORT positions on spot exchanges are rejected; do not invent margin behavior.

## Procedure for future changes

1. Read the live renderer, preload, main IPC, exchange adapter, and focused tests before editing.
2. Create same-directory backups with a dated feature suffix before mutation.
3. Make the smallest change that preserves the selection, confirmation, and stale-state checks.
4. Add or update a feature-specific `<feature>` inside the `arrow-desktop-app` category skill for the functional behavior.
5. Add fake-fetch tests for every affected exchange and reject invalid position symbols, sides, and quantities.
6. Run `node --check` for changed JavaScript files.
7. Run focused exchange and desktop-contract tests.
8. Run `npm run smoke` and inspect the fresh Electron renderer; an old Electron window is not evidence of the new CSS or JavaScript.
9. Verify the final button text, alignment, disabled state, selection accessibility, and absence of console errors.
10. State explicitly that no live order was sent during verification.

## Pitfalls

- Do not replace selection with a generic enabled button; that allows ambiguous orders.
- Do not trust renderer-supplied symbol or quantity without the main-process live re-check.
- Do not return exchange payloads containing credentials, tokens, or private-key material.
- Do not use a negative right margin to force alignment; it can paint over the card border.
- Do not claim a real close succeeded from a fake-fetch test or a smoke test.
- Do not rename this into a generic `synapse-*` skill; the `arrow-desktop-app` category is the product boundary.

## Verification checklist

- [ ] Button is labeled `Close position`.
- [ ] Button is right-aligned within the card without overlapping its border.
- [ ] Button is disabled with no selected position.
- [ ] Exactly one radio selection is possible per rendered position set.
- [ ] Close position auto-applies after 300 ms once a position is selected.
- [ ] Main process re-fetches and compares live quantity.
- [ ] Binance Futures, Binance US, and Coinbase behavior is covered as applicable.
- [ ] Invalid and stale positions are rejected.
- [ ] Focused tests pass.
- [ ] Fresh Electron smoke passes with zero renderer console errors.
- [ ] No live exchange order was sent during verification.
