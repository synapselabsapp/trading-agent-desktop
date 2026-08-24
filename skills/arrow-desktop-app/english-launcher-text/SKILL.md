---
name: english-launcher-text
description: "Use for Arrow desktop launcher English text."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, launcher, English, Windows CMD]
    related_skills: [desktop-app-packaging]
---
# Arrow desktop app — English launcher text

Use when the Windows `INICIAR_APP.cmd` launcher needs English user-facing messages.

## Contract

- Launcher commands, paths, arguments, and exit codes remain unchanged.
- Visible errors, installation status, startup text, and comments are in English.
- The launcher is named `START_APP.cmd` and its user-facing messages are in English.

## Verification

Run `START_APP.cmd --check` and inspect the launcher text without starting a second Electron instance. Confirm the backup is stored under the project `backup/` directory.
