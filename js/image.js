/**
 * image.js — image input pipeline.
 *
 * Owns the `current` image state (the next thing the user will OCR).
 * Other modules read it via `getCurrent()` and load new images via
 * `loadFromHistory(record)` (history re-run) or by user gesture
 * (drag / paste / file picker, handled internally).
 *
 * Long edge auto-downscales to MAX_DIM (1600px) so IndexedDB records
 * stay small and the API payload stays reasonable.
 */

import { $, fmtBytes, escapeHtml, setStatus, haptic } from './utils.js';

const MAX_DIM = 1600;

/** Internal: current image to OCR. `null` when nothing selected. */
let current = null;

/** Public read-only view of `current`. */
export function getCurrent() { return current; }

/* ---------- Image processing ---------- */

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function downscale(dataUrl, type) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(width, height));
      if (scale >= 1) {
        resolve({ dataUrl, width, height, scaled: false });
        return;
      }
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      // PNG/GIF preserve transparency; JPEG for everything else.
      const mime = (type === 'image/png' || type === 'image/gif') ? 'image/png' : 'image/jpeg';
      resolve({ dataUrl: c.toDataURL(mime, 0.9), width: w, height: h, scaled: true });
    };
    img.onerror = () => resolve({ dataUrl, scaled: false });
    img.src = dataUrl;
  });
}

/* ---------- Preview rendering ---------- */

function renderPreview(extraLabel = '') {
  if (!current) return;
  $('previewImg').src = current.dataUrl;
  $('preview').classList.add('show');
  const parts = [current.name];
  if (current.w && current.h) parts.push(`${current.w}×${current.h}`);
  if (current.size) parts.push(fmtBytes(current.size));
  if (extraLabel) parts.push(extraLabel);
  $('previewMeta').innerHTML = parts
    .map((p, i) => (i ? '<span class="dot">·</span>' : '') + escapeHtml(p))
    .join(' ');
  $('runBtn').disabled = false;
}

/* ---------- Public entry points ---------- */

/** Process a user-supplied File or Blob. */
export async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Please choose an image file.', 'err');
    return;
  }
  setStatus('<span class="spin"></span>Reading…');
  try {
    const raw = await readAsDataURL(file);
    const { dataUrl, width, height, scaled } = await downscale(raw, file.type);
    const approxBytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
    current = {
      dataUrl,
      name: file.name || 'pasted.png',
      size: approxBytes,
      type: file.type,
      w: width, h: height,
    };
    renderPreview(scaled ? 'downscaled' : '');
    setStatus('Ready', 'ok');
    haptic();
  } catch (e) {
    setStatus('Read failed: ' + e.message, 'err');
  }
}

/** Load a stored history record back into the input area. */
export function loadFromHistory(record) {
  current = {
    dataUrl: record.image,
    name:    record.name || 'history.png',
    size:    record.size,
    type:    record.type || 'image/png',
    w:       record.w,
    h:       record.h,
  };
  renderPreview('from history');
  // Pre-fill the previous result so users see the before/after delta.
  $('result').textContent = record.text || '';
  $('outMeta').textContent = record.text
    ? `previous · ${(record.durationMs / 1000).toFixed(2)}s`
    : '';
  setStatus('Loaded from history — edit the prompt, then run again', 'ok');
  haptic();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * If we arrived here from the OS share sheet (`?share-target=1`), pull
 * the image out of the share cache and feed it through handleFile().
 *
 * The SW writes `shared-image` into a cache named `ocr-share-inbox` on
 * POST to ./share-target/, then redirects here.
 */
export async function consumeSharedImage() {
  const url = new URL(location.href);
  if (url.searchParams.get('share-target') !== '1') return;
  // Strip the marker so a refresh doesn't re-import.
  url.searchParams.delete('share-target');
  history.replaceState({}, '', url.toString());

  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('ocr-share-inbox');
    const resp  = await cache.match('shared-image');
    if (!resp) return;
    const blob = await resp.blob();
    const name = decodeURIComponent(resp.headers.get('X-Share-Filename') || 'shared.png');
    const file = new File([blob], name, { type: blob.type });
    await handleFile(file);
    // One-shot — delete so it doesn't fire next visit.
    cache.delete('shared-image').catch(() => {});
  } catch (_) {
    /* silent — fall back to normal empty input area */
  }
}

/** Reset the input area to empty. */
export function clearCurrent() {
  current = null;
  $('preview').classList.remove('show');
  $('previewImg').src = '';
  $('previewMeta').textContent = '';
  $('runBtn').disabled = true;
  $('result').textContent = '';
  $('outMeta').textContent = '';
  $('file').value = '';
  setStatus('');
}

/* ---------- Wire DOM listeners ---------- */

export function initImage() {
  const drop = $('drop');
  const file = $('file');
  const clear = $('clearBtn');
  if (!drop || !file) return;

  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      file.click();
    }
  });

  file.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('over');
    })
  );
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  // Global clipboard paste.
  window.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])]
      .find((i) => i.type.startsWith('image/'));
    if (item) handleFile(item.getAsFile());
  });

  if (clear) clear.addEventListener('click', clearCurrent);
}
