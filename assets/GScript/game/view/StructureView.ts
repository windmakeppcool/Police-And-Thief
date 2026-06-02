import { _decorator, Color, Component, EventTouch, instantiate, Node, Prefab, Size, UITransform, Vec3, tween } from 'cc';
import { cellKey, isInsideBoard, PieceType, type BoardSize, type Coord, type Rotation, type ShapeCatalog } from '../domain/GameTypes';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { buildOccupancy } from '../domain/BoardOccupancy';
import { BaseGridView } from './BaseGridView';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
import { PrefabsCfg } from '../../auto/PrefabCfg';
const { ccclass, property } = _decorator;

export type OnPlacedCallback = (structureId: string, shapeId: string, origin: Coord, rotation: Rotation) => void;

export interface StructureCreateOptions {
    session: GameSession;
    boardGridView: BoardGridView;
    parentNode: Node;
    trayX: number;
    spacing: number;
}

@ccclass('StructureView')
export class StructureView extends BaseGridView {
    private readonly STRUCTURE_PREFAB_KEYS: (keyof typeof PrefabsCfg)[] = [
        'Structure1UI',
        'Structure2UI',
        'Structure3UI',
        'Structure4UI',
    ];

    @property(String) public shapeId: string = '';

    public boardNode: Node | null = null;
    public boardGridView: BoardGridView | null = null;
    public board: BoardSize = { width: 6, height: 6 };
    public session: GameSession | null = null;
    public shapes: ShapeCatalog = {};
    public onPlaced: OnPlacedCallback | null = null;
    public structureId: string = '';
    public isPlaced: boolean = false;

    private _dragOffset: Vec3 = new Vec3();
    private _startPos: Vec3 = new Vec3();
    private _homePos: Vec3 = new Vec3();
    private _touchStartLocalPos: Vec3 = new Vec3();
    private _rootToOriginOffset: Vec3 = new Vec3();
    private _rotation: Rotation = 0;
    private _isDragging: boolean = false;
    private _hasMoved: boolean = false;

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

        // Cocos 的触摸命中区域以根节点为中心。如果直接使用 max-min，
        // 对于 L 形/竖条这种相对根节点不居中的 prefab，会有部分格子落在命中区域外。
        // 因此这里使用关于根节点对称的热区，确保旋转前后每个可见格子都能被点中拖动。
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

        if (this.isPlaced && !this.isPointInsideBoardRect(rootBoardLocalPos, grid)) {
            this.unplaceStructure();
            event.propagationStopped = true;
            return;
        }

        if (!this.isPlaced && !this.isPointInsideBoardRect(rootBoardLocalPos, grid)) {
            event.propagationStopped = true;
            return;
        }

        if (!this.isOriginInBoard(origin)) {
            if (this.isPlaced) {
                this.unplaceStructure();
            }
            event.propagationStopped = true;
            return;
        }

        if (this.session && this.isValidPlacement(origin)) {
            const snapBoardPos = grid.boardToLocal(origin, this.board).subtract(this.getRotatedRootToOriginOffset());
            const snapWorldPos = boardTransform.convertToWorldSpaceAR(snapBoardPos);
            this.node.setPosition(parentTransform.convertToNodeSpaceAR(snapWorldPos));
            this.isPlaced = true;
            this.onPlaced?.(this.structureId, this.shapeId, origin, this._rotation);
        } else {
            this.snapBack();
        }

