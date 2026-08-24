---
name: coinbase-pem-normalization
description: "Use for Coinbase CDP PEM normalization."
version: 0.1.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, Coinbase, CDP, PEM, credentials, newlines]
    related_skills: [api-save-error-feedback, desktop-app-packaging]
---
# Arrow desktop app — Coinbase CDP PEM normalization

Use when Coinbase CDP API credentials are pasted from the dashboard, JSON, or `.env` text.

## Contract

- Coinbase key secrets are normalized before validation and storage.
- Actual PEM line breaks are preserved.
- Literal `\\n` and `\\r\\n` sequences are converted to real line breaks.
- A JSON-quoted PEM string is decoded before validation.
- Node validates that the resulting PEM is a real EC private key.
- The normalized secret is stored only through the existing Windows `safeStorage` path.

## Official reference

Coinbase CDP API Authentication: https://docs.cdp.coinbase.com/api-reference/authentication

The official documentation states that `KEY_SECRET` may be shown with escaped `\\n` separators and that newlines must be preserved to parse the secret correctly.

## Verification

Use generated in-memory EC keys to test real PEM, escaped-newline PEM, and JSON-quoted PEM. Never print or persist a real user secret. Run focused local-exchange tests, desktop contracts, and Electron smoke.
