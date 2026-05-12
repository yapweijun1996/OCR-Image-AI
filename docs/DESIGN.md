# Design

Apple Human Interface Guidelines applied to a vanilla-JS web app. Three principles, applied throughout.

## The three principles

| Principle  | What it means here                                                                               |
|------------|--------------------------------------------------------------------------------------------------|
| **Clarity** | Text is legible at every viewport. Icons are precise. Spacing is generous. Hierarchy is obvious from typography alone, not from heavy chrome. |
| **Deference** | The UI gets out of the way of content (the OCR result and the image). Backgrounds are neutral, accents are sparingly used, borders are hairlines. |
| **Depth**   | Subtle elevation via shadow. Translucent modal backdrops. Motion that conveys hierarchy (slide-up modal, fade overlay), never decorative. |

## Color tokens

All colors live as CSS custom properties on `:root`. Light and dark variants share names so component CSS doesn't need to know which theme is active.

### Surface

| Token            | Light       | Dark       | Use                       |
|------------------|-------------|------------|---------------------------|
| `--bg`           | `#f2f2f7`   | `#000000`  | Page background           |
| `--bg-elevated`  | `#ffffff`   | `#1c1c1e`  | Card / modal surface      |
| `--bg-tertiary`  | translucent | translucent | Input fills, gray buttons |

### Text

| Token             | Use                                              |
|-------------------|--------------------------------------------------|
| `--fg`            | Primary body text and headlines                  |
| `--fg-secondary`  | Secondary text — meta, captions inside cards     |
| `--fg-tertiary`   | Section labels, hints, history meta              |
| `--fg-quaternary` | Placeholder text, the "Waiting for input…" ghost |

### Accent

| Token             | Value      | Use                              |
|-------------------|------------|----------------------------------|
| `--accent`        | `#ff6a3d`  | Primary CTAs, focus rings        |
| `--accent-hover`  | `#ff7d54`  | Hover state on filled buttons    |
| `--accent-pressed`| `#e8552b`  | Active/pressed state             |
| `--on-accent`     | `#ffffff`  | Text on the accent color         |

### System

| Token             | Use                                              |
|-------------------|--------------------------------------------------|
| `--success`       | Status "Done", "Copied"                          |
| `--danger`        | Errors, destructive buttons                      |
| `--separator`     | Hairline dividers between list rows              |

Designers' rule: **add a new color to `:root`, never inline.** That's how dark mode stays consistent.

## Type scale

Fluid `clamp(min, fluid, max)` — text smoothly scales from 320 px to 1920 px viewports without abrupt jumps.

| Token         | Approx range (320→1920) | Use                              |
|---------------|--------------------------|-----------------------------------|
| `--fs-caption2` | 11→12 px               | Smallest captions                  |
| `--fs-caption`  | 12→13 px               | Meta lines, hints                  |
| `--fs-footnote` | 13→14 px               | Section labels, status row         |
| `--fs-subhead`  | 14→15 px               | Small button text, history text    |
| `--fs-callout`  | 15→16 px               | Default button label, drop title   |
| `--fs-body`     | 15→17 px               | Body text in inputs                |
| `--fs-headline` | 16→17 px               | Brand title, modal title           |
| `--fs-title3`   | 18→20 px               | (reserved)                         |
| `--fs-title2`   | 20→22 px               | (reserved)                         |
| `--fs-title1`   | 24→28 px               | (reserved)                         |
| `--fs-large`    | 28→34 px               | (reserved)                         |

Rules:

- **No raw `px` font-size anywhere in component CSS.** Always reference a token.
- **`ch` units for prose line length.** Cap at 60-70ch for readability.
- **`tabular-nums`** on time / byte readouts so numbers don't jitter as digits change.

## Shape & elevation

| Token            | Value | Use                                       |
|------------------|-------|-------------------------------------------|
| `--r-input`      | 10 px | Inputs (when bordered)                    |
| `--r-button`     | 12 px | Buttons                                   |
| `--r-card`       | 18 px | Cards and grouped lists                   |
| `--r-modal`      | 22 px | Modal box                                 |
| `--r-pill`       | 999 px| Install chip                              |

