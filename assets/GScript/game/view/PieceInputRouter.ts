import { _decorator, Component, EventTouch, Input, input } from 'cc';
import { DraggablePieceViewBase } from './DraggablePieceViewBase';
const { ccclass } = _decorator;

@ccclass('PieceInputRouter')
export class PieceInputRouter extends Component {
    private pieces: DraggablePieceViewBase[] = [];
    private activePiece: DraggablePieceViewBase | null = null;

    protected onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.activePiece = null;
    }

    public setPieces(pieces: readonly DraggablePieceViewBase[]): void {
        this.pieces = [...pieces];
    }

    private onTouchStart(event: EventTouch): void {
        if (this.activePiece) return;

        const piece = this.findTopmostPiece(event);
        if (!piece) return;

        this.activePiece = piece;
        piece.beginDrag(event);
    }

    private onTouchMove(event: EventTouch): void {
        this.activePiece?.moveDrag(event);
    }

    private onTouchEnd(event: EventTouch): void {
        const piece = this.activePiece;
        this.activePiece = null;
        piece?.endDrag(event);
    }

    private onTouchCancel(event: EventTouch): void {
        const piece = this.activePiece;
        this.activePiece = null;
        piece?.cancelDrag(event);
    }

    private findTopmostPiece(event: EventTouch): DraggablePieceViewBase | null {
        const candidates = this.pieces
            .filter(piece => piece?.isValid && piece.node?.isValid)
            .sort((a, b) => b.node.getSiblingIndex() - a.node.getSiblingIndex());

        for (const piece of candidates) {
            if (piece.containsTouch(event)) return piece;
        }

        return null;
    }
}