        event.propagationStopped = true;
    }

    private rotateClockwise(): void {
        this._rotation = this.nextRotation(this._rotation);
        this.node.angle = this._rotation;
        this.ensureInteractiveArea();

        if (!this.isPlaced) return;
        const origin = this.getCurrentOrigin();
        if (origin && this.isValidPlacement(origin)) {
            this.onPlaced?.(this.structureId, this.shapeId, origin, this._rotation);
        } else {
            this._rotation = this.previousRotation(this._rotation);
            this.node.angle = this._rotation;
            this.ensureInteractiveArea();
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

    private isPointInsideBoardRect(pos: Vec3, grid: BoardGridView): boolean {
        const halfW = this.board.width * grid.cellSize / 2;
        const halfH = this.board.height * grid.cellSize / 2;
        return pos.x >= -halfW && pos.x <= halfW && pos.y >= -halfH && pos.y <= halfH;
    }

    private isOriginInBoard(origin: Coord): boolean {
        const candidate = {
            id: 'candidate',
            shapeId: this.shapeId,
            type: PieceType.Building,
            origin,
            rotation: this._rotation,
        };
        return getAbsoluteCells(this.shapes, candidate).every(cell => isInsideBoard(this.board, cell));
    }

    private unplaceStructure(): void {
        this.session?.removeStructure(this.structureId);
        this.isPlaced = false;
    }

    private isValidPlacement(origin: Coord): boolean {
        if (!this.session) return false;

        const level = this.session.getLevel();
        const candidate = {
            id: 'candidate',
            shapeId: this.shapeId,
            type: PieceType.Building,
            origin,
            rotation: this._rotation,
        };

        const candidateCells = getAbsoluteCells(this.shapes, candidate);
        for (const cell of candidateCells) {
            if (!isInsideBoard(this.board, cell)) return false;
            if (cell.x === level.thief.x && cell.y === level.thief.y) return false;
        }

        const occupancy = buildOccupancy(this.shapes, [
            ...level.buildings,
            ...this.session.getPlacedStructures().filter(piece => piece.id !== this.structureId),
            ...this.session.getPlacedPolice(),
        ]);
        for (const cell of candidateCells) {
            if (occupancy.blocked.has(cellKey(cell))) return false;
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

    public async createStructures(
        options: StructureCreateOptions,
        onPlaced?: OnPlacedCallback
    ): Promise<StructureView[]> {
        const { session, boardGridView, parentNode, trayX, spacing } = options;

        const structures: StructureView[] = [];
        const positions = [
            // new Vec3(trayX, spacing / 2, 0),
            // new Vec3(trayX + spacing, spacing / 2, 0),
            // new Vec3(trayX, -spacing / 2, 0),
            // new Vec3(trayX + spacing, -spacing / 2, 0),
            new Vec3(-520, 200, 0),
            new Vec3(-320, 200, 0),
            new Vec3(-500, -90, 0),
            new Vec3(-300, -90, 0),
        ];

        for (let i = 0; i < this.STRUCTURE_PREFAB_KEYS.length; i++) {
            const prefabKey = this.STRUCTURE_PREFAB_KEYS[i];
            const shapeId = `building_00${i + 1}`;

            const draggable = await this.createSingleStructure({
                structureId: `structure_${i + 1}`,
                prefabKey,
                shapeId,
                session,
                boardGridView,
                parentNode,
                homePos: positions[i] ?? new Vec3(trayX, 0, 0),
            });

            if (draggable) {
                draggable.onPlaced = onPlaced ?? null;
                structures.push(draggable);
            }
        }

        return structures;
    }

    public async createSingleStructure(params: {
        structureId: string;
        prefabKey: keyof typeof PrefabsCfg;
        shapeId: string;
        session: GameSession;
        boardGridView: BoardGridView;
        parentNode: Node;
        homePos: Vec3;
    }): Promise<StructureView | null> {
        const {
            structureId,
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
            console.error(`[StructureView] Failed to load prefab: ${prefabKey}`);
            return null;
        }

        const node = instantiate(prefab);
        this.applyColorToChildren(node, this.COLOR_BUILDING);
        const draggable = node.addComponent(StructureView);

        draggable.structureId = structureId;
        draggable.shapeId = shapeId;
        draggable.boardNode = boardGridView.node;
        draggable.boardGridView = boardGridView;
        draggable.board = session.getLevel().board;
        draggable.session = session;
        draggable.shapes = session.getShapes();

        node.parent = parentNode;
        node.setPosition(homePos);
        draggable.setHomePosition(homePos);

        return draggable;
    }

    public getStructurePrefabsCount(): number {
        return this.STRUCTURE_PREFAB_KEYS.length;
    }
}

