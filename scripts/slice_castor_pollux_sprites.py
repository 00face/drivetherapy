#!/usr/bin/env python3
"""
[WO-102] Non-Destructive Castor & Pollux 8x4 Chibi Sheet Slicer & Alpha Matte Extractor

Reads 1376x768 8x4 expression sheets from:
  /home/face/Documents/Documents/code/CastorAndPollux/gens/castor_pollux_complete_library/generated_chibi_sheets/{castor,pollux}
Outputs clean individual 256x256 transparent PNGs into:
  public/characters/castor/C-01..C-24/<01_Neutral..16_Skeptical>.png
  public/characters/pollux/P-01..P-24/<01_Neutral..16_Skeptical>.png

Uses edge flood-fill background removal so internal white highlights (eyes, teeth,
glasses glare, collar details) are preserved intact while the outer matte becomes transparent.
"""

from collections import deque
from pathlib import Path
from PIL import Image

SRC_ROOT = Path('/home/face/Documents/Documents/code/CastorAndPollux/gens/castor_pollux_complete_library/generated_chibi_sheets')
OUT_ROOT = Path(__file__).resolve().parent.parent / 'public' / 'characters'

EXPRESSIONS = [
    '01_Neutral.png',
    '02_Happy.png',
    '03_Confident.png',
    '04_Relieved.png',
    '05_Laughing.png',
    '06_Excited.png',
    '07_Proud.png',
    '08_Sad.png',
    '09_Angry.png',
    '10_Frustrated.png',
    '11_Annoyed.png',
    '12_Scared.png',
    '13_Disgusted.png',
    '14_Confused.png',
    '15_Curious.png',
    '16_Skeptical.png',
]

# Each 8x4 sheet contains two 16-expression outfits (top 2 rows = first, bottom 2 rows = second)
CASTOR_SHEETS = [
    ('13_castor_casual_tech_apparel.png', 'C-01', 'C-23'),
    ('01_castor_outfits_01_02.png', None, 'C-02'),
    ('02_castor_outfits_03_04.png', 'C-03', 'C-04'),
    ('03_castor_outfits_05_06.png', 'C-05', 'C-06'),
    ('04_castor_outfits_07_08.png', 'C-07', 'C-08'),
    ('05_castor_outfits_09_10.png', 'C-09', 'C-10'),
    ('06_castor_outfits_11_12.png', 'C-11', 'C-12'),
    ('07_castor_outfits_13_14.png', 'C-13', 'C-14'),
    ('08_castor_outfits_15_16.png', 'C-15', 'C-16'),
    ('09_castor_outfits_17_18.png', 'C-17', 'C-18'),
    ('10_castor_outfits_19_20.png', 'C-19', 'C-20'),
    ('11_castor_outfits_21_22.png', 'C-21', 'C-22'),
    ('12_castor_outfit_24_heavy_eva.png', 'C-24', None),
]

POLLUX_SHEETS = [
    ('12_pollux_outfit_23_casual_tech.png', 'P-23', 'P-01'),
    ('01_pollux_outfits_01_02.png', None, 'P-02'),
    ('02_pollux_outfits_03_04.png', 'P-03', 'P-04'),
    ('03_pollux_outfits_05_06.png', 'P-05', 'P-06'),
    ('04_pollux_outfits_07_08.png', 'P-07', 'P-08'),
    ('05_pollux_outfits_09_10.png', 'P-09', 'P-10'),
    ('06_pollux_outfits_11_12.png', 'P-11', 'P-12'),
    ('07_pollux_outfits_13_14.png', 'P-13', 'P-14'),
    ('08_pollux_outfits_15_16.png', 'P-15', 'P-16'),
    ('09_pollux_outfits_17_18.png', 'P-17', 'P-18'),
    ('10_pollux_outfits_19_20.png', 'P-19', 'P-20'),
    ('11_pollux_outfits_21_22.png', 'P-21', 'P-22'),
    ('13_pollux_heavy_eva_combat_suit.png', 'P-24', None),
]

