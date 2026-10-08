import { Color, Label, Node, UITransform, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import { box, boxCenter, boxSize, labelInBox, type MenuMetrics } from './MenuWidgets';
import { addSprite, createNode, setSize } from './UIFactory';

/** 启动加载页：警徽底板 + 进度条，进度走完后由控制器切到主菜单 */
export class MenuBootView {
    readonly node: Node;
    private readonly fill: Node;
    private readonly fillLabel: Label;
    private readonly innerWidth: number;
    private readonly trackX: number;

    constructor(parent: Node, private readonly m: MenuMetrics, private readonly frames: DesignFrames) {
        // 414×820 整块背景
        this.node = box('BootPage', parent, m, 0, 0, 414, 820);
        addSprite(this.node, frames.solid, { size: boxSize(m, 414, 820), color: new Color(226, 239, 223, 255) });

        // 警徽底板（素材底板）+ 叠加 badge 图标
        const mark = box('BootMark', this.node, m, (414 - 132) / 2, 189, 132, 132);
        mark.angle = -6;
        addSprite(mark, frames.bootMark, { size: boxSize(m, 132, 132), sliced: true });
        const badgeIcon = createNode('BootBadge', mark, boxSize(m, 80, 80), new Vec3(0, 0, 0));
        addSprite(badgeIcon, frames.badge, { size: boxSize(m, 80, 80) });

        labelInBox(this.node, m, 'BootEyebrow', 'POCKET PATROL', 10,
            { x: 0, y: 345, w: 414, h: 16 }, { color: PocketPalette.mintDeep, bold: true });
        labelInBox(this.node, m, 'BootTitle', '口袋巡逻队', 35,
            { x: 0, y: 372, w: 414, h: 48 }, { color: PocketPalette.ink, bold: true });
        labelInBox(this.node, m, 'BootDesc', '集合啦！快乐马上出发', 12,
            { x: 0, y: 436, w: 414, h: 20 }, { color: new Color(122, 148, 115, 255) });

        // 进度条：track 底板 + 左对齐 fill
        const trackW = 269;
        this.trackX = (414 - trackW) / 2;
        const track = box('LoadingTrack', this.node, m, this.trackX, 478, trackW, 16);
        addSprite(track, frames.loadingTrack, { size: boxSize(m, trackW, 16), sliced: true });

        this.innerWidth = trackW - 8;
        this.fill = box('LoadingFill', this.node, m, this.trackX + 4, 482, 1, 8);
        addSprite(this.fill, frames.loadingFill, { size: boxSize(m, 1, 8), sliced: true });

        const fillTextNode = labelInBox(this.node, m, 'LoadingText', '正在整理巡逻装备… 0%', 10,
            { x: 0, y: 502, w: 414, h: 16 }, { color: new Color(139, 158, 125, 255) });
        this.fillLabel = fillTextNode.getComponent(Label)!;

        labelInBox(this.node, m, 'BootBottom', '适度游戏益脑 · 享受健康生活', 9,
            { x: 0, y: 778, w: 414, h: 14 }, { color: new Color(144, 161, 130, 255) });
    }

    /** p: 0~1，更新进度条宽度与文案 */
    setProgress(p: number): void {
        const clamped = Math.max(0, Math.min(1, p));
        const width = Math.max(1, this.innerWidth * clamped);
        this.fill.setPosition(boxCenter(this.m, this.trackX + 4, 482, width, 8));
        const transform = this.fill.getComponent(UITransform);
        const next = boxSize(this.m, width, 8);
        if (transform) transform.setContentSize(next.width, next.height);
        else setSize(this.fill, next);

        const percent = Math.round(clamped * 100);
        const done = clamped >= 1;
        this.fillLabel.string = done ? `准备好了，快乐出发！${percent}%` : `正在整理巡逻装备… ${percent}%`;
    }
}
