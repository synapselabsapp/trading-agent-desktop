---
name: api-save-error-feedback
description: "Use for Arrow desktop API credential save errors."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, API Setup, credentials, validation, error feedback]
    related_skills: [native-clipboard-editing, desktop-app-packaging]
---
# Arrow desktop app — API save error feedback

Use when saving exchange credentials fails in the API Setup modal.

## Contract

- On save failure, API key and secret fields are preserved for correction and retry.
- The modal status area displays the bounded error message returned by the host.
- A non-secret activity log entry tells the user to correct the fields and try again.
- Fields are cleared only after a successful encrypted save.
- Credential validation and safeStorage behavior remain in the existing main-process IPC path.

## Verification

Run renderer syntax checks, focused desktop contracts, and Electron smoke. Confirm the API failure catch updates `apiStatus`, does not clear either field, and smoke reports zero renderer errors.

## Pitfalls

- Do not log API keys, private keys, or secrets.
- Do not clear failed input before the user can read or correct the error.
- Do not treat a successful IPC save as proof that exchange account access succeeded; report subsequent account-read failures separately.
