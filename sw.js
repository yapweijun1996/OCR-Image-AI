/* AI Image OCR — service worker
 * Pattern from KB ccb5ae85 + 4b41442d:
 *  - Versioned cache, old caches cleaned on activate
 *  - HTML navigation -> network-first, fallback cache, fallback offline.html
 *  - Same-origin assets -> stale-while-revalidate
 *  - API calls (cross-origin POST) -> never intercepted
 *  - SKIP_WAITING message channel for user-driven update
 *  - share_target POST -> intercept, stash image in cache, redirect to /
 */
const VERSION    = '2026-05-12-7';
const CACHE_NAME = `ocr-${VERSION}`;
// Separate cache for the share_target hand-off — doesn't get nuked on version bumps.
const SHARE_CACHE = 'ocr-share-inbox';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './offline.html',
  './assets/styles.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon-180.png',
  './js/fouc.js',
  './js/main.js',
  './js/utils.js',
  './js/db.js',
  './js/config.js',
  './js/theme.js',
  './js/image.js',
  './js/history.js',
  './js/api.js',
  './js/pwa.js',
  './js/result.js',
  './js/modal.js',
  './js/prompts.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/**
 * Read the multipart form, store the first image in `SHARE_CACHE`,
 * and redirect to the app root with `?share-target=1` so the client
 * knows to pull from the cache.
 */
async function handleShareTarget(request) {
  try {
    const data  = await request.formData();
    const file  = data.get('image');
    if (file && file instanceof File && file.type.startsWith('image/')) {
      const cache = await caches.open(SHARE_CACHE);
      const resp  = new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Share-Filename': encodeURIComponent(file.name || 'shared.png'),
        },
      });
      await cache.put('shared-image', resp);
    }
  } catch (_) {
    /* fall through — redirect anyway so the user lands on the app */
  }
  return Response.redirect('./?share-target=1', 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // share_target POST → stash image, redirect to root with a marker.
  // The page reads the marker on load, pulls the image out of the share cache,
  // and feeds it through the normal handleFile() pipeline.
  if (req.method === 'POST' && sameOrigin && url.pathname.endsWith('/share-target/')) {
    e.respondWith(handleShareTarget(req));
    return;
  }

  // Never intercept any other non-GET (POST to API gateway etc.).
  if (req.method !== 'GET') return;

  // HTML navigations: network-first with cache + offline fallback
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match('./offline.html');
        })
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200) {
              const copy = resp.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
            }
            return resp;
          })
          .catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Cross-origin (fonts, etc.): cache-first with network fallback
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
