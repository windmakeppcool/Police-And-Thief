import { _decorator, Component, Node, UITransform, Vec3, tween } from 'cc';
import { type BoardSize, type Coord, type ShapeCatalog } from '../domain/GameTypes';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { buildOccupancy } from '../domain/BoardOccupancy';
import { isInsideBoard, cellKey } from '../domain/GameTypes';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
const { ccclass, property } = _decorator;

/** Callback when structure is successfully placed on the board */
export type OnPlacedCallback = (shapeId: string, origin: Coord, rotation: 0) => void;

@ccclass('StructureDraggable')
export class StructureDraggable extends Component {
    @property(String) public shapeId: string = '';

    /** Set programmatically before use */
    public boardNode: Node | null = null;
    public boardGridView: BoardGridView | null = null;
    public board: BoardSize = { width: 6, height: 6 };
    public session: GameSession | null = null;
    public shapes: ShapeCatalog = {};
    public onPlaced: OnPlacedCallback | null = null;

    private _dragOffset: Vec3 = new Vec3();
    private _startPos: Vec3 = new Vec3();
    private _isDragging: boolean = false;

    /** Mark as placed (no longer draggable) */
    public isPlaced: boolean = false;

    protected onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this, true);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this, true);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this, true);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this, true);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this, true);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this, true);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this, true);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this, true);
    }

    private onTouchStart(event: any): void {
        if (this.isPlaced || !this.boardNode) return;

        this._isDragging = true;
        this._startPos.set(this.node.position);

        // Record offset: touch world pos - node world pos
        const touchWorldPos = event.getUILocation();
        const nodeWorldPos = this.node.parent!.getComponent(UITransform)!
            .convertToWorldSpaceAR(this.node.position);
        this._dragOffset.set(
            nodeWorldPos.x - touchWorldPos.x,
            nodeWorldPos.y - touchWorldPos.y,
            0
        );

        // Elevate to top
        this.node.setSiblingIndex(999);
        event.propagationStopped = true;
    }

    private onTouchMove(event: any): void {
        if (!this._isDragging || !this.boardNode) return;

        const touchWorldPos = event.getUILocation();
        // Move node so its center follows the finger (maintaining initial grab offset)
        const parentUITrans = this.node.parent!.getComponent(UITransform)!;
        const newWorldPos = new Vec3(
            touchWorldPos.x + this._dragOffset.x,
            touchWorldPos.y + this._dragOffset.y,
            0
        );
        const newLocalPos = parentUITrans.convertToNodeSpaceAR(newWorldPos);
        this.node.setPosition(newLocalPos);

        event.propagationStopped = true;
    }

    private onTouchEnd(event: any): void {
        if (!this._isDragging || !this.boardNode) return;
        this._isDragging = false;

        const grid = this.boardGridView;
        if (!grid) { this.snapBack(); return; }

        // Convert structure's current world pos → board-local pos
        const structWorldPos = this.node.parent!.getComponent(UITransform)!
            .convertToWorldSpaceAR(this.node.position);
        const boardUITrans = this.boardNode.getComponent(UITransform)!;
        const boardLocalPos = boardUITrans.convertToNodeSpaceAR(structWorldPos);

        // Snap to nearest grid origin
        const cs = grid.cellSize;
        const originX = Math.round(boardLocalPos.x / cs);
        const originY = Math.round(boardLocalPos.y / cs);
        const origin: Coord = { x: originX, y: originY };

        // Validate placement
        if (this.session && this.isValidPlacement(origin)) {
            const snapPos = boardUITrans.convertToWorldSpaceAR(
                new Vec3(originX * cs, originY * cs, 0)
            );
            const parentUITrans = this.node.parent!.getComponent(UITransform)!;
            const snapLocal = parentUITrans.convertToNodeSpaceAR(snapPos);
            this.node.setPosition(snapLocal);
            this.isPlaced = true;
            this.onPlaced?.(this.shapeId, origin, 0);
        } else {
            this.snapBack();
        }

        event.propagationStopped = true;
    }

    private isValidPlacement(origin: Coord): boolean {
        if (!this.session || !this.boardNode) return false;

        const shapes = this.shapes;
        const board = this.board;
        const level = this.session.getLevel();

        // Build a temporary PlacedPiece for validation
        const candidate = {
            id: 'candidate',
            shapeId: this.shapeId,
            type: level.buildings[0]?.type ?? 'building' as any,
            origin,
            rotation: 0 as const,
        };

        // Check all cells are inside the board
        const candidateCells = getAbsoluteCells(shapes, candidate);
        for (const cell of candidateCells) {
            if (!isInsideBoard(board, cell)) return false;
        }

        // Check no collision with thief
        for (const cell of candidateCells) {
            if (cell.x === level.thief.x && cell.y === level.thief.y) return false;
        }

        // Check no collision with existing buildings or placed police
        const occupancy = buildOccupancy(shapes, [
            ...level.buildings,
            ...this.session.getPlacedStructures(),
            ...this.session.getPlacedPolice(),
        ]);
        for (const cell of candidateCells) {
            if (occupancy.blocked.has(cellKey(cell))) return false;
        }

        return true;
    }

    private snapBack(): void {
        // Animate back to start position
        tween(this.node)
            .to(0.2, { position: this._startPos.clone() }, { easing: 'quadOut' })
            .start();
    }
}
