/**
 * prompts.js — English-only prompt presets.
 *
 * The user picks a preset from a combobox; the matching `text` is loaded
 * into the prompt textarea. Manual edits in the textarea flip the preset
 * back to "custom" automatically (see config.js).
 *
 * Add a new preset by appending to this map and re-using the same shape.
 * The combobox is rebuilt from this object at boot, so no HTML change
 * is needed.
 */

export const PROMPT_PRESETS = {
  general: {
    label: 'General — preserve layout',
    text:
      'Read all visible text in this image. Preserve original layout, ' +
      'line breaks, and any non-English characters. Output only the ' +
      'recognized text — no markdown, no explanation.',
  },
  plain: {
    label: 'Plain text — strip formatting',
    text:
      'Extract all text from this image as a continuous string. Ignore ' +
      'layout and line breaks. Output only the recognized text — no ' +
      'markdown, no explanation.',
  },
  receipt: {
    label: 'Receipt / invoice',
    text:
      'Extract all text from this receipt or invoice. Preserve line ' +
      'items, prices, totals, dates, and vendor information. Output ' +
      'one item per line as plain text — no markdown.',
  },
  handwriting: {
    label: 'Handwriting',
    text:
      'Carefully read the handwriting in this image. Pay attention to ' +
      'ambiguous characters and stylized letters. Output only the ' +
      'recognized text — no commentary.',
  },
  code: {
    label: 'Code snippet',
    text:
      'Extract the code from this image. Preserve indentation, syntax, ' +
      'and special characters exactly. Output only the code — no ' +
      'markdown fences, no explanation.',
  },
  table: {
    label: 'Table — TSV output',
    text:
      'Extract the tabular data from this image. Output each row on its ' +
      'own line, with columns separated by tabs. No header decoration, ' +
      'no markdown, no commentary.',
  },
  'translate-en': {
    label: 'Translate to English',
    text:
      'Read all visible text in this image, then translate it to ' +
      'English. Output only the English translation — no markdown, ' +
      'no commentary, no original-language text.',
  },
  custom: {
    label: 'Custom (your own prompt)',
    // `null` is the sentinel meaning "do not overwrite the textarea".
    text: null,
  },
};

export const DEFAULT_PRESET = 'general';

/** Reverse lookup: which preset key matches a given prompt text? */
export function detectPreset(text) {
  const t = (text || '').trim();
  for (const [key, p] of Object.entries(PROMPT_PRESETS)) {
    if (p.text && p.text.trim() === t) return key;
  }
  return 'custom';
}
