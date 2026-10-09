import { _decorator, Component, EventTouch, input, Input, Node, Sprite, SpriteFrame, tween, UITransform, Vec3 } from 'cc';
import { GameSession } from '../common/GameSession';
import type { Coord, Piece, Rotation } from '../common/GameTypes';
import { BoardGrid } from './BoardGrid';
import { applyPieceLayout, pieceCenterOffset } from './pieceLayout';
const { ccclass } = _decorator;

export type PieceCallbacks = {
    /** 请求把棋子放到 anchor，返回是否成功（由 GameController 走 GameSession 判定） */
    place: (pieceId: string, anchor: Coord) => boolean;
    /** 点击已放置棋子请求旋转，返回是否成功 */
    rotate: (pieceId: string) => boolean;
};

export type PieceInitOptions = {
    pieceId: string;
    piece: Piece;
    session: GameSession;
    boardGrid: BoardGrid;
    callbacks: PieceCallbacks;
    /** 拖拽时的父节点（保证棋子盖在棋盘与托盘之上） */
    dragLayer: Node;
    /** 托盘槽位 */
    traySlot: Node;
    cellFrame: SpriteFrame | null;
    dragCellFrame: SpriteFrame | null;
    trayScale: number;
};

/**
 * 警察棋子交互：托盘 -> 棋盘拖拽、落点预览、点击转向、非法落点弹回。
 * 只负责表现与输入，放置合法性全部交给 GameSession。
 */
@ccclass('DraggablePiece')
export class DraggablePiece extends Component {
    private static activePiece: DraggablePiece | null = null;

    private pieceId = '';
    private piece: Piece | null = null;
    private session: GameSession | null = null;
    private boardGrid: BoardGrid | null = null;
    private callbacks: PieceCallbacks | null = null;
    private dragLayer: Node | null = null;
    private traySlot: Node | null = null;
    private cellFrame: SpriteFrame | null = null;
    private dragCellFrame: SpriteFrame | null = null;

    private rotation: Rotation = 0;
    private onBoard = false;
    private anchor: Coord | null = null;
    private trayScale = 0.55;
    private cellSize = 64;

    private interactable = false;
    private dragging = false;
    private moved = false;
    private readonly grabOffset = new Vec3();
    private readonly touchStart = new Vec3();
    private pendingAnchor: Coord | null = null;
    private pendingValid = false;

    public init(options: PieceInitOptions): void {
        this.pieceId = options.pieceId;
        this.piece = options.piece;
        this.session = options.session;
        this.boardGrid = options.boardGrid;
        this.callbacks = options.callbacks;
        this.dragLayer = options.dragLayer;
        this.traySlot = options.traySlot;
        this.cellFrame = options.cellFrame;
        this.dragCellFrame = options.dragCellFrame;
        this.trayScale = options.trayScale;
        this.cellSize = options.boardGrid.cellSize;
        this.rotation = options.session.getRotation(options.pieceId);
        this.applyCellFrames(false);
        this.moveToTray();
    }

    public setInteractable(value: boolean): void {
        this.interactable = value;
        if (!value) this.cancelDrag();
    }

