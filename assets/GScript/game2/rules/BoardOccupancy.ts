import type { Coord } from "../common/GameTypes";

/** "x,y" 形式的格子键 */
export function coordKey(coord: Coord): string {
    return `${coord.x},${coord.y}`;
}

/** 占用表：格子键 -> 占用者 id（棋子 id 或建筑 id） */
export type Occupancy = ReadonlyMap<string, string>;

export function buildOccupancy(entries: Iterable<{ owner: string; cells: readonly Coord[] }>): Occupancy {
    const map = new Map<string, string>();
    for (const entry of entries) {
        for (const cell of entry.cells) {
            map.set(coordKey(cell), entry.owner);
        }
    }
    return map;
}
