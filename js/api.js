/**
 * api.js — streaming SSE client + batch runner.
 *
 * `runBatch()` walks the queue (`js/queue.js`) one item at a time,
 * dispatches `runOne(item)` for each pending entry, and stops cleanly
 * when the user clicks Stop (AbortController scoped to the entire batch).
 *
 * Pattern from KB 461a53d5 (verified 2026-05-12):
 *   - `stream: true` so Cloudflare's 100s 524 timeout never fires
 *   - Live render: `response.output_text.delta` → appended text node
 *   - `response.reasoning_summary_text.delta` → Thinking panel
 *
 * See `docs/API.md` for the full event reference.
 */

import { $, setStatus, haptic, escapeHtml } from './utils.js';
import { getConfig, saveConfig } from './config.js';
import { dbAdd } from './db.js';
import { renderHistory } from './history.js';
import {
  getItem, findNextPending, pendingCount,
  setItemStatus, setItemResult,
  setActiveItemId, selectForView,
  initQueue,
} from './queue.js';

let abortCtrl = null;
let batchRunning = false;

/* ---------- Thinking panel helpers ---------- */
function resetThinking() {
  const el = $('thinking');
  const body = $('thinkingBody');
  const label = $('thinkingLabel');
  if (!el || !body || !label) return;
  el.hidden = true;
  el.classList.add('collapsed');
  el.classList.remove('done');
  body.textContent = '';
  label.textContent = 'Thinking…';
  $('thinkingHead')?.setAttribute('aria-expanded', 'false');
}

function appendThinking(delta) {
  const el = $('thinking');
  const body = $('thinkingBody');
  if (!el || !body || !delta) return;
  if (el.hidden) {
    el.hidden = false;
    el.classList.remove('collapsed');
    $('thinkingHead')?.setAttribute('aria-expanded', 'true');
  }
  body.appendChild(document.createTextNode(delta));
  body.scrollTop = body.scrollHeight;
}

function finishThinking() {
  const el = $('thinking');
  const label = $('thinkingLabel');
  if (!el || el.hidden) return;
  el.classList.add('done', 'collapsed');
  if (label) label.textContent = 'Thought process';
  $('thinkingHead')?.setAttribute('aria-expanded', 'false');
}

/* ---------- SSE reader ---------- */
async function readSSE(body, onEvent, signal) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) { try { await reader.cancel(); } catch (_) {} return; }
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

/* ---------- One-item runner ---------- */

/**
 * Run OCR for a single queue item. Updates queue state, streams into
 * the shared Thinking + Result panels, persists to history on success.
 *
 * Returns true if processed (success OR error), false if aborted.
 */
