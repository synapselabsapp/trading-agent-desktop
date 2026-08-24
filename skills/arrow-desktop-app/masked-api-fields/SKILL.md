---
name: masked-api-fields
description: "Use for Arrow desktop masked saved API fields."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, API Setup, masked credentials, safeStorage, update]
    related_skills: [api-save-error-feedback, native-clipboard-editing]
---
# Arrow desktop app — masked saved API fields

Use when saved exchange credentials should reappear as masks when API Setup is reopened.

## Contract

- Saved Coinbase API fields show structural masks: the key keeps the `organizations/.../apiKeys/...` shape and the PEM keeps its BEGIN/END lines with masked body. Binance and Binance US use the longer generic `****************************************************************` mask; decrypted credentials never reach the renderer.
- Saving while both fields remain masked is a no-op that preserves the existing encrypted records.
- Editing only one field uses the main-process `exchange:credentials` update action and preserves the other credential from the encrypted vault.
- While the structural key mask is displayed, the key field uses text rendering so the organization/API-key shape is visible; editing switches it back to password rendering. The private-key field behavior remains unchanged.
- Focusing a masked field selects the mask so typing or pasting replaces it.
- Credentials are cleared from visible fields only after a successful save or delete.

## Verification

Run focused desktop/local-exchange tests and Electron smoke. Confirm masked fields do not enter IPC requests as secrets, partial updates preserve the untouched vault value, and smoke has zero renderer errors.

## Pitfalls

- Never decrypt credentials into renderer state just to display them.
- Never save the literal mask as an API key or secret.
- Do not overwrite an unchanged credential with an empty or masked value during partial updates.
