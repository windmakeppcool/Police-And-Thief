import { EventTouch, Node, UITransform, Vec3, tween } from 'cc';
import { cellKey, isInsideBoard, type BoardSize, type Coord, type PieceType, type Rotation, type ShapeCatalog } from '../domain/GameTypes';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { BaseGridView } from './BaseGridView';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
import { isTouchInsidePolygonCollider } from './PolygonHitTest';

/**
 * 可拖拽棋子的视图基类
 * 
 * 处理棋子的完整拖拽生命周期：
 * - 触摸开始时记录偏移量，将棋子提升到最上层
 * - 移动时跟随手指，检测是否发生有效位移
 * - 松开时判断落点是否在棋盘内，执行吸附或弹回动画
 * - 未发生位移时触发顺时针旋转
 * 
 * 子类需要实现放置验证和通知逻辑。
 */
export abstract class DraggablePieceViewBase extends BaseGridView {
    /** 所属形状的 ID */
    public shapeId: string = '';

    /** 棋盘节点引用，用于坐标转换 */
    public boardNode: Node | null = null;

    /** 棋盘网格视图引用 */
    public boardGridView: BoardGridView | null = null;

    /** 当前棋盘尺寸 */
    public board: BoardSize = { width: 6, height: 6 };

    /** 游戏会话引用，用于放置验证 */
    public session: GameSession | null = null;

    /** 形状目录，包含所有可用形状的定义 */
    public shapes: ShapeCatalog = {};

    /** 是否已放置到棋盘上 */
    public isPlaced: boolean = false;

    // === 拖拽状态私有变量 ===

    /** 触摸起点与棋子世界位置的偏移量 */
    private _dragOffset: Vec3 = new Vec3();

    /** 拖拽开始时的棋子位置（用于弹回） */
    private _startPos: Vec3 = new Vec3();

    /** 初始预设位置（未拖拽时的家位置） */
    private _homePos: Vec3 = new Vec3();

    /** 触摸开始时棋子的局部坐标 */
    private _touchStartLocalPos: Vec3 = new Vec3();

    /** 从根节点到形状原点的偏移量（受子节点包围盒影响） */
    private _rootToOriginOffset: Vec3 = new Vec3();

    /** 当前旋转角度：0 / 90 / 180 / 270 */
    private _rotation: Rotation = 0;

    /** 是否正在拖拽中 */
    private _isDragging: boolean = false;

    /** 拖拽过程中是否发生了超过阈值的位移 */
    private _hasMoved: boolean = false;

    // === 子类必须实现的抽象成员 ===

    /** 获取棋子类型（警察/建筑等） */
    protected abstract get pieceType(): PieceType;

    /** 获取棋子唯一标识 */
    protected abstract get pieceId(): string;

    /**
     * 从棋盘上移除此棋子
     * 子类实现：恢复库存、更新占用地图等
     */
    protected abstract unplacePiece(): void;

    /**
     * 验证在指定原点放置是否合法
     * @param origin 放置的原点坐标
     * @returns 是否允许放置
     */
    protected abstract isValidPlacement(origin: Coord): boolean;

    /**
     * 通知已成功放置到棋盘
     * @param origin 放置的原点坐标
     * @param rotation 当前旋转角度
     */
    protected abstract notifyPlaced(origin: Coord, rotation: Rotation): void;

    /**
     * 组件启用时：确保存在 UITransform，并刷新原点偏移量
     */
    protected onEnable(): void {
        this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        this.refreshRootToOriginOffsetFromChildren();
    }

    /**
     * 设置棋子的初始预设位置
     * @param pos 预设位置的 Vec3
     */
    public setHomePosition(pos: Vec3): void {
        this._homePos.set(pos);
    }

    /**
     * 检测触摸事件是否发生在本棋子范围内
     * 使用多边形碰撞检测（PolygonCollider）
     * @param event 触摸事件
     * @returns 是否包含该触摸点
     */
    public containsTouch(event: EventTouch): boolean {
        return isTouchInsidePolygonCollider(this.node, event.getUILocation());
    }

