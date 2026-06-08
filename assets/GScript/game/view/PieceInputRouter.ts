import { _decorator, Component, EventTouch, Input, input } from 'cc';
import { DraggablePieceViewBase } from './DraggablePieceViewBase';
const { ccclass } = _decorator;

/**
 * 触摸输入路由组件
 * 
 * 负责将触摸事件分发给可拖拽的棋子组件。
 * 通过层级顺序（SiblingIndex）确定最上层的棋子，并将后续的移动和结束事件
 * 都路由到同一个棋子上，确保一次完整的拖拽操作由同一个棋子处理。
 */
@ccclass('PieceInputRouter')
export class PieceInputRouter extends Component {
    /** 所有可交互的棋子列表 */
    private pieces: DraggablePieceViewBase[] = [];

    /** 当前正在被拖拽的棋子，null 表示没有进行中的拖拽 */
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

    /**
     * 更新可交互的棋子列表
     * @param pieces 新的棋子列表（只读数组）
     */
    public setPieces(pieces: readonly DraggablePieceViewBase[]): void {
        this.pieces = [...pieces];
    }

    /** 触摸开始：查找并锁定最上层的棋子，开始拖拽 */
    private onTouchStart(event: EventTouch): void {
        if (this.activePiece) return;

        const piece = this.findTopmostPiece(event);
        if (!piece) return;

        this.activePiece = piece;
        piece.beginDrag(event);
    }

    /** 触摸移动：将位移事件传递给当前锁定的棋子 */
    private onTouchMove(event: EventTouch): void {
        this.activePiece?.moveDrag(event);
    }

    /** 触摸结束：完成拖拽并释放锁定 */
    private onTouchEnd(event: EventTouch): void {
        const piece = this.activePiece;
        this.activePiece = null;
        piece?.endDrag(event);
    }

    /** 触摸取消（如手指滑出屏幕）：取消拖拽并释放锁定 */
    private onTouchCancel(event: EventTouch): void {
        const piece = this.activePiece;
        this.activePiece = null;
        piece?.cancelDrag(event);
    }

    /**
     * 查找触摸点下最上层的棋子
     * 
     * 按 SiblingIndex 从大到小排序（层级越高越靠前），
     * 然后依次检查每个棋子是否包含该触摸点。
     * @returns 最上层且包含触摸点的棋子，若无则返回 null
     */
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
