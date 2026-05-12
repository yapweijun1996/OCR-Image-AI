#!/usr/bin/env python3
"""
generate-icons.py — render PNG app icons for the PWA manifest.

Why a script instead of running them through PWABuilder once and committing?
The icon is procedural (rounded rect + gradient + scan brackets + text bars),
so rebuilding it from primitives keeps the source of truth in this repo. If
you change the design (gradient stops, stroke width, ...), edit this file
and re-run; the SVG at the repo root should be edited to match.

Usage:
    python scripts/generate-icons.py

Output:
    assets/icons/icon-192.png            (any)
    assets/icons/icon-512.png            (any)
    assets/icons/icon-maskable-512.png   (maskable — content in safe zone)
    assets/icons/apple-touch-icon-180.png

Dependencies:
    pip install Pillow
"""

from pathlib import Path
from PIL import Image, ImageDraw

# --- Design tokens (mirror icon.svg) ----------------------------------------

# Base coordinate system from icon.svg: 512×512.
BASE = 512

# Gradient stops (135° diagonal: top-left → bottom-right).
GRAD_TOPLEFT     = (0xff, 0x8a, 0x5b)   # #ff8a5b
GRAD_BOTTOMRIGHT = (0xff, 0x5a, 0x2c)   # #ff5a2c

# Background rounded-rect corner radius (relative to BASE).
BG_RADIUS_RATIO = 112 / BASE

# Stroke width for scan brackets (relative to BASE).
STROKE_RATIO = 18 / BASE

# Scan bracket polylines (top-left, top-right, bottom-left, bottom-right).
# Each is a 3-point polyline that traces a 90° corner.
BRACKETS = [
    [(150, 180), (150, 150), (180, 150)],
    [(362, 180), (362, 150), (332, 150)],
    [(150, 332), (150, 362), (180, 362)],
    [(362, 332), (362, 362), (332, 362)],
]

# Centered "text" pill bars: (x1, y1, x2, y2). Height 14 px → radius 7.
BARS = [
    (180, 208, 332, 222),
    (180, 240, 292, 254),
    (180, 272, 320, 286),
    (180, 304, 276, 318),
]

# Maskable safe-zone scale. Android masks the icon to various shapes
# (circle / squircle / rounded square). 0.72 keeps even the diagonal
# corners of our content inside a 40%-radius safety circle.
MASKABLE_SCALE = 0.72


# --- Drawing primitives -----------------------------------------------------

def diagonal_gradient(size):
    """Return an RGB image filled with a top-left → bottom-right gradient."""
    img = Image.new('RGB', (size, size))
    px  = img.load()
    sr, sg, sb = GRAD_TOPLEFT
    er, eg, eb = GRAD_BOTTOMRIGHT
    denom = 2 * (size - 1) if size > 1 else 1
    for y in range(size):
        for x in range(size):
            t = (x + y) / denom
            px[x, y] = (
                int(sr + (er - sr) * t),
                int(sg + (eg - sg) * t),
                int(sb + (eb - sb) * t),
            )
    return img


def rounded_mask(size, radius):
    """Single-channel mask for a rounded square."""
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=radius,
        fill=255,
    )
    return mask


def render_icon(size, maskable=False):
    """Build a single PNG at the requested pixel size."""
    bg = diagonal_gradient(size).convert('RGBA')

    if not maskable:
        # Round the corners for `any` purpose.
        bg.putalpha(rounded_mask(size, int(size * BG_RADIUS_RATIO)))

    # Convert BASE-coordinate (x, y) into pixel coordinate at this size,
    # optionally scaled into the maskable safe zone.
    scale = MASKABLE_SCALE if maskable else 1.0
    offset = (size - size * scale) / 2

    def px(v):
        return int(v * size * scale / BASE + offset)

    draw   = ImageDraw.Draw(bg)
    stroke = max(2, int(BASE * STROKE_RATIO * size * scale / BASE))
    white  = (255, 255, 255, 255)

    # Scan brackets — two segments per corner with rounded caps.
    for polyline in BRACKETS:
        for (x1, y1), (x2, y2) in zip(polyline, polyline[1:]):
            draw.line([(px(x1), px(y1)), (px(x2), px(y2))],
                      fill=white, width=stroke)
        # Round the elbow with a small filled circle at every vertex.
        for (x, y) in polyline:
            r = stroke / 2
            draw.ellipse(
                [(px(x) - r, px(y) - r), (px(x) + r, px(y) + r)],
                fill=white,
            )

    # Text bars
    for (x1, y1, x2, y2) in BARS:
        radius = (y2 - y1) * size * scale / BASE / 2
        draw.rounded_rectangle(
            [(px(x1), px(y1)), (px(x2), px(y2))],
            radius=int(radius), fill=white,
        )

    return bg


# --- Manifest --------------------------------------------------------------

CONFIGS = [
    # (size_px, maskable, output_filename)
    (192, False, 'icon-192.png'),
    (512, False, 'icon-512.png'),
    (512, True,  'icon-maskable-512.png'),
    (180, False, 'apple-touch-icon-180.png'),
]


def main():
    out_dir = Path(__file__).resolve().parent.parent / 'assets' / 'icons'
    out_dir.mkdir(parents=True, exist_ok=True)

    for (size, maskable, name) in CONFIGS:
        img = render_icon(size, maskable)
        path = out_dir / name
        img.save(path, 'PNG', optimize=True)
        print(f'wrote {path}  ({size}x{size}{" maskable" if maskable else ""})')


if __name__ == '__main__':
    main()
