import { buildOccupancy, type Occupancy } from "../rules/BoardOccupancy";
import { canPlace } from "../rules/PlacementValidator";
import { isThiefCaptured } from "../rules/WinCondition";
import { nextRotation, pieceCells, toAbsoluteCells } from "../rules/PieceGeometry";
import { PieceType, type Coord, type LevelData, type PieceCatalog, type Rotation } from "./GameTypes";

export type PiecePlacement = Readonly<{
    anchor: Coord;
    rotation: Rotation;
}>;

type HistoryEntry = Readonly<{
    pieceId: string;
    /** null 表示该棋子上一步还在托盘里 */
    prev: PiecePlacement | null;
}>;

/**
 * 一局游戏的纯逻辑状态：关卡、占用、放置/旋转/撤销、胜负与评级。
 * 不依赖 Cocos，可在 Node 下直接测试。
 */
export class GameSession {
    /** 警察棋子 id，保持目录顺序 */
    private readonly policeIds: string[];
    private readonly placements = new Map<string, PiecePlacement>();
    private readonly rotations = new Map<string, Rotation>();
    private readonly history: HistoryEntry[] = [];
    private moves = 0;

    constructor(
        private readonly level: LevelData,
        private readonly catalog: PieceCatalog,
    ) {
        for (const placement of level.buildings) {
            if (!this.catalog[placement.pieceId]) {
                throw new Error(`[GameSession] 关卡引用了不存在的棋子: ${placement.pieceId}`);
            }
        }
        this.policeIds = Object.values(catalog)
            .filter(p => p.type === PieceType.Police)
            .map(p => p.id);
        for (const piece of Object.values(catalog)) {
            this.rotations.set(piece.id, piece.rotation);
        }
    }

    getLevel(): LevelData {
        return this.level;
    }

    get gridSize(): number {
        return this.level.gridSize;
    }

    getPoliceIds(): readonly string[] {
        return this.policeIds;
    }

    /** 棋子当前（或指定）旋转下的相对 cell */
    relativeCells(pieceId: string, rotation?: Rotation): Coord[] {
        const piece = this.requirePiece(pieceId);
        return pieceCells(piece, rotation ?? this.rotations.get(pieceId) ?? piece.rotation);
    }

    /** 棋子放到 anchor 时占用的绝对 cell，用于落点预览 */
    cellsAt(pieceId: string, anchor: Coord, rotation?: Rotation): Coord[] {
        return toAbsoluteCells(this.relativeCells(pieceId, rotation), anchor);
    }

    getPlacement(pieceId: string): PiecePlacement | null {
        return this.placements.get(pieceId) ?? null;
    }

    getRotation(pieceId: string): Rotation {
        return this.rotations.get(pieceId) ?? this.requirePiece(pieceId).rotation;
    }

    /** 当前占用表（建筑 + 已放置棋子）；ignorePieceId 用于正在被拖动的棋子 */
    occupancy(ignorePieceId?: string): Occupancy {
        const entries: { owner: string; cells: readonly Coord[] }[] = [
            ...this.level.buildings.map(b => ({
                owner: b.pieceId,
                cells: this.cellsAt(b.pieceId, b.anchor, b.rotation),
            })),
        ];
        for (const [pieceId, placement] of this.placements) {
            if (pieceId === ignorePieceId) continue;
            entries.push({ owner: pieceId, cells: this.cellsAt(pieceId, placement.anchor, placement.rotation) });
        }
        return buildOccupancy(entries);
    }

    canPlaceAt(pieceId: string, anchor: Coord, rotation?: Rotation): boolean {
        const ignore = this.placements.has(pieceId) ? pieceId : undefined;
        return canPlace({
            gridSize: this.gridSize,
            thief: this.level.thief,
            occupancy: this.occupancy(ignore),
            cells: this.cellsAt(pieceId, anchor, rotation),
        });
    }

    /** 落子：成功返回 true。只有从托盘首次上岗才计入场步数 */
    place(pieceId: string, anchor: Coord, rotation?: Rotation): boolean {
        if (!this.canPlaceAt(pieceId, anchor, rotation)) return false;
        const prev = this.placements.get(pieceId) ?? null;
        const placedRotation = rotation ?? this.getRotation(pieceId);
        // 原地放回：位置与朝向都没变，不必记入撤销历史
        if (prev && prev.anchor.x === anchor.x && prev.anchor.y === anchor.y && prev.rotation === placedRotation) {
            return true;
        }
        this.placements.set(pieceId, { anchor, rotation: placedRotation });
        this.rotations.set(pieceId, placedRotation);
        if (!prev) this.moves++;
        this.history.push({ pieceId, prev });
        return true;
    }

    canRotate(pieceId: string): boolean {
        const placement = this.placements.get(pieceId);
        if (!placement) return false;
        return this.canPlaceAt(pieceId, placement.anchor, nextRotation(placement.rotation));
    }

    /** 原地顺时针旋转，返回是否成功 */
    rotate(pieceId: string): boolean {
        const placement = this.placements.get(pieceId);
        if (!placement || !this.canRotate(pieceId)) return false;
        const rotation = nextRotation(placement.rotation);
        this.placements.set(pieceId, { anchor: placement.anchor, rotation });
        this.rotations.set(pieceId, rotation);
        return true;
    }

    /**
     * 在托盘里预转向：棋子还没上场，只需要换个朝向，不做棋盘合法性判断
     * （否则某些贴边落点必须先上场再转向，玩家无法通过点击完成）
     */
    rotateInTray(pieceId: string): boolean {
        if (this.placements.has(pieceId)) return false;
        const piece = this.requirePiece(pieceId);
        if (piece.type !== PieceType.Police) return false;
        this.rotations.set(pieceId, nextRotation(this.getRotation(pieceId)));
        return true;
    }

    /** 撤销上一步放置/移动，返回是否执行了撤销 */
    undo(): boolean {
        const last = this.history.pop();
        if (!last) return false;
        if (last.prev) {
            this.placements.set(last.pieceId, last.prev);
            this.rotations.set(last.pieceId, last.prev.rotation);
        } else {
            // 退回托盘：旋转一并恢复为棋子初始朝向
            this.placements.delete(last.pieceId);
            this.rotations.set(last.pieceId, this.requirePiece(last.pieceId).rotation);
            this.moves = Math.max(0, this.moves - 1);
        }
        return true;
    }

    /** 重开：所有警察回到托盘初始状态，建筑保持关卡配置 */
    reset(): void {
        this.placements.clear();
        this.history.length = 0;
        this.moves = 0;
        for (const piece of Object.values(this.catalog)) {
            this.rotations.set(piece.id, piece.rotation);
        }
    }

    get moveCount(): number {
        return this.moves;
    }

    get undoCount(): number {
        return this.history.length;
    }

    /** 小偷是否已被围住 */
    get captured(): boolean {
        return isThiefCaptured(this.gridSize, this.level.thief, this.occupancy());
    }

    private requirePiece(pieceId: string): PieceCatalog[string] {
        const piece = this.catalog[pieceId];
        if (!piece) throw new Error(`[GameSession] 未知棋子: ${pieceId}`);
        return piece;
    }
}
