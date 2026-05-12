/**
 * history.js — record list rendering + row actions.
 *
 * Reads from db.js (the source of truth) and triggers image.loadFromHistory
 * for the Re-run action. Re-rendering happens after every mutation
 * (add via api.js, delete here, clear here).
 */

import { $, fmtBytes, fmtTime, escapeHtml, setStatus, haptic } from './utils.js';
import { dbAll, dbDelete, dbClear } from './db.js';
import { loadFromHistory } from './image.js';

const DELETE_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
  </svg>`;

/** Render the full list from IndexedDB into #history. */
export async function renderHistory() {
  const items = await dbAll();
  const root  = $('history');
  if (!root) return;
  if (!items.length) {
    root.innerHTML = '<div class="h-empty">No records yet.</div>';
    return;
  }
  root.innerHTML = items.map((it) => `
    <div class="h-row" data-id="${it.id}">
      <img class="h-thumb" src="${it.image}" alt="" loading="lazy" data-act="view">
      <div class="h-body">
        <div class="h-text">${escapeHtml(it.text || '(empty)')}</div>
        <div class="h-meta">
          <span>${fmtTime(it.createdAt)}</span>
          <span class="dot">·</span>
          <span>${escapeHtml(it.model || '')}</span>
          <span class="dot">·</span>
          <span>${(it.durationMs / 1000).toFixed(2)}s</span>
        </div>
      </div>
      <div class="h-actions">
        <button class="btn btn-tinted btn-sm" data-act="view" type="button"
                title="Load image to input and re-run">Re-run</button>
        <button class="btn btn-tinted btn-sm" data-act="copy" type="button">Copy</button>
        <button class="btn btn-tinted btn-sm btn-danger" data-act="del" type="button"
                aria-label="Delete">${DELETE_ICON}</button>
      </div>
    </div>
  `).join('');
}

/** Wire up the click handler, clear-all, and JSON export. Call once. */
export function initHistory() {
  const list = $('history');
  if (!list) return;

  list.addEventListener('click', async (e) => {
    const row     = e.target.closest('.h-row');
    const trigger = e.target.closest('[data-act]');
    if (!row || !trigger) return;
    const id  = Number(row.dataset.id);
    const act = trigger.dataset.act;
    const all = await dbAll();
    const it  = all.find((x) => x.id === id);
    if (!it) return;

    if (act === 'view') {
      loadFromHistory(it);
    } else if (act === 'copy') {
      try {
        await navigator.clipboard.writeText(it.text || '');
        setStatus('Copied record', 'ok');
      } catch {
        setStatus('Copy failed', 'err');
      }
    } else if (act === 'del') {
      await dbDelete(id);
      renderHistory();
      haptic();
    }
  });

  $('clearHistBtn')?.addEventListener('click', async () => {
    if (!confirm('Clear all history?')) return;
    await dbClear();
    renderHistory();
  });

  $('exportBtn')?.addEventListener('click', async () => {
    const items = await dbAll();
    const blob  = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = `ocr-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}
