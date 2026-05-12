/**
 * image.js — image input pipeline.
 *
 * Reads files (drag / paste / file picker / share_target), downscales the
 * long edge to MAX_DIM, and pushes the prepared image into the queue
 * (see `js/queue.js`).
 *
 * The "current image" concept is gone — the queue is the source of truth.
 * Other modules read it via `queue.getItem(id)`.
 */

import { $, setStatus, haptic } from './utils.js';
import { addItem } from './queue.js';

const MAX_DIM = 1600;

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

/**
 * Read + downscale one File. Returns a plain object suitable for
 * `queue.addItem()`. Throws on non-image files.
 */
async function prepareImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Not an image: ' + (file?.name || '<unknown>'));
  }
  const raw = await readAsDataURL(file);
  const { dataUrl, width, height } = await downscale(raw, file.type);
  const approxBytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
  return {
    dataUrl,
    name: file.name || 'pasted.png',
    size: approxBytes,
    type: file.type,
    w:    width,
    h:    height,
  };
}

/* ---------- Public entry points ---------- */

/**
 * Process one or more user-supplied Files / Blobs and add them to the
 * queue. Reports progress in the status row.
 */
export async function handleFiles(files) {
  const list = Array.from(files || []).filter(Boolean);
  if (list.length === 0) return;

  let added = 0;
  for (let i = 0; i < list.length; i++) {
    setStatus(
      `<span class="spin"></span>Reading ${i + 1} of ${list.length}…`
    );
    try {
      const prepared = await prepareImage(list[i]);
      addItem(prepared);
      added++;
    } catch (e) {
      // Continue with the rest even if one fails.
      setStatus(`Skipped “${list[i].name}”: ${e.message}`, 'err');
    }
  }
  if (added > 0) {
    setStatus(`Added ${added} ${added === 1 ? 'image' : 'images'} to queue`, 'ok');
    haptic();
  }
}

/** Back-compat shim: a single-file handler routed through handleFiles(). */
export function handleFile(file) {
  return handleFiles(file ? [file] : []);
}

/**
 * Share-target receiver. SW POSTed an image into the share cache and
 * redirected here with `?share-target=1`. Pull and feed into the queue.
 */
export async function consumeSharedImage() {
  const url = new URL(location.href);
  if (url.searchParams.get('share-target') !== '1') return;
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
    await handleFiles([file]);
    cache.delete('shared-image').catch(() => {});
  } catch (_) { /* silent — empty input area on failure */ }
}

/* ---------- Wire DOM listeners ---------- */

export function initImage() {
  const drop  = $('drop');
  const file  = $('file');
  if (!drop || !file) return;

  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      file.click();
    }
  });

  file.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    // Allow re-picking the same file again later.
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); })
  );
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  // Global clipboard paste — may include multiple images.
  window.addEventListener('paste', (e) => {
    const items  = [...(e.clipboardData?.items || [])]
      .filter((i) => i.type.startsWith('image/'));
    if (items.length === 0) return;
    handleFiles(items.map((i) => i.getAsFile()));
  });
}
