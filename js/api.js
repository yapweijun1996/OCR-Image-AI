/**
 * api.js — streaming SSE client for the openai-gateway Responses API.
 *
 * Pattern from KB 461a53d5 (verified 2026-05-12 by the gateway operator):
 *   - `stream: true` so Cloudflare's 100s 524 timeout never fires
 *   - Live render: each `response.output_text.delta` is appended as a
 *     text node (cheap, no full re-render per token)
 *   - AbortController wired to the Stop button — partial output is kept
 *
 * See `docs/API.md` for the full event-type reference.
 */

import { $, setStatus, haptic } from './utils.js';
import { getConfig, saveConfig } from './config.js';
import { getCurrent } from './image.js';
import { dbAdd } from './db.js';
import { renderHistory } from './history.js';

let abortCtrl = null;

/**
 * Read an SSE stream from `body`, calling `onEvent` for each parsed event.
 * Aborts cleanly when `signal.aborted` flips true.
 */
async function readSSE(body, onEvent, signal) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch (_) {}
        return;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') return;
          try { onEvent(JSON.parse(payload)); }
          catch { /* keepalive / non-JSON — ignore */ }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

export async function runOCR() {
  const current = getCurrent();
  if (!current) return;

  const cfg = getConfig();
  if (!cfg.apiKey)   { setStatus('Missing API key.', 'err');   return; }
  if (!cfg.endpoint) { setStatus('Missing endpoint.', 'err'); return; }
  saveConfig();

  const resultEl = $('result');
  $('runBtn').disabled  = true;
  $('stopBtn').hidden   = false;
  $('stopBtn').disabled = false;
  resultEl.textContent    = '';
  $('outMeta').textContent = '';
  setStatus('<span class="spin"></span>Streaming…');

  abortCtrl = new AbortController();

  const body = {
    model:  cfg.model,
    stream: true,
    reasoning: { effort: cfg.effort, summary: 'auto' },
    input: [{
      role: 'user',
      content: [
        { type: 'input_text',  text: cfg.prompt || 'Read all text in this image.' },
        { type: 'input_image', image_url: current.dataUrl },
      ],
    }],
  };

  let accumulated = '';
  let usage = null;
  const t0 = performance.now();

  try {
    const resp = await fetch(cfg.endpoint, {
      method: 'POST',
      signal: abortCtrl.signal,
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type':  'application/json',
        'Accept':        'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      let msg;
      try {
        const j = JSON.parse(errTxt);
        msg = j?.error?.message || j?.message || errTxt;
      } catch { msg = errTxt || `HTTP ${resp.status}`; }
      throw new Error(msg);
    }
    if (!resp.body) {
      throw new Error('No response body (streaming unsupported by this browser).');
    }

    await readSSE(resp.body, (event) => {
      const t = event?.type;
      if (t === 'response.output_text.delta') {
        const delta = event.delta || '';
        if (!delta) return;
        accumulated += delta;
        resultEl.appendChild(document.createTextNode(delta));
      } else if (t === 'response.completed') {
        usage = event.response?.usage || null;
      } else if (t === 'response.error' || t === 'error') {
        const msg = event?.error?.message || event?.message || 'stream error';
        throw new Error(msg);
      }
    }, abortCtrl.signal);

    const ms = performance.now() - t0;
    const finalText = accumulated || '(no text recognized)';
    if (!accumulated) resultEl.textContent = finalText;

    const parts = [`${(ms / 1000).toFixed(2)}s`, cfg.model];
    if (usage) {
      const reasoning = usage.output_tokens_details?.reasoning_tokens ?? 0;
      parts.push(`in:${usage.input_tokens}`);
      parts.push(`out:${usage.output_tokens}`);
      if (reasoning) parts.push(`reasoning:${reasoning}`);
    }
    $('outMeta').textContent = parts.join(' · ');
    setStatus('Done', 'ok');
    haptic();

    await dbAdd({
      createdAt: Date.now(),
      image: current.dataUrl,
      name:  current.name,
      size:  current.size,
      type:  current.type,
      w:     current.w,
      h:     current.h,
      prompt: cfg.prompt,
      model:  cfg.model,
      effort: cfg.effort,
      text:   finalText,
      usage,
      durationMs: Math.round(ms),
    });
    renderHistory();
  } catch (e) {
    if (e.name === 'AbortError') {
      setStatus('Stopped', '');
      if (accumulated) {
        $('outMeta').textContent =
          `partial · ${((performance.now() - t0) / 1000).toFixed(2)}s`;
      } else {
        resultEl.textContent = '';
      }
    } else {
      setStatus(e.message || 'Request failed', 'err');
      if (!accumulated) resultEl.textContent = '';
    }
  } finally {
    $('runBtn').disabled  = false;
    $('stopBtn').disabled = true;
    $('stopBtn').hidden   = true;
    abortCtrl = null;
  }
}

export function initApi() {
  $('runBtn')?.addEventListener('click', runOCR);
  $('stopBtn')?.addEventListener('click', () => { abortCtrl?.abort(); });
}
