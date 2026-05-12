/**
 * config.js — localStorage-backed configuration.
 *
 * Hardcoded values (endpoint, key, model) live in the DOM as `hidden`
 * inputs so this module can read them uniformly. The XOR-decoded
 * `HARDCODED_API_KEY` is used as the API-key default if `localStorage`
 * has no value for it yet.
 *
 * Keys are namespaced under `ocr.*`. The prompt key was bumped from
 * `ocr.prompt` → `ocr.prompt.v2` on 2026-05-12 to migrate from the
 * legacy Chinese default to the English one.
 */

import { $ } from './utils.js';
import { PROMPT_PRESETS, DEFAULT_PRESET, detectPreset } from './prompts.js';

/* ---------- Encoded API key (demo only) ---------- */
const ENC_KEY     = '20260512';
const ENC_API_KEY = '085071109007084005000002001081084087086083009007010008086006009086008084086084002080006084004002005005084015005086084001003003086003008087085005086007001';

function decodeKey(enc, pad) {
  let out = '';
  const n = Math.floor(enc.length / 3);
  for (let i = 0; i < n; i++) {
    const b = parseInt(enc.substr(i * 3, 3), 10);
    out += String.fromCharCode(b ^ pad.charCodeAt(i % pad.length));
  }
  return out;
}

const HARDCODED_API_KEY = decodeKey(ENC_API_KEY, ENC_KEY);

/* ---------- localStorage keys ---------- */
//
// `prompt.v3` (2026-05-12): bumped from v2 to force-replace any lingering
// Chinese saved values from pre-refactor sessions. The default is now a
// preset key — see prompts.js.
export const LS = Object.freeze({
  theme:    'ocr.theme',
  endpoint: 'ocr.endpoint',
  key:      'ocr.key',
  model:    'ocr.model',
  effort:   'ocr.effort',
  preset:   'ocr.prompt.preset',
  prompt:   'ocr.prompt.v3',
});

/* ---------- Preset select population ---------- */
function populatePresetOptions() {
  const el = $('cfgPromptPreset');
  if (!el || el.options.length > 0) return;
  for (const [value, p] of Object.entries(PROMPT_PRESETS)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = p.label;
    el.appendChild(opt);
  }
}

/* ---------- Load / save ---------- */
export function loadConfig() {
  const set = (id, lsKey, fallback) => {
    const el = $(id);
    if (!el) return;
    const v = localStorage.getItem(lsKey);
    if (v !== null) el.value = v;
    else if (fallback !== undefined) el.value = fallback;
  };
  set('cfgEndpoint', LS.endpoint);
  set('cfgKey',      LS.key,    HARDCODED_API_KEY);
  set('cfgModel',    LS.model);
  set('cfgEffort',   LS.effort);

  // Prompt loading: pick a preset first, then the textarea text.
  populatePresetOptions();
  const presetEl = $('cfgPromptPreset');
  const promptEl = $('cfgPrompt');
  if (presetEl && promptEl) {
    const savedPreset = localStorage.getItem(LS.preset);
    const savedPrompt = localStorage.getItem(LS.prompt);
    const preset = (savedPreset && PROMPT_PRESETS[savedPreset])
      ? savedPreset
      : DEFAULT_PRESET;
    presetEl.value = preset;
    if (preset === 'custom') {
      // Use the user's saved free-form text, or fall back to the general default.
      promptEl.value = savedPrompt ?? PROMPT_PRESETS[DEFAULT_PRESET].text;
    } else {
      promptEl.value = PROMPT_PRESETS[preset].text;
    }
  }
}

export function saveConfig() {
  try {
    localStorage.setItem(LS.endpoint, $('cfgEndpoint').value.trim());
    localStorage.setItem(LS.key,      $('cfgKey').value.trim());
    localStorage.setItem(LS.model,    $('cfgModel').value.trim());
    localStorage.setItem(LS.effort,   $('cfgEffort').value);
    localStorage.setItem(LS.preset,   $('cfgPromptPreset').value);
    localStorage.setItem(LS.prompt,   $('cfgPrompt').value);
  } catch (_) {
    // Safari Private Mode, Brave aggressive blocking — fall through gracefully.
  }
}

/** Read a single config value at runtime (always live from the DOM). */
export function getConfig() {
  return {
    endpoint: $('cfgEndpoint').value.trim(),
    apiKey:   $('cfgKey').value.trim(),
    model:    $('cfgModel').value.trim(),
    effort:   $('cfgEffort').value,
    preset:   $('cfgPromptPreset')?.value || DEFAULT_PRESET,
    prompt:   $('cfgPrompt').value.trim(),
  };
}

/* ---------- Prompt preset ↔ textarea sync ---------- */
function wirePromptPresets() {
  const presetEl = $('cfgPromptPreset');
  const promptEl = $('cfgPrompt');
  if (!presetEl || !promptEl) return;

  // Preset change → overwrite textarea (unless picking "custom").
  presetEl.addEventListener('change', () => {
    const next = PROMPT_PRESETS[presetEl.value];
    if (next && next.text !== null) {
      promptEl.value = next.text;
    }
    saveConfig();
  });

  // Free-form edit → auto-flip preset to whatever matches, else "custom".
  promptEl.addEventListener('input', () => {
    const matched = detectPreset(promptEl.value);
    if (presetEl.value !== matched) presetEl.value = matched;
  });
}

/** Wire up persistence listeners. Call once after DOM is ready. */
export function initConfig() {
  loadConfig();
  ['cfgEndpoint', 'cfgKey', 'cfgModel', 'cfgEffort', 'cfgPrompt'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('change', saveConfig);
    el.addEventListener('blur',   saveConfig);
  });
  wirePromptPresets();
}
