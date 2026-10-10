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

export type SolverPiece = Readonly<{
    id: string;
    placements: ReadonlyArray<{ rotation: Rotation; anchor: Coord; cells: Coord[] }>;
}>;

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
        const placements: { rotation: Rotation; anchor: Coord; cells: Coord[] }[] = [];
        for (const rotation of rotations) {
            const relative = pieceCells(piece, rotation);
            for (let ax = -half; ax < half; ax++) {
                for (let ay = -half; ay < half; ay++) {
                    const cells = toAbsoluteCells(relative, { x: ax, y: ay });
                    if (cells.some(c => c.x < -half || c.x >= half || c.y < -half || c.y >= half)) continue;
                    if (cells.some(c => c.x === thief.x && c.y === thief.y)) continue;
                    placements.push({ rotation, anchor: { x: ax, y: ay }, cells });
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

type PackPlacement = Readonly<{ rotation: Rotation; anchor: Coord; cellKeys: string[] }>;
type PackPiece = Readonly<{ cells: number; placements: PackPlacement[] }>;

/** 满编解里的一枚棋子：落点是绝对坐标 */
export type PlacedPiece = Readonly<{ pieceId: string; anchor: Coord; rotation: Rotation }>;

/**
 * 找一个「用满全部棋子」的围捕解：
 * 把 pieces 里的每一个棋子都放到棋盘上（互不重叠、不压小偷、不出界），
 * 且放完后小偷的所有去路都被占据（棋子或建筑）。找不到返回 null。
 *
 * 搜索带节点预算，超预算按「未找到解」处理，避免坏关卡把测试挂死。
 */
export function findFullSquadSolution(
    pieces: readonly SolverPiece[],
    gridSize: number,
    thief: Coord,
    blocked: readonly Coord[],
    nodeBudget = 300_000,
): PlacedPiece[] | null {
    const boardCells = gridSize * gridSize;
    const occupied0 = new Set(blocked.map(key));
    const uncovered0 = thiefExits(gridSize, thief).map(key).filter(k => !occupied0.has(k));

    // 预先把每枚棋子的落点转成格子键，并剔除压到建筑的落点
    const pieces_: PackPiece[] = pieces.map(p => ({
        cells: p.placements[0]?.cells.length ?? 0,
        placements: p.placements
            .map(pl => ({ rotation: pl.rotation, anchor: pl.anchor, cellKeys: pl.cells.map(key) }))
            .filter(pl => pl.cellKeys.every(k => !occupied0.has(k))),
    }));

    // 有棋子一个合法落点都不剩，必然放不满
    if (pieces_.some(p => p.placements.length === 0)) return null;

    let nodes = 0;
    const search = (
        remaining: readonly number[],
        occupied: ReadonlySet<string>,
        uncovered: readonly string[],
        acc: PlacedPiece[],
    ): PlacedPiece[] | null => {
        if (++nodes > nodeBudget) return null;
        if (remaining.length === 0) return uncovered.length === 0 ? acc : null;

        // 剪枝：剩下的格子不够放下剩下的棋子（小偷那格永远不可用）
        let need = 0;
        for (const i of remaining) need += pieces_[i].cells;
        if (boardCells - occupied.size - 1 < need) return null;

        // 剪枝：某条去路已没有任何剩余棋子能覆盖
        for (const ek of uncovered) {
            const coverable = remaining.some(i =>
                pieces_[i].placements.some(pl => pl.cellKeys.includes(ek) && pl.cellKeys.every(k => !occupied.has(k))),
            );
            if (!coverable) return null;
        }

        const rest = (i: number): number[] => remaining.filter(x => x !== i);

        // 还有去路没堵上：优先落子去堵。落子顺序不影响最终格局，
        // 所以先锁定「堵去路」的落点、再随便摆剩下的棋子，不会漏解。
        if (uncovered.length > 0) {
            let best: { i: number; pl: PackPlacement }[] = [];
            for (const ek of uncovered) {
                const options: { i: number; pl: PackPlacement }[] = [];
                for (const i of remaining) {
                    for (const pl of pieces_[i].placements) {
                        if (pl.cellKeys.includes(ek) && pl.cellKeys.every(k => !occupied.has(k))) options.push({ i, pl });
                    }
                }
                if (best.length === 0 || options.length < best.length) best = options;
            }
            if (best.length === 0) return null;
            for (const { i, pl } of best) {
                const next = new Set(occupied);
                pl.cellKeys.forEach(k => next.add(k));
                const got = search(rest(i), next, uncovered.filter(k => !pl.cellKeys.includes(k)),
                    [...acc, toPlaced(pieces, i, pl)]);
                if (got) return got;
            }
            return null;
        }

        // 去路已全堵上：剩下的棋子找地方摆即可，选候选最少的先摆最容易剪枝
        let bestI = -1;
        let bestPl: PackPlacement[] = [];
        for (const i of remaining) {
            const options = pieces_[i].placements.filter(pl => pl.cellKeys.every(k => !occupied.has(k)));
            if (bestI === -1 || options.length < bestPl.length) {
                bestI = i;
                bestPl = options;
            }
        }
        if (bestI === -1 || bestPl.length === 0) return null;
        for (const pl of bestPl) {
            const next = new Set(occupied);
            pl.cellKeys.forEach(k => next.add(k));
            const got = search(rest(bestI), next, uncovered, [...acc, toPlaced(pieces, bestI, pl)]);
            if (got) return got;
        }
        return null;
    };

    return search(pieces_.map((_, i) => i), occupied0, uncovered0, []);
}

/** 把搜索里的落点换算成参考解条目 */
function toPlaced(pieces: readonly SolverPiece[], index: number, pl: PackPlacement): PlacedPiece {
    return { pieceId: pieces[index].id, anchor: pl.anchor, rotation: pl.rotation };
}

/**
 * 判断是否能「用满全部棋子」围住小偷（见 findFullSquadSolution）。
 */
export function canCaptureUsingAllPieces(
    pieces: readonly SolverPiece[],
    gridSize: number,
    thief: Coord,
    blocked: readonly Coord[],
    nodeBudget = 300_000,
): boolean {
    return findFullSquadSolution(pieces, gridSize, thief, blocked, nodeBudget) !== null;
}
