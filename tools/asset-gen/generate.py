"""A 档素材生成器：按 specs.py 的规格输出 PNG 到 out/。

用法：
    python -I tools/asset-gen/generate.py          # 生成全部 A 档
    python -I tools/asset-gen/generate.py --check  # 只校验尺寸，不写文件

产物落在 tools/asset-gen/out/，不直接覆盖 assets/Game/image/——
覆盖不可逆，先在这里验收，再用 sync.py 同步。
"""

import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from draw import hex_rgba, panel, siren_bar  # noqa: E402
from specs import A_SPECS  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
ASSET_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          '..', '..', 'assets', 'Game', 'image')


def _stripes(size, radius, base_fill, inner_bottom, inner_h):
    """cell_corner：底色 + 135° 斑马线条纹。

    pocket-patrol.css：repeating-linear-gradient(135deg, #fbf8e5 0 7px, #b7c6b4 7px 12px)
    即每 12px 里 7px 浅、5px 深——画的是那 5px 的深线，浅色留给底图。
    """
    w, h = size
    img = panel(size, radius, base_fill, border='#263f47', border_w=2,
                inner_bottom=inner_bottom, inner_h=inner_h)
    stripe = Image.new('RGBA', (w * 3, h * 3), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripe)
    period, band = 12, 5
    sw, sh = stripe.size
    for i in range(-sh, sw + sh, period):
        sd.line((i, 0, i + sh, sh), fill=hex_rgba('#b7c6b4', 200), width=band)
    stripe = stripe.resize((w, h), Image.LANCZOS)
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    img.paste(stripe, (0, 0), Image.composite(stripe.split()[3], Image.new('L', (w, h), 0), mask))
    return img


def build(relpath: str, spec: dict) -> Image.Image:
    size = spec['size']
    if 'siren' in spec:
        left, right = spec['siren']
        return siren_bar(size, left, right, spec.get('radius', 9))
    if spec.get('stripes'):
        return _stripes(size, spec['radius'], spec['fill'],
                        spec.get('inner_bottom'), spec.get('inner_h', 0))
    # 半透明阴影：把 alpha 并进色值
    shadow = spec.get('bottom_shadow')
    if shadow and spec.get('shadow_alpha') is not None:
        a = spec['shadow_alpha']
        shadow = shadow + f'{a:02x}'
    return panel(
        size, spec['radius'], spec['fill'],
        border=spec.get('border'), border_w=spec.get('border_w', 0),
        bottom_shadow=shadow, shadow_h=spec.get('shadow_h', 0),
        inner_bottom=spec.get('inner_bottom'), inner_h=spec.get('inner_h', 0),
        dashed=spec.get('dashed', False),
        dash_len=spec.get('dash_len', 10), gap_len=spec.get('gap_len', 8),
        top_radius_only=spec.get('top_radius_only', False),
        fill_alpha=spec.get('fill_alpha', 255),
    )


def check_sizes() -> list:
    """核对规格表里的尺寸与现有素材一致（防止误改导致棋盘错位）。"""
    bad = []
    for rel, spec in A_SPECS.items():
        p = os.path.join(ASSET_ROOT, rel.replace('/', os.sep))
        if not os.path.exists(p):
            bad.append(f'{rel}: 现有素材缺失')
            continue
        cur = Image.open(p).size
        if cur != tuple(spec['size']):
            bad.append(f'{rel}: 规格 {spec["size"]} != 现有 {cur}')
    return bad


def main() -> int:
    if '--check' in sys.argv:
        bad = check_sizes()
        if bad:
            print('尺寸校验失败：')
            for b in bad:
                print('  ', b)
            return 1
        print(f'尺寸校验通过（{len(A_SPECS)} 张规格与现有素材一致）')
        return 0

    bad = check_sizes()
    if bad:
        print('尺寸校验失败，已中止：')
        for b in bad:
            print('  ', b)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    for rel, spec in sorted(A_SPECS.items()):
        img = build(rel, spec)
        dst = os.path.join(OUT_DIR, rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        img.save(dst, 'PNG')
    print(f'已生成 {len(A_SPECS)} 张 A 档素材 -> {os.path.relpath(OUT_DIR)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
