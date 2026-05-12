/**
 * modal.js — generic open/close handlers for the (currently dormant) modal.
 *
 * The modal markup lives in index.html but is not opened by any current
 * code path — the history "View" action loads images back into the input
 * area instead. Kept around as a holding pen for future fullscreen views.
 */

import { $ } from './utils.js';

export function closeModal() {
  $('modal')?.classList.remove('show');
}

export function initModal() {
  $('modalClose')?.addEventListener('click', closeModal);
  $('modal')?.addEventListener('click', (e) => {
    if (e.target === $('modal')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}