async function runOne(item, cfg, signal, batchPosition) {
  const resultEl = $('result');
  setActiveItemId(item.id);
  selectForView(item.id, { fireListener: false });

  // Reset display for this item.
  resultEl.textContent = '';
  $('outMeta').textContent = '';
  resetThinking();
  setStatus(
    `<span class="spin"></span>Thinking… <span class="status-pos">` +
    `(${batchPosition.idx} / ${batchPosition.total} · ${escapeHtml(item.name)})</span>`
  );
  setItemStatus(item.id, 'running');

  const body = {
    model:  cfg.model,
    stream: true,
    reasoning: { effort: cfg.effort, summary: 'auto' },
    input: [{
      role: 'user',
      content: [
        { type: 'input_text',  text: cfg.prompt || 'Read all text in this image.' },
        { type: 'input_image', image_url: item.dataUrl },
      ],
    }],
  };

  let accumulated = '';
  let usage = null;
  const t0 = performance.now();

  try {
    const resp = await fetch(cfg.endpoint, {
      method: 'POST',
      signal,
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

    let outputStarted = false;
    await readSSE(resp.body, (event) => {
      const t = event?.type;

      // Reasoning summary deltas.
      if (
        t === 'response.reasoning_summary_text.delta' ||
        t === 'response.reasoning_summary.delta'      ||
        t === 'response.reasoning.delta'
      ) {
        appendThinking(event.delta || event.text || '');
        return;
      }

      if (t === 'response.output_text.delta') {
        const delta = event.delta || '';
        if (!delta) return;
        if (!outputStarted) {
          outputStarted = true;
          finishThinking();
          setStatus(
            `<span class="spin"></span>Writing… <span class="status-pos">` +
            `(${batchPosition.idx} / ${batchPosition.total} · ${escapeHtml(item.name)})</span>`
          );
        }
        accumulated += delta;
        resultEl.appendChild(document.createTextNode(delta));
        return;
      }

      if (t === 'response.completed') {
        usage = event.response?.usage || null;
      } else if (t === 'response.error' || t === 'error') {
        const msg = event?.error?.message || event?.message || 'stream error';
        throw new Error(msg);
      }
    }, signal);

    const ms = performance.now() - t0;
    const finalText = accumulated || '(no text recognized)';
    if (!accumulated) resultEl.textContent = finalText;

    const metaParts = [`${(ms / 1000).toFixed(2)}s`, cfg.model];
    if (usage) {
      const reasoning = usage.output_tokens_details?.reasoning_tokens ?? 0;
      metaParts.push(`in:${usage.input_tokens}`);
      metaParts.push(`out:${usage.output_tokens}`);
      if (reasoning) metaParts.push(`reasoning:${reasoning}`);
    }
    $('outMeta').textContent = metaParts.join(' · ');

    setItemResult(item.id, { text: finalText, usage, durationMs: Math.round(ms) });
    setItemStatus(item.id, 'done');

    await dbAdd({
      createdAt: Date.now(),
      image: item.dataUrl,
      name:  item.name,
      size:  item.size,
      type:  item.type,
      w:     item.w,
      h:     item.h,
      prompt: cfg.prompt,
      model:  cfg.model,
      effort: cfg.effort,
      text:   finalText,
      usage,
      durationMs: Math.round(ms),
    });
    renderHistory();
    return true;
  } catch (e) {
    if (e.name === 'AbortError') {
      setItemStatus(item.id, 'aborted', { error: 'Aborted by user' });
      if (accumulated) {
        // Keep what we got.
        setItemResult(item.id, {
          text: accumulated,
          usage: null,
          durationMs: Math.round(performance.now() - t0),
        });
        $('outMeta').textContent =
          `partial · ${((performance.now() - t0) / 1000).toFixed(2)}s`;
      } else {
        resultEl.textContent = '';
      }
      return false;
    }
    setItemStatus(item.id, 'error', { error: e.message || 'Request failed' });
    if (!accumulated) resultEl.textContent = '';
    return true;   // processed (with error); batch continues
  } finally {
    finishThinking();
  }
}

/* ---------- Batch runner ---------- */

async function runBatch() {
  if (batchRunning) return;
  const cfg = getConfig();
  if (!cfg.apiKey)   { setStatus('Missing API key.', 'err');   return; }
  if (!cfg.endpoint) { setStatus('Missing endpoint.', 'err'); return; }
  if (pendingCount() === 0) return;
  saveConfig();

  batchRunning = true;
  abortCtrl = new AbortController();
  $('runBtn').disabled    = true;
  $('stopBtn').hidden     = false;
  $('stopBtn').disabled   = false;

  const total = pendingCount();
  let idx = 0;
  let aborted = false;

  try {
    while (true) {
      if (abortCtrl.signal.aborted) { aborted = true; break; }
      const item = findNextPending();
      if (!item) break;
      idx++;
      const processed = await runOne(item, cfg, abortCtrl.signal, { idx, total });
      if (!processed) { aborted = true; break; }
      // After each item, refresh the saved config in case the user edited
      // the prompt mid-batch. The next item picks up the change.
      Object.assign(cfg, getConfig());
    }

    if (aborted) {
      setStatus(`Stopped at ${idx} / ${total}.`, '');
    } else {
      setStatus(`Done · ${idx} / ${total}.`, 'ok');
      haptic();
    }
  } finally {
    batchRunning = false;
    abortCtrl = null;
    setActiveItemId(null);
    $('runBtn').disabled  = false;
    $('stopBtn').disabled = true;
    $('stopBtn').hidden   = true;
    refreshRunBtn();
  }
}

/* ---------- Run-button label ---------- */

export function refreshRunBtn() {
  const btn = $('runBtn');
  if (!btn) return;
  const label = btn.querySelector('.run-label');
  const n = pendingCount();
  if (label) {
    label.textContent = n === 0
      ? 'Recognize text'
      : n === 1
        ? 'Recognize 1 image'
        : `Recognize ${n} images`;
  }
  btn.disabled = n === 0 || batchRunning;
}

/* ---------- Show selected item's stored result in the Result panel ---------- */

function showItemResult(item) {
  if (!item) return;
  const resultEl = $('result');
  if (batchRunning && item.id !== /* active */ undefined) {
    // While running, don't clobber the active stream — only allow switching
    // to view a row that's NOT currently active.
  }
  if (batchRunning) return;
  resultEl.textContent = item.text || '';
  if (item.status === 'done' && item.durationMs != null) {
    $('outMeta').textContent =
      `${(item.durationMs / 1000).toFixed(2)}s` +
      (item.usage ? ` · in:${item.usage.input_tokens} out:${item.usage.output_tokens}` : '');
  } else if (item.status === 'error') {
    $('outMeta').textContent = `error · ${item.error || ''}`;
  } else {
    $('outMeta').textContent = '';
  }
}

/* ---------- Wiring ---------- */

export function initApi() {
  $('runBtn')?.addEventListener('click', runBatch);
  $('stopBtn')?.addEventListener('click', () => { abortCtrl?.abort(); });

  // Thinking panel: click head to toggle expand / collapse.
  $('thinkingHead')?.addEventListener('click', () => {
    const el = $('thinking');
    if (!el) return;
    const willCollapse = !el.classList.contains('collapsed');
    el.classList.toggle('collapsed', willCollapse);
    $('thinkingHead').setAttribute('aria-expanded', String(!willCollapse));
  });

  initQueue({
    onChange: refreshRunBtn,
    onSelect: showItemResult,
  });
  refreshRunBtn();
}
