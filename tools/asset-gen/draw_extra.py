"""自绘素材：设计稿没有对应 SVG 的那些——天际线剪影、街景、警察徽章、小偷三帧。

配色取自 pocket-patrol.html 的 SVG symbol 填充色：
    i-home  屋顶 #f29179  墙 #ffedc3  门 #8bc6ba
    i-tree  树冠 #82b9a0
    i-thief 帽 #466170  脸 #ffcfac  眼罩 #344d58
    i-user  衣 #8cbbe3  帽 #406b8a
"""

import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from draw import hex_rgba  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
INK = '#263f47'


def save(img: Image.Image, rel: str) -> None:
    dst = os.path.join(OUT_DIR, rel.replace('/', os.sep))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img.save(dst, 'PNG')


# ── 天际线剪影：750×132，单色楼群（GameOverlayView 按 132/750 反推高度） ──
def skyline() -> Image.Image:
    w, h = 750, 132
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 由若干圆角矩形组成的城市轮廓，顶部高低错落
    blocks = [(0, 78, 92), (78, 60, 74), (150, 84, 96), (238, 52, 66),
              (300, 72, 88), (384, 46, 62), (442, 80, 92), (530, 58, 76),
              (602, 88, 100), (696, 66, 82), (742, 92, 96)]
    for x, top, width in blocks:
        d.rounded_rectangle((x, top, x + width, h), radius=8, fill=hex_rgba(INK))
    # 若干小天线/屋顶装饰
    for x, top in ((40, 58), (200, 62), (350, 34), (520, 44), (660, 68)):
        d.rounded_rectangle((x, top, x + 8, top + 26), radius=3, fill=hex_rgba(INK))
    return img


# ── 树：圆团树冠 + 方形树干 ──────────────────────────────────────
def tree(size: tuple, canopy: int) -> Image.Image:
    w, h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    trunk_w = max(4, w // 8)
    d.rounded_rectangle((w // 2 - trunk_w // 2, canopy - 6, w // 2 + trunk_w // 2, h - 2),
                        radius=2, fill=hex_rgba('#8a6b4f'))
    r = w // 2 - 2
    d.ellipse((2, 2, w - 2, canopy + r - 4), fill=hex_rgba(canopy_color))
    # 高光，让树冠不那么平
    d.ellipse((w // 2 - r // 2, 6, w // 2 + r // 2 - 2, 6 + r // 2),
              fill=hex_rgba('#a8d4bd'))
    return img


canopy_color = '#82b9a0'


# ── 小屋：三角屋顶 + 矩形屋身 + 门 + 窗 ─────────────────────────
def house(size: tuple, roof: str) -> Image.Image:
    w, h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    wall_top = int(h * 0.38)
    # 屋身
    d.rounded_rectangle((int(w * 0.12), wall_top, int(w * 0.88), h - 2),
                        radius=6, fill=hex_rgba('#ffedc3'))
    # 屋顶（三角，略宽于屋身）
    d.polygon([(2, wall_top + 4), (w // 2, 2), (w - 2, wall_top + 4)], fill=hex_rgba(roof))
    d.rounded_rectangle((int(w * 0.12), wall_top, int(w * 0.88), wall_top + 8),
                        radius=3, fill=hex_rgba(roof))
    # 门
    dw = int(w * 0.2)
    d.rounded_rectangle((w // 2 - dw // 2, int(h * 0.62), w // 2 + dw // 2, h - 2),
                        radius=4, fill=hex_rgba('#8bc6ba'))
    # 窗
    ww = int(w * 0.18)
    d.rounded_rectangle((int(w * 0.2), int(h * 0.5), int(w * 0.2) + ww, int(h * 0.5) + ww),
                        radius=3, fill=hex_rgba('#8bc6ba'))
    return img


# ── 警车：车身 + 车窗 + 双轮 + 顶灯 ────────────────────────────
def police_car(light_on: bool) -> Image.Image:
    w, h = 96, 56
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body_y = 26
    # 车身
    d.rounded_rectangle((4, body_y, w - 4, body_y + 18), radius=6, fill=hex_rgba('#83b8d9'))
    # 车顶舱
    d.rounded_rectangle((20, 12, 74, body_y + 2), radius=5, fill=hex_rgba('#83b8d9'))
    # 车窗
    d.rounded_rectangle((25, 15, 45, body_y), radius=3, fill=hex_rgba('#cfe6f5'))
    d.rounded_rectangle((50, 15, 70, body_y), radius=3, fill=hex_rgba('#cfe6f5'))
    # 顶灯
    light = '#ffcf71' if light_on else '#e8a91c'
    d.rounded_rectangle((42, 6, 54, 13), radius=3, fill=hex_rgba(light))
    # 车轮
    for cx in (26, w - 26):
        d.ellipse((cx - 9, 38, cx + 9, 56), fill=hex_rgba(INK))
        d.ellipse((cx - 4, 43, cx + 4, 51), fill=hex_rgba('#cfe6f5'))
    return img


# ── 警察站位徽章：64×64，天空蓝底 + 金星 ──────────────────────
def cop_badge() -> Image.Image:
    s = 64
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2, 2, s - 2, s - 2), radius=10, fill=hex_rgba('#85b8dc'))
    d.rounded_rectangle((2, 2, s - 2, s - 2), radius=10, outline=hex_rgba(INK), width=3)
    # 五角星
    cx, cy, R = s // 2, s // 2 + 1, 17
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        r = R if i % 2 == 0 else R * 0.42
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    d.polygon(pts, fill=hex_rgba('#ffce69'), outline=hex_rgba(INK))
    return img


# ── 小偷三帧：64×64，眼珠偏移表现东张西望 ────────────────────
def thief(look: str) -> Image.Image:
    s = 64
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 脸
    d.ellipse((10, 12, 54, 56), fill=hex_rgba('#ffcfac'))
    # 帽
    d.pieslice((8, 2, 56, 40), 180, 360, fill=hex_rgba('#466170'))
    d.rounded_rectangle((8, 18, 56, 26), radius=3, fill=hex_rgba('#466170'))
    # 眼罩
    d.rounded_rectangle((14, 30, 50, 42), radius=6, fill=hex_rgba('#344d58'))
    # 眼珠（按 look 偏移）
    dx = {'left': -4, 'right': 4, 'normal': 0}[look]
    for ex in (24, 40):
        d.ellipse((ex - 5 + dx, 32, ex + 5 + dx, 41), fill=hex_rgba('#ffffff'))
        d.ellipse((ex - 2 + dx, 35, ex + 2 + dx, 39), fill=hex_rgba(INK))
    # 嘴
    d.arc((24, 44, 40, 56), 0, 180, fill=hex_rgba(INK), width=2)
    return img


def main() -> int:
    save(skyline(), 'icon/skyline.png')
    save(tree((48, 56), 34), 'town/tree_large.png')
    save(tree((40, 48), 28), 'town/tree_small.png')
    save(house((80, 80), '#f29179'), 'town/house_red.png')
    save(house((64, 64), '#f7c96b'), 'town/house_yellow.png')
    save(police_car(False), 'town/police_car.png')
    save(police_car(True), 'town/police_car_light.png')
    save(cop_badge(), 'piece/cop_badge.png')
    save(thief('normal'), 'character/thief_normal.png')
    save(thief('left'), 'character/thief_peek_left.png')
    save(thief('right'), 'character/thief_peek_right.png')
    print('已生成 11 张自绘素材 ->', os.path.relpath(OUT_DIR))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
