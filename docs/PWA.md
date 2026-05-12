# PWA — Manifest, Service Worker, Update Flow

The app is an installable progressive web app. This doc explains the three moving parts: `manifest.json`, `sw.js`, and the in-page update banner.

## Manifest

[`manifest.json`](../manifest.json) (excerpt):

```json
{
  "id": "/OCR-Image-AI/",
  "name": "AI Image OCR",
  "short_name": "AI OCR",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "background_color": "#f2f2f7",
  "theme_color": "#ff6a3d",
  "icons": [
    { "src": "./assets/icons/icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./assets/icons/icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "./icon.svg",                            "sizes": "any",     "type": "image/svg+xml", "purpose": "any" }
  ],
  "launch_handler": { "client_mode": "navigate-existing" },
  "share_target": {
    "action": "./share-target/",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{ "name": "image", "accept": ["image/*"] }]
    }
  }
}
```

### Decisions

- **`id` is explicit** — keeps Chrome from registering the same site as two PWAs if `start_url` ever changes.
- **`purpose: "any"` and `purpose: "maskable"` are split into two entries** — combining them (`"any maskable"`) is a Chrome bug that breaks Android adaptive icons.
- **`display_override: ["standalone", "minimal-ui"]`** — falls back gracefully if a browser doesn't support `standalone`.
- **`launch_handler.client_mode: "navigate-existing"`** — opening the PWA from the OS won't spawn duplicate windows.
- **PNG icons (192 / 512 / 180-apple-touch) + maskable 512 + SVG fallback.** Generated from primitives by [`scripts/generate-icons.py`](../scripts/generate-icons.py). The maskable variant scales content to 0.72 so even with a circular Android mask the corners of the scan brackets stay inside the safe zone.
- **`share_target` POST** — the app shows up in the OS share sheet. The service worker intercepts the POST, stashes the image, redirects to `?share-target=1`. See "Share target flow" below.

### Regenerating icons

```bash
pip install Pillow
python scripts/generate-icons.py
```

Edit the script if you change the design (gradient stops, stroke width, layout). Keep [`icon.svg`](../icon.svg) in sync as the human-readable source of truth.

### iOS-specific tags (in `<head>`)

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="AI OCR">
<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon-180.png">
```

iOS does **not** read the manifest's `icons` array — it needs its own `<link rel="apple-touch-icon">` pointing at the 180×180 PNG.

## Share target flow

OS share sheet → app:

```
 ┌──────────────────┐
 │ User picks AI OCR │
 │ from share sheet  │
 └────────┬──────────┘
          │ POST ./share-target/  (multipart/form-data, image= …)
          ▼
 ┌──────────────────────────────────────────┐
 │ SW handleShareTarget(req)                │
 │   formData.get('image') → File           │
 │   caches.open('ocr-share-inbox')         │
 │     .put('shared-image', file)           │
 │   Response.redirect('./?share-target=1') │
 └────────┬─────────────────────────────────┘
          │
          ▼
 ┌──────────────────────────────────────────┐
 │ Page boot → consumeSharedImage()         │
 │   caches.match('shared-image')           │
 │   → new File(blob, name, {type})         │
 │   → handleFile(file)                     │
 │   cache.delete('shared-image')           │
 │   history.replaceState — strip ?marker   │
 └──────────────────────────────────────────┘
```

The cache is named `ocr-share-inbox` (separate from the versioned `ocr-<VERSION>` precache) so version bumps don't drop pending shares.

## Service Worker

[`sw.js`](../sw.js) caches the app shell and handles offline navigation. Three caching strategies in one file.

### Caching strategy

| Request                              | Strategy                       | Why                                                                |
|--------------------------------------|--------------------------------|--------------------------------------------------------------------|
| Non-GET (POST, OPTIONS, etc.)        | **Pass through unintercepted** | Streaming POSTs to the API gateway must not be cached or proxied.  |
| HTML navigations (`req.mode === 'navigate'`) | Network-first, cache fallback, then `offline.html` | Always show fresh HTML when online; survive offline.            |
| Same-origin assets (CSS/JS/SVG)      | Stale-while-revalidate         | Instant load from cache, background refresh.                       |
| Cross-origin (fonts etc.)            | Cache-first                    | Long-lived resources, don't waste roundtrips.                      |

### Versioning

```js
const VERSION    = '2026-05-12-4';
const CACHE_NAME = `ocr-${VERSION}`;
```

Bump `VERSION` whenever you ship a change to `index.html`, `manifest.json`, or any precached asset. On install, the new SW caches the new shell. On activate, the old `ocr-<old-version>` cache is deleted.

### Precache list

```js
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './offline.html',
];
```

If you add a new same-origin asset that should be available offline, add it here and bump the version.

## Update flow (the user-facing part)

We don't silently swap the SW mid-session — the user may be in the middle of writing a prompt. The flow:

```
       ┌─────────────────────────────┐
       │  reg.update() fires hourly  │
       │  + on visibilitychange      │
       └────────────┬────────────────┘
                    │ new SW found
                    ▼
       ┌─────────────────────────────┐
       │  reg.installing.state →     │
       │  'installed' AND there is   │
       │  an existing controller     │
       └────────────┬────────────────┘
                    │
                    ▼
       ┌─────────────────────────────┐
       │  Show banner:               │
       │   "Update available  Reload"│
       └────────────┬────────────────┘
                    │ user clicks Reload
                    ▼
       ┌─────────────────────────────┐
       │  installing.postMessage(    │
       │    { type: 'SKIP_WAITING' } │
       │  )                          │
       └────────────┬────────────────┘
                    │ SW skipWaiting() → activates
                    ▼
       ┌─────────────────────────────┐
       │  'controllerchange' event   │
       │  → location.reload() (once) │
       └─────────────────────────────┘
```

The reload guard (`refreshing` flag) prevents a reload loop if two `controllerchange` events fire.

## Install prompt

```js
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').classList.add('show');
});
```

Chrome / Edge fire `beforeinstallprompt` once the install criteria are met (HTTPS / localhost, valid manifest, registered SW, served from the manifest's `scope`). We reveal the **Install** chip in the header; clicking it calls `deferredPrompt.prompt()`.

iOS Safari does NOT fire `beforeinstallprompt`. The chip stays hidden there. iOS users add to home screen via Share → Add to Home Screen.

## Offline fallback

[`offline.html`](../offline.html) is a tiny self-contained page (system font, no external resources). If a navigation request fails (no network) and the cached `index.html` isn't available either, the SW serves this page. From here the user can hit "Try again" to retry.

## Testing the PWA

```
# 1. Start a local server (SW requires http://)
python -m http.server 6766

# 2. Open Chrome → DevTools → Application
# 3. Manifest panel: should show name, theme color, icons
# 4. Service Workers panel: should show "activated and is running"
# 5. Cache Storage panel: should contain ocr-<version> with the precache list
# 6. Network panel → Offline → reload: navigates to offline.html
```

Lighthouse → Categories → Progressive Web App: target the green "Installable" + "PWA Optimized" pillars.

## Known limitations

1. **No iOS splash screens.** Each iOS screen size wants its own splash PNG. Use `pwa-asset-generator` to produce all 10+ from the 512 PNG when desired.
2. **No `file_handlers`.** Tapping an image in the file manager won't open the app. Add a `file_handlers` block to the manifest if/when you want this.
3. **No background sync / push.** Out of scope for a stateless demo.

See [`CHANGELOG.md`](../CHANGELOG.md) → Planned for the prioritized followups.
