import type { Coord } from "../common/GameTypes";
import { coordKey, type Occupancy } from "./BoardOccupancy";

/** 网格坐标是否落在棋盘范围内 */
export function isInBoard(gridSize: number, coord: Coord): boolean {
    const half = gridSize / 2;
    return coord.x >= -half && coord.x < half && coord.y >= -half && coord.y < half;
}

export type PlaceCheck = Readonly<{
    gridSize: number;
    thief: Coord;
    occupancy: Occupancy;
    /** 待放置的绝对坐标 */
    cells: readonly Coord[];
    /** 被移动棋子自身的 id：其当前占用不参与冲突判断 */
    ignoreOwner?: string;
}>;

/**
 * 放置校验：全部格子在棋盘内、不踩小偷、不与其它棋子重叠。
 */
export function canPlace(check: PlaceCheck): boolean {
    const seen = new Set<string>();
    for (const cell of check.cells) {
        if (!isInBoard(check.gridSize, cell)) return false;
        if (cell.x === check.thief.x && cell.y === check.thief.y) return false;
        const key = coordKey(cell);
        if (seen.has(key)) return false;
        seen.add(key);
        const owner = check.occupancy.get(key);
        if (owner !== undefined && owner !== check.ignoreOwner) return false;
    }
    return true;
}
