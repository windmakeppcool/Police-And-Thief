import { Color, Mask, Node, ScrollView, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import {
    box, boxSize, labelInBox, localBox, localIcon, localLabel, makeButton, type MenuMetrics,
} from './MenuWidgets';
import { addSprite, createNode } from '../../core/ui/UIFactory';

export type ResultCallbacks = {
    onNext: () => void;
    onReplay: () => void;
    onShare: () => void;
    onMenu: () => void;
};

const VIEW_W = 364;
const VIEW_H = 596;

// 滚动内容内部布局（设计 px，相对内容顶部，居中式布局）
const SEAL_Y = 12, SEAL_H = 132;
const KICKER_Y = 172;
const TITLE_Y = 194, TITLE_H = 36;
const SUB_Y = 238;
const STARS_Y = 278;
const TICKET_Y = 348, TICKET_H = 158;
const NOTE_Y = 526;
const CONTENT_H = 566;

/** 结算页：巡逻报告印章 + 星级 + 成绩单票据 + 下一关/重开/分享/返回 */
export class ResultView {
    readonly node: Node;

    constructor(
        parent: Node,
        private readonly m: MenuMetrics,
        private readonly frames: DesignFrames,
        cb: ResultCallbacks,
    ) {
        this.node = box('ResultPage', parent, m, 0, 0, 414, 820);
        const bg = box('ResultBg', this.node, m, 0, 0, 414, 820);
        addSprite(bg, frames.solid, { size: boxSize(m, 414, 820), color: new Color(244, 248, 236, 255) });

        // ── 顶部报告栏 ──
        labelInBox(this.node, m, 'TopBrand', '巡逻报告', 13,
            { x: 24, y: 16, w: 160, h: 24 }, { color: PocketPalette.ink, bold: true });
        labelInBox(this.node, m, 'TopLevel', '第 08 关', 10,
            { x: 250, y: 18, w: 140, h: 22 }, { color: PocketPalette.mintDeep });

        // ── 可滚动内容（视口 60..656） ──
        const scrollNode = box('ResultScroll', this.node, m, (414 - VIEW_W) / 2, 60, VIEW_W, VIEW_H);
        const content = createNode('Content', scrollNode, boxSize(m, VIEW_W, CONTENT_H),
            new Vec3(0, (CONTENT_H - VIEW_H) / 2 * m.sx, 0));

        // 印章
        const seal = localBox('Seal', content, m, VIEW_W, CONTENT_H,
            (VIEW_W - SEAL_H) / 2, SEAL_Y, SEAL_H, SEAL_H);
        addSprite(seal, frames.resultSeal, { size: boxSize(m, SEAL_H, SEAL_H), sliced: true });
        const sealIcon = localBox('SealIcon', seal, m, SEAL_H, SEAL_H, (SEAL_H - 95) / 2, (SEAL_H - 95) / 2, 95, 95);
        sealIcon.angle = -8;
        addSprite(sealIcon, frames.badge, { size: boxSize(m, 95, 95) });
        // 对应设计稿 .spark-one（左上、探出印章）与 .spark-two（右下、略小）
        localLabel(seal, m, 'Spark1', '✦', 26, SEAL_H, SEAL_H,
            { x: -17, y: 0, w: 30, h: 30 }, { color: new Color(233, 180, 76, 255) });
        localLabel(seal, m, 'Spark2', '✦', 20, SEAL_H, SEAL_H,
            { x: SEAL_H - 4, y: SEAL_H - 22, w: 22, h: 22 }, { color: new Color(233, 180, 76, 255) });

        // 文案
        localLabel(content, m, 'Kicker', 'MISSION COMPLETE', 10, VIEW_W, CONTENT_H,
            { x: 0, y: KICKER_Y, w: VIEW_W, h: 14 }, { color: PocketPalette.mintDeep, bold: true });
        localLabel(content, m, 'Title', '漂亮！成功收网', 27, VIEW_W, CONTENT_H,
            { x: 0, y: TITLE_Y, w: VIEW_W, h: TITLE_H }, { color: PocketPalette.ink, bold: true });
        localLabel(content, m, 'Subtitle', '小镇恢复平静，你就是今日机智担当。', 11, VIEW_W, CONTENT_H,
            { x: 0, y: SUB_Y, w: VIEW_W, h: 18 }, { color: new Color(125, 141, 118, 255) });

        // 三星：中间略大上移
        const starY = STARS_Y + 20;
        localIcon(content, m, 'Star1', frames.starActive, VIEW_W, CONTENT_H, VIEW_W / 2 - 40, starY, 40);
        localIcon(content, m, 'Star2', frames.starActive, VIEW_W, CONTENT_H, VIEW_W / 2, starY + 4, 52);
        localIcon(content, m, 'Star3', frames.starActive, VIEW_W, CONTENT_H, VIEW_W / 2 + 40, starY, 40);

        // 成绩单票据
        const ticket = localBox('Ticket', content, m, VIEW_W, CONTENT_H, 0, TICKET_Y, VIEW_W, TICKET_H);
        addSprite(ticket, frames.cardTicket, { size: boxSize(m, VIEW_W, TICKET_H), sliced: true });
        localLabel(ticket, m, 'TicketCaption', '本次巡逻成绩单', 11, VIEW_W, TICKET_H,
            { x: 0, y: 18, w: VIEW_W, h: 16 }, { color: new Color(133, 144, 123, 255) });
        localLabel(ticket, m, 'TicketScore', '1,280', 46, VIEW_W, TICKET_H,
            { x: 0, y: 40, w: VIEW_W - 40, h: 56 }, { color: new Color(220, 132, 89, 255), bold: true });
        localLabel(ticket, m, 'TicketScoreUnit', '分', 12, VIEW_W, TICKET_H,
            { x: VIEW_W - 46, y: 58, w: 30, h: 24 }, { color: new Color(220, 132, 89, 255) });
        const stats = [
            { label: '出动警队', value: '3 步', cx: VIEW_W / 4 },
            { label: '行动用时', value: '00:42', cx: VIEW_W * 3 / 4 },
        ];
        stats.forEach((s, i) => {
            localLabel(ticket, m, `TicketStatLabel_${i}`, s.label, 10, VIEW_W, TICKET_H,
                { x: s.cx - 70, y: 116, w: 140, h: 14 }, { color: new Color(126, 139, 118, 255) });
            localLabel(ticket, m, `TicketStatValue_${i}`, s.value, 17, VIEW_W, TICKET_H,
                { x: s.cx - 70, y: 130, w: 140, h: 22 }, { color: PocketPalette.ink, bold: true });
        });

        localLabel(content, m, 'Note', '下一站的小镇，正等着你！', 11, VIEW_W, CONTENT_H,
            { x: 0, y: NOTE_Y, w: VIEW_W, h: 18 }, { color: new Color(125, 141, 118, 255) });

        const mask = scrollNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const scroll = scrollNode.addComponent(ScrollView);
        scroll.vertical = true;
        scroll.horizontal = false;
        scroll.inertia = true;
        scroll.brake = 0.75;
        scroll.content = content;

        // ── 底部操作区（662..808） ──
        const next = makeButton(this.node, m, 'NextButton', 24, 666, 366, 56,
            { normal: frames.btnPrimary, pressed: frames.btnPrimaryPressed, color: PocketPalette.orange, sliced: true });
        localLabel(next.node, m, 'NextText', '下一关，出发', 18, 366, 56,
            { x: 0, y: 0, w: 300, h: 56 }, { color: PocketPalette.whiteish, bold: true });
        localIcon(next.node, m, 'NextArrow', frames.arrowWhite, 366, 56, 334, 28, 20);
        next.node.on(Node.EventType.TOUCH_END, cb.onNext);

        const replay = makeButton(this.node, m, 'ReplayButton', 24, 730, 178, 48,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(replay.node, m, 'ReplayIcon', frames.reset, 178, 48, 28, 24, 21);
        localLabel(replay.node, m, 'ReplayText', '重新开始', 12, 178, 48,
            { x: 44, y: 0, w: 130, h: 48 }, { color: PocketPalette.ink, bold: true });
        replay.node.on(Node.EventType.TOUCH_END, cb.onReplay);

        const share = makeButton(this.node, m, 'ShareButton', 212, 730, 178, 48,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(share.node, m, 'ShareIcon', frames.share, 178, 48, 28, 24, 21);
        localLabel(share.node, m, 'ShareText', '分享战绩', 12, 178, 48,
            { x: 44, y: 0, w: 130, h: 48 }, { color: PocketPalette.ink, bold: true });
        share.node.on(Node.EventType.TOUCH_END, cb.onShare);

        const menuText = box('MenuTextButton', this.node, m, (414 - 200) / 2, 784, 200, 28);
        localLabel(menuText, m, 'MenuText', '返回主菜单', 11, 200, 28,
            { x: 0, y: 0, w: 200, h: 28 }, { color: PocketPalette.muted });
        menuText.on(Node.EventType.TOUCH_END, cb.onMenu);
    }
}
