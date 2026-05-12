# Refactor Plan

The app currently lives in a single ~1500-line `index.html`. That was right for the demo phase — fast to read, zero build step, one file to share. It's wrong for a project that wants contributors.

This is the staged plan for splitting it apart **without losing the no-build-step property**. Each phase is small, atomic, and ships on its own.

---

## Where we're going

```
.
├── index.html              # markup only, links to assets
├── manifest.json
├── sw.js
├── offline.html
├── icon.svg
│
├── assets/
│   ├── styles.css          # all CSS, organized by section
│   └── (future) icons/
│
├── js/
│   ├── main.js             # boot — wires modules to the DOM
│   ├── api.js              # streaming SSE client (runOCR + readSSE)
│   ├── db.js               # IndexedDB helpers
│   ├── config.js           # localStorage config (LS, loadConfig, saveConfig)
│   ├── theme.js            # theme toggle + applyTheme
│   ├── image.js            # readAsDataURL + downscale + handleFile
│   ├── history.js          # renderHistory + history action handlers
│   ├── pwa.js              # SW registration + update banner + install prompt
│   └── utils.js            # fmtBytes, fmtTime, escapeHtml, setStatus, haptic, $
│
├── docs/
│   └── …                   # already migrated
│
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── .gitignore
```

Constraints that stay true:

- ✅ No bundler, no transpiler.
- ✅ Works from `file:///` for the no-SW pieces.
- ✅ `<script type="module" src="./js/main.js">` — native ES modules, that's all.
- ✅ Every JS file is independently readable.

---

## Phase 0 — Docs scaffolding ✅ done (2026-05-12)

- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitignore`
- `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/PWA.md`, `docs/DESIGN.md`, `docs/DEVELOPMENT.md`, this file.

Established the standards before code moved.

---

## Phase 1 — Extract CSS ✅ done (2026-05-12)

**Scope:** Move the `<style>` block in `index.html` into `assets/styles.css`. Add `<link rel="stylesheet" href="./assets/styles.css">`.

**Steps:**

1. Create `assets/styles.css`.
2. Cut the entire `<style>…</style>` block out of `index.html`, paste into `assets/styles.css`.
3. Add `<link rel="stylesheet" href="./assets/styles.css">` to `<head>`.
4. Add `./assets/styles.css` to the `PRECACHE` array in `sw.js`.
5. Bump SW `VERSION`.
6. Verify everything still renders.

**Acceptance criteria:**

- App looks identical in light + dark.
- DevTools shows the CSS loaded as a separate request.
- Offline mode still works (`offline.html` shows when network is cut).

**Risk:** Low. Pure mechanical move.

**Effort:** ~30 minutes.

---

## Phase 2 — Extract JS into one module file ✅ skipped — went straight to phases 3–6 in one pass (2026-05-12)

**Scope:** Move the `<script>` block from `index.html` into `js/main.js` as a single ES module. Don't split further yet.

> **Note:** The intermediate single-`main.js` step was skipped because the section banners in the original source were already a clean module map. Splitting straight to per-module files saved one round of file edits.

**Steps:**

1. Create `js/main.js`.
2. Cut the entire `<script>…</script>` block out of `index.html`, paste into `js/main.js`.
3. Replace with `<script type="module" src="./js/main.js"></script>` at the bottom of `<body>`.
4. Add `./js/main.js` to `PRECACHE`.
5. Bump SW `VERSION`.
6. Verify.

**Acceptance criteria:**

- All features work.
- No console errors.
- `document.readyState` ordering still correct — `main.js` is `defer`-by-default as a module, so DOM is ready when it runs.

**Risk:** Low-medium. Watch for code that assumed inline-script timing (none expected).

**Effort:** ~30 minutes.

---

## Phase 3 — Split utilities and DB ✅ done (2026-05-12)

**Scope:** Extract the smallest, most-stable pieces first.

**Files to create:**

| File          | Move these symbols                                              |
|---------------|-----------------------------------------------------------------|
| `js/utils.js` | `$`, `fmtBytes`, `fmtTime`, `escapeHtml`, `setStatus`, `haptic` |
| `js/db.js`    | `openDB`, `dbOp`, `dbAdd`, `dbAll`, `dbDelete`, `dbClear`, plus `DB_NAME`, `STORE` constants |

**Steps:**

1. Create both files.
2. `export` the symbols.
3. In `main.js`, `import` them.
4. Verify.

**Acceptance criteria:**

- App works.
- `js/utils.js` and `js/db.js` are self-contained — they only depend on browser APIs, not on app state.

**Risk:** Low. These have zero coupling to the rest.

**Effort:** ~45 minutes.

---

## Phase 4 — Split config, theme, image ✅ done (2026-05-12)

**Scope:** Extract three medium pieces.

| File           | Move these symbols                                              |
|----------------|-----------------------------------------------------------------|
| `js/config.js` | `LS` object, `loadConfig`, `saveConfig`, and the change/blur listeners |
| `js/theme.js`  | `applyTheme`, the initTheme IIFE, the `themeBtn` click handler  |
| `js/image.js`  | `MAX_DIM`, `readAsDataURL`, `downscale`, `handleFile`, plus the `current` ref management |

**Steps:** Same as phase 3 — create, export, import, verify.

**Acceptance criteria:**

- Config persists across reloads.
- Theme toggle still cycles correctly.
- Image input from drag/paste/pick still works.

**Risk:** Medium. `handleFile` mutates the shared `current` reference. Consider:

- Keep `current` in a top-level module variable in `image.js`, export a `getCurrent()` getter.
- Or pass `current` around as a parameter.

Pick the lower-coupling option.

**Effort:** ~1 hour.

---

## Phase 5 — Split API and history ✅ done (2026-05-12)

**Scope:** The two largest functional blocks.

| File           | Move these symbols                                              |
|----------------|-----------------------------------------------------------------|
| `js/api.js`    | `readSSE`, `runOCR`, `abortCtrl` lifecycle                      |
| `js/history.js`| `renderHistory`, history click handler, clear/export handlers   |

**Steps:** Same as phase 3.

**Acceptance criteria:**

- Streaming works.
- Stop button works.
- History re-run loads image, re-run streams.
- All three history actions (Re-run, Copy, Delete) work.

**Risk:** Medium-high. `runOCR` reads from `config.js` AND `image.js` AND writes to `db.js` AND triggers `renderHistory`. Document the cross-module call graph in the file headers.

**Effort:** ~1.5 hours.

---

## Phase 6 — Split PWA wiring ✅ done (2026-05-12)

> Plus a bonus extraction: `js/result.js` (copy/download/share buttons) and `js/modal.js` (modal handlers) — both small enough to merit their own files for clarity.

**Scope:** Move SW registration + install prompt + update banner into `js/pwa.js`.

**Acceptance criteria:**

- SW still registers from a non-`file:///` origin.
- Update banner still appears when a new SW is found.
- Install chip still appears on Chrome / Edge.

**Risk:** Low. It's just hoisting the existing code into a module.

**Effort:** ~30 minutes.

---

## Phase 7 — Restructure CSS ✅ done (2026-05-12)

Done as part of phase 1: `assets/styles.css` ships with banner-commented sections numbered 1–17.

**Scope:** Reorganize `assets/styles.css` into clearly-banner-commented sections. Already 80% there from the single-file source; this phase just polishes.

Sections in order:

1. Tokens (`:root`, dark theme overrides)
2. Reset + base
3. Layout
4. Header / brand
5. Card / list
6. Inputs / select
7. Drop zone / preview
8. Buttons
9. Status / result
10. History
11. Modal
12. Update banner
13. Install chip
14. Footer
15. Responsive breakpoints
16. Motion preferences

**Acceptance:** CSS reads top-to-bottom from generic (tokens) to specific (components) to overrides (media queries).

**Effort:** ~45 minutes.

---

## Phase 8 — CI / CD via GitHub Actions ✅ done (2026-05-12)

**Scope:** Auto-deploy `main` to GitHub Pages.

**Files to add:**

