import { Color, Node } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import {
    box, boxSize, buildStarCounter, labelInBox, localBox, localIcon, localLabel, makeButton, type MenuMetrics,
} from './MenuWidgets';
import { addSprite } from '../../core/ui/UIFactory';

export type MenuHomeCallbacks = {
    onStart: () => void;
    onLevels: () => void;
    onNavMenu: () => void;
    onNavSettings: () => void;
    onNavProfile: () => void;
};

/** 主菜单：顶部品牌栏 + 主视觉 + 开始/关卡按钮 + 底部导航 */
export class MenuHomeView {
    readonly node: Node;

    constructor(
        parent: Node,
        private readonly m: MenuMetrics,
        private readonly frames: DesignFrames,
        stars: number,
        unlocked: number,
        cb: MenuHomeCallbacks,
    ) {
        this.node = box('HomePage', parent, m, 0, 0, 414, 820);

        // 背景：上绿下奶油，近似设计稿纵向渐变 linear-gradient(180deg, #e4f0e5 → #e3efe2 → var(--cream))
        const top = box('HomeBgTop', this.node, m, 0, 0, 414, 480);
        addSprite(top, frames.solid, { size: boxSize(m, 414, 480), color: PocketPalette.mint });
        const bottom = box('HomeBgBottom', this.node, m, 0, 480, 414, 340);
        addSprite(bottom, frames.solid, { size: boxSize(m, 414, 340), color: PocketPalette.cream });

        // ── 顶部品牌栏 ──
        const brand = box('MiniBrand', this.node, m, 20, 20, 150, 24);
        localIcon(brand, m, 'BrandIcon', frames.badge, 150, 24, 14, 12, 25);
        localLabel(brand, m, 'BrandText', '口袋巡逻队', 12, 150, 24,
            { x: 30, y: 0, w: 120, h: 24 }, { color: PocketPalette.ink, bold: true });
        buildStarCounter(this.node, m, frames, 320, 14, 74, 28, stars);

        // ── 标题区 ──
        labelInBox(this.node, m, 'HeadingEyebrow', 'POCKET PATROL', 10,
            { x: 0, y: 86, w: 414, h: 14 }, { color: PocketPalette.mintDeep, bold: true });
        labelInBox(this.node, m, 'HeadingTitle', '警察抓小偷✦', 38,
            { x: 0, y: 106, w: 414, h: 58 }, { color: PocketPalette.ink, bold: true });
        labelInBox(this.node, m, 'HeadingSub', '动动小脑筋，小偷无处躲！', 12,
            { x: 0, y: 170, w: 414, h: 18 }, { color: new Color(102, 135, 121, 255) });

        // ── 主视觉 hero ──
        const hero = box('Hero', this.node, m, 10, 200, 394, 260);
        addSprite(hero, frames.heroTown, { size: boxSize(m, 394, 260) });
        // 场景标签角标（设计稿：贴 hero 底部、上移 8px、左偏 -3°）
        const tag = localBox('SceneTag', hero, m, 394, 260, (394 - 172) / 2, 218, 172, 34);
        tag.angle = -3;
        addSprite(tag, frames.sceneTag, { size: boxSize(m, 172, 34), sliced: true });
        localIcon(tag, m, 'TagIcon', frames.badge, 172, 34, 16, 17, 18);
        localLabel(tag, m, 'TagText', '今日任务：快乐出警', 11, 172, 34,
            { x: 28, y: 0, w: 140, h: 34 }, { color: PocketPalette.ink, bold: true });

        // ── 下一站信息 ──
        labelInBox(this.node, m, 'NextEyebrow', '下一站，出发！', 9,
            { x: 25, y: 478, w: 200, h: 12 }, { color: PocketPalette.mintDeep, bold: true });
        labelInBox(this.node, m, 'NextTitle', `第 08 关 · 薄荷街角`, 15,
            { x: 25, y: 492, w: 260, h: 22 }, { color: PocketPalette.ink, bold: true });
        const pill = box('DifficultyPill', this.node, m, 300, 484, 80, 30);
        addSprite(pill, frames.difficultyPill, { size: boxSize(m, 80, 30), sliced: true });
        localLabel(pill, m, 'PillText', '轻松上手', 10, 80, 30,
            { x: 0, y: 0, w: 80, h: 30 }, { color: new Color(103, 144, 118, 255) });

        // ── 操作区：开始 + 关卡选择 ──
        const start = makeButton(this.node, m, 'StartButton', 24, 534, 366, 62,
            // btnPrimary 素材本身已是设计稿的珊瑚橙 #F78462，再 tint 会二次染色偏红，故不指定 color
            { normal: frames.btnPrimary, pressed: frames.btnPrimaryPressed, sliced: true });
        localIcon(start.node, m, 'StartPlay', frames.play, 366, 62, 42, 31, 23, PocketPalette.whiteish);
        localLabel(start.node, m, 'StartText', '开始游戏', 21, 366, 62,
            { x: 60, y: 0, w: 220, h: 62 },
            { color: PocketPalette.whiteish, bold: true });
        localIcon(start.node, m, 'StartArrow', frames.arrowWhite, 366, 62, 338, 31, 22);
        start.node.on(Node.EventType.TOUCH_END, cb.onStart);

        const levels = makeButton(this.node, m, 'LevelsButton', 24, 609, 366, 55,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(levels.node, m, 'LevelsIcon', frames.grid, 366, 55, 22, 27, 21);
        localLabel(levels.node, m, 'LevelsText', '关卡选择', 14, 366, 55,
            { x: 40, y: 0, w: 120, h: 55 }, { color: PocketPalette.ink, bold: true });
        localLabel(levels.node, m, 'LevelsDetail', `${unlocked} / 24`, 11, 366, 55,
            { x: 270, y: 0, w: 70, h: 55 }, { color: PocketPalette.muted });
        localIcon(levels.node, m, 'LevelsArrow', frames.arrow, 366, 55, 346, 27, 18);
        levels.node.on(Node.EventType.TOUCH_END, cb.onLevels);

        labelInBox(this.node, m, 'MenuTip', '不比手速，只比一点点小机智', 10,
            { x: 0, y: 678, w: 414, h: 16 }, { color: new Color(146, 157, 135, 255) });

        // ── 底部导航 ──
        this.buildNav(m, frames, cb);
    }

    private buildNav(m: MenuMetrics, frames: DesignFrames, cb: MenuHomeCallbacks): void {
        const nav = box('BottomNav', this.node, m, 0, 716, 414, 104);
        addSprite(nav, frames.navBg, { size: boxSize(m, 414, 104) });

        const items: { key: 'home' | 'settings' | 'user'; label: string; cx: number; current: boolean; tap: () => void }[] = [
            { key: 'home', label: '小镇', cx: 69, current: true, tap: cb.onNavMenu },
            { key: 'settings', label: '设置', cx: 207, current: false, tap: cb.onNavSettings },
            { key: 'user', label: '我的', cx: 345, current: false, tap: cb.onNavProfile },
        ];
        for (const item of items) {
            const btn = localBox(`Nav_${item.key}`, nav, m, 414, 104, item.cx - 38, 12, 76, 76);
            if (item.current) {
                const plate = localBox('NavCurrentPlate', btn, m, 76, 76, 0, 12, 76, 52);
                addSprite(plate, frames.solid, { size: boxSize(m, 76, 52), color: new Color(227, 238, 220, 255) });
            }
            const color = item.current ? new Color(66, 110, 86, 255) : new Color(139, 151, 135, 255);
            localIcon(btn, m, `NavIcon_${item.key}`, frames[item.key], 76, 76, 38, 24, 24, color);
            localLabel(btn, m, `NavLabel_${item.key}`, item.label, 10, 76, 76,
                { x: 0, y: 50, w: 76, h: 16 }, { color, bold: item.current });
            btn.on(Node.EventType.TOUCH_END, item.tap);
        }
    }
}
