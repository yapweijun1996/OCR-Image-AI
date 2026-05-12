/**
 * queue.js — in-memory batch queue + row rendering.
 *
 * The user can drop / paste / pick multiple images. Each becomes a
 * QueueItem with status `pending`. `runBatch()` in api.js walks the queue
 * sequentially and mutates each item through `running` → `done` / `error`
 * / `aborted` via `setItemStatus()` and `setItemResult()`.
 *
 * Items are not persisted; the history (IndexedDB) is the durable store.
 * Reloading the page drops the in-memory queue.
 *
 * QueueItem shape:
 *   {
 *     id:         number       // monotonic, unique per session
 *     dataUrl:    string       // post-downscale data: URL
 *     name:       string
 *     size:       number       // bytes (approx, post-downscale)
 *     type:       string       // mime type
 *     w, h:       number       // px (post-downscale)
 *     status:     'pending' | 'running' | 'done' | 'error' | 'aborted'
 *     text:       string|null  // OCR result text once done
 *     usage:      object|null  // token usage from response.completed
 *     durationMs: number|null
 *     error:      string|null  // human-readable error if status==='error'
 *   }
 */

import { $, fmtBytes, escapeHtml, haptic } from './utils.js';

const queue = [];
let nextId = 1;
let activeItemId = null;          // currently-being-processed item
let viewItemId   = null;          // last clicked-to-view item (drives Result panel)

/* Callbacks (wired by initQueue / api.js) */
const listeners = {
  /** Fires after any structural change so api.js can update Run-button state. */
  onChange: () => {},
  /** Fires when user clicks a row — api.js / image.js can show that item's result. */
  onSelect: () => {},
};

/* ---------- Public API ---------- */

export function getQueue() { return queue.slice(); }
export function getItem(id) { return queue.find((x) => x.id === id) || null; }
export function findNextPending() { return queue.find((x) => x.status === 'pending') || null; }
export function getActiveItemId() { return activeItemId; }
export function getViewItemId() { return viewItemId; }
export function setActiveItemId(id) { activeItemId = id; renderQueue(); }
export function pendingCount() { return queue.filter((x) => x.status === 'pending').length; }

export function addItem(prepared) {
  // `prepared` is a plain object from image.prepareImage(file).
  const item = {
    id: nextId++,
    ...prepared,
    status: 'pending',
    text: null,
    usage: null,
    durationMs: null,
    error: null,
  };
  queue.push(item);
  if (viewItemId === null) viewItemId = item.id;
  renderQueue();
  listeners.onChange();
  return item;
}

export function removeItem(id) {
  const i = queue.findIndex((x) => x.id === id);
  if (i < 0) return;
  queue.splice(i, 1);
  if (activeItemId === id) activeItemId = null;
  if (viewItemId   === id) viewItemId   = queue[Math.max(0, i - 1)]?.id ?? null;
  renderQueue();
  listeners.onChange();
}

export function clearQueue({ keepDone = false } = {}) {
  if (keepDone) {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].status !== 'done') queue.splice(i, 1);
    }
  } else {
    queue.length = 0;
  }
  activeItemId = null;
  viewItemId   = queue[0]?.id ?? null;
  renderQueue();
  listeners.onChange();
}

export function setItemStatus(id, status, extra = {}) {
  const it = getItem(id);
  if (!it) return;
  it.status = status;
  Object.assign(it, extra);
  renderQueue();
  listeners.onChange();
}

export function setItemResult(id, { text, usage, durationMs }) {
  const it = getItem(id);
  if (!it) return;
  it.text = text;
  it.usage = usage;
  it.durationMs = durationMs;
  renderQueue();
}

/** Mark the user-visible "currently viewing this row" state. */
export function selectForView(id, { fireListener = true } = {}) {
  if (!getItem(id)) return;
  viewItemId = id;
  renderQueue();
  if (fireListener) listeners.onSelect(getItem(id));
}

/* ---------- Rendering ---------- */

const STATUS_ICONS = {
  pending: '<span class="q-dot pending" aria-hidden="true"></span>',
  running: '<span class="spin q-spin" aria-hidden="true"></span>',
  done:    `<svg class="q-icon ok" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4 4 10-10"/>
           </svg>`,
  error:   `<svg class="q-icon err" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.01"/>
           </svg>`,
  aborted: `<svg class="q-icon dim" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>
           </svg>`,
};

const STATUS_LABEL = {
  pending: 'Queued',
  running: 'Running…',
  done:    'Done',
  error:   'Error',
  aborted: 'Aborted',
};

function statusMeta(it) {
  if (it.status === 'done' && it.durationMs != null) {
    return `${STATUS_LABEL.done} · ${(it.durationMs / 1000).toFixed(2)}s`;
  }
  if (it.status === 'error' && it.error) {
    return `${STATUS_LABEL.error} · ${escapeHtml(it.error.slice(0, 80))}`;
  }
  return STATUS_LABEL[it.status] || '';
}

export function renderQueue() {
  const root = $('queue');
  if (!root) return;
  if (queue.length === 0) {
    root.innerHTML = '';
    root.hidden = true;
    return;
  }
  root.hidden = false;
  root.innerHTML = queue.map((it) => {
    const dims = (it.w && it.h) ? `${it.w}×${it.h}` : '';
    const size = it.size ? fmtBytes(it.size) : '';
    const sub  = [dims, size].filter(Boolean).join(' · ');
    const classes = [
      'q-row',
      `is-${it.status}`,
      it.id === activeItemId ? 'is-active' : '',
      it.id === viewItemId   ? 'is-viewing' : '',
    ].filter(Boolean).join(' ');
    return `
      <div class="${classes}" data-id="${it.id}" data-act="view">
        <img class="q-thumb" src="${it.dataUrl}" alt="" loading="lazy">
        <div class="q-body">
          <div class="q-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
          <div class="q-meta">
            <span class="q-status-text">${statusMeta(it)}</span>
            ${sub ? `<span class="dot">·</span><span>${escapeHtml(sub)}</span>` : ''}
          </div>
        </div>
        <span class="q-status" aria-label="${STATUS_LABEL[it.status]}">
          ${STATUS_ICONS[it.status] || ''}
        </span>
        <button class="q-remove" data-act="remove" type="button"
                aria-label="Remove from queue" ${it.status === 'running' ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

/* ---------- Wiring ---------- */

export function initQueue({ onChange, onSelect }) {
  if (onChange) listeners.onChange = onChange;
  if (onSelect) listeners.onSelect = onSelect;

  const root = $('queue');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.q-remove');
    const row       = e.target.closest('.q-row');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (!id) return;

    if (removeBtn) {
      e.stopPropagation();
      const it = getItem(id);
      if (it && it.status === 'running') return;   // safety; button is also disabled
      removeItem(id);
      haptic();
      return;
    }
    // Plain row click → select for viewing.
    selectForView(id);
  });

  // Clear-queue button (in the action row).
  $('clearQueueBtn')?.addEventListener('click', () => {
    if (queue.length === 0) return;
    if (queue.some((x) => x.status === 'running')) return;
    if (!confirm('Clear the queue?')) return;
    clearQueue();
  });

  renderQueue();
}
