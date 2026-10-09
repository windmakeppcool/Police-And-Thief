"""B 档素材：从 design/pocket-patrol.html 的 SVG symbol 导出图标 PNG。

设计稿图标是 32×32 viewBox、CSS 统一描边（stroke: var(--ink) = #263f47，
stroke-width 2，round 线端）。导出时把这些描边属性烘焙进 SVG，否则全是黑描边。

流程：
    python -I tools/asset-gen/icons.py html    # 生成图标网格页 icons.html
    （用 playwright 打开 icons.html 并整页截图 -> tools/asset-gen/icons-shot.png）
    python -I tools/asset-gen/icons.py slice   # 按网格切分为单张 PNG
"""

import math
import os
import re
import sys

from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.join(HERE, '..', '..', 'design', 'pocket-patrol.html')
OUT_DIR = os.path.join(HERE, 'out')
HTML_PATH = os.path.join(HERE, 'icons.html')
SHOT_PATH = os.path.join(HERE, 'icons-shot.png')

CELL = 96          # 输出像素
GAP = 24
COLS = 6
SCALE = 3          # 截图时的 devicePixelRatio，切分后再降采样，保证边缘平滑

INK = '#263f47'
WHITEISH = '#fffdf2'

# symbol id -> 输出文件名（可复用同一 symbol，或改描边色）
# stroke 覆盖 CSS 的 var(--ink)；gray 表示灰阶暗星
JOBS = [
    ('i-badge', 'icon/badge.png', None, False),
    ('i-star', 'icon/star_active.png', None, False),
    ('i-star', 'icon/star_inactive.png', None, True),
    ('i-play', 'icon/play.png', WHITEISH, False),
    ('i-grid', 'icon/grid.png', None, False),
    ('i-home', 'icon/home.png', None, False),
    ('i-settings', 'icon/settings.png', None, False),
    ('i-user', 'icon/user.png', None, False),
    ('i-back', 'icon/back.png', None, False),
    ('i-back', 'icon/undo.png', None, False),
    ('i-arrow', 'icon/arrow.png', None, False),
    ('i-arrow', 'icon/arrow_white.png', WHITEISH, False),
    ('i-lock', 'icon/lock.png', None, False),
    ('i-pause', 'icon/pause.png', None, False),
    ('i-hint', 'icon/hint.png', None, False),
    ('i-reset', 'icon/reset.png', None, False),
    ('i-reset', 'icon/restart.png', None, False),
    ('i-share', 'icon/share.png', None, False),
    ('i-clock', 'icon/clock.png', None, False),
    ('i-sound', 'icon/sound.png', None, False),
    ('i-check', 'icon/check.png', None, False),
    ('i-close', 'icon/close.png', None, False),
    ('i-thief', 'icon/thief.png', None, False),
    ('i-tree', 'icon/tree.png', None, False),
]


def load_symbols() -> dict:
    src = open(DESIGN, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'<symbol id="(i-[a-z]+)"(.*?)</symbol>', src, re.S):
        out[m.group(1)] = (m.group(2), m.group(0))
    return out


def bake(sym_inner: str, sym_tag_attrs: str, stroke: str | None, px: int) -> str:
    """把 CSS 的描边属性烘焙进 symbol，返回完整可独立渲染的 <svg>。

    注意 i-play 用 fill="currentColor"（设计稿里跟随文字色），独立渲染时
    currentColor 取不到值会变黑，这里替换成目标色。
    """
    vb = re.search(r'viewBox="([^"]+)"', sym_tag_attrs)
    viewBox = vb.group(1) if vb else '0 0 32 32'
    color = stroke or INK
    inner = sym_inner.replace('currentColor', color)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewBox}" '
        f'width="{px}" height="{px}"'
        f' fill="none" stroke="{color}" stroke-width="2"'
        f' stroke-linecap="round" stroke-linejoin="round">'
        f'{inner}</svg>'
    )


def build_html() -> str:
    syms = load_symbols()
    # 渲染尺寸 = CELL*SCALE，截图后再降采样到 CELL，边缘更平滑
    px = CELL * SCALE
    cells = []
    for sid, rel, stroke, gray in JOBS:
        inner, attrs = syms[sid]
        svg = bake(inner, attrs, stroke, px)
        style = 'filter:grayscale(1);opacity:.3;' if gray else ''
        cells.append(f'<div class="c" style="{style}">{svg}</div>')
    rows = ['<html><head><meta charset="utf-8"><style>',
            # 背景必须透明：白色 play / arrow_white 图标在白底上会整个消失
            f'body{{margin:0;background:transparent;}}',
            f'.g{{display:grid;grid-template-columns:repeat({COLS}, {px}px);'
            f'gap:{GAP * SCALE}px;padding:{GAP * SCALE}px;width:max-content;}}',
            f'.c{{width:{px}px;height:{px}px;}}',
            'svg{display:block;width:100%;height:100%;}',
            '</style></head><body><div class="g">',
            ''.join(cells),
            '</div></body></html>']
    return ''.join(rows)


def slice_shot() -> int:
    if not os.path.exists(SHOT_PATH):
        print(f'缺少截图 {SHOT_PATH}，请先用 playwright 打开 icons.html 截图')
        return 1
    shot = Image.open(SHOT_PATH).convert('RGBA')
    step = (CELL + GAP) * SCALE
    pad = GAP * SCALE
    os.makedirs(OUT_DIR, exist_ok=True)
    n = 0
    for i, (_, rel, _stroke, _gray) in enumerate(JOBS):
        col, row = i % COLS, i // COLS
        x = pad + col * step
        y = pad + row * step
        tile = shot.crop((x, y, x + CELL * SCALE, y + CELL * SCALE))
        tile = tile.resize((CELL, CELL), Image.LANCZOS)
        dst = os.path.join(OUT_DIR, rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        tile.save(dst, 'PNG')
        n += 1
    print(f'已切分 {n} 张图标 -> {os.path.relpath(OUT_DIR)}')
    return 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'html'
    if cmd == 'html':
        html = build_html()
        open(HTML_PATH, 'w', encoding='utf-8').write(html)
        print(f'已生成 {HTML_PATH}（{len(JOBS)} 个图标，{COLS} 列）')
    elif cmd == 'slice':
        raise SystemExit(slice_shot())
    else:
        print('用法: icons.py html|slice')
