import { Canvas, Layers, UITransform, Node } from "cc";

/** UI 层类型 */
export enum EViewLayer {
    /** 场景层 */
    Scene,
    /** 默认层 */
    UI,
    /** 引导层 */
    Guide,
    /** 表现层 */
    Anim,
    /** 切换层 */
    Transform,
    /** 转圈层、遮挡层 */
    Loading,
    /** 模态对话框 */
    Modal,
    /** 提示 */
    Toast,
}

export class MyLayer {
    public readonly node: Node;
    constructor(public readonly layer: EViewLayer,
                public readonly canvas: Canvas,
                name: string) {
        const node = this.node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        canvas.node.addChild(node);
    }
}

