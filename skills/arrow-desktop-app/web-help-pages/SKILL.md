---
name: web-help-pages
description: "Use when building standalone Help pages for Arrow desktop."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [Arrow desktop app, standalone HTML, Help, screenshots, Electron, VPS]
    related_skills: [help-center-guide, desktop-app-packaging]
---
# Arrow desktop app — standalone web Help pages

## Trigger

Use when a Help control in Arrow desktop should open a separate `trading_agent_help.html` document rather than render a Help surface inside the Electron renderer. This is a class-level workflow for standalone in-app documentation pages with real UI screenshots.

## Scope discipline

- Preserve the existing desktop renderer. If the user asks to convert only the Help button into a web link and create a separate page, do not replace the renderer with the About page, refactor the desktop shell, or migrate unrelated UI.
- Back up `renderer/index.html`, `renderer/app.mjs`, and `renderer/app.css` before editing.
- Make the smallest renderer change: keep the Help button above `.rail-status`, update its accessible label if needed, and change only its click handler.
- Do not make an unused dialog the primary Help path. A standalone HTML document is the source of Help content.

## Local path layout

Maintain two identical local copies when the repository has both a website canonical page and an Electron-served page:

- Website canonical: `C:\dev\Synapse Labs VPS 2.0\Synapse Labs\pages\trading_agent_help.html`
- Electron-served page: `apps/trading-bot-desktop/renderer/trading_agent_help.html`

If an app-local `apps/trading-bot-desktop/pages/` directory is used temporarily, remove it only after moving the file and updating the route. When the file lives under `renderer/`, the Electron handler must navigate to `/renderer/trading_agent_help.html`; a stale `/pages/trading_agent_help.html` link silently breaks the local flow.

Keep the two page copies byte-identical and preserve a rollback copy under `apps/trading-bot-desktop/backup/renderer/` before a destructive move.

## Page construction

1. Build the standalone page with inline CSS and local relative assets. Do not depend on Tailwind CDN, AOS CDN, Google Fonts CDN, or any external stylesheet/script that Electron CSP can block.
2. Match the website's About visual language with a real header and footer, but copy the visual structure rather than copying the whole CDN-dependent About implementation into Electron.
3. Use real screenshot crops from the supplied application capture under `assets/images/help/`. Include descriptive `alt` text and captions.
4. Document every visible function, not generic onboarding: toolbar controls, exchange selector, Arrow toggle, monitor Start/Stop, all 12 parameters and Configure, account metrics, Open positions, Pending Orders, Select/Close position, Activity/Clear, Arrow Agent, chat/Send, and Local runtime.
5. Keep the page responsive and legible. Use a two-column section grid for wide screens and one column for narrow screens; ensure section eyebrow labels have explicit contrast instead of inheriting the About page's default text color.

## VPS deployment

- Deploy the canonical page to `/var/www/synapselabs.app/html/pages/trading_agent_help.html`.
- Deploy each real crop to `/var/www/synapselabs.app/html/assets/images/help/`.
- Back up an existing remote target before replacing it.
- Prefer stdin-pipe installation over nested shell heredocs when paths or content are complex.
- Do not restart nginx for static HTML/image changes.

## Verification

- Static contract: the Help button exists above Local runtime; the click handler points to the actual served route; the old app-local `pages/` directory is absent when the move is requested; renderer structure is otherwise preserved.
- Page contract: local copies have equal SHA-256; page has exactly one header and footer, the expected section count, all real crop references, and no external CDN dependencies.
- Electron: run the focused smoke and require `smokePassed: true`, `errorCount: 0`; manually click Help and verify the window title changes to `Trading Agent Help | Synapse Labs` and the page is styled.
- VPS: verify remote hash read-back, public HTTP 200 for the page and at least one crop, then inspect the public page visually for header/footer, contrast, loaded crops, and no overlap.

## Pitfalls

- A full About-page copy can render as an unstyled gray/black document inside Electron when its CDN resources are blocked. Use self-contained CSS instead.
- Moving the file without changing the renderer route leaves Help pointing to a deleted directory.
- Changing the renderer too broadly makes it hard to distinguish a Help-page defect from an app regression; restore from the backup and reapply only the link change.
- HTTP 200 alone is insufficient: inspect image natural dimensions and capture the rendered page.
- Keep the root canonical page and Electron page synchronized after every content edit.

See `references/standalone-help-migration.md` for the validated migration and repair detail from the first implementation.
