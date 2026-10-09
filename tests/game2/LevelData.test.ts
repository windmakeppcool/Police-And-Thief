import { describe, expect, it } from "vitest";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { thiefExits } from "../../assets/GScript/game/rules/WinCondition";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { EXAMPLE_LEVEL, EXAMPLE_SOLUTION } from "../../assets/GScript/game/level/LevelData";
import { enumeratePlacements, minMovesToCapture } from "./helpers/levelSolver";

describe("关卡数据", () => {
    const { gridSize, thief, buildings } = EXAMPLE_LEVEL;

    it("基础配置为 6×6 棋盘", () => {
        expect(gridSize).toBe(6);
        expect(thief).toEqual({ x: 1, y: 1 });
    });

    it("建筑都在棋盘内、互不重叠且不压住小偷", () => {
        const seen = new Set<string>();
        for (const building of buildings) {
            const piece = BoardPieces[building.pieceId];
            expect(piece).toBeDefined();
            const cells = toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor);
            for (const cell of cells) {
                expect(cell.x).toBeGreaterThanOrEqual(-gridSize / 2);
                expect(cell.x).toBeLessThan(gridSize / 2);
                expect(cell.y).toBeGreaterThanOrEqual(-gridSize / 2);
                expect(cell.y).toBeLessThan(gridSize / 2);
                expect(cell).not.toEqual(thief);
                expect(seen.has(coordKey(cell))).toBe(false);
                seen.add(coordKey(cell));
            }
        }
    });

    it("开局时小偷四周仍然可通行（不能一上来就赢）", () => {
        const blocked = new Set<string>();
        for (const building of buildings) {
            const piece = BoardPieces[building.pieceId];
            toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor)
                .forEach(cell => blocked.add(coordKey(cell)));
        }
        expect(thiefExits(gridSize, thief).every(exit => !blocked.has(coordKey(exit)))).toBe(true);
    });

    it("最少三步才能围住小偷（三星需要最优解）", () => {
        const blocked = buildings.flatMap(building => {
            const piece = BoardPieces[building.pieceId];
            return toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor);
        });
        const solverPieces = enumeratePlacements(BoardPieces, gridSize, thief);

        expect(minMovesToCapture(solverPieces, gridSize, thief, blocked, 2)).toBeNull();
        expect(minMovesToCapture(solverPieces, gridSize, thief, blocked, 3)).toBe(3);
    });

    it("参考解使用的棋子在目录中存在", () => {
        for (const step of EXAMPLE_SOLUTION) {
            expect(BoardPieces[step.pieceId]).toBeDefined();
        }
    });
});
