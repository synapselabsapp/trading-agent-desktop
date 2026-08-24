---
name: assistant-config-context
description: "Use for Arrow desktop app current bot configuration context."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, assistant, configuration, context, parameters]
    related_skills: [assistant-fast-parameter-actions, chat-history-language]
---
# Arrow desktop app — current configuration context

Use when Arrow Agent must answer about all current Configure parameters, including values that were not changed in the chat.

## Contract

- Renderer includes the loaded local configuration as `context.botConfig` on every assistant turn.
- Backend sanitizes `botConfig` through `sanitizeBotConfig`, preserving exactly the twelve allowlisted Configure fields and their current values.
- Unknown fields, credentials, tokens, and secrets are discarded before prompt construction.
- `botConfig` is authoritative for current parameter-state questions; conversation history is only for prior turns and action references.
- If `botConfig` is unavailable, Arrow must say the current configuration is unavailable instead of inferring values from chat.

## Verification

Test that all twelve fields reach the sanitized snapshot, a value not mentioned in chat is present in the prompt, unknown fields are removed, renderer sends `context.botConfig`, focused Assistant/Desktop contracts pass, and Electron smoke reports no renderer errors.

## Pitfalls

- Do not send raw renderer state or the entire configuration object without host-side sanitization.
- Do not use recent chat text as a substitute for current configuration.
- Do not expose credentials or arbitrary keys through `botConfig`.
