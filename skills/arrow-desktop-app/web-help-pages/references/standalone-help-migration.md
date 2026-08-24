# Standalone Help migration — session detail

## Failure mode observed

The first migration copied the full About page into the Electron-served Help document. About depended on Tailwind/AOS/Google Fonts and other CDN resources. Electron's local CSP blocked those dependencies, leaving the Help window visually unstyled and making the desktop app appear damaged.

## Validated repair

1. Restore `renderer/index.html`, `renderer/app.mjs`, and `renderer/app.css` from the pre-migration backup.
2. Leave the desktop shell and existing Help dialog markup untouched unless the user explicitly asks for its removal.
3. Change only the Help handler to navigate to the standalone document.
4. Build the standalone Help page with inline CSS, local `../assets/images/help/*.png` references, and a hand-matched About-style header/footer.
5. If the Electron page is moved from `apps/trading-bot-desktop/pages/` to `apps/trading-bot-desktop/renderer/`, update the handler from `/pages/trading_agent_help.html` to `/renderer/trading_agent_help.html` and remove the now-empty app `pages/` directory.
6. Keep the website canonical at root `pages/trading_agent_help.html` and synchronize it byte-for-byte with the Electron-served copy.

## Evidence gates

- Electron smoke reports `smokePassed: true` and `errorCount: 0`.
- Clicking Help in Electron changes the document title to `Trading Agent Help | Synapse Labs`.
- The page exposes one header, one footer, eleven function sections, and eleven real crop images.
- The page contains no Tailwind, AOS, Google Fonts, or other CDN dependency.
- The public VPS URL and at least one crop return HTTP 200 and the rendered page is visually inspected.