    // === 拖拽生命周期方法 ===

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
    public beginDrag(event: EventTouch): void {
        if (!this.boardNode) return;

        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;

        this.refreshRootToOriginOffsetFromChildren();
        this._isDragging = true;
        this._hasMoved = false;
        this._startPos.set(this.node.position);
        this._touchStartLocalPos.set(this.node.position);

        const touchPos = event.getUILocation();
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
    public moveDrag(event: EventTouch): void {
        if (!this._isDragging || !this.boardNode) return;

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
    public endDrag(event: EventTouch): void {
        if (!this._isDragging || !this.boardNode) return;
        this._isDragging = false;

        if (!this._hasMoved) {
            this.rotateClockwise();
            event.propagationStopped = true;
            return;
        }

        const grid = this.boardGridView;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardNode.getComponent(UITransform);
        if (!grid || !parentTransform || !boardTransform) {
            this.snapBack();
            return;
        }

        const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        const rootBoardLocalPos = boardTransform.convertToNodeSpaceAR(worldPos);
        const originBoardLocalPos = rootBoardLocalPos.add(this.getRotatedRootToOriginOffset());
        const origin = grid.localToBoard(originBoardLocalPos, this.board);

        if (!this.hasOverlapWithBoard()) {
            if (this.isPlaced) {
                this.unplacePiece();
                this.snapBack();
            }
            event.propagationStopped = true;
            return;
        }

        if (!this.isOriginInBoard(origin)) {
            if (this.isPlaced) {
                this.unplacePiece();
            }
            this.snapBack();
            event.propagationStopped = true;
            return;
        }

        if (this.session && this.isValidPlacement(origin)) {
            const snapBoardPos = grid.boardToLocal(origin, this.board).subtract(this.getRotatedRootToOriginOffset());
            const snapWorldPos = boardTransform.convertToWorldSpaceAR(snapBoardPos);
            this.node.setPosition(parentTransform.convertToNodeSpaceAR(snapWorldPos));
            this.isPlaced = true;
            this.notifyPlaced(origin, this._rotation);
        } else {
            this.snapBack();
        }

        event.propagationStopped = true;
    }

    /**
     * 拖拽取消（如触摸滑出屏幕边界）
     * 
     * 将棋子弹回起始位置，清除拖拽状态。
     * @param event 触摸取消事件
     */
    public cancelDrag(event: EventTouch): void {
        if (!this._isDragging) return;
        this._isDragging = false;
        this.snapBack();
        event.propagationStopped = true;
    }

    // === 旋转相关 ===

    /** 获取当前旋转角度 */
    protected get rotation(): Rotation {
        return this._rotation;
    }

    /** 旋转角度变化时的回调，子类可重写以更新外观 */
    protected onRotationChanged(): void { }

    /**
     * 根据子节点包围盒刷新原点偏移量
     * 
     * 遍历所有子节点，计算包围盒的最小 x/y，
     * 用于确定形状"锚点"在棋子中的相对位置。
     */
    private refreshRootToOriginOffsetFromChildren(): void {
        if (this.node.children.length === 0) return;

        let minX = Infinity;
        let minY = Infinity;

        for (const child of this.node.children) {
            const childTransform = child.getComponent(UITransform);
            if (!childTransform) continue;

            const size = childTransform.contentSize;
            const pos = child.position;
            minX = Math.min(minX, pos.x - size.width / 2);
            minY = Math.min(minY, pos.y - size.height / 2);
        }

        if (!Number.isFinite(minX)) return;
        this._rootToOriginOffset.set(minX + 32, minY + 32, 0);
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
        this.onRotationChanged();

        if (!this.isPlaced) return;
        const origin = this.getCurrentOrigin();
        if (origin && this.isValidPlacement(origin)) {
            this.notifyPlaced(origin, this._rotation);
        } else {
            this._rotation = this.previousRotation(this._rotation);
            this.node.angle = this._rotation;
            this.onRotationChanged();
        }
    }

    /**
     * 获取棋子当前放置的原点坐标
     * @returns 若无法计算（如引用缺失）则返回 null
     */
    private getCurrentOrigin(): Coord | null {
        const grid = this.boardGridView;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardNode?.getComponent(UITransform);
        if (!grid || !parentTransform || !boardTransform) return null;

        const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        const rootBoardLocalPos = boardTransform.convertToNodeSpaceAR(worldPos);
        return grid.localToBoard(rootBoardLocalPos.add(this.getRotatedRootToOriginOffset()), this.board);
    }

    /**
     * 根据当前旋转角度获取原点的偏移量
     * 
     * 旋转 90° 时交换 x/y 并调整符号，实现正确的坐标变换。
     * @returns 旋转后的偏移向量
     */
    private getRotatedRootToOriginOffset(): Vec3 {
        const x = this._rootToOriginOffset.x;
        const y = this._rootToOriginOffset.y;
        switch (this._rotation) {
            case 0:
                return new Vec3(x, y, 0);
            case 90:
                return new Vec3(-y, x, 0);
            case 180:
                return new Vec3(-x, -y, 0);
            case 270:
                return new Vec3(y, -x, 0);
        }
    }

    /**
     * 判断棋子是否与棋盘有视觉重叠
     * 
     * 通过检查所有占据格子是否在棋盘半尺寸范围内。
     * @returns 是否有任何格子落在棋盘内
     */
    private hasOverlapWithBoard(): boolean {
        const grid = this.boardGridView;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardNode?.getComponent(UITransform);
        if (!grid || !parentTransform || !boardTransform) return false;

        const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        const rootBoardLocalPos = boardTransform.convertToNodeSpaceAR(worldPos);
        const originBoardLocalPos = rootBoardLocalPos.add(this.getRotatedRootToOriginOffset());
        const origin = grid.localToBoard(originBoardLocalPos, this.board);

        const candidate = {
            id: 'overlap_check',
            shapeId: this.shapeId,
            type: this.pieceType,
            origin,
            rotation: this._rotation,
        };

        const cells = getAbsoluteCells(this.shapes, candidate);
        const halfW = this.board.width * grid.cellSize / 2;
        const halfH = this.board.height * grid.cellSize / 2;

        for (const cell of cells) {
            const localPos = grid.boardToLocal(cell, this.board);
            if (localPos.x >= -halfW && localPos.x <= halfW &&
                localPos.y >= -halfH && localPos.y <= halfH) {
                return true;
            }
        }
        return false;
    }

    /**
     * 验证在指定原点放置时，所有格子是否都在棋盘范围内
     * 
     * 与 hasOverlapWithBoard 不同，这里要求完整的形状都必须落在棋盘内。
     * @param origin 待验证的原点坐标
     * @returns 所有格子是否都在棋盘内
     */
    private isOriginInBoard(origin: Coord): boolean {
        const candidate = {
            id: 'candidate',
            shapeId: this.shapeId,
            type: this.pieceType,
            origin,
            rotation: this._rotation,
        };
        return getAbsoluteCells(this.shapes, candidate).every(cell => isInsideBoard(this.board, cell));
    }

    /**
     * 获取在指定原点放置时的绝对格子坐标列表
     * 
     * 供子类使用，用于碰撞检测、占用地图更新等。
     * @param origin 原点坐标
     * @returns 所有占据的格子坐标数组
     */
    protected candidateCells(origin: Coord): Coord[] {
        return getAbsoluteCells(this.shapes, {
            id: 'candidate',
            shapeId: this.shapeId,
            type: this.pieceType,
            origin,
            rotation: this._rotation,
        });
    }

    /**
     * 检查指定格子是否被占用（阻塞）
     * @param cell 格子坐标
     * @param blocked 被占用的格子集合（cellKey 格式）
     */
    protected isBlocked(cell: Coord, blocked: Set<string>): boolean {
        return blocked.has(cellKey(cell));
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
}
