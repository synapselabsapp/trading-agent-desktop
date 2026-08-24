---
name: chat-history-language
description: "Use for Arrow desktop app chat language and history."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, chat, language, history, context]
    related_skills: [assistant-fast-parameter-actions]
---
# Arrow desktop app — chat language and history

Use when Arrow Agent must preserve the user's language and understand previous chat turns.

## Contract

- Renderer keeps the most recent 15 user/assistant messages.
- The renderer sends recent history as the top-level `history` field; the backend also accepts legacy `context.history` during transition.
- The renderer sends the current local Configure values as `context.botConfig`; the backend sanitizes all twelve fields before building the prompt.
- Assistant history entries may carry sanitized structured `actions`, so applied parameter changes remain referential context instead of relying on display text.
- The prompt explicitly requires Spanish or English according to the user turn.
- Follow-up parameter messages resolve the last applied parameter action, including `ahora al 2` and `el que pusiste en 7`.
- Credentials, tokens, and unrelated renderer state never enter chat history.

## Verification

Test Spanish and English detection, history serialization, language-specific prompt text, follow-up resolution such as `cambia ahora a 10` → `stop loss`, focused desktop contracts, and `npm run smoke`.

For Windows ad-hoc verification wrappers, create the temporary file with Python `tempfile` using the `hermes-verify-` prefix and pass project/temp paths with forward slashes or `pathlib.Path`; embedding backslash-heavy paths into `python -c` can corrupt the subprocess `cwd`.