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
    /** prev 为 null 时，记录操作前该棋子在托盘里的朝向，撤销时恢复 */
    prevTrayRotation?: Rotation;
}>;

/**
 * 一局游戏的纯逻辑状态：关卡、占用、放置/旋转/撤销、胜负与评级。
 * 不依赖 Cocos，可在 Node 下直接测试。
 */
export class GameSession {
    /** 警察棋子 id，保持目录顺序 */
    private readonly policeIds: string[];
    /** 关卡预置、开局锁定的警察棋子 id：不能移动/转向/撤下，重开后仍在原位 */
    private readonly lockedIds: ReadonlySet<string>;
    private readonly placements = new Map<string, PiecePlacement>();
    private readonly rotations = new Map<string, Rotation>();
    private readonly history: HistoryEntry[] = [];

    constructor(
        private readonly level: LevelData,
        private readonly catalog: PieceCatalog,
    ) {
        for (const placement of level.buildings) {
            if (!this.catalog[placement.pieceId]) {
                throw new Error(`[GameSession] 关卡引用了不存在的棋子: ${placement.pieceId}`);
            }
        }
        for (const preset of level.police) {
            const piece = this.catalog[preset.pieceId];
            if (!piece) {
                throw new Error(`[GameSession] 关卡预置了不存在的棋子: ${preset.pieceId}`);
            }
            if (piece.type !== PieceType.Police) {
                throw new Error(`[GameSession] 预置棋子 ${preset.pieceId} 不是警察棋子`);
            }
        }
        this.policeIds = Object.values(catalog)
            .filter(p => p.type === PieceType.Police)
            .map(p => p.id);
        this.lockedIds = new Set(level.police.map(p => p.pieceId));
        for (const piece of Object.values(catalog)) {
            this.rotations.set(piece.id, piece.rotation);
        }
        // 预置警察开局即在棋盘上、占用格子并计入在场数；几何合法性已由 LevelParser 保证
        for (const preset of level.police) {
            this.placements.set(preset.pieceId, { anchor: preset.anchor, rotation: preset.rotation });
            this.rotations.set(preset.pieceId, preset.rotation);
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

    /** 进入托盘、玩家可操作的警察棋子（预置锁定的不出现）；同时是棋盘上的上场分母 */
    getTrayPoliceIds(): readonly string[] {
        return this.policeIds.filter(id => !this.lockedIds.has(id));
    }

    /** 关卡预置、锁定在棋盘上的警察棋子 id */
    getPresetPoliceIds(): readonly string[] {
        return this.policeIds.filter(id => this.lockedIds.has(id));
    }

    isLocked(pieceId: string): boolean {
        return this.lockedIds.has(pieceId);
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

    /** 建筑等非警察棋子不参与放置，直接判定为非法 */
    private isPolice(pieceId: string): boolean {
        return this.requirePiece(pieceId).type === PieceType.Police;
    }

    canPlaceAt(pieceId: string, anchor: Coord, rotation?: Rotation): boolean {
        if (!this.isPolice(pieceId) || this.isLocked(pieceId)) return false;
        const ignore = this.placements.has(pieceId) ? pieceId : undefined;
        return canPlace({
            gridSize: this.gridSize,
            thief: this.level.thief,
            occupancy: this.occupancy(ignore),
            cells: this.cellsAt(pieceId, anchor, rotation),
        });
    }

    /** 落子：成功返回 true。已上场的棋子挪位不增加在场数 */
    place(pieceId: string, anchor: Coord, rotation?: Rotation): boolean {
        if (!this.isPolice(pieceId) || this.isLocked(pieceId)) return false;
        if (!this.canPlaceAt(pieceId, anchor, rotation)) return false;
        const prev = this.placements.get(pieceId) ?? null;
        const prevTrayRotation = this.getRotation(pieceId);
        const placedRotation = rotation ?? prevTrayRotation;
        // 原地放回：位置与朝向都没变，不必记入撤销历史
        if (prev && prev.anchor.x === anchor.x && prev.anchor.y === anchor.y && prev.rotation === placedRotation) {
            return true;
        }
        this.placements.set(pieceId, { anchor, rotation: placedRotation });
        this.rotations.set(pieceId, placedRotation);
        // prev 为 null（从托盘落子）时记下放置前的托盘朝向，撤销时原样恢复
        this.history.push(prev ? { pieceId, prev } : { pieceId, prev, prevTrayRotation });
        return true;
    }

    /**
     * 把已上场的棋子撤回托盘，返回是否执行成功。
     * 保留当前朝向——玩家多半要换个位置再摆，不必重新转向；撤销可原样放回。
     */
    remove(pieceId: string): boolean {
        if (!this.isPolice(pieceId) || this.isLocked(pieceId)) return false;
        const prev = this.placements.get(pieceId) ?? null;
        if (!prev) return false;
        this.placements.delete(pieceId);
        this.history.push({ pieceId, prev });
        return true;
    }

    canRotate(pieceId: string): boolean {
        if (!this.isPolice(pieceId) || this.isLocked(pieceId)) return false;
        const placement = this.placements.get(pieceId);
        if (!placement) return false;
        return this.canPlaceAt(pieceId, placement.anchor, nextRotation(placement.rotation));
    }

    /** 原地顺时针旋转，返回是否成功 */
    rotate(pieceId: string): boolean {
        if (!this.isPolice(pieceId) || this.isLocked(pieceId)) return false;
        const placement = this.placements.get(pieceId);
        if (!placement || !this.canRotate(pieceId)) return false;
        const rotation = nextRotation(placement.rotation);
        // 记下旋转前的完整落点：撤销时原地不动，只回退朝向
        this.history.push({ pieceId, prev: { anchor: placement.anchor, rotation: placement.rotation } });
        this.placements.set(pieceId, { anchor: placement.anchor, rotation });
        this.rotations.set(pieceId, rotation);
        return true;
    }

    /**
     * 在托盘里预转向：棋子还没上场，只需要换个朝向，不做棋盘合法性判断
     * （否则某些贴边落点必须先上场再转向，玩家无法通过点击完成）
     */
    rotateInTray(pieceId: string): boolean {
        if (this.isLocked(pieceId)) return false;
        if (this.placements.has(pieceId)) return false;
        const piece = this.requirePiece(pieceId);
        if (piece.type !== PieceType.Police) return false;
        const prevRotation = this.getRotation(pieceId);
        const rotation = nextRotation(prevRotation);
        // 棋子在托盘：prev=null，并记录转向之前的托盘朝向供撤销恢复
        this.history.push({ pieceId, prev: null, prevTrayRotation: prevRotation });
        this.rotations.set(pieceId, rotation);
        return true;
    }

    /** 撤销上一步放置/移动/旋转/撤下/托盘预转向，返回是否执行了撤销 */
    undo(): boolean {
        const last = this.history.pop();
        if (!last) return false;
        if (last.prev) {
            this.placements.set(last.pieceId, last.prev);
            this.rotations.set(last.pieceId, last.prev.rotation);
        } else {
            // 退回托盘：恢复操作前记录的托盘朝向；旧条目没有记录时回退初始朝向
            this.placements.delete(last.pieceId);
            const trayRotation = last.prevTrayRotation ?? this.requirePiece(last.pieceId).rotation;
            this.rotations.set(last.pieceId, trayRotation);
        }
        return true;
    }

    /**
     * 重开：玩家放下的警察全部回到托盘初始朝向，建筑与预置警察保持关卡配置。
     * 预置警察是锁定的关卡布置，重开不能把它们收回托盘。
     */
    reset(): void {
        for (const pieceId of this.placements.keys()) {
            if (!this.lockedIds.has(pieceId)) this.placements.delete(pieceId);
        }
        this.history.length = 0;
        for (const piece of Object.values(this.catalog)) {
            this.rotations.set(piece.id, piece.rotation);
        }
        for (const preset of this.level.police) {
            this.placements.set(preset.pieceId, { anchor: preset.anchor, rotation: preset.rotation });
            this.rotations.set(preset.pieceId, preset.rotation);
        }
    }

    /** 当前在场警力数（HUD 显示「已部署 N / 总数」） */
    get moveCount(): number {
        return this.placements.size;
    }

    get undoCount(): number {
        return this.history.length;
    }

    /** 小偷是否已被围住 */
    /** 小偷去路是否已被全部堵住 */
    get captured(): boolean {
        return isThiefCaptured(this.gridSize, this.level.thief, this.occupancy());
    }

    /** 六枚警察棋子是否都已上场 */
    get deployed(): boolean {
        return this.policeIds.length > 0 && this.policeIds.every(id => this.placements.has(id));
    }

    /** 获胜：小偷被围住，且六枚警力全部就位 */
    get won(): boolean {
        return this.captured && this.deployed;
    }

    private requirePiece(pieceId: string): PieceCatalog[string] {
        const piece = this.catalog[pieceId];
        if (!piece) throw new Error(`[GameSession] 未知棋子: ${pieceId}`);
        return piece;
    }
}