# Vertical search windows for the 4 sprite rows on 1376x768 sheets.
# Each window is refined dynamically via horizontal whitespace-gutter detection
# so 100% of hair tops, sparkles, question marks, hands, and braid tips are preserved
# while text labels below each sprite are cleanly excluded.
ROW_WINDOWS = [
    (0.055, 0.278),  # Row 0 (expressions 1-8 of top outfit)
    (0.285, 0.495),  # Row 1 (expressions 9-16 of top outfit)
    (0.545, 0.758),  # Row 2 (expressions 1-8 of bottom outfit)
    (0.768, 0.975),  # Row 3 (expressions 9-16 of bottom outfit)
]

PRESERVED_REPAIRED = {
    ('castor', 'C-02', '12_Scared.png'),
}


def detect_row_sprite_band(img: Image.Image, y_min: int, y_max: int) -> tuple[int, int]:
    """Find the exact vertical sprite band inside [y_min, y_max], excluding bottom text labels."""
    gray = img.convert('L')
    w, _ = gray.size
    # Count non-white pixels per scanline
    row_density = []
    for y in range(y_min, y_max):
        dark = 0
        for x in range(0, w, 2):
            if gray.getpixel((x, y)) < 232:
                dark += 1
        row_density.append((y, dark))

    # Find contiguous non-empty horizontal bands
    bands = []
    in_band = False
    start = y_min
    for y, dark in row_density:
        if dark >= 8 and not in_band:
            in_band = True
            start = y
        elif dark < 8 and in_band:
            in_band = False
            bands.append((start, y))
    if in_band:
        bands.append((start, y_max))

    if not bands:
        return (y_min, y_max)
    # The sprite artwork band is always the tallest band (text labels are thin ~12-18px bands below)
    best = max(bands, key=lambda b: b[1] - b[0])
    return (max(y_min, best[0] - 2), min(y_max, best[1] + 2))


def remove_white_bg_floodfill(img: Image.Image, threshold: int = 236) -> Image.Image:
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

    # Trim transparent bounding box and center in a crisp 256x256 transparent canvas with >= 12px margin
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    rgba.thumbnail((232, 232), Image.Resampling.LANCZOS)
    ox = (256 - rgba.width) // 2
    oy = (256 - rgba.height) // 2
    canvas.paste(rgba, (ox, oy), rgba)
    return canvas


def slice_character(char_name: str, sheets: list) -> int:
    src_dir = SRC_ROOT / char_name
    out_base = OUT_ROOT / char_name
    count = 0
    for sheet_file, top_id, bot_id in sheets:
        sheet_path = src_dir / sheet_file
        if not sheet_path.exists():
            print(f'[skip] missing {sheet_path}')
            continue
        img = Image.open(sheet_path)
        w, h = img.size
        col_w = w / 8.0

        def export_half(outfit_id: str, row_pair: tuple[int, int]):
            nonlocal count
            out_dir = out_base / outfit_id
            out_dir.mkdir(parents=True, exist_ok=True)
            expr_idx = 0
            for r_idx in row_pair:
                wy0 = int(h * ROW_WINDOWS[r_idx][0])
                wy1 = int(h * ROW_WINDOWS[r_idx][1])
                y0, y1 = detect_row_sprite_band(img, wy0, wy1)
                for c in range(8):
                    expr_name = EXPRESSIONS[expr_idx]
                    expr_idx += 1
                    out_file = out_dir / expr_name
                    if (char_name, outfit_id, expr_name) in PRESERVED_REPAIRED and out_file.exists():
                        count += 1
                        continue
                    x0 = max(0, int(c * col_w) - 2)
                    x1 = min(w, int((c + 1) * col_w) + 2)
                    cell = img.crop((x0, y0, x1, y1))
                    clean = remove_white_bg_floodfill(cell)
                    clean.save(out_file, 'PNG', optimize=True)
                    count += 1

        if top_id:
            export_half(top_id, (0, 1))
        if bot_id:
            export_half(bot_id, (2, 3))
    return count


if __name__ == '__main__':
    c_count = slice_character('castor', CASTOR_SHEETS)
    p_count = slice_character('pollux', POLLUX_SHEETS)
    print(f'[Slice Complete] Castor: {c_count} sprites | Pollux: {p_count} sprites')
