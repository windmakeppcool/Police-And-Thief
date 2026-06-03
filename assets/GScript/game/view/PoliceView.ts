import { _decorator, Color, Component, EventTouch, instantiate, Node, Prefab, Size, Sprite, SpriteFrame, UITransform, Vec3, tween } from 'cc';
import { cellKey, isInsideBoard, PieceType, type BoardSize, type Coord, type PieceShape, type Rotation, type ShapeCatalog } from '../domain/GameTypes';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { buildOccupancy } from '../domain/BoardOccupancy';
import { BaseGridView } from './BaseGridView';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
import { PrefabsCfg } from '../../auto/PrefabCfg';
const { ccclass, property } = _decorator;

export type OnPolicePlacedCallback = (policeId: string, shapeId: string, origin: Coord, rotation: Rotation) => void;

export interface PoliceCreateOptions {
    session: GameSession;
    boardGridView: BoardGridView;
    parentNode: Node;
    trayX: number;
    spacing: number;
}

@ccclass('PoliceView')
export class PoliceView extends BaseGridView {
    private readonly POLICE_PREFAB_KEYS: (keyof typeof PrefabsCfg)[] = [
        'Police1UI',
        'Police2UI',
        'Police3UI',
        'Police4UI',
        'Police5UI',
        'Police6UI',
    ];

    private readonly SHAPE_IDS: string[] = [
        'police_001',
        'police_002',
        'police_003',
        'police_004',
        'police_005',
        'police_006',
    ];

    /** policeAt 标记颜色 - 金色/黄色用于高亮 */
    private readonly COLOR_POLICE_AT = new Color(250, 204, 21, 255); // 金黄
    /** 每个格子的像素大小（需与 BoardGridView.cellSize 对应） */
    public cellPixelSize: number = 64;

    @property(String) public shapeId: string = '';

    public boardNode: Node | null = null;
    public boardGridView: BoardGridView | null = null;
    public board: BoardSize = { width: 6, height: 6 };
    public session: GameSession | null = null;
    public shapes: ShapeCatalog = {};
    public onPlaced: OnPolicePlacedCallback | null = null;
    public policeId: string = '';
    public isPlaced: boolean = false;

    private _dragOffset: Vec3 = new Vec3();
    private _startPos: Vec3 = new Vec3();
    private _homePos: Vec3 = new Vec3();
    private _touchStartLocalPos: Vec3 = new Vec3();
    private _rootToOriginOffset: Vec3 = new Vec3();
    private _rotation: Rotation = 0;
    private _isDragging: boolean = false;
    private _hasMoved: boolean = false;
    /** policeAt 位置的高亮标记节点 */
    private _policeAtMarker: Node | null = null;

    public start(): void { }

    public update(deltaTime: number): void { }

    public setHomePosition(pos: Vec3): void {
        this._homePos.set(pos);
    }

