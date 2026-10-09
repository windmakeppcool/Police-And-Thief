import { Color, Mask, Node, ScrollView, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import {
    box, boxSize, labelInBox, localBox, localIcon, localLabel, makeButton, type MenuMetrics,
} from './MenuWidgets';
import { addSprite, createNode } from '../../core/ui/UIFactory';

export type ProfileCallbacks = {
    onBack: () => void;
    onSettings: () => void;
    onPlay: () => void;
    onLevels: () => void;
};

const VIEW_W = 366;
const VIEW_H = 590;

// 滚动内容内部布局（设计 px，相对内容顶部）
const AV_Y = 6, AV_H = 105;
const EYEBROW_Y = 137;
const NAME_Y = 156, NAME_H = 34;
const DESC_Y = 194;
const TAG_Y = 218;
const STATS_Y = 262, STATS_H = 92;
const ACH_Y = 378, ACH_H = 78;
const LINK1_Y = 472;
const LINK2_Y = 536;
const MUTED_Y = 600;
const CONTENT_H = 630;

/** 个人中心：页头 + 头像身份 + 三项统计 + 成就 + 地图/清除入口 + 底部再来一局 */
export class ProfileView {
    readonly node: Node;

    constructor(
        parent: Node,
        private readonly m: MenuMetrics,
        private readonly frames: DesignFrames,
        cb: ProfileCallbacks,
    ) {
        this.node = box('ProfilePage', parent, m, 0, 0, 414, 820);
        const bg = box('ProfileBg', this.node, m, 0, 0, 414, 820);
        addSprite(bg, frames.solid, { size: boxSize(m, 414, 820), color: PocketPalette.cream });

        // ── 页头：返回 + 标题 + 设置 ──
        const back = makeButton(this.node, m, 'BackButton', 16, 17, 48, 48,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(back.node, m, 'BackIcon', frames.back, 48, 48, 24, 24, 25);
        back.node.on(Node.EventType.TOUCH_END, cb.onBack);
        labelInBox(this.node, m, 'ProfileTitle', '我的巡逻手册', 18,
            { x: 64, y: 17, w: 286, h: 48 }, { color: PocketPalette.ink, bold: true });
        const settings = makeButton(this.node, m, 'SettingsButton', 350, 17, 48, 48,
            { normal: frames.btnSecondary, sliced: true });
        localIcon(settings.node, m, 'SettingsIcon', frames.settings, 48, 48, 24, 24, 25);
        settings.node.on(Node.EventType.TOUCH_END, cb.onSettings);

        // ── 可滚动内容（视口 88..678） ──
        const scrollNode = box('ProfileScroll', this.node, m, (414 - VIEW_W) / 2, 88, VIEW_W, VIEW_H);
        const content = createNode('Content', scrollNode, boxSize(m, VIEW_W, CONTENT_H),
            new Vec3(0, (CONTENT_H - VIEW_H) / 2 * m.sx, 0));

        // 头像
        const avatar = localBox('Avatar', content, m, VIEW_W, CONTENT_H,
            (VIEW_W - AV_H) / 2, AV_Y, AV_H, AV_H);
        avatar.angle = -4;
        addSprite(avatar, frames.profileAvatarBg, { size: boxSize(m, AV_H, AV_H), sliced: true });
        localIcon(avatar, m, 'AvatarUser', frames.user, AV_H, AV_H, AV_H / 2, AV_H / 2, 70);
        const checkBadge = localBox('AvatarCheck', avatar, m, AV_H, AV_H, AV_H - 26, AV_H - 24, 30, 30);
        addSprite(checkBadge, frames.solid, { size: boxSize(m, 30, 30), color: new Color(137, 173, 138, 255) });
        localIcon(checkBadge, m, 'CheckIcon', frames.check, 30, 30, 15, 15, 18, PocketPalette.whiteish);

        // 身份文案
        localLabel(content, m, 'Eyebrow', 'HELLO, LITTLE HERO', 10, VIEW_W, CONTENT_H,
            { x: 0, y: EYEBROW_Y, w: VIEW_W, h: 14 }, { color: PocketPalette.mintDeep, bold: true });
        localLabel(content, m, 'Name', '见习巡逻员', 25, VIEW_W, CONTENT_H,
            { x: 0, y: NAME_Y, w: VIEW_W, h: NAME_H }, { color: PocketPalette.ink, bold: true });
        localLabel(content, m, 'Desc', '每一点机智，都值得被记录。', 11, VIEW_W, CONTENT_H,
            { x: 0, y: DESC_Y, w: VIEW_W, h: 16 }, { color: new Color(138, 149, 126, 255) });
        const tag = localBox('LocalTag', content, m, VIEW_W, CONTENT_H,
            (VIEW_W - 150) / 2, TAG_Y, 150, 26);
        addSprite(tag, frames.solid, { size: boxSize(m, 150, 26), color: new Color(237, 240, 223, 255) });
        localLabel(tag, m, 'TagText', '本机游客 · 无需登录', 10, 150, 26,
            { x: 0, y: 0, w: 150, h: 26 }, { color: new Color(120, 146, 115, 255) });

        // 三项统计
        const stats = localBox('Stats', content, m, VIEW_W, CONTENT_H, 0, STATS_Y, VIEW_W, STATS_H);
        addSprite(stats, frames.solid, { size: boxSize(m, VIEW_W, STATS_H), color: new Color(255, 253, 242, 0) });
        const statData: { value: string; label: string; cx: number }[] = [
            { value: '7', label: '已通关', cx: VIEW_W / 6 },
            { value: '18', label: '收集星星', cx: VIEW_W / 2 },
            { value: '1,280', label: '最高得分', cx: VIEW_W * 5 / 6 },
        ];
        statData.forEach((s, i) => {
            localLabel(stats, m, `StatValue_${i}`, s.value, 26, VIEW_W, STATS_H,
                { x: s.cx - 60, y: 14, w: 120, h: 32 }, { color: PocketPalette.ink, bold: true });
            localLabel(stats, m, `StatLabel_${i}`, s.label, 10, VIEW_W, STATS_H,
                { x: s.cx - 60, y: 54, w: 120, h: 16 }, { color: new Color(130, 144, 120, 255) });
        });

        // 成就卡片
        const ach = localBox('Achievement', content, m, VIEW_W, CONTENT_H, 0, ACH_Y, VIEW_W, ACH_H);
        addSprite(ach, frames.cardAchievement, { size: boxSize(m, VIEW_W, ACH_H), sliced: true });
        localIcon(ach, m, 'AchBadge', frames.badge, VIEW_W, ACH_H, 32, ACH_H / 2, 40);
        localLabel(ach, m, 'AchTitle', '第一枚警徽', 12, VIEW_W, ACH_H,
            { x: 60, y: 14, w: 200, h: 18 }, { color: PocketPalette.ink, bold: true });
        localLabel(ach, m, 'AchDesc', '小镇因为你的机智，多了一份安心。', 9, VIEW_W, ACH_H,
            { x: 60, y: 36, w: 220, h: 30 }, { color: new Color(151, 135, 96, 255), lineHeight: 13 });
        localLabel(ach, m, 'AchStatus', '已点亮', 9, VIEW_W, ACH_H,
            { x: VIEW_W - 64, y: 0, w: 56, h: ACH_H }, { color: new Color(162, 139, 85, 255) });

        // 地图入口
        const linkMap = localBox('LinkMap', content, m, VIEW_W, CONTENT_H, 0, LINK1_Y, VIEW_W, 56);
        localLabel(linkMap, m, 'LinkMapText', '查看我的巡逻地图', 12, VIEW_W, 56,
            { x: 0, y: 0, w: 240, h: 56 }, { color: PocketPalette.ink });
        localIcon(linkMap, m, 'LinkMapArrow', frames.arrow, VIEW_W, 56, VIEW_W - 24, 28, 19);
        linkMap.on(Node.EventType.TOUCH_END, cb.onLevels);

        // 清除记录入口
        const linkClear = localBox('LinkClear', content, m, VIEW_W, CONTENT_H, 0, LINK2_Y, VIEW_W, 56);
        localLabel(linkClear, m, 'LinkClearText', '清除本机游戏记录', 12, VIEW_W, 56,
            { x: 0, y: 0, w: 240, h: 56 }, { color: new Color(199, 100, 73, 255) });
        localIcon(linkClear, m, 'LinkReset', frames.reset, VIEW_W, 56, VIEW_W - 24, 28, 19);

        localLabel(content, m, 'Muted', '个人中心展示数据，不代表真实账号。', 10, VIEW_W, CONTENT_H,
            { x: 0, y: MUTED_Y, w: VIEW_W, h: 16 }, { color: PocketPalette.muted });

        const mask = scrollNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const scroll = scrollNode.addComponent(ScrollView);
        scroll.vertical = true;
        scroll.horizontal = false;
        scroll.inertia = true;
        scroll.brake = 0.75;
        scroll.content = content;

        // ── 底部再来一局 ──
        const play = makeButton(this.node, m, 'PlayButton', 24, 740, 366, 58,
            { normal: frames.btnPrimary, pressed: frames.btnPrimaryPressed, color: PocketPalette.orange, sliced: true });
        localLabel(play.node, m, 'PlayText', '再来一局', 18, 366, 58,
            { x: 0, y: 0, w: 300, h: 58 }, { color: PocketPalette.whiteish, bold: true });
        localIcon(play.node, m, 'PlayIcon', frames.play, 366, 58, 332, 29, 20);
        play.node.on(Node.EventType.TOUCH_END, cb.onPlay);
    }
}
