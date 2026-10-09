import { Color, Mask, Node, ScrollView, UITransform, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import {
    box, boxSize, labelInBox, localBox, localIcon, localLabel, makeButton, type MenuMetrics,
} from './MenuWidgets';
import { addSprite, createNode } from './UIFactory';

export type LevelsCallbacks = {
    onBack: () => void;
    onContinue: () => void;
    onPick: (level: number) => void;
};

const TOTAL = 24;
const COLS = 4;
const TILE = 76;
const GAP_X = 10;
const GAP_Y = 13;
const GRID_W = COLS * TILE + (COLS - 1) * GAP_X; // 334
const GRID_H = 6 * TILE + 5 * GAP_Y;             // 521

// 滚动内容内部布局（设计 px，相对内容顶部）
const CH_Y = 4, CH_H = 132;
const CAP_Y = 158;
const PROG_Y = 180, PROG_H = 8;
const GRID_Y = 213;
const HINT_Y = GRID_Y + GRID_H + 12;
const CONTENT_H = HINT_Y + 16 + 20; // 802

/** 关卡选择：页头 + 可滚动的章节卡片/进度/24 格网格 + 底部继续按钮 */
export class LevelsView {
    readonly node: Node;

    constructor(
        parent: Node,
        private readonly m: MenuMetrics,
        private readonly frames: DesignFrames,
        stars: number,
        unlocked: number,
        cb: LevelsCallbacks,
    ) {
        this.node = box('LevelsPage', parent, m, 0, 0, 414, 820);
        const bg = box('LevelsBg', this.node, m, 0, 0, 414, 820);
        addSprite(bg, frames.solid, { size: boxSize(m, 414, 820), color: PocketPalette.cream });

        // ── 页头：返回 + 标题 + 星星 ──
        const back = makeButton(this.node, m, 'BackButton', 16, 17, 48, 48,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(back.node, m, 'BackIcon', frames.back, 48, 48, 24, 24, 25);
        back.node.on(Node.EventType.TOUCH_END, cb.onBack);
        labelInBox(this.node, m, 'LevelsTitle', '巡逻地图', 18,
            { x: 64, y: 17, w: 286, h: 48 }, { color: PocketPalette.ink, bold: true });
        this.buildStarCounter(308, 27, 90, 28, stars);

        this.buildScroll(unlocked, cb);

        // ── 底部继续按钮 ──
        const cont = makeButton(this.node, m, 'ContinueButton', 24, 740, 366, 58,
            { normal: frames.btnPrimary, pressed: frames.btnPrimaryPressed, color: PocketPalette.orange, sliced: true });
        localLabel(cont.node, m, 'ContinueText', '继续巡逻', 18, 366, 58,
            { x: 0, y: 0, w: 300, h: 58 }, { color: PocketPalette.whiteish, bold: true });
        localIcon(cont.node, m, 'ContinueArrow', frames.arrowWhite, 366, 58, 332, 29, 20);
        cont.node.on(Node.EventType.TOUCH_END, cb.onContinue);
    }

    /** 视口高度 640（88..728），内容更高时可纵向滚动 */
    private buildScroll(unlocked: number, cb: LevelsCallbacks): void {
        const viewW = 366;
        const viewH = 640;
        const scrollNode = box('LevelScroll', this.node, this.m, (414 - viewW) / 2, 88, viewW, viewH);

        const content = createNode('Content', scrollNode, boxSize(this.m, viewW, CONTENT_H),
            new Vec3(0, (CONTENT_H - viewH) / 2 * this.m.sx, 0));

        // ── 章节卡片 ──
        const chapter = localBox('ChapterHeading', content, this.m, viewW, CONTENT_H, 0, CH_Y, viewW, CH_H);
        addSprite(chapter, this.frames.solid, { size: boxSize(this.m, viewW, CH_H), color: new Color(225, 239, 223, 255) });
        localLabel(chapter, this.m, 'ChapterEyebrow', '每一步，都算数', 10, viewW, CH_H,
            { x: 20, y: 20, w: 240, h: 14 }, { color: PocketPalette.mintDeep, bold: true });
        localLabel(chapter, this.m, 'ChapterTitle', '小镇的平安，\n就交给你啦。', 24, viewW, CH_H,
            { x: 20, y: 40, w: 260, h: 78 }, { color: PocketPalette.ink, bold: true, lineHeight: 37 });
        const badge = localBox('ChapterBadge', chapter, this.m, viewW, CH_H, viewW - 98, 20, 98, 98);
        badge.angle = 14;
        addSprite(badge, this.frames.badge, { size: boxSize(this.m, 98, 98), color: new Color(255, 255, 255, 178) });

        // ── 进度文案 + 进度条 ──
        localLabel(content, this.m, 'ProgressCaptionLeft', '巡逻进度', 11, viewW, CONTENT_H,
            { x: 0, y: CAP_Y, w: 120, h: 16 }, { color: PocketPalette.muted });
        localLabel(content, this.m, 'ProgressCaptionRight', `${unlocked - 1} / 24`, 11, viewW, CONTENT_H,
            { x: viewW - 120, y: CAP_Y, w: 120, h: 16 }, { color: PocketPalette.muted });
        const track = localBox('MapProgress', content, this.m, viewW, CONTENT_H, 0, PROG_Y, viewW, PROG_H);
        addSprite(track, this.frames.progressTrack, { size: boxSize(this.m, viewW, PROG_H), sliced: true });
        const fillW = Math.max(1, viewW * ((unlocked - 1) / TOTAL));
        const fill = localBox('MapProgressFill', content, this.m, viewW, CONTENT_H, 0, PROG_Y, fillW, PROG_H);
        addSprite(fill, this.frames.progressFill, { size: boxSize(this.m, fillW, PROG_H), sliced: true });

        // ── 24 格关卡网格 ──
        const grid = localBox('LevelGrid', content, this.m, viewW, CONTENT_H,
            (viewW - GRID_W) / 2, GRID_Y, GRID_W, GRID_H);
        for (let i = 0; i < TOTAL; i++) {
            const level = i + 1;
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const tile = localBox(`Level_${level}`, grid, this.m, GRID_W, GRID_H,
                col * (TILE + GAP_X), row * (TILE + GAP_Y), TILE, TILE);
            this.decorateTile(tile, level, unlocked);
            if (level <= unlocked) {
                tile.on(Node.EventType.TOUCH_END, () => cb.onPick(level));
            }
        }

        localLabel(content, this.m, 'LevelsHint', '通关上一关，即可解锁下一段旅程', 10, viewW, CONTENT_H,
            { x: 0, y: HINT_Y, w: viewW, h: 16 }, { color: PocketPalette.muted });

        // 裁剪 + 滚动组件（内容节点在视口顶部对齐，初始露出章节卡片）
        const mask = scrollNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const scroll = scrollNode.addComponent(ScrollView);
        scroll.vertical = true;
        scroll.horizontal = false;
        scroll.inertia = true;
        scroll.brake = 0.75;
        scroll.content = content;
    }

    /** 按通关 / 待挑战 / 未解锁三种状态铺底板与文字 */
    private decorateTile(tile: Node, level: number, unlocked: number): void {
        const num = String(level).padStart(2, '0');
        if (level > unlocked) {
            addSprite(tile, this.frames.levelTileLocked, { size: boxSize(this.m, TILE, TILE), sliced: true });
            localIcon(tile, this.m, 'TileLock', this.frames.lock, TILE, TILE, TILE / 2, 30, 23,
                new Color(141, 155, 144, 255));
            localLabel(tile, this.m, 'TileNum', num, 11, TILE, TILE,
                { x: 0, y: 52, w: TILE, h: 16 }, { color: new Color(146, 156, 145, 255) });
            return;
        }
        if (level === unlocked) {
            addSprite(tile, this.frames.levelTileCurrent, { size: boxSize(this.m, TILE, TILE), sliced: true });
            localLabel(tile, this.m, 'TileNum', num, 21, TILE, TILE,
                { x: 0, y: 14, w: TILE, h: 28 }, { color: PocketPalette.whiteish, bold: true });
            localLabel(tile, this.m, 'TileState', '出发！', 10, TILE, TILE,
                { x: 0, y: 46, w: TILE, h: 16 }, { color: new Color(255, 245, 210, 255) });
            return;
        }
        addSprite(tile, this.frames.levelTile, { size: boxSize(this.m, TILE, TILE), sliced: true });
        localLabel(tile, this.m, 'TileNum', num, 21, TILE, TILE,
            { x: 0, y: 14, w: TILE, h: 28 }, { color: PocketPalette.ink, bold: true });
        const stars = level % 3 === 0 ? '★★☆' : '★★★';
        localLabel(tile, this.m, 'TileStars', stars, 12, TILE, TILE,
            { x: 0, y: 46, w: TILE, h: 16 }, { color: new Color(198, 138, 47, 255) });
    }

    /** 页头内的星星计数胶囊（尺寸与主菜单一致） */
    private buildStarCounter(x: number, y: number, w: number, h: number, stars: number): void {
        const node = box('HeaderStarCounter', this.node, this.m, x, y, w, h);
        addSprite(node, this.frames.starCounter, { size: boxSize(this.m, w, h), sliced: true });
        localIcon(node, this.m, 'StarIcon', this.frames.starActive, w, h, 15, h / 2, 21);
        localLabel(node, this.m, 'StarNum', `${stars}`, 14, w, h,
            { x: 24, y: 0, w: w - 30, h }, { color: PocketPalette.ink, bold: true });
    }
}
