#!/usr/bin/env python3
"""
[WO-103] Head-to-Toe Full-Body Castor & Pollux Extractor (Non-Destructive)

1. Extracts all 384 full-body head-to-toe transparent Castor sprites (C-01..C-24 x 16 expressions)
   from Castor_All_24_Outfits_16_Expressions_Complete.zip into public/characters/castor/C-XX/.
2. Extracts Pollux's head-to-toe full-body chibi sprite from
   castor_pollux_complete_library/reference_sheets/castor_and_pollux_chibi_cf.png
   with clean edge flood-fill transparency into public/characters/pollux/pollux_fullbody.png.
"""

from collections import deque
from pathlib import Path
import re
import zipfile
from PIL import Image

GENS_ROOT = Path('/home/face/Documents/Documents/code/CastorAndPollux/gens')
CASTOR_ZIP = GENS_ROOT / 'Castor_All_24_Outfits_16_Expressions_Complete.zip'
POLLUX_CHIBI_REF = GENS_ROOT / 'castor_pollux_complete_library' / 'reference_sheets' / 'castor_and_pollux_chibi_cf.png'
POLLUX_FULL_REF = GENS_ROOT / 'castor_pollux_complete_library' / 'reference_sheets' / 'pollux_cf.png'
OUT_ROOT = Path(__file__).resolve().parent.parent / 'public' / 'characters'


def extract_castor_fullbody() -> int:
    count = 0
    if not CASTOR_ZIP.exists():
        print(f'[warn] Missing {CASTOR_ZIP}')
        return 0
    with zipfile.ZipFile(CASTOR_ZIP, 'r') as zf:
        for info in zf.infolist():
            m = re.match(r'^Castor_24_Outfits/(C-\d{2})_[^/]+/sprites/(\d{2}_[A-Za-z]+\.png)$', info.filename)
            if not m:
                continue
            outfit_id, expr_file = m.group(1), m.group(2)
            out_dir = OUT_ROOT / 'castor' / outfit_id
            out_dir.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(out_dir / expr_file, 'wb') as dst:
                dst.write(src.read())
            count += 1
    return count


def floodfill_transparent(img: Image.Image, threshold: int = 235) -> Image.Image:
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]
    q = deque()

    def is_bg(r: int, g: int, b: int) -> bool:
        return r >= threshold and g >= threshold and b >= threshold

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b) and not visited[y][x]:
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b) and not visited[y][x]:
                visited[y][x] = True
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        px[cx, cy] = (255, 255, 255, 0)
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, _ = px[nx, ny]
                if is_bg(r, g, b):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    return rgba


def extract_pollux_fullbody() -> bool:
    out_dir = OUT_ROOT / 'pollux'
    out_dir.mkdir(parents=True, exist_ok=True)
    # castor_and_pollux_chibi_cf.png has Castor on the left half and Pollux head-to-toe on the right half
    if POLLUX_CHIBI_REF.exists():
        img = Image.open(POLLUX_CHIBI_REF)
        w, h = img.size
        # Right half contains Pollux head-to-toe; trim top/bottom margins cleanly
        right_half = img.crop((int(w * 0.50), int(h * 0.08), w, int(h * 0.94)))
        clean = floodfill_transparent(right_half, threshold=232)
        clean.thumbnail((360, 480), Image.Resampling.LANCZOS)
        clean.save(out_dir / 'pollux_fullbody.png', 'PNG', optimize=True)
        return True
    if POLLUX_FULL_REF.exists():
        img = Image.open(POLLUX_FULL_REF)
        clean = floodfill_transparent(img, threshold=232)
        clean.thumbnail((360, 480), Image.Resampling.LANCZOS)
        clean.save(out_dir / 'pollux_fullbody.png', 'PNG', optimize=True)
        return True
    return False


if __name__ == '__main__':
    c = extract_castor_fullbody()
    p = extract_pollux_fullbody()
    print(f'[Full-Body Extract] Castor head-to-toe sprites: {c} | Pollux full-body: {p}')
