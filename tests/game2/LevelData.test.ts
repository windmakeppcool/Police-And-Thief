import { describe, expect, it } from "vitest";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { thiefExits } from "../../assets/GScript/game/rules/WinCondition";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { enumeratePlacements, minMovesToCapture } from "./helpers/levelSolver";
import { LEVEL_01_SOLUTION, loadLevelFile } from "./helpers/levelFixtures";

const level = loadLevelFile("level_01");

describe("关卡数据 level_01", () => {
    const { gridSize, thief, buildings } = level;

    it("基础配置为 6×6 棋盘，小偷在 (1,1)", () => {
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

    it("最少两步才能围住小偷", () => {
        const blocked = buildings.flatMap(building => {
            const piece = BoardPieces[building.pieceId];
            return toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor);
        });
        const solverPieces = enumeratePlacements(BoardPieces, gridSize, thief);

        expect(minMovesToCapture(solverPieces, gridSize, thief, blocked, 1)).toBeNull();
        expect(minMovesToCapture(solverPieces, gridSize, thief, blocked, 2)).toBe(2);
    });

    it("参考解用满六个警察棋子后围住小偷", () => {
        const session = new GameSession(level, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            expect(
                session.place(step.pieceId, step.anchor, step.rotation),
                `${step.pieceId} 落在 (${step.anchor.x}, ${step.anchor.y}) 应当合法`,
            ).toBe(true);
        }
        expect(session.moveCount).toBe(LEVEL_01_SOLUTION.length);
        expect(LEVEL_01_SOLUTION.length).toBe(6);
        expect(session.captured).toBe(true);
    });
});
