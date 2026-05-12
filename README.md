# AI Image OCR

A browser-native OCR demo that turns any image into clean text. Drop, paste, or pick an image and watch the text stream back token-by-token. No build step, no framework — vanilla HTML, CSS, and JavaScript.

> **Demo only.** The API key is XOR-obfuscated in the source. Do not ship this configuration to production — anyone can recover the key from `view-source`.

---

## Highlights

- **Live streaming OCR** via Server-Sent Events on the [openai-gateway](https://gpt.yapweijun1996.com) `/v1/responses` endpoint
- **Apple Human Interface Guidelines** look & feel — clarity, deference, depth (see [`docs/DESIGN.md`](docs/DESIGN.md))
- **Installable PWA** — works offline (cached shell), passes Lighthouse PWA checks (see [`docs/PWA.md`](docs/PWA.md))
- **Mobile responsive** — fluid type scale, safe-area insets, 44 px touch targets
- **Light & dark themes** that follow the system or user preference
- **Local history** in IndexedDB with re-run and JSON export
- **Stop button** that aborts mid-stream and keeps partial output

## Screenshots

The app is a single scrollable page:

```
┌─ Header ── brand · theme toggle · install chip ────┐
│                                                    │
├─ Configuration ─ effort · prompt ──────────────────┤
│                                                    │
├─ Image ──── drop zone · preview · run · stop ──────┤
│                                                    │
├─ Result ─── streaming text · copy · download ──────┤
│                                                    │
├─ History ── thumbnails · re-run · copy · delete ───┤
│                                                    │
└─ Footer ───────────────────────────────────────────┘
```

## Quick start

```bash
git clone https://github.com/yapweijun1996/OCR-Image-AI.git
cd OCR-Image-AI

# Service workers need http://, not file:///
python -m http.server 6766
# or:  npx serve .
# or:  php -S localhost:6766
```

Open `http://localhost:6766/` and drag an image onto the drop zone.

## How to use

1. **Drag, paste, or pick** an image (jpg / png / webp). Long edge auto-downscales to 1600 px.
2. Optionally adjust the **prompt** (e.g. "translate to English") or the **reasoning effort** (`minimal` → `xhigh`).
3. Hit **Recognize text**. Output streams in live.
4. **Copy**, **download**, or **share** the result. It's also saved to local history.
5. Tap **Re-run** on a history entry to load that image back into the input area with a different prompt.

## What's user-configurable

| Setting           | Editable? | Where stored          |
|-------------------|-----------|-----------------------|
| Theme (auto/light/dark) | ✅ | `localStorage`        |
| Reasoning effort  | ✅        | `localStorage`        |
| Prompt            | ✅        | `localStorage`        |
| Endpoint          | ❌ hardcoded | source             |
| API key           | ❌ XOR-encoded in source | source  |
| Model             | ❌ hardcoded | source             |
| History records   | (data)    | `IndexedDB`           |

To change a hardcoded value, edit `index.html` — the relevant `<div class="list-row" hidden>` blocks still exist in the DOM.

## Tech stack

- HTML / CSS / vanilla JS — no bundler, no framework
- [openai-gateway](https://gpt.yapweijun1996.com) Responses API with SSE streaming
- Service Worker + Web Manifest for the PWA layer
- IndexedDB for history, `localStorage` for config

## Documentation

Detailed docs live in [`docs/`](docs/):

| File                              | What you'll find                                  |
|-----------------------------------|---------------------------------------------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | High-level structure, data flow, file responsibilities |
| [`docs/API.md`](docs/API.md)      | Gateway contract — request shape, SSE event types, error format |
| [`docs/PWA.md`](docs/PWA.md)      | Manifest, service worker, caching strategy, update flow |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Apple HIG decisions, design tokens, fluid type scale |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Local setup, manual test checklist, browser compatibility |
| [`docs/REFACTOR-PLAN.md`](docs/REFACTOR-PLAN.md) | Phased plan for splitting the single-file source |

## Contributing

PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the code style and PR checklist.

## Project status

Single-file demo. Working, but pre-modularization — see [`docs/REFACTOR-PLAN.md`](docs/REFACTOR-PLAN.md) for the planned migration to `js/` + `assets/` modules.

## License

Pick a license before publishing — `LICENSE` file is intentionally absent. MIT is recommended for this kind of demo.

## Acknowledgements

- Built against [openai-gateway](https://gpt.yapweijun1996.com), `gpt-5.4-mini`.
- Design tokens follow Apple HIG (clarity / deference / depth).
- PWA blueprint adapted from the `yapweijun1996/PayNow-QR-Generator` reference pattern.
