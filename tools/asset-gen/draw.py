"""圆角面板绘制工具：A 档素材的共同底座。

对应 pocket-patrol.css 里的视觉语言：
- 圆角矩形（radius）
- 外描边（border，CSS 的 border）
- 硬阴影（bottom_shadow，CSS 的 box-shadow: 0 Npx 0 color，无模糊）
- 内阴影（inner_bottom，CSS 的 inset 0 -Npx 0 color）
- 虚线描边（dashed）
- 横向双色条（siren）
"""

from PIL import Image, ImageDraw


def hex_rgba(color: str, alpha: int = 255) -> tuple:
    """把 #RRGGBB 解析为 RGBA 元组；alpha 可覆盖。"""
    c = color.lstrip('#')
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), alpha)


def _rounded(draw: ImageDraw.ImageDraw, box, radius, **kw) -> None:
    draw.rounded_rectangle(box, radius=radius, **kw)


def panel(
    size: tuple,
    radius: int,
    fill: str,
    *,
    border: str | None = None,
    border_w: float = 0,
    bottom_shadow: str | None = None,
    shadow_h: int = 0,
    inner_bottom: str | None = None,
    inner_h: int = 0,
    dashed: bool = False,
    dash_len: int = 10,
    gap_len: int = 8,
    top_radius_only: bool = False,
    fill_alpha: int = 255,
) -> Image.Image:
    """绘制一块圆角面板。

    size            输出尺寸 (w, h)
    radius          圆角半径
    fill            填充色
    border/border_w 描边色与宽度
    bottom_shadow/shadow_h  底部硬阴影（先画在下层）
    inner_bottom/inner_h    底部内阴影（画在填充之上）
    dashed          描边是否虚线
    top_radius_only 只圆上面两个角（如底部导航条）
    """
    w, h = size
    # 输出尺寸必须与原素材完全一致（代码按原尺寸使用），所以阴影画在画布内：
    # 本体占 0..h-shadow_h，阴影占 shadow_h..h
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    shadow_h = shadow_h if (bottom_shadow and shadow_h > 0) else 0
    body_bottom = h - 1 - shadow_h

    # 1) 底部硬阴影：整体下移 shadow_h
    if shadow_h > 0:
        _rounded(draw, (0, shadow_h, w - 1, h - 1), radius,
                 fill=hex_rgba(bottom_shadow))

    # 2) 面板本体
    if top_radius_only:
        draw.rectangle((0, radius, w - 1, body_bottom), fill=hex_rgba(fill, fill_alpha))
        _rounded(draw, (0, 0, w - 1, radius * 2), radius, fill=hex_rgba(fill, fill_alpha))
    else:
        _rounded(draw, (0, 0, w - 1, body_bottom), radius, fill=hex_rgba(fill, fill_alpha))

    # 3) 描边
    if border and border_w > 0:
        outline = hex_rgba(border)
        half = max(1, int(border_w))
        if dashed:
            _dash_rounded(draw, (0, 0, w - 1, body_bottom), radius, outline, half, dash_len, gap_len)
        elif top_radius_only:
            # 只描上边与左右上圆角
            draw.arc((0, 0, radius * 2, radius * 2), 180, 270, fill=outline, width=half)
            draw.arc((w - 1 - radius * 2, 0, w - 1, radius * 2), 270, 360, fill=outline, width=half)
            draw.line((0, radius, 0, body_bottom), fill=outline, width=half)
            draw.line((w - 1, radius, w - 1, body_bottom), fill=outline, width=half)
            draw.line((0, half // 2, w - 1, half // 2), fill=outline, width=half)
        else:
            _rounded(draw, (0, 0, w - 1, body_bottom), radius,
                     outline=outline, width=half)

    # 4) 底部内阴影：贴着本体底边内侧一条色带
    if inner_bottom and inner_h > 0:
        band = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        bd.rectangle((0, body_bottom - inner_h + 1, w, body_bottom + 1),
                     fill=hex_rgba(inner_bottom))
        # 用面板形状裁掉圆角外部
        mask = Image.new('L', (w, h), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle((0, 0, w - 1, body_bottom), radius=radius, fill=255)
        img.paste(band, (0, 0), Image.composite(band.split()[3], Image.new('L', (w, h), 0), mask))

    return img


def _dash_rounded(draw, box, radius, color, width, dash_len, gap_len) -> None:
    """沿圆角矩形轮廓画虚线（分段圆弧 + 直线）。"""
    x0, y0, x1, y1 = box
    # 四条边用分段线段模拟，圆角处用短弧段
    def dash_line(p0, p1):
        import math
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        dist = math.hypot(dx, dy)
        if dist == 0:
            return
        ux, uy = dx / dist, dy / dist
        t = 0.0
        while t < dist:
            t2 = min(t + dash_len, dist)
            draw.line((p0[0] + ux * t, p0[1] + uy * t, p0[0] + ux * t2, p0[1] + uy * t2),
                      fill=color, width=width)
            t = t2 + gap_len

    # 四条直边（避开圆角段）
    dash_line((x0 + radius, y0), (x1 - radius, y0))
    dash_line((x1, y0 + radius), (x1, y1 - radius))
    dash_line((x1 - radius, y1), (x0 + radius, y1))
    dash_line((x0, y1 - radius), (x0, y0 + radius))
    # 四段圆弧（粗略按角度分段）
    import math
    for (cx, cy, start) in ((x0 + radius, y0 + radius, 180),
                            (x1 - radius, y0 + radius, 270),
                            (x1 - radius, y1 - radius, 0),
                            (x0 + radius, y1 - radius, 90)):
        steps = 8
        for i in range(0, steps, 2):
            a0 = math.radians(start + i * 90 / steps)
            a1 = math.radians(start + (i + 1) * 90 / steps)
            draw.arc((cx - radius, cy - radius, cx + radius, cy + radius),
                     math.degrees(a0), math.degrees(a1), fill=color, width=width)


def siren_bar(size: tuple, left: str, right: str, radius: int = 9) -> Image.Image:
    """警灯条：左半 left、右半 right。"""
    w, h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    half = w // 2
    draw.rectangle((0, 0, half, h), fill=hex_rgba(left))
    draw.rectangle((half, 0, w, h), fill=hex_rgba(right))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out
