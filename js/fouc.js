/**
 * fouc.js — flash-of-unstyled-content guard.
 *
 * Loaded synchronously in <head> before CSS resolves. Reads the saved
 * theme from localStorage and sets data-theme so the first paint matches
 * the user's preference. The rest of theme handling lives in theme.js.
 *
 * IMPORTANT: this script must remain a regular script (NOT type="module")
 * because module scripts are deferred and would render the FOUC.
 */
(function () {
  try {
    var t = localStorage.getItem('ocr.theme');
    document.documentElement.setAttribute(
      'data-theme',
      (t === 'light' || t === 'dark') ? t : 'auto'
    );
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'auto');
  }
})();
