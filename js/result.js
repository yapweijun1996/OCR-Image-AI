/**
 * result.js — output panel actions (copy / download / share).
 *
 * Small enough to live in `main.js`, but pulled out so each module
 * stays single-responsibility.
 */

import { $, setStatus, haptic } from './utils.js';

export function initResult() {
  $('copyBtn')?.addEventListener('click', async () => {
    const t = $('result').textContent;
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setStatus('Copied to clipboard', 'ok');
      haptic();
    } catch {
      setStatus('Copy failed', 'err');
    }
  });

  $('dlBtn')?.addEventListener('click', () => {
    const t = $('result').textContent;
    if (!t) return;
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `ocr-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const shareBtn = $('shareBtn');
  if (shareBtn && navigator.share) {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', async () => {
      const t = $('result').textContent;
      if (!t) return;
      try { await navigator.share({ title: 'OCR result', text: t }); }
      catch (_) { /* user cancelled — ignore */ }
    });
  }
}
