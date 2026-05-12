# Development

How to set up, run, and verify the demo locally.

## Prerequisites

- A modern evergreen browser (Chrome / Edge / Firefox / Safari).
- Any static HTTP server. Pick whatever you have installed:

| Tool       | Command                              |
|------------|--------------------------------------|
| Python 3   | `python -m http.server 6766`         |
| Node       | `npx serve . -l 6766`                |
| PHP        | `php -S localhost:6766`              |
| Ruby       | `ruby -run -e httpd . -p 6766`       |
| Go         | `go run github.com/shurcooL/goexec 'http.ListenAndServe(":6766", http.FileServer(http.Dir(".")))'` |

A static server is required because the service worker won't register from `file:///`. Everything except the SW works from `file:///` though, if you're just tweaking UI.

## First run

```bash
git clone https://github.com/yapweijun1996/OCR-Image-AI.git
cd OCR-Image-AI
python -m http.server 6766
```

Open `http://localhost:6766/`. The first request to `/sw.js` registers the service worker; DevTools → Application → Service Workers should show "activated and is running".

## Making changes

The whole app is in `index.html`. Edit, refresh, see the change. There's no build step.

If your change is in `index.html`, `manifest.json`, or any precached asset:

1. **Bump `VERSION` in [`sw.js`](../sw.js).** Example: `2026-05-12-4` → `2026-05-12-5`.
2. **Hard refresh** (Ctrl+Shift+R / Cmd+Shift+R) once during development so the old SW doesn't serve cached HTML.
3. **Verify the update banner** appears the *next* time you open the app in another tab — that's how end-users will see it.

If you don't bump `VERSION`, users with the old cached shell stay on the old version forever.

## Manual test checklist

Run this before every PR.

### Core flow

- [ ] Drag an image onto the drop zone — preview shows, Run button enables, status says "Ready".
- [ ] Paste an image (`Ctrl V` / `Cmd V`) anywhere on the page — same behavior.
- [ ] Click the drop zone, pick a file — same behavior.
- [ ] Click **Recognize text** — status changes to "Streaming…", text appears live in the result panel.
- [ ] **Stop** mid-stream — partial text retained, meta shows `partial · X.XXs`.
- [ ] Result Copy / Download / Share buttons work.
- [ ] Run again — new history row appears at the top.
- [ ] Click **Re-run** on a history row — image loads into input, scroll jumps to top, status confirms.
- [ ] Click thumbnail on a history row — same as Re-run.
- [ ] Click **Copy** on a history row — clipboard has the result.
- [ ] Click delete (trash icon) — row vanishes, history re-renders.
- [ ] **Clear all** — confirmation, then empty state shows.
- [ ] **Export JSON** — downloads a `.json` file with all records.

### Theme

- [ ] Theme toggle: auto → light → dark → light → … cycles correctly.
- [ ] `<meta name="theme-color">` swaps with the theme (check via DevTools Elements).
- [ ] System dark-mode preference is honored when the saved theme is `auto`.

### Responsive

- [ ] Resize from 320 px to 1920 px — no horizontal scroll, no layout breaks, type scales smoothly.
- [ ] At ≤520 px — primary CTA full-width, history actions wrap, thumbnails are 48 px.
- [ ] DevTools mobile emulation (iPhone 15, Pixel 8): safe areas respected, no notch overlap, all controls reachable.

### PWA

- [ ] DevTools → Application → Manifest: name, icons, theme color all populated.
- [ ] DevTools → Application → Service Workers: shows "activated and is running".
- [ ] DevTools → Application → Cache Storage → `ocr-<version>`: contains the precache list.
- [ ] DevTools → Network → Offline → reload: navigates to `offline.html` (the orange ⌁ page).
- [ ] Bump `VERSION` in `sw.js`, refresh — update banner appears, clicking Reload installs the new SW.
- [ ] On Chrome desktop: **Install** chip appears in the header; clicking it shows the install dialog.

### Accessibility

- [ ] Tab through every interactive element with the keyboard — focus is visible, order is logical.
- [ ] Drop zone is reachable via Tab, activatable via Enter / Space.
- [ ] Screen reader (NVDA / VoiceOver / TalkBack) announces status messages.
- [ ] Color contrast passes WCAG AA in both themes (use axe DevTools).
- [ ] `prefers-reduced-motion: reduce` — modal opens instantly without animation.

### Browser compatibility

Tested working:

| Browser              | Notes                                         |
|----------------------|-----------------------------------------------|
| Chrome 120+ (desktop / Android) | Full feature set                    |
| Edge 120+            | Same as Chrome                                |
| Firefox 120+         | Full streaming, install chip not shown        |
| Safari 17+ (macOS / iOS) | Streaming OK; install via "Add to Home Screen"; SVG icon may render blank — PNG icons TODO |

Known issues:

- **iOS Safari < 16.4:** No Web Push (we don't use it anyway).
- **Firefox:** No `beforeinstallprompt`, so the Install chip never appears. Users install via the address bar icon.
- **WebView (in-app browsers):** Service workers often disabled. Streaming might still work; PWA install will not.

## Debugging tips

- **No text streaming in?** Check Network → response — should be `Content-Type: text/event-stream`. If buffered (large chunks), the gateway needs `X-Accel-Buffering: no`. See [`API.md`](API.md).
- **CORS error?** That's a gateway-side issue, see the CORS section in [`API.md`](API.md).
- **SW won't register?** Check the URL is `http://` or `https://`, not `file:///`. Check DevTools Console for the actual error.
- **Stale cache?** DevTools → Application → Storage → Clear site data. Or unregister the SW manually.
- **History empty after refresh?** IndexedDB is per-origin. Switching from `http://localhost:6766/` to `http://localhost:8080/` gives you a fresh database.

## Testing on a real device

Phone-on-same-WiFi test (replace IP):

```bash
# Find your local IP:
ipconfig   # Windows
ifconfig   # macOS / Linux

# Start server bound to all interfaces (default for python -m http.server)
python -m http.server 6766

# On the phone: http://192.168.1.42:6766/
```

The SW won't register on plain HTTP from a remote host — you need HTTPS. For real PWA testing on devices, use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose `localhost` over HTTPS.

## Releasing

The project deploys to GitHub Pages (see future `.github/workflows/deploy.yml`). Until that's wired up:

1. Merge to `main`.
2. Tag a release (`v0.x.y`) matching `CHANGELOG.md`.
3. Push the tag — Pages serves the contents of `main`.

See [`REFACTOR-PLAN.md`](REFACTOR-PLAN.md) for the CI/CD work item.
