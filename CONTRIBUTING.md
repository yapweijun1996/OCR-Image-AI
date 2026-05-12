# Contributing to AI Image OCR

Thanks for picking this up. The project is intentionally tiny — vanilla HTML/CSS/JS, no build step — so the contribution loop is fast.

## Ground rules

- **No build tools.** No bundler, no transpiler, no npm dependencies at runtime. If you reach for one, justify it in your PR description.
- **No framework.** Plain DOM APIs only. The whole app must keep working from `file:///` opened in a browser (with the obvious exception of the service worker, which needs `http://`).
- **Browser-native first.** Use the platform: `fetch`, `IndexedDB`, `localStorage`, `URL`, `Intl`, `crypto.subtle`, etc.
- **Demo-grade security.** This is a public demo. The API key is XOR-obfuscated in the source — anyone who opens devtools can recover it. Don't pretend otherwise in docs or UI.

## Local development

```bash
python -m http.server 6766
# or any static server of your choice
```

Then open `http://localhost:6766/`. See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the manual test checklist before every PR.

## Code style

### JavaScript

- Modern syntax (ES2022+). Target evergreen browsers; no IE/legacy compat.
- `const` by default, `let` only when reassigned. Never `var`.
- Two-space indent. Single quotes for strings. Semicolons required.
- Arrow functions for callbacks; `function` keyword for top-level / named helpers.
- Async/await over `.then()` chains where possible.
- One thing per function. If a function needs a comment to explain *what* it does, split it.
- Comments explain *why*, not *what*. The code shows *what*.
- No magic numbers — pull them into a `const` with a meaningful name.

### CSS

- Design tokens live on `:root` as custom properties (`--fs-*`, `--bg-*`, etc.). New colors / sizes go there first.
- Mobile-first when adding breakpoints. Stick to the three established ones: `≤520`, `≤820`, `≤1100`. Don't invent device-specific breakpoints.
- Use `rem` / `clamp()` for type and spacing. Raw `px` only for hairline borders and shadow offsets.
- Touch targets ≥ 44 px (Apple HIG minimum).

### HTML

- Semantic tags (`<main>`, `<section>`, `<header>`, `<button>`). No `<div onclick>`.
- ARIA where it matters: `aria-label` on icon-only buttons, `role="status" aria-live="polite"` on live regions, `role="dialog" aria-modal="true"` on modals.
- `loading="lazy"` on history thumbnails and anywhere else off-screen images appear.

## Commits

Conventional-Commits style:

```
type(scope): short imperative summary

Optional body explaining why, not what. Wrap at ~72 chars.
```

Common types: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `perf`, `a11y`.

Examples:

```
feat(history): add re-run button that loads image back into input
fix(sw): skip non-GET requests so streaming POST passes through
docs(api): document response.in_progress keep-alive event
```

## PR checklist

Before opening a PR:

- [ ] Manual test checklist passes (see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md))
- [ ] No console errors / warnings in light **and** dark theme
- [ ] Resize the window from 320 px to 1920 px — no layout breaks, no horizontal scrollbar
- [ ] Tested on a real phone (or DevTools mobile emulation) — touch targets reachable, safe areas respected
- [ ] If you touched `index.html` / `manifest.json` / `sw.js` — bump `VERSION` in [`sw.js`](sw.js) so users get the update prompt
- [ ] If you changed the prompt default or migrated config keys — note it in [`CHANGELOG.md`](CHANGELOG.md)
- [ ] If you added a new dep on a vendor lib — verify MIT/BSD/Apache license, document the source in the PR

## What to NOT do

- Don't ship the actual API key in plain text or in any commit, ever.
- Don't add tracking / analytics / fingerprinting.
- Don't add a backend. This project is browser-only by design.
- Don't intercept POST requests in the service worker — see the inline note in [`sw.js`](sw.js).
- Don't break `file:///` opening (the SW won't register; everything else should still work).

## Asking questions

Open a GitHub Discussion or issue. Tag with `question` for routing.

## Roadmap

See [`docs/REFACTOR-PLAN.md`](docs/REFACTOR-PLAN.md) for the path from "single-file demo" to "multi-file, modular project". Good first contributions live there as phase tasks.
