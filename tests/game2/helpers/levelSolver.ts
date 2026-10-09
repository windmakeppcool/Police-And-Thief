import { pieceCells, toAbsoluteCells } from "../../../assets/GScript/game/rules/PieceGeometry";
import { PieceType, type Coord, type PieceCatalog, type Rotation } from "../../../assets/GScript/game/common/GameTypes";
import { isThiefCaptured } from "../../../assets/GScript/game/rules/WinCondition";

export const TEST_CATALOG: PieceCatalog = {
    'Police-A': {
        id: 'Police-A',
        type: PieceType.Police,
        cells: [
            { name: 'white-00', coord: { x: 0, y: 1 } },
            { name: 'white-01', coord: { x: 0, y: 0 } },
            { name: 'white-02', coord: { x: -1, y: 0 } },
            { name: 'white-03', coord: { x: 1, y: 0 } },
        ],
        origin: 1,
        rotation: 0,
        policeAt: 0,
    },
    'Police-B': {
        id: 'Police-B',
        type: PieceType.Police,
        cells: [
            { name: 'white-00', coord: { x: 0, y: 1 } },
            { name: 'white-01', coord: { x: 0, y: 0 } },
            { name: 'white-02', coord: { x: 1, y: 0 } },
        ],
        origin: 1,
        rotation: 0,
        policeAt: 1,
    },
    'Police-C': {
        id: 'Police-C',
        type: PieceType.Police,
        cells: [
            { name: 'white-00', coord: { x: -1, y: 0 } },
            { name: 'white-01', coord: { x: 0, y: 0 } },
            { name: 'white-02', coord: { x: 1, y: 0 } },
        ],
        origin: 1,
        rotation: 0,
        policeAt: 1,
    },
};

export type SolverPiece = Readonly<{ id: string; placements: ReadonlyArray<{ rotation: Rotation; cells: Coord[] }> }>;

const key = (c: Coord) => `${c.x},${c.y}`;

export function thiefExits(gridSize: number, thief: Coord): Coord[] {
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    return dirs
        .map(d => ({ x: thief.x + d.x, y: thief.y + d.y }))
        .filter(c => c.x >= -gridSize / 2 && c.x < gridSize / 2 && c.y >= -gridSize / 2 && c.y < gridSize / 2);
}

/** 枚举棋子在 gridSize×gridSize 棋盘上的全部合法落点 */
export function enumeratePlacements(catalog: PieceCatalog, gridSize: number, thief: Coord): SolverPiece[] {
    const half = gridSize / 2;
    const rotations: Rotation[] = [0, 90, 180, 270];
    return Object.values(catalog).map(piece => {
        const placements: { rotation: Rotation; cells: Coord[] }[] = [];
        for (const rotation of rotations) {
            const relative = pieceCells(piece, rotation);
            for (let ax = -half; ax < half; ax++) {
                for (let ay = -half; ay < half; ay++) {
                    const cells = toAbsoluteCells(relative, { x: ax, y: ay });
                    if (cells.some(c => c.x < -half || c.x >= half || c.y < -half || c.y >= half)) continue;
                    if (cells.some(c => c.x === thief.x && c.y === thief.y)) continue;
                    placements.push({ rotation, cells });
                }
            }
        }
        return { id: piece.id, placements };
    });
}

/** 计算围住小偷所需的最少步数；超过 limit 返回 null */
export function minMovesToCapture(
    pieces: readonly SolverPiece[],
    gridSize: number,
    thief: Coord,
    blocked: readonly Coord[],
    limit: number,
): number | null {
    const exits = thiefExits(gridSize, thief);

    const search = (occupied: Set<string>, remaining: readonly SolverPiece[], depth: number): number | null => {
        if (exits.every(e => occupied.has(key(e)))) return depth;
        if (depth >= limit) return null;
        const free = exits.filter(e => !occupied.has(key(e)));
        for (const piece of remaining) {
            for (const placement of piece.placements) {
                if (!placement.cells.some(c => free.some(f => f.x === c.x && f.y === c.y))) continue;
                if (placement.cells.some(c => occupied.has(key(c)))) continue;
                const next = new Set(occupied);
                placement.cells.forEach(c => next.add(key(c)));
                const result = search(next, remaining.filter(p => p !== piece), depth + 1);
                if (result !== null) return result;
            }
        }
        return null;
    };

    return search(new Set(blocked.map(key)), pieces, 0);
}

export function isCaptured(gridSize: number, thief: Coord, cells: readonly Coord[]): boolean {
    const occupancy = new Map<string, string>();
    cells.forEach(c => occupancy.set(key(c), 'piece'));
    return isThiefCaptured(gridSize, thief, occupancy);
}
