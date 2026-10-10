import { describe, expect, it } from "vitest";
import { PieceType, type Piece, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import { canCaptureUsingAllPieces, enumeratePlacements } from "./helpers/levelSolver";

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
