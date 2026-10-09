import { Color, Mask, Node, ScrollView, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import {
    box, boxSize, labelInBox, localBox, localIcon, localLabel, makeButton, type MenuMetrics,
} from './MenuWidgets';
import { addSprite, createNode } from '../../core/ui/UIFactory';

export type SettingsCallbacks = {
    onBack: () => void;
};

const VIEW_W = 366;
const VIEW_H = 508;

// 滚动内容内部布局（设计 px，相对内容顶部）
const LABEL1_Y = 0;
const GROUP1_Y = 22, GROUP1_H = 219;
const LABEL2_Y = 261;
const GROUP2_Y = 283, GROUP2_H = 192;
const NOTE_Y = 498;
const CONTENT_H = 560;

/** 设置页：页头 + 介绍 + 可滚动的声音反馈/关于约定分组 + 底部返回按钮 */
export class SettingsView {
    readonly node: Node;

    constructor(
        parent: Node,
        private readonly m: MenuMetrics,
        private readonly frames: DesignFrames,
        cb: SettingsCallbacks,
    ) {
        this.node = box('SettingsPage', parent, m, 0, 0, 414, 820);
        const bg = box('SettingsBg', this.node, m, 0, 0, 414, 820);
        addSprite(bg, frames.solid, { size: boxSize(m, 414, 820), color: PocketPalette.cream });

        // ── 页头：返回 + 标题 ──
        const back = makeButton(this.node, m, 'BackButton', 16, 17, 48, 48,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(back.node, m, 'BackIcon', frames.back, 48, 48, 24, 24, 25);
        back.node.on(Node.EventType.TOUCH_END, cb.onBack);
        labelInBox(this.node, m, 'SettingsTitle', '舒适地玩', 18,
            { x: 64, y: 17, w: 286, h: 48 }, { color: PocketPalette.ink, bold: true });

        // ── 介绍区 ──
        const introIcon = localBox('IntroIcon', this.node, m, 414, 820, (414 - 54) / 2, 96, 54, 54);
        introIcon.angle = -12;
        addSprite(introIcon, frames.settings, { size: boxSize(m, 54, 54) });
        labelInBox(this.node, m, 'IntroTitle', '你的游戏，你做主', 20,
            { x: 0, y: 156, w: 414, h: 28 }, { color: PocketPalette.ink, bold: true });
        labelInBox(this.node, m, 'IntroDesc', '调到刚刚好的快乐频率。', 11,
            { x: 0, y: 186, w: 414, h: 18 }, { color: new Color(130, 145, 121, 255) });

        // ── 可滚动分组区（视口 212..720） ──
        const scrollNode = box('SettingsScroll', this.node, m, (414 - VIEW_W) / 2, 212, VIEW_W, VIEW_H);
        const content = createNode('Content', scrollNode, boxSize(m, VIEW_W, CONTENT_H),
            new Vec3(0, (CONTENT_H - VIEW_H) / 2 * m.sx, 0));

        // 分组一：声音与反馈
        localLabel(content, m, 'Label1', '声音与反馈', 11, VIEW_W, CONTENT_H,
            { x: 4, y: LABEL1_Y, w: 200, h: 16 }, { color: new Color(127, 142, 118, 255) });
        const g1 = localBox('Group1', content, m, VIEW_W, CONTENT_H, 0, GROUP1_Y, VIEW_W, GROUP1_H);
        addSprite(g1, frames.cardGroup, { size: boxSize(m, VIEW_W, GROUP1_H), sliced: true });

        localIcon(g1, m, 'SoundIcon', frames.sound, VIEW_W, GROUP1_H, 30, 36, 23);
        localLabel(g1, m, 'SoundText', '游戏音效', 13, VIEW_W, GROUP1_H,
            { x: 48, y: 20, w: 140, h: 32 }, { color: PocketPalette.ink });
        this.buildSwitch(g1, 300, 12, true);

        localLabel(g1, m, 'VolumeText', '音效音量', 12, VIEW_W, GROUP1_H,
            { x: 16, y: 82, w: 120, h: 24 }, { color: PocketPalette.ink });
        localLabel(g1, m, 'VolumeValue', '65%', 11, VIEW_W, GROUP1_H,
            { x: VIEW_W - 90, y: 82, w: 74, h: 24 }, { color: new Color(116, 146, 120, 255) });
        const volTrack = localBox('VolumeTrack', g1, m, VIEW_W, GROUP1_H, 16, 120, VIEW_W - 32, 8);
        addSprite(volTrack, frames.progressTrack, { size: boxSize(m, VIEW_W - 32, 8), sliced: true });
        const volFill = localBox('VolumeFill', g1, m, VIEW_W, GROUP1_H, 16, 120, (VIEW_W - 32) * 0.65, 8);
        addSprite(volFill, frames.progressFill, { size: boxSize(m, (VIEW_W - 32) * 0.65, 8), sliced: true });

        localLabel(g1, m, 'HapticsText', '轻触反馈', 13, VIEW_W, GROUP1_H,
            { x: 16, y: 150, w: 160, h: 24 }, { color: PocketPalette.ink });
        localLabel(g1, m, 'HapticsSub', '设备支持时，给予轻微振动', 9, VIEW_W, GROUP1_H,
            { x: 16, y: 176, w: 220, h: 16 }, { color: new Color(132, 145, 123, 255) });
        this.buildSwitch(g1, 300, 158, true);

        // 分组二：关于与约定
        localLabel(content, m, 'Label2', '关于与约定', 11, VIEW_W, CONTENT_H,
            { x: 4, y: LABEL2_Y, w: 200, h: 16 }, { color: new Color(127, 142, 118, 255) });
        const g2 = localBox('Group2', content, m, VIEW_W, CONTENT_H, 0, GROUP2_Y, VIEW_W, GROUP2_H);
        addSprite(g2, frames.cardGroup, { size: boxSize(m, VIEW_W, GROUP2_H), sliced: true });
        const links = ['隐私说明', '用户协议', '关于口袋巡逻队'];
        links.forEach((text, i) => {
            const rowY = i * 64;
            localLabel(g2, m, `Link_${i}`, text, 12, VIEW_W, GROUP2_H,
                { x: 16, y: rowY, w: 200, h: 64 }, { color: PocketPalette.ink });
            localIcon(g2, m, `LinkArrow_${i}`, frames.arrow, VIEW_W, GROUP2_H,
                VIEW_W - 24, rowY + 32, 19);
        });

        localLabel(content, m, 'Footnote', 'UI 设计效果稿 · v1.0\n页面内容为设计示例，未接入平台服务。', 9,
            VIEW_W, CONTENT_H, { x: 0, y: NOTE_Y, w: VIEW_W, h: 28 },
            { color: new Color(152, 161, 143, 255), lineHeight: 14 });

        const mask = scrollNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const scroll = scrollNode.addComponent(ScrollView);
        scroll.vertical = true;
        scroll.horizontal = false;
        scroll.inertia = true;
        scroll.brake = 0.75;
        scroll.content = content;

        // ── 底部返回按钮 ──
        const done = makeButton(this.node, m, 'DoneButton', 24, 740, 366, 58,
            { normal: frames.btnPrimary, pressed: frames.btnPrimaryPressed, color: PocketPalette.orange, sliced: true });
        localLabel(done.node, m, 'DoneText', '设置好了，回小镇', 18, 366, 58,
            { x: 0, y: 0, w: 366, h: 58 }, { color: PocketPalette.whiteish, bold: true });
    }

    /** 开关：底板 switchOn/Off + 白色圆点（点击切换，仅视觉态）。坐标相对父分组局部左上角 */
    private buildSwitch(parent: Node, x: number, y: number, initial: boolean): void {
        const node = localBox('Switch', parent, this.m, VIEW_W, GROUP1_H, x, y, 56, 48);
        const sprite = addSprite(node, initial ? this.frames.switchOn : this.frames.switchOff,
            { size: boxSize(this.m, 56, 48) });
        node.on(Node.EventType.TOUCH_END, () => {
            // 仅切换视觉，音效/振动等真实开关随平台设置接入
            sprite.spriteFrame = sprite.spriteFrame === this.frames.switchOn
                ? this.frames.switchOff
                : this.frames.switchOn;
        });
    }
}
