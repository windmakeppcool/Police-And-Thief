"""A 档素材规格表：几何与配色全部取自 design/pocket-patrol.css。

字段含义见 draw.panel()。所有 size 与现有 PNG 保持一致——
尺寸被代码硬编码（棋盘 coord*64、街景 frameSize、九宫格 inset），不能改。
"""

# 色板（pocket-patrol.css L2-12）
INK        = '#263f47'   # 正文与轮廓
MUTED      = '#6b807b'
MINT       = '#dcefe4'   # 主背景
MINT_DEEP  = '#528d79'
CREAM      = '#fffaf0'   # 内容底色
ORANGE     = '#f78462'   # 主按钮
ORANGE_DK  = '#c76449'   # 按钮底部阴影
LINE       = '#cddcd2'
YELLOW     = '#ffcf71'   # 奖励与提示
BLUE       = '#83b8d9'   # 警察棋子

# ── 棋盘 / 棋子（严格 64×64，BoardGrid._cellSize = 64） ──────────────
BOARD = {
    'block_05.png': dict(
        size=(64, 64), radius=9, fill='#e5bf98',
        inner_bottom='#c89d7c', inner_h=4,
    ),
    'board/cell_normal.png': dict(
        size=(64, 64), radius=9, fill='#fbf6dc', border=INK, border_w=2,
        inner_bottom='#e3ddbe', inner_h=3,
    ),
    # 四角斑马线：底同 cell_normal，另加 135° 条纹（生成器里特判）
    'board/cell_corner.png': dict(
        size=(64, 64), radius=9, fill='#fbf6dc', border=INK, border_w=2,
        inner_bottom='#e3ddbe', inner_h=3, stripes=True,
    ),
    'board/ghost_valid.png': dict(
        size=(64, 64), radius=9, fill=BLUE, border=INK, border_w=2, fill_alpha=210,
    ),
    'board/ghost_invalid.png': dict(
        size=(64, 64), radius=9, fill=ORANGE, border=INK, border_w=2, fill_alpha=165,
    ),
    'piece/police_cell.png': dict(
        size=(64, 64), radius=9, fill='#85b8dc', border=INK, border_w=2,
        inner_bottom='#6093b8', inner_h=4,
    ),
    'piece/police_cell_drag.png': dict(
        size=(64, 64), radius=9, fill='#9ec9e8', border=INK, border_w=2,
        inner_bottom='#77a9cf', inner_h=4,
    ),
}

# ── 按钮 / 卡片 ───────────────────────────────────────────────────
BUTTONS = {
    'ui/btn_primary.png': dict(
        size=(208, 52), radius=17, fill=ORANGE, border='#ad5943', border_w=2,
        bottom_shadow='#ad5943', shadow_h=4,
    ),
    'ui/btn_primary_pressed.png': dict(
        size=(208, 52), radius=17, fill=ORANGE, border='#ad5943', border_w=2,
        bottom_shadow='#ad5943', shadow_h=1,
    ),
    'ui/btn_secondary.png': dict(
        size=(360, 110), radius=17, fill='#fffdf4', border='#ced6bf', border_w=2,
        bottom_shadow='#e0e2cd', shadow_h=3,
    ),
    'ui/btn_round.png': dict(
        size=(48, 48), radius=15, fill=CREAM, border='#d8deca', border_w=2,
        bottom_shadow='#e0e2cd', shadow_h=3,
    ),
    'ui/btn_hint.png': dict(
        size=(240, 112), radius=17, fill='#fff9e9', border='#e0d5ad', border_w=2,
        bottom_shadow='#e8dfbc', shadow_h=3,
    ),
}

