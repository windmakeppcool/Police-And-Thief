import { Color, HorizontalTextAlignment, Label, Layers, Node, Sprite, SpriteFrame, UITransform, Vec3, VerticalTextAlignment } from 'cc';

export type Size2 = { width: number; height: number };

/** 创建节点并统一设置 UI_2D 层与可点击区域 */
export function createNode(name: string, parent: Node, size?: Size2, position?: Vec3): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    const transform = node.addComponent(UITransform);
    if (size) transform.setContentSize(size.width, size.height);
    if (position) node.setPosition(position);
    node.parent = parent;
    return node;
}

/** 设置节点尺寸（不存在 UITransform 时自动补上） */
export function setSize(node: Node, size: Size2): void {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(size.width, size.height);
}


/** 九宫格拉伸所需的边框宽度（略小于设计稿圆角，避免拉伸变形） */
export function applyInsets(frame: SpriteFrame | null, inset: number): void {
    if (!frame) return;
    frame.insetLeft = inset;
    frame.insetRight = inset;
    frame.insetTop = inset;
    frame.insetBottom = inset;
}

export type SpriteOptions = {
    size?: Size2;
    color?: Color;
    /** 九宫格拉伸，配合 size 使用可保持圆角不变形 */
    sliced?: boolean;
};

/** 添加精灵；frame 为空时保留空精灵，避免调用方到处判空 */
export function addSprite(node: Node, frame: SpriteFrame | null, options: SpriteOptions = {}): Sprite {
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    sprite.spriteFrame = frame;
    if (options.color) sprite.color = options.color;
    if (options.sliced) sprite.type = Sprite.Type.SLICED;
    if (options.size) setSize(node, options.size);
    return sprite;
}


export type LabelOptions = {
    size?: Size2;
    /**
     * 文字颜色，必填。core 层不绑定业务配色，由调用方显式指定，
     * 避免漏传时文字在浅色背景上不可见。
     */
    color: Color;
    bold?: boolean;
    align?: HorizontalTextAlignment;
    verticalAlign?: VerticalTextAlignment;
    lineHeight?: number;
};

export function addLabel(node: Node, text: string, fontSize: number, options: LabelOptions): Label {
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    // 使用系统字体，保证中文 / CJK 字符不会被默认内置字体渲染成「豆腐块」或乱码；
    // 不指定自定义 font 资源，运行时按平台回退到 微软雅黑 / 苹方 / 思源黑体 等系统字体。
    label.useSystemFont = true;
    label.lineHeight = options.lineHeight ?? Math.round(fontSize * 1.3);
    label.color = options.color;
    label.isBold = options.bold ?? false;
    label.horizontalAlign = options.align ?? Label.HorizontalAlign.CENTER;
    label.verticalAlign = options.verticalAlign ?? Label.VerticalAlign.CENTER;
    label.overflow = options.size ? Label.Overflow.CLAMP : Label.Overflow.NONE;
    label.enableWrapText = false;
    if (options.size) setSize(node, options.size);
    return label;
}

/** 创建带文字的标签节点 */
export function createLabel(parent: Node, name: string, text: string, fontSize: number, options: LabelOptions, position?: Vec3): Node {
    const node = createNode(name, parent, options.size, position);
    addLabel(node, text, fontSize, options);
    return node;
}
