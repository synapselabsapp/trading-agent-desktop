---
name: assistant-fast-parameter-actions
description: "Use for Arrow desktop app fast parameter actions."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Assistant, fast path, parameters]
    related_skills: [parameter-stop-loss]
---
# Arrow desktop app — fast parameter actions

Use for explicit parameter-change requests that can be parsed locally without invoking the AI runtime.

## Contract

- Recognize an explicit change verb plus a known Configure parameter and value.
- Return the normal structured envelope with one `set_parameter` action.
- Keep the action button visible for 300 ms, auto-apply `set_parameter`, then change the button to `Applied`; no user click is required.
- Reuse `sanitizeBotConfig` before exposing the action.
- If the wording is ambiguous or lacks a value, fall back to the normal Hermes path.

## Current examples

- `cambia el stop loss al 10%` → `STOP_LOSS_PERCENTAGE: 10`.
- `set the take profit percentage to 7.5` → `TAKE_PROFIT_PERCENTAGE_OF_CAPITAL: 7.5`.

## Procedure

1. Update the local parser in `assistant-chat.cjs` and call it before Hermes subprocess startup in `main.cjs`.
2. Preserve the allowlist and host-side validation.
3. Add Spanish and English parser tests plus an ambiguity test.
4. Run `node --check`, focused Assistant/desktop tests, and `npm run smoke`.
5. Confirm no Hermes subprocess is needed for explicit parameter requests, the 300 ms visual transition occurs, and no live change occurs before the automatic host save.

## Pitfalls

- Do not create canned replies for greetings or ambiguous questions.
- This skill covers parameter auto-apply only; monitor and close-position auto-apply behavior is documented separately.
- Do not accept unknown keys, malformed arrays, or out-of-range values.
- Do not claim latency improvement without exercising the exact phrase and checking the structured action.
