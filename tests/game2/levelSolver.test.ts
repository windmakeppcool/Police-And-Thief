import { describe, expect, it } from "vitest";
import { PieceType, type Piece, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import {
    canCaptureUsingAllPieces,
    enumeratePlacements,
    findFullSquadSolutionDetailed,
    SOLVER_NODE_BUDGET,
    type SolverPiece,
} from "./helpers/levelSolver";

/** 单格棋子：形状最简，便于精确控制「放不放得下」 */
function cellPieces(n: number): PieceCatalog {
    const catalog: Record<string, Piece> = {};
    for (let i = 0; i < n; i++) {
        catalog[`P${i}`] = {
            id: `P${i}`,
            type: PieceType.Police,
            cells: [{ name: "white-00", coord: { x: 0, y: 0 } }],
            origin: 0,
            rotation: 0,
            policeAt: 0,
        };
    }
    return catalog;
}

/** 生成棋盘上除保留格外的全部坐标 */
function allCellsExcept(...keep: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const keepKeys = new Set(keep.map(c => `${c.x},${c.y}`));
    const out: Array<{ x: number; y: number }> = [];
    for (let x = -3; x <= 2; x++) {
        for (let y = -3; y <= 2; y++) {
            if (!keepKeys.has(`${x},${y}`)) out.push({ x, y });
        }
    }
    return out;
}

/** 横条三格棋子（旋转 0/180 占格相同，90/270 占格相同），用于验证落点去重 */
function barPieces(): PieceCatalog {
    return {
        Bar: {
            id: "Bar",
            type: PieceType.Police,
            cells: [
                { name: "white-00", coord: { x: -1, y: 0 } },
                { name: "white-01", coord: { x: 0, y: 0 } },
                { name: "white-02", coord: { x: 1, y: 0 } },
            ],
            origin: 1,
            rotation: 0,
            policeAt: 1,
        },
    };
}

describe("用满全部棋子的可解性", () => {
    // 小偷在 (2,2)：贴着右上角，去路只剩 (1,2) 与 (2,1) 两条
    const THIEF = { x: 2, y: 2 };

    it("两枚单格棋子刚好堵住两条去路", () => {
        const pieces = enumeratePlacements(cellPieces(2), 6, THIEF);
        expect(canCaptureUsingAllPieces(pieces, 6, THIEF, [])).toBe(true);
    });

    it("棋子少于去路条数时不可解", () => {
        const pieces = enumeratePlacements(cellPieces(1), 6, THIEF);
        expect(canCaptureUsingAllPieces(pieces, 6, THIEF, [])).toBe(false);
    });

    it("建筑堵掉一条去路后，一枚棋子即可解出", () => {
        const pieces = enumeratePlacements(cellPieces(1), 6, THIEF);
        expect(canCaptureUsingAllPieces(pieces, 6, THIEF, [{ x: 1, y: 2 }])).toBe(true);
    });

    it("即便已经围住小偷，棋子放不下仍然算不可解", () => {
        // 建筑已把两条去路堵死（围捕成立），但棋盘只剩一格空地，两枚棋子摆不开
        const blocked = allCellsExcept(THIEF, { x: 0, y: 0 });
        const pieces = enumeratePlacements(cellPieces(2), 6, THIEF);
        expect(canCaptureUsingAllPieces(pieces, 6, THIEF, blocked)).toBe(false);
    });

    it("一枚棋子无处可放时立即返回 false", () => {
        const blocked = allCellsExcept(THIEF);
        const pieces = enumeratePlacements(cellPieces(1), 6, THIEF);
        expect(canCaptureUsingAllPieces(pieces, 6, THIEF, blocked)).toBe(false);
    });
});

describe("findFullSquadSolutionDetailed 三态结果", () => {
    const THIEF = { x: 2, y: 2 };

    it("找到解时返回 solved 与落点列表", () => {
        const pieces = enumeratePlacements(cellPieces(2), 6, THIEF);
        const result = findFullSquadSolutionDetailed(pieces, 6, THIEF, []);
        expect(result.status).toBe('solved');
        expect(result.solution).not.toBeNull();
        expect(result.solution).toHaveLength(2);
        expect(result.nodes).toBeGreaterThan(0);
    });

    it("穷尽摆法无解时返回 unsat", () => {
        // 只有一枚单格棋子，却要堵住两条去路，必然无解
        const pieces = enumeratePlacements(cellPieces(1), 6, THIEF);
        const result = findFullSquadSolutionDetailed(pieces, 6, THIEF, []);
        expect(result.status).toBe('unsat');
        expect(result.solution).toBeNull();
    });

    it("一枚棋子没有任何合法落点时直接 unsat", () => {
        const blocked = allCellsExcept(THIEF);
        const pieces = enumeratePlacements(cellPieces(1), 6, THIEF);
        const result = findFullSquadSolutionDetailed(pieces, 6, THIEF, blocked);
        expect(result.status).toBe('unsat');
        expect(result.solution).toBeNull();
    });

    it("节点预算为 0 时无法判定，返回 unknown", () => {
        const pieces = enumeratePlacements(cellPieces(2), 6, THIEF);
        const result = findFullSquadSolutionDetailed(pieces, 6, THIEF, [], 0);
        expect(result.status).toBe('unknown');
        expect(result.solution).toBeNull();
        expect(result.nodes).toBeGreaterThan(0);
    });

    it("极小预算下任何稍微展开的搜索都会落到 unknown", () => {
        // 两枚棋子、空棋盘：根节点就要展开分支，预算 1 不足以得出结论
        const pieces = enumeratePlacements(cellPieces(2), 6, { x: 0, y: 0 });
        const result = findFullSquadSolutionDetailed(pieces, 6, { x: 0, y: 0 }, [], 1);
        expect(result.status).toBe('unknown');
    });

});

describe("enumeratePlacements 落点去重", () => {
    const THIEF = { x: 0, y: 0 };

    it("旋转对称的朝向只保留一个候选：每个 anchor 横/竖各一个占格集合", () => {
        const pieces = enumeratePlacements(barPieces(), 6, THIEF);
        expect(pieces).toHaveLength(1);
        const bar = pieces[0] as SolverPiece;

        // 按 anchor 归组：同一 anchor 最多 2 个不同占格集合（横条、竖条）
        const byAnchor = new Map<string, Set<string>>();
        for (const pl of bar.placements) {
            const anchorKey = `${pl.anchor.x},${pl.anchor.y}`;
            const cellsKey = pl.cells.map(c => `${c.x},${c.y}`).sort().join("|");
            let set = byAnchor.get(anchorKey);
            if (!set) {
                set = new Set<string>();
                byAnchor.set(anchorKey, set);
            }
            expect(set.has(cellsKey), `anchor ${anchorKey} 出现重复占格候选`).toBe(false);
            set.add(cellsKey);
            expect(set.size).toBeLessThanOrEqual(2);
        }

        // 棋盘 6×6：横条可放 6 行 × 4 列、竖条 4 行 × 6 列，共 48 个候选；
        // 再减去占格含小偷 (0,0) 的 6 个（横条 y=0 行 x∈-1..1 共 3 个，竖条 x=0 列 y∈-1..1 共 3 个）
        expect(bar.placements.length).toBe(6 * 4 + 4 * 6 - 6);
    });

    it("单格棋子四个朝向完全等价，只保留一个候选", () => {
        const pieces = enumeratePlacements(cellPieces(1), 6, THIEF);
        // 36 格去掉小偷格 = 35 个落点
        expect(pieces[0].placements.length).toBe(35);
    });
});