/**
 * theme.js — light / dark / auto theme management.
 *
 * The initial theme is set by an inline script in index.html `<head>` to
 * avoid FOUC. This module handles the runtime toggle + theme-color sync.
 *
 * Tri-state cycle: auto → light → dark → light → dark → …
 * (Once the user makes an explicit choice, `auto` is exited.)
 */

import { $ } from './utils.js';
import { LS } from './config.js';

const THEME_COLORS = {
  light: '#ff6a3d',
  dark:  '#000000',
};

function effectiveTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  if (cur === 'light' || cur === 'dark') return cur;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncThemeColorMeta() {
  // Always reflect the EFFECTIVE theme so the OS chrome (Android URL bar,
  // iOS status bar) matches the page — even when data-theme is "auto".
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[effectiveTheme()]);
}

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  syncThemeColorMeta();
}

export function initTheme() {
  // The inline `<head>` script already set data-theme — sync the chrome
  // color now (it loaded a default value matching only the light theme).
  syncThemeColorMeta();

  // Wire the toggle.
  const btn = $('themeBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(LS.theme, next); } catch (_) {}
      applyTheme(next);
    });
  }

  // While in auto mode, react to OS preference changes.
  try {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (document.documentElement.getAttribute('data-theme') === 'auto') {
        syncThemeColorMeta();
      }
    });
  } catch (_) {}
}
