import { EventTouch, Node, UITransform, Vec3, tween } from 'cc';
import { cellKey, isInsideBoard, type BoardSize, type Coord, type PieceType, type Rotation, type ShapeCatalog } from '../domain/GameTypes';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { BaseGridView } from './BaseGridView';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
import { isTouchInsidePolygonCollider } from './PolygonHitTest';

export abstract class DraggablePieceViewBase extends BaseGridView {
    public shapeId: string = '';
    public boardNode: Node | null = null;
    public boardGridView: BoardGridView | null = null;
    public board: BoardSize = { width: 6, height: 6 };
    public session: GameSession | null = null;
    public shapes: ShapeCatalog = {};
    public isPlaced: boolean = false;

    private _dragOffset: Vec3 = new Vec3();
    private _startPos: Vec3 = new Vec3();
    private _homePos: Vec3 = new Vec3();
    private _touchStartLocalPos: Vec3 = new Vec3();
    private _rootToOriginOffset: Vec3 = new Vec3();
    private _rotation: Rotation = 0;
    private _isDragging: boolean = false;
    private _hasMoved: boolean = false;

    protected abstract get pieceType(): PieceType;
    protected abstract get pieceId(): string;
    protected abstract unplacePiece(): void;
    protected abstract isValidPlacement(origin: Coord): boolean;
    protected abstract notifyPlaced(origin: Coord, rotation: Rotation): void;

    protected onEnable(): void {
        this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        this.refreshRootToOriginOffsetFromChildren();
    }

    public setHomePosition(pos: Vec3): void {
        this._homePos.set(pos);
    }

    public containsTouch(event: EventTouch): boolean {
        return isTouchInsidePolygonCollider(this.node, event.getUILocation());
    }

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

    public cancelDrag(event: EventTouch): void {
        if (!this._isDragging) return;
        this._isDragging = false;
        this.snapBack();
        event.propagationStopped = true;
    }

    protected get rotation(): Rotation {
        return this._rotation;
    }

    protected onRotationChanged(): void { }

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

    private getCurrentOrigin(): Coord | null {
        const grid = this.boardGridView;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardNode?.getComponent(UITransform);
        if (!grid || !parentTransform || !boardTransform) return null;

        const worldPos = parentTransform.convertToWorldSpaceAR(this.node.position);
        const rootBoardLocalPos = boardTransform.convertToNodeSpaceAR(worldPos);
        return grid.localToBoard(rootBoardLocalPos.add(this.getRotatedRootToOriginOffset()), this.board);
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

    protected candidateCells(origin: Coord): Coord[] {
        return getAbsoluteCells(this.shapes, {
            id: 'candidate',
            shapeId: this.shapeId,
            type: this.pieceType,
            origin,
            rotation: this._rotation,
        });
    }

    protected isBlocked(cell: Coord, blocked: Set<string>): boolean {
        return blocked.has(cellKey(cell));
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
}
