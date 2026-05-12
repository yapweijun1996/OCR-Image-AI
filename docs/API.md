# Gateway API contract

The app calls the **openai-gateway** Responses API. This doc captures the request shape, the streaming event types we handle, and the failure modes we care about.

## Endpoint

```
POST https://gpt.yapweijun1996.com/v1/responses
```

Recommended by the gateway operator over `/v1/chat/completions` because it supports image inputs, reasoning effort, and streaming in one consistent payload.

## Authentication

```
Authorization: Bearer gw_<your-client-key>
```

The client key is XOR-obfuscated in the source at `index.html` (see the `ENC_API_KEY` constant). Treat the demo key as public.

## Request

```http
POST /v1/responses HTTP/1.1
Host: gpt.yapweijun1996.com
Authorization: Bearer gw_...
Content-Type: application/json
Accept: text/event-stream

{
  "model": "gpt-5.4-mini",
  "stream": true,
  "reasoning": { "effort": "medium", "summary": "auto" },
  "input": [
    {
      "role": "user",
      "content": [
        { "type": "input_text",  "text": "Read all text in this image." },
        { "type": "input_image", "image_url": "data:image/jpeg;base64,…" }
      ]
    }
  ]
}
```

### Field notes

| Field                     | Required | Notes                                                                 |
|---------------------------|----------|-----------------------------------------------------------------------|
| `model`                   | yes      | We use `gpt-5.4-mini`. Other vision-capable models will work too.    |
| `stream`                  | yes (here) | Must be `true` — non-stream calls risk Cloudflare 524 timeouts on long reasoning. |
| `reasoning.effort`        | optional | `minimal` / `low` / `medium` / `high` / `xhigh`. Higher = more thinking tokens, more latency. |
| `reasoning.summary`       | optional | `auto` returns reasoning summary alongside the answer.               |
| `input[].content[].type`  | yes      | `input_text` or `input_image`.                                       |
| `input[].content[].image_url` | yes for image | Accepts data URIs or HTTPS URLs.                                |

### Reasoning effort guidance

| Effort     | Latency  | Token cost | Best for                                         |
|------------|----------|------------|--------------------------------------------------|
| `minimal`  | fastest  | lowest     | Receipts, single-column labels, captions         |
| `low`      | fast     | low        | Clean documents with predictable layout          |
| `medium`   | balanced | medium     | Default — most images                            |
| `high`     | slow     | high       | Dense multi-column, handwriting, mixed languages |
| `xhigh`    | slowest  | highest    | Last resort for ambiguous content                |

## Streaming response

`Content-Type: text/event-stream` — Server-Sent Events. Events are separated by blank lines (`\n\n`). Each event has one or more `data: <json>` lines.

The reader logic lives in `readSSE()` in `index.html`.

### Event types we handle

| `type`                                | Payload shape                                        | What we do                                    |
|---------------------------------------|------------------------------------------------------|------------------------------------------------|
| `response.created`                    | `{ response: { id, ... } }`                          | (ignored)                                      |
| `response.in_progress`                | keep-alive ping                                      | (ignored)                                      |
| `response.reasoning_summary_text.delta` (+ legacy `response.reasoning_summary.delta` / `response.reasoning.delta`) | `{ delta: "<fragment>" }` | Reveal the **Thinking panel**, append the delta as a text node, auto-scroll |
| `response.reasoning_summary_text.done` / `response.reasoning_summary_part.done` | (no payload of interest) | (logged but no-op — we wait for the first output delta to collapse the panel) |
| `response.output_text.delta`          | `{ delta: "<fragment>" }`                            | On first delta: collapse the Thinking panel + flip status to **Writing…**. Then append the delta as a text node into the result |
| `response.output_text.done`           | `{ text: "<full>" }`                                 | (ignored — we already accumulated deltas)      |
| `response.completed`                  | `{ response: { usage: { input_tokens, output_tokens, output_tokens_details: { reasoning_tokens } } } }` | Render `outMeta` line, save record |
| `response.error` / `error`            | `{ error: { message: "..." } }`                      | Throw — caught and rendered as error status    |
| `[DONE]` (literal payload string)     | n/a                                                  | Terminate read loop                            |

### Why text-node append?

Each `delta` is appended via `document.createTextNode` so the browser only does a tiny layout invalidation per token, not a full re-render. `textContent +=` would force a full re-parse every event — visible jank.

## Errors

### 4xx / 5xx (non-stream)

If the response status is non-2xx, the body is JSON of the form:

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "auth_error",
    "code": "invalid_key"
  }
}
```

We extract `error.message` and render it as `status.err`.

### Stream errors

A `response.error` event mid-stream looks like:

```json
{
  "type": "response.error",
  "error": { "message": "model timed out" }
}
```

We throw from inside the `readSSE` callback; the outer `try/catch` in `runOCR()` catches it.

### Abort (user clicked Stop)

`AbortController.abort()` rejects the `fetch` with `AbortError`. We detect via `err.name === 'AbortError'`:

- If any text was already accumulated → keep it, mark output meta as `partial · X.XXs`.
- If nothing was accumulated → clear the result panel.

## CORS

The browser sends a preflight `OPTIONS` request before the actual `POST`. The gateway **must** answer:

```
Access-Control-Allow-Origin: <your-origin>      (or *)
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

…and respond `204 No Content` to the `OPTIONS` itself.

As of 2026-05-12 the gateway preflight returned `200` with body `"POST"` and **no** `Access-Control-*` headers. Browser blocks the call. The CORS issue is a gateway-side fix — see the report email in the repo history (or thread between the demo author and the gateway maintainer).

## Cloudflare buffering

The gateway sits behind Cloudflare. For SSE to flow event-by-event (not batched), the upstream must emit `X-Accel-Buffering: no` on the streaming response. If you see events arriving in chunks of 4-8 at once, suspect buffering and not the client.

## Reference

Server-side example (for parity testing):

```bash
curl -sN https://gpt.yapweijun1996.com/v1/responses \
  -H "Authorization: Bearer gw_..." \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "model": "gpt-5.4-mini",
    "stream": true,
    "reasoning": { "effort": "medium", "summary": "auto" },
    "input": [{
      "role": "user",
      "content": [{ "type": "input_text", "text": "Hello" }]
    }]
  }'
```

If that prints SSE events to your terminal, the gateway is healthy; any browser failure after that is a CORS / network / client bug.
