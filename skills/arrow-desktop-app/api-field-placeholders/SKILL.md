---
name: api-field-placeholders
description: "Use for Arrow desktop API field placeholders."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, API Setup, placeholders, Coinbase, Binance, visual help]
    related_skills: [coinbase-pem-normalization, native-clipboard-editing]
---
# Arrow desktop app — API field placeholders

Use when empty API Setup fields should show a faint example of the expected key and secret format.

## Contract

- Empty API key and secret fields show muted placeholders; entering text naturally hides them.
- Placeholders update when the selected exchange changes.
- Empty Coinbase fields show the generic CDP pattern `organizations/{org_id}/apiKeys/{key_id}` and the PEM example with `Paste your private key here`; saved credentials use the separate structural mask.
- Binance and Binance US show exchange-specific generic API key/secret examples.
- Placeholder styling remains low-contrast and does not become submitted data.

## Verification

Review the API Setup modal with empty fields for readability and privacy. Confirm dynamic placeholders are assigned in `renderExchange`, the HTML has safe initial examples, and the placeholder CSS uses muted opacity.