CARDS = {
    'ui/card_bg.png': dict(
        size=(344, 304), radius=23, fill=CREAM, border='#c0cbae', border_w=2,
        bottom_shadow='#26453c', shadow_h=8, shadow_alpha=51,
    ),
    'ui/card_mint.png': dict(
        size=(400, 160), radius=20, fill='#e1efdf',
    ),
    'ui/card_group.png': dict(
        size=(400, 160), radius=20, fill='#f2f3e8', border='#e0e4d1', border_w=2,
    ),
    'ui/card_achievement.png': dict(
        size=(400, 160), radius=20, fill='#f5edcf', border='#e6dcb8', border_w=2,
    ),
    'ui/card_stats.png': dict(
        size=(400, 160), radius=20, fill=CREAM, border='#d8deca', border_w=2,
    ),
    'ui/card_ticket.png': dict(
        size=(400, 216), radius=23, fill='#fffdf5', border='#e3dac2', border_w=2,
        bottom_shadow='#e8e2cf', shadow_h=4,
    ),
    'ui/tray_bg.png': dict(
        size=(400, 120), radius=20, fill=CREAM, border=INK, border_w=2,
        bottom_shadow='#d8deca', shadow_h=3,
    ),
    'ui/slot_dashed.png': dict(
        size=(112, 100), radius=13, fill='#e9eedc', border='#b5c6aa', border_w=2,
        dashed=True, dash_len=9, gap_len=7,
    ),
    'ui/coach_bubble.png': dict(
        size=(160, 48), radius=14, fill='#fff9e9', border=INK, border_w=2,
    ),
}

# ── 控件 / 进度 / 胶囊 ────────────────────────────────────────────
WIDGETS = {
    'ui/loading_track.png': dict(
        size=(400, 32), radius=16, fill='#d0dfc7', border='#9ab58a', border_w=2,
    ),
    'ui/loading_fill.png': dict(
        size=(400, 32), radius=16, fill='#efb766',
    ),
    'ui/progress_track.png': dict(
        size=(320, 16), radius=8, fill='#e5e9d9',
    ),
    'ui/progress_fill.png': dict(
        size=(320, 16), radius=8, fill='#86b59b',
    ),
    'ui/nav_bg.png': dict(
        size=(640, 104), radius=16, fill='#fffdf4', border='#d8e0ce', border_w=2,
        top_radius_only=True,
    ),
    'ui/overlay_dim.png': dict(
        size=(4, 4), radius=0, fill=INK, fill_alpha=128,
    ),
    'ui/profile_avatar_bg.png': dict(
        size=(210, 210), radius=35, fill='#e1eed8', border='#b6c9a7', border_w=2,
        bottom_shadow='#c9d8bb', shadow_h=4,
    ),
    'ui/result_seal.png': dict(
        size=(264, 264), radius=132, fill='#e4efd4', border='#a6bd91', border_w=2,
        dashed=True, dash_len=12, gap_len=10,
    ),
    'ui/scene_tag.png': dict(
        # 原 inset=34 已越界（贴图半高仅 32），生成时保持尺寸不变
        size=(200, 64), radius=30, fill='#fff9e9', border='#63786a', border_w=2,
        bottom_shadow='#becabe', shadow_h=3,
    ),
    'ui/star_counter.png': dict(
        size=(176, 56), radius=28, fill='#fff9e9', border='#d8d9bc', border_w=2,
    ),
    'ui/difficulty_pill.png': dict(
        size=(120, 44), radius=22, fill='#e3efdd', border='#c5d6c4', border_w=2,
    ),
    'ui/boot_mark.png': dict(
        size=(240, 240), radius=40, fill='#fdf8de', border='#7fa07e', border_w=2,
        bottom_shadow='#b4c9a8', shadow_h=7,
    ),
    'ui/level_tile.png': dict(
        size=(152, 152), radius=18, fill='#eef3df', border='#c9d6bc', border_w=2,
        bottom_shadow='#d3dfc6', shadow_h=3,
    ),
    'ui/level_tile_current.png': dict(
        size=(152, 152), radius=18, fill=ORANGE, border='#ae644b', border_w=2,
        bottom_shadow='#ae644b', shadow_h=3,
    ),
    'ui/level_tile_locked.png': dict(
        size=(152, 152), radius=18, fill='#f0f1e9', border='#e0e3d7', border_w=2,
        bottom_shadow='#e3e5d9', shadow_h=3,
    ),
    'ui/siren_blue_left.png': dict(
        size=(400, 18), radius=9, siren=('#d9705f', '#6093b8'),
    ),
    'ui/siren_red_left.png': dict(
        size=(400, 18), radius=9, siren=('#6093b8', '#d9705f'),
    ),
    'white.png': dict(size=(2, 2), radius=0, fill='#ffffff'),
}

A_SPECS = {}
A_SPECS.update(BOARD)
A_SPECS.update(BUTTONS)
A_SPECS.update(CARDS)
A_SPECS.update(WIDGETS)
