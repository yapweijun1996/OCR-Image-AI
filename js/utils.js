/**
 * utils.js — DOM and formatting helpers.
 *
 * No dependencies on other app modules. Safe to import anywhere.
 */

/** Shorthand for `document.getElementById`. */
export const $ = (id) => document.getElementById(id);

/** Format a byte count as "1.2 MB" / "240 KB" / "120 B". */
export function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/** Format a timestamp: time-only for today, "Mar 12, 14:32" for older. */
export function fmtTime(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const opts = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/** Escape HTML special characters for safe innerHTML interpolation. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/**
 * Update the global status row (#status). Accepts inline HTML (e.g. spinner)
 * because we control the input — never use with user-provided text.
 */
export function setStatus(html, cls = '') {
  const el = $('status');
  if (!el) return;
  el.className = 'status ' + cls;
  el.innerHTML = html;
}

/** Tiny tactile feedback on supported devices. No-op elsewhere. */
export function haptic() {
  if (navigator.vibrate) {
    try { navigator.vibrate(8); } catch (_) {}
  }
}
