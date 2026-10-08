import { Color, HorizontalTextAlignment, Node, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { G_VIEW_SIZE } from '../../core/ui/UIManager';
import { DesignFrames, PocketPalette } from './DesignAssets';
import { addLabel, addSprite, createNode, type Size2 } from './UIFactory';

/** 设计稿基准尺寸（pocket-patrol.html 中 .app 的 414×820） */
export const DESIGN_W = 414;
export const DESIGN_H = 820;

export type MenuMetrics = {
    /** 设计稿 px → 渲染 px 的等比缩放因子 */
    sx: number;
    width: number;
    height: number;
};

/** 等比缩放并居中：无论屏幕比例如何，414×820 的版式都能完整显示 */
export function computeMenuMetrics(): MenuMetrics {
    const sx = Math.min(G_VIEW_SIZE.width / DESIGN_W, G_VIEW_SIZE.height / DESIGN_H);
    return { sx, width: DESIGN_W * sx, height: DESIGN_H * sx };
}

/** 设计稿左上角坐标 (x,y) 的矩形中心，换算为容器内本地坐标（y 向上） */
export function boxCenter(m: MenuMetrics, x: number, y: number, w: number, h: number): Vec3 {
    return new Vec3((x + w / 2 - DESIGN_W / 2) * m.sx, (DESIGN_H / 2 - y - h / 2) * m.sx, 0);
}

export function boxSize(m: MenuMetrics, w: number, h: number): Size2 {
    return { width: w * m.sx, height: h * m.sx };
}

/** 创建一个以设计稿左上角 (x,y) 定位的矩形节点 */
export function box(name: string, parent: Node, m: MenuMetrics, x: number, y: number, w: number, h: number): Node {
    return createNode(name, parent, boxSize(m, w, h), boxCenter(m, x, y, w, h));
}

/** 设计稿字号换算为渲染字号 */
export function fontPx(m: MenuMetrics, px: number): number {
    return Math.round(px * m.sx);
}

/** 在设计稿矩形区域内放置文字 */
export function labelInBox(
    parent: Node, m: MenuMetrics, name: string, text: string, fontSize: number,
    rect: { x: number; y: number; w: number; h: number },
    options: {
        color?: Color;
        bold?: boolean;
        align?: HorizontalTextAlignment;
        lineHeight?: number;
    } = {},
): Node {
    const node = createNode(name, parent, boxSize(m, rect.w, rect.h), boxCenter(m, rect.x, rect.y, rect.w, rect.h));
    addLabel(node, text, fontPx(m, fontSize), {
        size: boxSize(m, rect.w, rect.h),
        color: options.color ?? PocketPalette.ink,
        bold: options.bold,
        align: options.align,
        lineHeight: options.lineHeight ? fontPx(m, options.lineHeight) : undefined,
    });
    return node;
}

/** 以设计稿中心点 (cx,cy) 放置方形图标 */
export function iconAt(
    parent: Node, m: MenuMetrics, nodeName: string, frame: SpriteFrame | null,
    cx: number, cy: number, size: number, color?: Color,
): Node {
    const node = createNode(nodeName, parent, boxSize(m, size, size),
        new Vec3((cx - DESIGN_W / 2) * m.sx, (DESIGN_H / 2 - cy) * m.sx, 0));
    addSprite(node, frame, { size: boxSize(m, size, size), color });
    return node;
}

// ── 局部坐标版：父节点本身已由全局坐标定位，子元素按父级设计稿局部坐标摆放 ──
// 父节点设计尺寸为 (pw,ph)，原点在父节点中心，x 向右、y 向上。

/** 在尺寸为 pw×ph 的父节点内，按局部左上角 (x,y) 放置矩形 */
export function localBox(
    name: string, parent: Node, m: MenuMetrics,
    pw: number, ph: number, x: number, y: number, w: number, h: number,
): Node {
    return createNode(name, parent, boxSize(m, w, h),
        new Vec3((x + w / 2 - pw / 2) * m.sx, (ph / 2 - y - h / 2) * m.sx, 0));
}

/** 在尺寸为 pw×ph 的父节点内，按局部中心点 (cx,cy) 放置方形图标 */
export function localIcon(
    parent: Node, m: MenuMetrics, nodeName: string, frame: SpriteFrame | null,
    pw: number, ph: number, cx: number, cy: number, size: number, color?: Color,
): Node {
    const node = createNode(nodeName, parent, boxSize(m, size, size),
        new Vec3((cx - pw / 2) * m.sx, (ph / 2 - cy) * m.sx, 0));
    addSprite(node, frame, { size: boxSize(m, size, size), color });
    return node;
}

/** 在尺寸为 pw×ph 的父节点内，按局部矩形放置文字 */
export function localLabel(
    parent: Node, m: MenuMetrics, name: string, text: string, fontSize: number,
    pw: number, ph: number, rect: { x: number; y: number; w: number; h: number },
    options: {
        color?: Color;
        bold?: boolean;
        align?: HorizontalTextAlignment;
        lineHeight?: number;
    } = {},
): Node {
    const node = createNode(name, parent, boxSize(m, rect.w, rect.h),
        new Vec3((rect.x + rect.w / 2 - pw / 2) * m.sx, (ph / 2 - rect.y - rect.h / 2) * m.sx, 0));
    addLabel(node, text, fontPx(m, fontSize), {
        size: boxSize(m, rect.w, rect.h),
        color: options.color ?? PocketPalette.ink,
        bold: options.bold,
        align: options.align,
        lineHeight: options.lineHeight ? fontPx(m, options.lineHeight) : undefined,
    });
    return node;
}

export type ButtonSkin = {
    normal: SpriteFrame | null;
    pressed?: SpriteFrame | null;
    color?: Color;
    sliced?: boolean;
};

/**
 * 带触摸态的按钮：按下切换贴图。返回节点与精灵，便于继续添加文字/图标。
 * 坐标按设计稿左上角 (x,y) 给定。
 */
export function makeButton(
    parent: Node, m: MenuMetrics, nodeName: string,
    x: number, y: number, w: number, h: number, skin: ButtonSkin,
): { node: Node; sprite: Sprite } {
    const node = box(nodeName, parent, m, x, y, w, h);
    const sprite = addSprite(node, skin.normal, { size: boxSize(m, w, h), color: skin.color, sliced: skin.sliced });
    const pressedFrame = skin.pressed ?? skin.normal;
    // 设计稿 button 过渡：200ms 内缩小到 0.96，松手/取消时回弹
    const pressDown = (): void => {
        sprite.spriteFrame = pressedFrame;
        tween(node).stop();
        tween(node).to(0.2, { scale: new Vec3(0.96, 0.96, 1) }).start();
    };
    const release = (): void => {
        sprite.spriteFrame = skin.normal;
        tween(node).stop();
        tween(node).to(0.2, { scale: new Vec3(1, 1, 1) }).start();
    };
    node.on(Node.EventType.TOUCH_START, pressDown);
    node.on(Node.EventType.TOUCH_END, release);
    node.on(Node.EventType.TOUCH_CANCEL, release);
    return { node, sprite };
}

/** 顶部 / 关卡页通用的星星计数胶囊：底板 + 星标 + 数字 */
export function buildStarCounter(
    parent: Node, m: MenuMetrics, frames: DesignFrames,
    x: number, y: number, w: number, h: number, stars: number,
): Node {
    const node = box('StarCounter', parent, m, x, y, w, h);
    addSprite(node, frames.starCounter, { size: boxSize(m, w, h), sliced: true });
    localIcon(node, m, 'StarIcon', frames.starActive, w, h, 15, h / 2, 21);
    localLabel(node, m, 'StarNum', `${stars}`, 14, w, h,
        { x: 24, y: 0, w: w - 30, h }, { color: PocketPalette.ink, bold: true });
    return node;
}
