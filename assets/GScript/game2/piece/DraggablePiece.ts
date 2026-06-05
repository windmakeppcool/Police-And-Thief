import { _decorator, Color, Component, EventTouch, input, Input, Intersection2D, Node, PolygonCollider2D, Sprite, tween, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DraggablePiece')
export class DraggablePiece extends Component {
    /** 是否激活 */
    private _active: boolean = false;
    /** 是否正在拖拽中 */
    private _isDragging: boolean = false;
    /** 拖拽过程中是否发生了超过阈值的位移 */
    private _hasMoved: boolean = false;
    /** 拖拽开始时的棋子位置（用于弹回） */
    private _startPos: Vec3 = new Vec3();
    /** 触摸起点与棋子世界位置的偏移量 */
    private _dragOffset: Vec3 = new Vec3();
    /** 触摸开始时棋子的局部坐标 */
    private _touchStartLocalPos: Vec3 = new Vec3();

    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /**
     * 开始拖拽
     * 
     * 1. 计算触摸点与棋子世界位置的偏移量
     * 2. 保存起始位置用于弹回
     * 3. 将棋子提升到最上层（SiblingIndex = 999）
     * 4. 阻止事件继续传播
     * 
     * @param event 触摸开始事件
     */
    private onTouchStart(event: EventTouch) {
        console.log('onTouchStart');
        if (!this.isTouchInsidePolygonCollider(event)) {
            console.log('触摸点不在多边形内');
            return;
        }
        console.log('触摸点在多边形内');
        this._active = true;
        // 开始拖拽
        this._isDragging = true;
        this._hasMoved = false;
        this._startPos.set(this.node.position);
        this._touchStartLocalPos.set(this.node.position);

        const touchPos = event.getUILocation();
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;
        const nodeWorldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        this._dragOffset.set(nodeWorldPos.x - touchPos.x, nodeWorldPos.y - touchPos.y, 0);

        this.node.setSiblingIndex(999);
        event.propagationStopped = true;
    }

    /**
     * 拖拽移动中
     * 
     * 根据触摸位置和初始偏移量计算新位置并移动棋子。
     * 若位移超过阈值（8像素），标记为已移动，用于区分点击旋转和实际拖拽。
     * 
     * @param event 触摸移动事件
     */
    private onTouchMove(event: EventTouch): void {
        console.log('onTouchMove');
        if (!this._isDragging || !this._active) return;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;

        const touchPos = event.getUILocation();
        const worldPos = new Vec3(touchPos.x + this._dragOffset.x, touchPos.y + this._dragOffset.y, 0);
        const localPos = parentTransform.convertToNodeSpaceAR(worldPos);
        if (Vec3.distance(localPos, this._touchStartLocalPos) > 8) {
            this._hasMoved = true;
        }
        this.node.setPosition(localPos);
        event.propagationStopped = true;
    }

    /**
     * 拖拽结束（手指抬起）
     * 
     * 处理逻辑：
     * 1. 若未发生位移 → 执行顺时针旋转
     * 2. 计算落点坐标，判断是否与棋盘有交集
     * 3. 判断原点是否在棋盘有效范围内
     * 4. 验证放置合法性，有效则吸附到网格，否则弹回
     * 
     * @param event 触摸结束事件
     */
    private onTouchEnd(event: EventTouch) {
        console.log('onTouchEnd');
        if (!this._isDragging || !this._active) return;
        
        if (!this._hasMoved) {
            // 未发生位移，执行顺时针旋转
            event.propagationStopped = true;
            return;
        }
        // const parentTransform = this.node.parent?.getComponent(UITransform);
        // const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        this._isDragging = false;
        this._active = false;
        this._hasMoved = false;
        event.propagationStopped = true;
    }

    private onTouchCancel(event: EventTouch) {
        console.log('onTouchCancel');
        if (!this._isDragging || !this._active) return;
        // 弹回棋子
        this.snapBack();
        event.propagationStopped = true;
        this._isDragging = false;
        this._active = false;
        this._hasMoved = false;
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

    /**
     * 弹回动画：将棋子移回拖拽开始时的位置
     * 
     * 使用 easeOut 缓动曲线，持续 0.2 秒。
     */
    private snapBack(): void {
        tween(this.node)
            .to(0.2, { position: this._startPos.clone() }, { easing: 'quadOut' })
            .start();
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