    protected onEnable(): void {
        this.ensureInteractiveArea();
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private ensureInteractiveArea(): void {
        const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        if (this.node.children.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const child of this.node.children) {
            const childTransform = child.getComponent(UITransform);
            if (!childTransform) continue;

            const size = childTransform.contentSize;
            const pos = child.position;
            minX = Math.min(minX, pos.x - size.width / 2);
            maxX = Math.max(maxX, pos.x + size.width / 2);
            minY = Math.min(minY, pos.y - size.height / 2);
            maxY = Math.max(maxY, pos.y + size.height / 2);
        }

        if (!Number.isFinite(minX)) return;

        // 使用关于根节点对称的热区，确保旋转前后每个可见格子都能被点中拖动
        const hitWidth = Math.max(Math.abs(minX), Math.abs(maxX)) * 2;
        const hitHeight = Math.max(Math.abs(minY), Math.abs(maxY)) * 2;
        transform.setAnchorPoint(0.5, 0.5);
        transform.setContentSize(new Size(hitWidth, hitHeight));
        this._rootToOriginOffset.set(minX + 32, minY + 32, 0);
    }

    private onTouchStart(event: EventTouch): void {
        if (!this.boardNode) return;

        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;

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

    private onTouchMove(event: EventTouch): void {
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

    private onTouchEnd(event: EventTouch): void {
        if (!this._isDragging || !this.boardNode) return;
        this._isDragging = false;

        // 点击未移动 → 旋转
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
        const origin = this.boardLocalToCoord(originBoardLocalPos, grid);

        // 棋子与棋盘没有任何交集
        if (!this.hasOverlapWithBoard()) {
            if (this.isPlaced) {
                this.unplacePolice();
                this.snapBack();
            }
            event.propagationStopped = true;
            return;
        }

        // 坐标越界
        if (!this.isOriginInBoard(origin)) {
            if (this.isPlaced) {
                this.unplacePolice();
                this.snapBack();
            } else {
                this.snapBack();
            }
            event.propagationStopped = true;
            return;
        }

        // 尝试放置
        if (this.session && this.isValidPlacement(origin)) {
            const snapBoardPos = grid.boardToLocal(origin, this.board).subtract(this.getRotatedRootToOriginOffset());
            const snapWorldPos = boardTransform.convertToWorldSpaceAR(snapBoardPos);
            this.node.setPosition(parentTransform.convertToNodeSpaceAR(snapWorldPos));
            this.isPlaced = true;
            this.onPlaced?.(this.policeId, this.shapeId, origin, this._rotation);
        } else {
            this.snapBack();
        }

        event.propagationStopped = true;
    }

    private rotateClockwise(): void {
        this._rotation = this.nextRotation(this._rotation);
        this.node.angle = this._rotation;
        this.ensureInteractiveArea();
        this.updatePoliceAtMarkerRotation();

        if (!this.isPlaced) return;
        const origin = this.getCurrentOrigin();
        if (origin && this.isValidPlacement(origin)) {
            this.onPlaced?.(this.policeId, this.shapeId, origin, this._rotation);
        } else {
            this._rotation = this.previousRotation(this._rotation);
            this.node.angle = this._rotation;
            this.ensureInteractiveArea();
            this.updatePoliceAtMarkerRotation();
        }
    }

    private getCurrentOrigin(): Coord | null {
        const grid = this.boardGridView;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardNode?.getComponent(UITransform);
        if (!grid || !parentTransform || !boardTransform) return null;

        const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        const rootBoardLocalPos = boardTransform.convertToNodeSpaceAR(worldPos);
        return this.boardLocalToCoord(rootBoardLocalPos.add(this.getRotatedRootToOriginOffset()), grid);
    }

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

    private boardLocalToCoord(pos: Vec3, grid: BoardGridView): Coord {
        const left = -((this.board.width - 1) * grid.cellSize) / 2;
        const bottom = -((this.board.height - 1) * grid.cellSize) / 2;
        return {
            x: Math.round((pos.x - left) / grid.cellSize),
            y: Math.round((pos.y - bottom) / grid.cellSize),
        };
    }

    /** 检查棋子的任意格子是否与棋盘区域有交集 */
    private hasOverlapWithBoard(): boolean {
        const grid = this.boardGridView;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardNode?.getComponent(UITransform);
        if (!grid || !parentTransform || !boardTransform) return false;

        const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        const rootBoardLocalPos = boardTransform.convertToNodeSpaceAR(worldPos);
        const originBoardLocalPos = rootBoardLocalPos.add(this.getRotatedRootToOriginOffset());
        const origin = this.boardLocalToCoord(originBoardLocalPos, grid);

        const candidate = {
            id: 'overlap_check',
            shapeId: this.shapeId,
            type: PieceType.Police,
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

    private isOriginInBoard(origin: Coord): boolean {
        const candidate = {
            id: 'candidate',
            shapeId: this.shapeId,
            type: PieceType.Police,
            origin,
            rotation: this._rotation,
        };
        return getAbsoluteCells(this.shapes, candidate).every(cell => isInsideBoard(this.board, cell));
    }

    private unplacePolice(): void {
        this.session?.removePolice(this.policeId);
        this.isPlaced = false;
    }

    private isValidPlacement(origin: Coord): boolean {
        if (!this.session) return false;

        const level = this.session.getLevel();
        const candidate = {
            id: 'candidate',
            shapeId: this.shapeId,
            type: PieceType.Police,
            origin,
            rotation: this._rotation,
        };

        const candidateCells = getAbsoluteCells(this.shapes, candidate);
        for (const cell of candidateCells) {
            if (!isInsideBoard(this.board, cell)) return false;
            if (cell.x === level.thief.x && cell.y === level.thief.y) return false;
        }

        const allPieces = [
            ...level.buildings,
            ...this.session.getPlacedStructures(),
            ...this.session.getPlacedPolice().filter(p => p.id !== this.policeId),
        ];
        const occupancy = buildOccupancy(this.shapes, allPieces);
        for (const cell of candidateCells) {
            if (occupancy.blocked.has(cellKey(cell))) return false;
        }

        // 检查库存上限
        const inventoryItem = level.policeInventory.find(item => item.shapeId === this.shapeId);
        if (inventoryItem) {
            const usedCount = this.session.getPlacedPolice()
                .filter(p => p.shapeId === this.shapeId && p.id !== this.policeId).length;
            if (usedCount >= inventoryItem.count) return false;
        }

        return true;
    }

    private nextRotation(rotation: Rotation): Rotation {
        if (rotation === 0) return 90;
        if (rotation === 90) return 180;
        if (rotation === 180) return 270;
        return 0;
    }

    private previousRotation(rotation: Rotation): Rotation {
        if (rotation === 0) return 270;
        if (rotation === 90) return 0;
        if (rotation === 180) return 90;
        return 180;
    }

    private snapBack(): void {
        tween(this.node)
            .to(0.2, { position: this._startPos.clone() }, { easing: 'quadOut' })
            .start();
    }

    public async createPolicePieces(
        options: PoliceCreateOptions,
        onPlaced?: OnPolicePlacedCallback
    ): Promise<PoliceView[]> {
        const { session, boardGridView, parentNode, trayX, spacing } = options;

        const policePieces: PoliceView[] = [];
        const positions = [
            new Vec3(320, 200, 0),
            new Vec3(520, 200, 0),
            new Vec3(320, -90, 0),
            new Vec3(520, -90, 0),
            new Vec3(420, 380, 0),
            new Vec3(420, -280, 0),
        ];

        for (let i = 0; i < this.POLICE_PREFAB_KEYS.length; i++) {
            const prefabKey = this.POLICE_PREFAB_KEYS[i];
            const shapeId = this.SHAPE_IDS[i];

            const draggable = await this.createSinglePolice({
                policeId: `police_${i + 1}`,
                prefabKey,
                shapeId,
                session,
                boardGridView,
                parentNode,
                homePos: positions[i] ?? new Vec3(trayX, 0, 0),
            });

            if (draggable) {
                draggable.onPlaced = onPlaced ?? null;
                policePieces.push(draggable);
            }
        }

        return policePieces;
    }

    public async createSinglePolice(params: {
        policeId: string;
        prefabKey: keyof typeof PrefabsCfg;
        shapeId: string;
        session: GameSession;
        boardGridView: BoardGridView;
        parentNode: Node;
        homePos: Vec3;
    }): Promise<PoliceView | null> {
        const {
            policeId,
            prefabKey,
            shapeId,
            session,
            boardGridView,
            parentNode,
            homePos,
        } = params;

        const bUrl = PrefabsCfg[prefabKey];
        const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
        if (!prefab) {
            console.error(`[PoliceView] 加载预制体失败: ${prefabKey}`);
            return null;
        }

        const node = instantiate(prefab);

        const draggable = node.addComponent(PoliceView);

        draggable.policeId = policeId;
        draggable.shapeId = shapeId;
        draggable.boardNode = boardGridView.node;
        draggable.boardGridView = boardGridView;
        draggable.board = session.getLevel().board;
        draggable.session = session;
        draggable.shapes = session.getShapes();

        node.parent = parentNode;
        node.setPosition(homePos);
        draggable.setHomePosition(homePos);

        // draggable.cellPixelSize = boardGridView.cellSize;

        // draggable.createPoliceAtMarker();
        this.applyColorToChildren(node, this.COLOR_POLICE);
        return draggable;
    }

    public getPolicePrefabsCount(): number {
        return this.POLICE_PREFAB_KEYS.length;
    }

    /**
     * 创建 policeAt 位置的高亮标记
     * 在棋子的 policeAt 对应的格子处显示一个金色圆点/菱形指示器
     */
    private createPoliceAtMarker(): void {
        if (!this.shapeId || !this.shapes[this.shapeId]) return;

        const shape: PieceShape = this.shapes[this.shapeId];
        if (shape.policeAt === undefined) return;

        // 如果已存在则销毁
        if (this._policeAtMarker) {
            this._policeAtMarker.destroy();
            this._policeAtMarker = null;
        }

        // 从 prefabChildren（或 cells）获取对应索引的坐标
        const coordArray = shape.prefabChildren ?? shape.cells;
        if (!coordArray || shape.policeAt >= coordArray.length) return;

        const policeCoord = coordArray[shape.policeAt];
        // 计算在棋子本地坐标系中的像素位置
        // Cocos Y轴向下，所以 y 需要取反
        const markerX = policeCoord.x * this.cellPixelSize;
        const markerY = -policeCoord.y * this.cellPixelSize;

        // 创建高亮节点（金色菱形形状）
        const markerNode = new Node('policeAt_marker');
        markerNode.parent = this.node;

        const transform = markerNode.addComponent(UITransform);
        // 标记大小为格子大小的 40%
        const markerSize = Math.floor(this.cellPixelSize * 0.4);
        transform.setContentSize(markerSize, markerSize);
        transform.setAnchorPoint(0.5, 0.5);

        const sprite = markerNode.addComponent(Sprite);
        sprite.color = this.COLOR_POLICE_AT;
        // 如果有白色精灵帧就用它，否则需要确保有这个资源
        if (this.whiteFrame) {
            sprite.spriteFrame = this.whiteFrame;
        } else {
            console.warn(`[PoliceView] whiteFrame 未设置，policeAt 标记可能无法正确渲染`);
        }

        markerNode.setPosition(markerX, markerY, 1); // z=1 确保在最上层
        this._policeAtMarker = markerNode;
    }

    /** 更新 policeAt 标记的旋转位置（当棋子旋转时调用） */
    private updatePoliceAtMarkerRotation(): void {
        if (!this._policeAtMarker) return;

        if (!this.shapeId || !this.shapes[this.shapeId]) return;
        const shape: PieceShape = this.shapes[this.shapeId];
        if (shape.policeAt === undefined) return;

        // 从 prefabChildren（或 cells）获取对应索引的坐标
        const coordArray = shape.prefabChildren ?? shape.cells;
        if (!coordArray || shape.policeAt >= coordArray.length) return;

        // 获取原始 policeAt 位置的坐标并顺时针旋转
        let rx = coordArray[shape.policeAt].x;
        let ry = coordArray[shape.policeAt].y;
        for (let r = 0; r < this._rotation; r += 90) {
            const nx = -ry;
            const ny = rx;
            rx = nx;
            ry = ny;
        }

        // Cocos Y轴向下，所以 y 需要取反
        this._policeAtMarker.setPosition(rx * this.cellPixelSize, -ry * this.cellPixelSize, 1);
    }
}