- `.github/workflows/deploy.yml` — three-step pipeline: checkout → configure-pages → upload-pages-artifact (path: `.`) → deploy-pages.

**Acceptance criteria:**

- Push to `main` → Pages deploy completes in < 90 s.
- Latest version live at `https://yapweijun1996.github.io/OCR-Image-AI/`.
- SW + manifest paths resolve correctly under the `/OCR-Image-AI/` base.

**Risk:** Medium. `start_url` and `scope` in `manifest.json` already use relative paths, so the path-prefix shouldn't break anything. Verify.

**Effort:** ~30 minutes.

---

## Phase 9 — PNG icons + iOS splash ✅ done (2026-05-12)

PNGs are regenerated from primitives via [`scripts/generate-icons.py`](../scripts/generate-icons.py) — no PWABuilder dependency. The script uses Pillow to draw the rounded background gradient, scan brackets, and text bars at any pixel size. Edit the script if you change the design, then re-run.

```
assets/icons/
├── icon-192.png              (any)
├── icon-512.png              (any)
├── icon-maskable-512.png     (content scaled to 0.72 — fits inside the circle mask)
└── apple-touch-icon-180.png  (linked from <head>)
```

iOS splash screens are still TODO — generate via `pwa-asset-generator` from the 512 PNG when desired.

**Scope:** Generate `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` and (optionally) iOS splash images.

**Tooling:**

- [PWABuilder.com](https://pwabuilder.com) — paste the deployed URL, download the icon bundle.
- Or `pwa-asset-generator` (npm tool) — run once, commit the PNGs.

**Steps:**

1. Generate PNGs from the SVG.
2. Drop them in `assets/icons/`.
3. Add them to `manifest.json`'s `icons` array (replacing or augmenting the SVG entries).
4. Update `<link rel="apple-touch-icon">` to point to the 180×180 PNG.
5. Bump SW `VERSION`.

**Acceptance criteria:**

- iOS home-screen install shows a colored icon (not blank).
- Android adaptive icons render cleanly inside circle / squircle / rounded-square masks.

**Effort:** ~30 minutes.

---

## Phase 10 — Polish ✅ partially done (2026-05-12)

Shipped:

- **CSP** — strict `Content-Security-Policy` meta tag in `<head>`. No `'unsafe-inline'`, no `'unsafe-eval'`. `connect-src` whitelists the gateway only. All previously-inline `style=""` attributes moved to CSS classes / `hidden` attribute; the inline FOUC script extracted to `js/fouc.js`.
- **`share_target`** — manifest declares POST share-target at `./share-target/`; SW intercepts the multipart request, stashes the image in a `ocr-share-inbox` Cache Storage entry, then `Response.redirect()`s to `?share-target=1`. The page boot (in `js/main.js`) calls `consumeSharedImage()` which pulls from cache and feeds the file through the normal `handleFile()` pipeline.
- **Lighthouse CI** — `.github/workflows/lighthouse.yml` + `.lighthouserc.json`. Runs on PRs and push-to-main; uploads reports to LHCI temporary public storage. Asserts ≥90 a11y and ≥85 performance with PWA-specific installability checks set to `error`.

Still to do:

- `file_handlers` → tap an image in the file manager → opens the app.
- iOS splash screens for each device size (pwa-asset-generator).
- Playwright smoke test — `tests/smoke.spec.ts` covers the happy path.

---

## Don't-do list

Things contributors are likely to suggest. Don't.

- ❌ **Add React / Vue / Svelte.** This is a teaching demo for vanilla PWAs. There's a different repo for framework projects.
- ❌ **Add a build step** (Vite / esbuild / Rollup). The whole point is "view-source, understand, fork".
- ❌ **Move the API key out of the source.** It's still demo-only — moving it to a hosted secret doesn't change that and adds a deployment surface.
- ❌ **Add a backend proxy** to fix CORS. The right fix is on the gateway. A proxy hides a real issue.
- ❌ **Sync history across devices.** Out of scope; users can export JSON.

---

## Tracking

This plan is a checklist, not a contract. Update phases as you ship them — open a PR, link to the relevant phase here, mark complete by editing this file in the same PR.
