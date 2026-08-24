---
name: help-center-guide
description: "Use when adding Arrow's web Help guide."
version: 2.0.0
author: Synapse Labs, Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, web help, screenshots, pages, VPS deployment]
---
# Arrow desktop app — web Help guide

## Trigger

Use when the Arrow desktop app needs a Help button above Local runtime that opens a separate `trading_agent_help.html` page instead of rendering a Help dialog inside Electron.

## Implementation pattern

1. Preserve `renderer/index.html`, `renderer/app.mjs`, and `renderer/app.css` in the project's dedicated `backup/renderer/` directory before editing.
2. Keep the existing app layout and behavior unchanged. The Help button should remain in the rail above `.rail-status`; change only its label/accessibility text and click handler to navigate to `/renderer/trading_agent_help.html`.
3. Do not use a native `<dialog>` for this workflow. The page is a separate document served by the app's static server.
4. Create the canonical local page at `C:\dev\Synapse Labs VPS 2.0\Synapse Labs\pages\trading_agent_help.html` and the Electron-served page at `apps/trading-bot-desktop/renderer/trading_agent_help.html`. Keep the Electron-served page byte-identical to the canonical local page.
5. Make the Help page self-contained: inline CSS, local relative assets, no Tailwind CDN, AOS CDN, Google Fonts CDN, or other external styles/scripts that Electron's CSP can block.
6. Match About's visual language with a real header and footer, then cover every visible function: toolbar controls, exchange selection, Arrow toggle, monitor Start/Stop, all 12 parameters and Configure, metrics, Open positions, Pending Orders, Select/Close position, Activity/Clear, Arrow Agent chat, and Local runtime.
7. Use real crops from the supplied app screenshot under `assets/images/help/` in the app and root asset trees. Include descriptive alt text and captions; never replace them with generic placeholders.
8. Deploy the canonical root page to `/var/www/synapselabs.app/html/pages/trading_agent_help.html` and the 11 crops to `/var/www/synapselabs.app/html/assets/images/help/`. Use atomic stdin-pipe SSH/SCP-style installation, preserve any existing remote target, and do not restart nginx for static files.

## Verification

- Confirm the renderer no longer depends on a Help dialog for the button action and contains `/pages/trading_agent_help.html`.
- Start Electron, click Help, and verify the window title becomes `Trading Agent Help | Synapse Labs` with the local page styled and populated.
- Run the focused Electron smoke; it must report `smokePassed: true`, `errorCount: 0`, and retain the existing app layout contracts.
- Confirm local page and Electron copy have identical SHA-256 hashes, 1 header, 1 footer, 11 sections, and 11 crop references.
- Read back the VPS hash and verify public HTTP 200 for the page and at least one crop.
- Inspect the public page visually for About-style header/footer, legible section labels, loaded crops, no overlaps, and no generic empty Help surface.

## Pitfalls

- Do not convert the entire desktop renderer into the About page; only the Help button should navigate away.
- Do not leave the app in a broken unstyled state by embedding About's CDN-dependent source inside Electron.
- Do not retain a separate in-app Help dialog as the primary path once the user requests the standalone HTML workflow.
- Do not omit the 12 parameter explanations or the distinction between monitor read-only behavior and position-close confirmation.
- Keep rollback copies in the project's dedicated `backup/` directory rather than scattering `.bak` files.
