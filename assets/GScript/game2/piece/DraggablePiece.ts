import { _decorator, Color, Component, EventTouch, input, Input, Intersection2D, Node, PolygonCollider2D, Sprite, tween, UITransform, Vec2, Vec3, Rect } from 'cc';
import { Rotation } from '../common/GameTypes';
import { BoardGrid } from './BoardGrid';
const { ccclass, property } = _decorator;

@ccclass('DraggablePiece')
export class DraggablePiece extends Component {
    private static activePiece: DraggablePiece | null = null;

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
    /** 当前旋转角度：0 / 90 / 180 / 270 */
    private _rotation: Rotation = 0;
    private _boardGrid: BoardGrid | null = null;

    public initBoardGrid(boardGrid: BoardGrid): void {
        this._boardGrid = boardGrid;
    }

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
        if (DraggablePiece.activePiece) return;

        if (!this.isTopHitPiece(event)) {
            return;
        }
        console.log('触摸点在多边形内');
        DraggablePiece.activePiece = this;
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
            this.rotateClockwise();
            this._isDragging = false;
            this._active = false;
            DraggablePiece.activePiece = null;
            event.propagationStopped = true;
            return;
        }
        if (this.isTouchingBoard()) {
            if (!this.snapToBoard()) {
                this.snapBack();
            }
        } else if (this.shouldSnapBack()) {
            this.snapBack();
        }
        this._isDragging = false;
        this._active = false;
        this._hasMoved = false;
        DraggablePiece.activePiece = null;
        event.propagationStopped = true;
    }

    private shouldSnapBack(): boolean {
        return !this.isInsideParentBounds() || this.isTouchingOtherPiece();
    }

    private snapToBoard(): boolean {
        if (!this._boardGrid) return false;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this._boardGrid.node.getComponent(UITransform);
        if (!parentTransform || !boardTransform) return false;

        const anchor = this.getClosestChildToBoardCell();
        if (!anchor) return false;

        const targetWorldPos = boardTransform.convertToWorldSpaceAR(this._boardGrid.cellToLocal(anchor.coord));
        const targetParentPos = parentTransform.convertToNodeSpaceAR(targetWorldPos);
        const offset = targetParentPos.subtract(anchor.parentPos);
        const nextPos = this.node.position.clone().add(offset);
        const oldPos = this.node.position.clone();
        this.node.setPosition(nextPos);

        if (!this.isAllCellsInsideBoard() || this.isTouchingOtherPiece()) {
            this.node.setPosition(oldPos);
            return false;
        }

        return true;
    }

    private getClosestChildToBoardCell(): { parentPos: Vec3, coord: { x: number, y: number } } | null {
        if (!this._boardGrid) return null;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this._boardGrid.node.getComponent(UITransform);
        if (!parentTransform || !boardTransform) return null;

        let closest: { parentPos: Vec3, coord: { x: number, y: number }, distance: number } | null = null;

        for (const child of this.node.children) {
            const childWorldPos = child.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(child.position);
            const boardLocalPos = boardTransform.convertToNodeSpaceAR(childWorldPos);
            const coord = this._boardGrid.localToCell(boardLocalPos);
            const cellLocalPos = this._boardGrid.cellToLocal(coord);
            const distance = Vec3.distance(boardLocalPos, cellLocalPos);
            const parentPos = parentTransform.convertToNodeSpaceAR(childWorldPos);

            if (!closest || distance < closest.distance) {
                closest = { parentPos, coord, distance };
            }
        }

        return closest;
    }

    private isAllCellsInsideBoard(): boolean {
        if (!this._boardGrid) return false;
        const boardTransform = this._boardGrid.node.getComponent(UITransform);
        if (!boardTransform) return false;

        for (const child of this.node.children) {
            const childWorldPos = child.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(child.position);
            const boardLocalPos = boardTransform.convertToNodeSpaceAR(childWorldPos);
            const coord = this._boardGrid.localToCell(boardLocalPos);
            const cellLocalPos = this._boardGrid.cellToLocal(coord);
            if (!this._boardGrid.isValidCoord(coord) || this._boardGrid.isBlockedByThief(coord) || Vec3.distance(boardLocalPos, cellLocalPos) > 1) {
                return false;
            }
        }

        return true;
    }

    private isTopHitPiece(event: EventTouch): boolean {
        if (!this.isTouchInsidePolygonCollider(event)) return false;
        const siblings = this.node.parent?.children ?? [];

        for (let i = siblings.length - 1; i >= 0; i--) {
            const siblingPiece = siblings[i].getComponent(DraggablePiece);
            if (!siblingPiece) continue;
            if (siblingPiece.isTouchInsidePolygonCollider(event)) {
                return siblingPiece === this;
            }
        }

        return false;
    }

    private isInsideParentBounds(): boolean {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return true;

        const parentSize = parentTransform.contentSize;
        if (parentSize.width <= 0 || parentSize.height <= 0) return true;

        const parentRect = new Rect(-parentSize.width / 2, -parentSize.height / 2, parentSize.width, parentSize.height);
        const pieceRect = this.getPieceRectInParent();
        return parentRect.containsRect(pieceRect);
    }

    private getPieceRectInParent(): Rect {
        const childRects = this.getChildRectsInParent();
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const rect of childRects) {
            minX = Math.min(minX, rect.xMin);
            minY = Math.min(minY, rect.yMin);
            maxX = Math.max(maxX, rect.xMax);
            maxY = Math.max(maxY, rect.yMax);
        }

        if (!Number.isFinite(minX)) {
            return new Rect(this.node.position.x, this.node.position.y, 0, 0);
        }

        return new Rect(minX, minY, maxX - minX, maxY - minY);
    }

    private getChildRectsInParent(): Rect[] {
        const parentTransform = this.node.parent!.getComponent(UITransform)!;
        const rects: Rect[] = [];

        for (const child of this.node.children) {
            const childTransform = child.getComponent(UITransform);
            if (!childTransform) continue;

            const childWorldPos = child.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(child.position);
            const childParentPos = parentTransform.convertToNodeSpaceAR(childWorldPos);
            const halfWidth = childTransform.contentSize.width / 2;
            const halfHeight = childTransform.contentSize.height / 2;
            rects.push(new Rect(childParentPos.x - halfWidth, childParentPos.y - halfHeight, childTransform.contentSize.width, childTransform.contentSize.height));
        }

        return rects;
    }

    private isTouchingBoard(): boolean {
        if (!this._boardGrid) return false;

        const boardTransform = this._boardGrid.node.getComponent(UITransform);
        if (!boardTransform) return false;

        const boardRect = this.getBoardRectInPieceParent();
        const pieceRect = this.getPieceRectInParent();
        return boardRect.intersects(pieceRect);
    }

    private isTouchingOtherPiece(): boolean {
        const siblings = this.node.parent?.children ?? [];
        const childRects = this.getChildRectsInParent();

        for (const sibling of siblings) {
            if (sibling === this.node) continue;
            const siblingPiece = sibling.getComponent(DraggablePiece);
            if (!siblingPiece) continue;
            const siblingChildRects = siblingPiece.getChildRectsInParent();
            for (const rect of childRects) {
                for (const siblingRect of siblingChildRects) {
                    if (this.isRectOverlapping(rect, siblingRect)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private isRectOverlapping(a: Rect, b: Rect): boolean {
        return a.xMin < b.xMax && a.xMax > b.xMin && a.yMin < b.yMax && a.yMax > b.yMin;
    }

    private getBoardRectInPieceParent(): Rect {
        const parentTransform = this.node.parent!.getComponent(UITransform)!;
        const boardTransform = this._boardGrid!.node.getComponent(UITransform)!;
        const half = this._boardGrid!.gridSize / 2;
        const minBoardLocal = this._boardGrid!.cellToLocal({ x: -half, y: -half });
        const maxBoardLocal = this._boardGrid!.cellToLocal({ x: half - 1, y: half - 1 });
        const halfCellSize = this._boardGrid!.cellSize / 2;
        const bottomLeftWorld = boardTransform.convertToWorldSpaceAR(new Vec3(minBoardLocal.x - halfCellSize, minBoardLocal.y - halfCellSize, 0));
        const topRightWorld = boardTransform.convertToWorldSpaceAR(new Vec3(maxBoardLocal.x + halfCellSize, maxBoardLocal.y + halfCellSize, 0));
        const bottomLeft = parentTransform.convertToNodeSpaceAR(bottomLeftWorld);
        const topRight = parentTransform.convertToNodeSpaceAR(topRightWorld);

        return new Rect(bottomLeft.x, bottomLeft.y, topRight.x - bottomLeft.x, topRight.y - bottomLeft.y);
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
        DraggablePiece.activePiece = null;
    }

    /** 获取当前旋转角度 */
    protected get rotation(): Rotation {
        return this._rotation;
    }

    /**
     * 执行顺时针旋转
     * 
     * 更新旋转角度并应用到节点。
     * 若棋子已放置在新位置，还需验证旋转后是否仍为有效放置，
     * 无效则回退到之前的旋转。
     */
    private rotateClockwise(): void {
        this._rotation = this.nextRotation(this._rotation);
        this.node.angle = this._rotation;
    }

    /** 获取下一旋转角度 (0→90→180→270→0) */
    private nextRotation(rotation: Rotation): Rotation {
        if (rotation === 0) return 90;
        if (rotation === 90) return 180;
        if (rotation === 180) return 270;
        return 0;
    }

    /** 获取上一旋转角度 (0←90←180←270←0) */
    private previousRotation(rotation: Rotation): Rotation {
        if (rotation === 0) return 270;
        if (rotation === 90) return 0;
        if (rotation === 180) return 90;
        return 180;
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


