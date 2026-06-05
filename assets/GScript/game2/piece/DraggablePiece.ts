import { _decorator, Color, Component, EventTouch, input, Input, Intersection2D, Node, PolygonCollider2D, Sprite, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DraggablePiece')
export class DraggablePiece extends Component {

    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    private onTouchStart(event: EventTouch) {
        console.log('onTouchStart');
        if (!this.isTouchInsidePolygonCollider(event)) {
            console.log('触摸点不在多边形内');
            return;
        }
        console.log('触摸点在多边形内');
        
    }

    private onTouchMove(event: EventTouch) {
        console.log('onTouchMove');
    }

    private onTouchEnd(event: EventTouch) {
        console.log('onTouchEnd');
    }

    private onTouchCancel(event: EventTouch) {
        console.log('onTouchCancel');
    }

    isTouchInsidePolygonCollider(event: EventTouch): boolean {
        const collider = this.node.getComponent(PolygonCollider2D);
        // 有效性检查：组件存在、启用、顶点数量≥3（构成多边形）
        if (!collider || !collider.enabled || collider.points.length < 3) {
            return false;
        }

        // 1. 获取触摸点的世界坐标（UI坐标）
        const touchLocation = event.getUILocation();

        // 2. 将触摸点转换到当前节点的本地坐标系
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return false;
        const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchLocation.x, touchLocation.y, 0));

        // 3. 核心判断：点是否在多边形内部
        // 注意：collider.points 是 Vec2 数组，需要转换为 Vec2 进行比较
        return Intersection2D.pointInPolygon(new Vec2(localPos.x, localPos.y), collider.points);
    }

    public applyColorToChild(color: Color) {
        for (let child of this.node.children) {
            const sprite = child.getComponent(Sprite) || child.addComponent(Sprite);
            sprite.color = color;
        }
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    
}


