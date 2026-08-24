---
name: native-clipboard-editing
description: "Use for Arrow desktop app native copy paste and cut editing."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, clipboard, copy, paste, cut, chat, API Setup]
    related_skills: [chat-history-language, assistant-config-context]
---
# Arrow desktop app — native clipboard editing

Use when API Setup credential fields or the Arrow Agent chat must support normal native copy, paste, cut, select-all, and context-menu editing.

## Contract

- API key, API secret, and Arrow Agent chat input are marked for native text editing.
- `copy`, `cut`, `paste`, and `contextmenu` events stop propagation only; they must not call `preventDefault()`.
- Ctrl/Cmd+A, C, X, and V key events stop propagation only so native Electron editing remains enabled.
- Credentials remain in the existing local form and safeStorage flow; no renderer clipboard API or secret logging is introduced.

## Verification

Run `node --check` for main and renderer, focused desktop contracts, and `npm run smoke`. Smoke must report `nativeTextEditing: true`, `smokePassed: true`, and zero renderer console errors.

## Pitfalls

- Do not implement clipboard operations by reading or writing clipboard contents in JavaScript.
- Do not call `preventDefault()` for copy, paste, or cut on these fields.
- Keep the scope limited to editable controls; navigation and action buttons must retain their existing behavior.