Elevation comes from `--shadow-card` (1 px hairline + 8–24 px soft drop) — one level only. iOS-style — flat with subtle depth, never multi-layer drop shadows.

## Motion

| Token             | Curve                       | Where used                      |
|-------------------|-----------------------------|---------------------------------|
| `--ease-standard` | `cubic-bezier(.4,0,.2,1)`   | Default transitions             |
| `--ease-emphasized` | `cubic-bezier(.2,0,0,1)`  | Modal slide-up, banner reveal   |
| `--dur-fast`      | 150 ms                      | Hover, theme swap               |
| `--dur-base`      | 250 ms                      | Modal entry, banner             |

Motion is **purposeful** — every transition communicates state. No decorative spin, no parallax, no easing for its own sake.

`prefers-reduced-motion: reduce` collapses all transitions to 0.01 ms — the user's setting wins.

## Components

### Buttons

Five styles, four sizes. Pick by intent, not by look.

| Style           | Class          | When                                            |
|-----------------|----------------|-------------------------------------------------|
| **Filled**      | `.btn-filled`  | Primary action on a screen (one per card max)   |
| **Tinted**      | `.btn-tinted`  | Secondary action that should still feel weighty |
| **Gray**        | `.btn-gray`    | Neutral / cancel / clear                        |
| **Plain**       | `.btn-plain`   | Text-only — quiet actions                       |
| **+ `.btn-danger`** | modifier  | Destructive (delete, clear all)                 |

Add `.btn-sm` for the smaller 36 px variant used in card footers.

Touch target is **minimum 44 px** (Apple HIG mandate) — enforced via `min-height: var(--tt);` on the base `.btn` class.

### iOS grouped list (Configuration card)

`<section class="list">` → `<div class="card-header">` → repeating `<div class="list-row">`. Separators are hairlines (`--separator`). Labels sit above inputs. The first visible row has no top border; the rest do.

### Drop zone

Rounded rectangle (16 px), tinted-fill on hover, accent-colored icon chip inside. **No dashed border** — dashed borders are a development-tool / brutalist signal that fights deference.

### History row

56 × 56 px rounded-square thumbnail, two-line text clamp, meta row, actions on the right. Tap the thumbnail for the same effect as the **Re-run** button — natural mobile pattern.

### Modal

Backdrop: `rgba(0,0,0,0.5)` + `backdrop-filter: saturate(180%) blur(20px)`. Slide-up + fade entrance. Pull-down or tap-outside dismisses. ESC closes.

## Responsive breakpoints

Pick by **content**, not by device.

| Breakpoint   | What changes                                                        |
|--------------|---------------------------------------------------------------------|
| `≤ 1100 px`  | No layout change yet — reserved for adding a sidebar later          |
| `≤ 820 px`   | Action button gaps tighten                                          |
| `≤ 520 px`   | Primary CTA goes full-width; history actions wrap to a new line; thumbnails shrink to 48 px; preview height drops to 240 px |
| landscape phone (`max-height: 500px`) | Reduced top padding while preserving safe-area minimum |

## Safe areas

Every edge of `<body>` uses `max(<our-padding>, env(safe-area-inset-<side>))`. The notch, Dynamic Island, and home indicator all stay out of content.

`<meta name="viewport" content="… viewport-fit=cover">` is mandatory — without it, `env(safe-area-inset-*)` returns `0px` on iOS Safari and you'd never know.

## Accessibility checklist

- All interactive elements have `aria-label` when they're icon-only.
- The drop zone is `role="button" tabindex="0"` with Enter / Space handlers.
- The status row is `role="status" aria-live="polite"` so screen readers announce progress.
- The modal is `role="dialog" aria-modal="true"` with a labelled close button.
- Color contrast meets WCAG AA in both themes (verify with axe DevTools after any color change).

## What we explicitly avoided

- **Dot-grid backgrounds** — developer-tool look, fights deference.
- **Dashed borders on the drop zone** — same reason.
- **Heavy multi-layer drop shadows** — Apple uses one subtle level.
- **Bright multi-color accents** — single warm-orange.
- **Custom checkboxes / toggles** — for a demo, native controls win; revisit if we add features that need them.
- **Decorative animations** — every transition is functional.
