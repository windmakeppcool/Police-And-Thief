import type { Coord } from "../common/GameTypes";
import { coordKey, type Occupancy } from "./BoardOccupancy";
import { isInBoard } from "./PlacementValidator";

/** 小偷上下左右的去路（仅棋盘内的格子） */
export function thiefExits(gridSize: number, thief: Coord): Coord[] {
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    return dirs
        .map(d => ({ x: thief.x + d.x, y: thief.y + d.y }))
        .filter(c => isInBoard(gridSize, c));
}

/** 小偷是否被彻底围住（所有去路都被棋子或建筑占据） */
export function isThiefCaptured(gridSize: number, thief: Coord, occupancy: Occupancy): boolean {
    const exits = thiefExits(gridSize, thief);
    if (exits.length === 0) return false;
    return exits.every(c => occupancy.has(coordKey(c)));
}
