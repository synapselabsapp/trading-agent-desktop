---
name: browser-style-data-tabs
description: "Use for Arrow desktop browser-style data tabs."
version: 0.1.0
author: Omar Hernandez, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, browser tabs, data tabs, visual design]
    related_skills: [pending-orders-tab, desktop-app-packaging]
---
# Arrow desktop app — browser-style data tabs

Use when the Direct Exchange Data tabs should visually resemble browser tabs without changing their behavior.

## Contract

- `Open positions` and `Pending Orders` remain sibling tabs with the existing tab behavior.
- Tabs use rounded top corners, layered dark backgrounds, an active tab integrated with the panel, and a shared baseline.
- The active tab retains readable white text, a Synapse pink/purple accent line, and a crisp two-layer pink text shadow matching the active border color.
- Hover and keyboard focus remain visible.
- Only `renderer/app.css` changes for this visual treatment; the tab state and order rendering remain unchanged.

## Verification

Review the fresh Electron surface visually before further refinement. If accepted, run the focused desktop tests and Electron smoke; do not broaden the change into unrelated layout work.
