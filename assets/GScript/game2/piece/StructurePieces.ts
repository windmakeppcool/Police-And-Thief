import { _decorator, Component } from 'cc';
import type { Coord, Piece, Rotation } from '../common/GameTypes';
import { applyPieceLayout } from './pieceLayout';
const { ccclass } = _decorator;

/**
 * 建筑障碍：不参与玩家操作，由关卡数据（LevelData.buildings）自动摆放，
 * 占用格子后成为围堵小偷的固定路障。
 */
@ccclass('StructurePieces')
export class StructurePieces extends Component {
    private piece: Piece | null = null;

    /** anchor：origin cell 对应的棋盘格，节点位置由 GameController 放置 */
    public anchor: Coord | null = null;

    public init(piece: Piece, anchor: Coord, rotation: Rotation, cellSize: number): void {
        this.piece = piece;
        this.anchor = anchor;
        applyPieceLayout(this.node, piece, rotation, cellSize);
    }

    public get pieceId(): string {
        return this.piece?.id ?? '';
    }
}
