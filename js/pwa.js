/**
 * pwa.js — service worker registration, update flow, install prompt.
 *
 * Pattern from KB ccb5ae85 (PWA 2026 checklist, model B):
 *   - Hourly + on-visibility `reg.update()` probe
 *   - `updatefound` → in-page banner → user clicks Reload → SKIP_WAITING
 *   - Single guarded reload on `controllerchange`
 *
 * No-op when running from `file:///` (the SW can't register there).
 */

import { $ } from './utils.js';

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // Periodic update probe.
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });

    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          // New version ready — prompt user.
          const banner    = $('updateBanner');
          const updateBtn = $('updateBtn');
          if (!banner || !updateBtn) return;
          banner.classList.add('show');
          updateBtn.onclick = () => nw.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // Reload once when the new SW takes control.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }).catch(() => { /* SW registration failed — silent */ });
}

function wireInstallPrompt() {
  const btn = $('installBtn');
  if (!btn) return;
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.add('show');
  });
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.classList.remove('show');
  });
  window.addEventListener('appinstalled', () => btn.classList.remove('show'));
}

export function initPwa() {
  registerSW();
  wireInstallPrompt();
}