    /** 依据外部逻辑状态（撤销、重开）同步表现 */
    public syncFromSession(): void {
        if (!this.session) return;
        const placement = this.session.getPlacement(this.pieceId);
        this.rotation = this.session.getRotation(this.pieceId);
        if (!placement) {
            this.onBoard = false;
            this.anchor = null;
            this.layoutChildren();
            this.moveToTray();
            return;
        }
        this.onBoard = true;
        this.anchor = placement.anchor;
        this.layoutChildren();
        this.parentToDragLayer();
        this.node.setScale(1, 1, 1);
        this.snapToAnchor(placement.anchor);
    }

    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        if (DraggablePiece.activePiece === this) DraggablePiece.activePiece = null;
    }

    private onTouchStart(event: EventTouch): void {
        if (!this.interactable || DraggablePiece.activePiece) return;
        if (!this.isTopHitPiece(event)) return;

        DraggablePiece.activePiece = this;
        this.dragging = true;
        this.moved = false;
        this.rotation = this.session?.getRotation(this.pieceId) ?? this.rotation;

        const touch = event.getUILocation();
        this.touchStart.set(touch.x, touch.y, 0);
        this.grabOffset.set(0, 0, 0);
        event.propagationStopped = true;
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.dragging || DraggablePiece.activePiece !== this) return;
        const touch = event.getUILocation();
        const moved = Math.abs(touch.x - this.touchStart.x) > 8 || Math.abs(touch.y - this.touchStart.y) > 8;
        if (moved && !this.moved) this.beginDrag(touch.x, touch.y);
        if (this.moved) {
            this.setWorldByTouch(touch.x, touch.y);
            this.updateGhost();
        }
        event.propagationStopped = true;
    }

    /** 真正开始位移时才把棋子提到拖拽层，避免点按时跳动 */
    private beginDrag(touchX: number, touchY: number): void {
        this.moved = true;
        this.parentToDragLayer();
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.node.setScale(1, 1, 1);
        this.applyCellFrames(true);
        const world = this.node.getWorldPosition();
        this.grabOffset.set(world.x - touchX, world.y - touchY, 0);
    }

    private onTouchEnd(event: EventTouch): void {
        if (!this.dragging || DraggablePiece.activePiece !== this) return;
        event.propagationStopped = true;

        if (!this.moved) {
            this.handleTap();
        } else {
            this.handleDrop();
        }
        this.endDrag();
    }

    private onTouchCancel(event: EventTouch): void {
        if (!this.dragging || DraggablePiece.activePiece !== this) return;
        this.revertDrag();
        this.endDrag();
        event.propagationStopped = true;
    }

    /** 点按转向：上场后原地旋转；仍在托盘则先转好朝向，方便贴边落点直接拖上去 */
    private handleTap(): void {
        if (!this.callbacks || !this.session) {
            this.revertDrag();
            return;
        }
        if (this.callbacks.rotate(this.pieceId)) {
            this.rotation = this.session.getRotation(this.pieceId);
            this.layoutChildren();
            if (this.onBoard && this.anchor) {
                this.snapToAnchor(this.anchor);
            } else {
                this.moveToTray();
            }
        } else {
            this.revertDrag();
            this.playShake();
        }
    }

    private handleDrop(): void {
        const anchor = this.pendingAnchor ?? this.currentAnchor();
        this.boardGrid?.clearGhost();
        if (anchor && this.pendingValid && this.callbacks?.place(this.pieceId, anchor)) {
            this.onBoard = true;
            this.anchor = anchor;
            this.parentToDragLayer();
            this.layoutChildren();
            this.snapToAnchor(anchor);
            return;
        }
        this.revertDrag();
        this.playShake();
    }

    private endDrag(): void {
        this.dragging = false;
        this.moved = false;
        this.pendingAnchor = null;
        this.pendingValid = false;
        this.boardGrid?.clearGhost();
        this.applyCellFrames(false);
        if (this.onBoard) {
            this.node.setScale(1, 1, 1);
            if (this.anchor) this.snapToAnchor(this.anchor);
        } else {
            this.moveToTray();
        }
        DraggablePiece.activePiece = null;
    }

    private cancelDrag(): void {
        if (!this.dragging) return;
        this.revertDrag();
        this.endDrag();
    }

    private revertDrag(): void {
        if (this.onBoard && this.anchor) {
            this.parentToDragLayer();
            this.snapToAnchor(this.anchor);
        } else {
            this.moveToTray();
        }
    }

    /** 依据当前触摸位置推算落点，刷新预览 */
    private updateGhost(): void {
        const anchor = this.currentAnchor();
        if (!anchor || !this.boardGrid || !this.session) return;
        const cells = this.session.cellsAt(this.pieceId, anchor, this.rotation);
        const valid = this.session.canPlaceAt(this.pieceId, anchor, this.rotation);
        this.boardGrid.showGhost(cells, valid);
        this.pendingAnchor = anchor;
        this.pendingValid = valid;
    }

    private currentAnchor(): Coord | null {
        if (!this.boardGrid) return null;
        const transform = this.node.parent?.getComponent(UITransform);
        const boardTransform = this.boardGrid.node.getComponent(UITransform);
        if (!transform || !boardTransform) return null;
        const boardLocal = boardTransform.convertToNodeSpaceAR(this.node.getWorldPosition());
        return this.boardGrid.localToCell(boardLocal);
    }

    private setWorldByTouch(x: number, y: number): void {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;
        const world = new Vec3(x + this.grabOffset.x, y + this.grabOffset.y, 0);
        this.node.setPosition(parentTransform.convertToNodeSpaceAR(world));
    }

    /** 节点本地原点即 origin cell，直接吸附到目标格中心 */
    private snapToAnchor(anchor: Coord): void {
        if (!this.boardGrid) return;
        const boardTransform = this.boardGrid.node.getComponent(UITransform);
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!boardTransform || !parentTransform) return;
        const world = boardTransform.convertToWorldSpaceAR(this.boardGrid.cellToLocal(anchor));
        this.node.setPosition(parentTransform.convertToNodeSpaceAR(world));
    }

    private layoutChildren(): void {
        if (!this.piece) return;
        applyPieceLayout(this.node, this.piece, this.rotation, this.cellSize);
    }

    private applyCellFrames(dragging: boolean): void {
        const frame = dragging ? (this.dragCellFrame ?? this.cellFrame) : this.cellFrame;
        if (!frame) return;
        for (const child of this.node.children) {
            const sprite = child.getComponent(Sprite);
            if (sprite) sprite.spriteFrame = frame;
        }
    }

    private parentToDragLayer(): void {
        if (!this.dragLayer || this.node.parent === this.dragLayer) return;
        const world = this.node.getWorldPosition().clone();
        this.node.parent = this.dragLayer;
        this.node.setWorldPosition(world);
    }

    private moveToTray(): void {
        if (!this.traySlot || !this.piece) return;
        this.layoutChildren();
        if (this.node.parent !== this.traySlot) {
            this.node.parent = this.traySlot;
        }
        // 以包围盒中心对齐槽位中心，避免形状偏向一侧
        const center = pieceCenterOffset(this.piece, this.rotation);
        this.node.setPosition(
            -center.x * this.cellSize * this.trayScale,
            -center.y * this.cellSize * this.trayScale,
            0,
        );
        this.node.setScale(this.trayScale, this.trayScale, 1);
    }

    private isTopHitPiece(event: EventTouch): boolean {
        if (!this.hitTest(event)) return false;
        const siblings = this.node.parent?.children ?? [];
        for (let i = siblings.length - 1; i >= 0; i--) {
            const sibling = siblings[i].getComponent(DraggablePiece);
            if (!sibling) continue;
            if (sibling.hitTest(event)) return sibling === this;
        }
        return false;
    }

    /** 命中判定：点是否落在任意一个格子方块内 */
    private hitTest(event: EventTouch): boolean {
        const transform = this.node.getComponent(UITransform);
        if (!transform) return false;
        const touch = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(new Vec3(touch.x, touch.y, 0));
        const half = this.cellSize / 2;
        for (const child of this.node.children) {
            const position = child.position;
            if (Math.abs(local.x - position.x) <= half && Math.abs(local.y - position.y) <= half) {
                return true;
            }
        }
        return false;
    }

    private playShake(): void {
        const origin = this.node.position.clone();
        tween(this.node)
            .to(0.06, { position: new Vec3(origin.x - 6, origin.y, origin.z) })
            .to(0.06, { position: new Vec3(origin.x + 6, origin.y, origin.z) })
            .to(0.06, { position: origin })
            .start();
    }
}
