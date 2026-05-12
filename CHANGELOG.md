# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- iOS splash screens for each device size (via `pwa-asset-generator`)
- `file_handlers` manifest block — register the app as a handler for image files
- Playwright smoke test
- License file

## [0.4.0] — 2026-05-12

### Added

- **Prompt preset selector** — combobox above the prompt textarea offering seven English-only templates: `general`, `plain`, `receipt`, `handwriting`, `code`, `table`, `translate-en`, plus `custom` for free-form edits. New module [`js/prompts.js`](js/prompts.js) holds the preset map.
- Two-way binding between preset and textarea: picking a preset overwrites the textarea; editing the textarea auto-flips the preset to whatever matches, falling back to `custom`.
- New `localStorage` key `ocr.prompt.preset` to remember the last picked preset.

### Changed

- **Prompt is English only.** Bumped `localStorage` key `ocr.prompt.v2` → `ocr.prompt.v3` so any lingering Chinese saved values from earlier sessions get replaced with the English `general` preset on next load.
- The textarea ships with `lang="en" spellcheck="true"` so browsers underline non-English input.
- SW `VERSION` → `2026-05-12-7`. `js/prompts.js` added to PRECACHE.

## [0.3.0] — 2026-05-12

### Added

- **PNG icons** generated from primitives by [`scripts/generate-icons.py`](scripts/generate-icons.py) (Phase 9):
  - `assets/icons/icon-192.png`, `icon-512.png` (`any` purpose)
  - `assets/icons/icon-maskable-512.png` (content scaled to 0.72 for safe-zone)
  - `assets/icons/apple-touch-icon-180.png` (linked from `<head>`)
- **Content Security Policy** meta tag in `<head>` — strict directives, no `'unsafe-inline'`, no `'unsafe-eval'`; only the gateway is allowed in `connect-src`.
- **`share_target`** in `manifest.json` — the app now appears in the OS share sheet. SW intercepts the POST, stashes the file in a dedicated Cache Storage entry, redirects to `?share-target=1`. `image.consumeSharedImage()` pulls it on load.
- **Lighthouse CI** via [`.github/workflows/lighthouse.yml`](.github/workflows/lighthouse.yml) + [`.lighthouserc.json`](.lighthouserc.json) — runs on PRs and main, fails the build below 90 a11y / 85 perf, gates PWA installability checks.
- `js/fouc.js` — externalized the inline FOUC theme guard (sync script, not a module) so the inline `<script>` block could be killed for CSP.

### Changed

- All previously-inline `style="…"` attributes in `index.html` moved to CSS classes (`.nav-right`, `.dim`, `.modal-text-spaced`) or the HTML `hidden` attribute.
- `stopBtn` / `shareBtn` initial-hidden state uses `hidden` attribute + `el.hidden = false/true` instead of `el.style.display`.
- `manifest.json` icons now list PNG entries first (Chromium prefers PNG), SVG kept as a fallback.
- `sw.js` precaches the new PNGs + `js/fouc.js`. `VERSION` bumped to `2026-05-12-6`.

## [0.2.0] — 2026-05-12

### Changed

- **Refactor**: split the single-file `index.html` into a modular layout — phases 1, 3–8 of [`docs/REFACTOR-PLAN.md`](docs/REFACTOR-PLAN.md) shipped together.
  - `assets/styles.css` (extracted from inline `<style>`, reorganized into 17 banner-commented sections)
  - `js/main.js` boot wires every module's `init<Name>()`
  - `js/utils.js`, `js/db.js`, `js/config.js`, `js/theme.js`, `js/image.js`, `js/history.js`, `js/api.js`, `js/result.js`, `js/modal.js`, `js/pwa.js`
  - Loaded as native ES modules — no bundler.
- `index.html` is now ~180 lines of markup + a tiny inline FOUC theme script.
- Migrated the prompt-default `localStorage` key to `ocr.prompt.v2` so legacy Chinese saved values get replaced by the new English default.
- `theme.js` now syncs the browser-chrome `theme-color` meta even in `auto` mode and on system preference changes.

### Added

- `.github/workflows/deploy.yml` — auto-deploy `main` to GitHub Pages on every push (Phase 8).
- `assets/` and `js/` directories.

### Fixed

- Removed the brittle media-conditional `theme-color` meta pair; now a single meta is kept in sync by `theme.js` against the effective theme.

## [0.1.0] — 2026-05-12

First public iteration.

### Added

- Streaming SSE OCR pipeline against `gpt.yapweijun1996.com/v1/responses` (`gpt-5.4-mini`).
- Reasoning effort selector (`minimal` → `xhigh`) persisted to `localStorage`.
- Editable prompt; defaults to an English instruction.
- Image input via drag / paste / file picker. Long-edge auto-downscale to 1600 px.
- Live token-by-token streaming render into the result panel.
- Stop button — aborts mid-stream and preserves partial output.
- Copy / Download `.txt` / native Share (where supported).
- History stored in IndexedDB with thumbnail, prompt, model, effort, duration, and usage tokens.
- **Re-run** action on each history entry — loads the image back into the input area for re-processing with a different prompt.
- Apple HIG visual style (clarity / deference / depth):
  - System font stack (SF Pro on Apple, Segoe UI Variable on Windows)
  - Fluid `clamp()` type scale, three discrete responsive breakpoints
  - iOS-grouped settings list, filled / tinted / gray button system
  - Single warm-orange accent
- Light / dark / auto theme; meta `theme-color` synced to current theme.
- PWA shell:
  - `manifest.json` with `id`, `scope`, `display`, `display_override`, `lang`, `dir`, split `any` + `maskable` icon entries
  - Versioned service worker — network-first HTML, stale-while-revalidate assets, offline.html fallback
  - **POST requests never intercepted** by the SW (so streaming passes through cleanly)
  - In-page update banner with `SKIP_WAITING` handoff (no silent reloads mid-edit)
  - Periodic update probe (hourly + on visibility change)
  - `beforeinstallprompt` capture with Install chip
- Safe-area-inset padding on all four sides for notch / Dynamic Island.
- `prefers-reduced-motion` honored.
- Haptic feedback on success events (where supported).

### Hardcoded (not user-editable)

- Endpoint (`https://gpt.yapweijun1996.com/v1/responses`)
- API key (XOR-encoded with literal `20260512` pad — demo only)
- Model (`gpt-5.4-mini`)

### Security notes

- API key obfuscation is **trivially reversible**. Do not use this configuration with a production-billable key.
- No CSP yet — add before publishing to a real domain.

### Known issues

- The gateway is missing `Access-Control-Allow-Origin` for browser callers (drafted bug report). Until that's fixed, the demo cannot complete a real request.
- iOS may show a blank home-screen icon because only `icon.svg` ships; PNG variants are TODO.
