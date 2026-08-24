---
name: parameter-rail-no-scroll
description: "Use when removing Arrow's Parameters scrollbar."
version: 1.0.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Parameters, layout, scrollbar, CSS]
---
# Arrow desktop app — Parameters summary without an internal scrollbar

## Trigger

Use when the left Parameters summary in `apps/trading-bot-desktop` has enough vertical room but still shows an internal vertical scrollbar, and all summary values should remain visible at once.

## Procedure

1. Work in the desktop app directory and preserve the current stylesheet under `backup/renderer/` using a unique, app-specific filename before editing.
2. In `renderer/app.css`, override only the left summary selector:

   `.parameters-rail .parameters-grid { max-height: none; overflow: visible; padding-right: 0; }`

3. Keep `.parameters-fields` unchanged; it belongs to the Configure dialog and may remain independently scrollable for smaller windows.
4. Run the focused test suite and the Electron smoke test. Capture a real smoke screenshot when visual confirmation is needed.
5. Verify the summary contains all entries from `BOT_PARAMETERS`, has no vertical overflow scrollbar, and has no clipping or overlap with the rail status.

## Verification

- `node --check renderer/app.mjs` succeeds.
- Focused desktop tests pass.
- `npm run smoke -- --smoke-screenshot=<temporary-path>` exits 0 and reports `smokePassed: true` with `errorCount: 0`.
- Visual inspection confirms all 12 summary parameters are visible and the Parameters panel has no internal vertical scrollbar.

## Pitfalls

- Do not remove scrolling from `.parameters-fields` unless the user explicitly requests a non-scrollable Configure dialog; that is a separate form with editable controls.
- Do not change the global `.parameters-grid` rule if only the left summary is affected.
- Keep rollback copies in the project's dedicated `backup/` directory rather than creating scattered `.bak` files.
