import { describe, expect, it } from "vitest";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import type { LevelData } from "../../assets/GScript/game/common/GameTypes";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { thiefExits } from "../../assets/GScript/game/rules/WinCondition";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { enumeratePlacements, findFullSquadSolutionDetailed, minMovesToCapture } from "./helpers/levelSolver";
import {
    LEVEL_01_SOLUTION,
    POLICE_ONLY_PIECES,
    deployablePoliceCatalog,
    fixedBlockedCells,
    loadLevelFile,
} from "./helpers/levelFixtures";

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
        // 建筑是固定路障，最少步数只统计玩家可落的警察棋子
        const solverPieces = enumeratePlacements(POLICE_ONLY_PIECES, gridSize, thief);

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
        expect(session.won).toBe(true);
    });
});

describe("预置警察棋子", () => {
    // 把 level_01 参考解里的第一枚棋子改成关卡预置，其余 5 枚仍由玩家部署
    const preset = LEVEL_01_SOLUTION[0];
    const presetLevel: LevelData = {
        ...level,
        police: [{ pieceId: preset.pieceId, anchor: preset.anchor, rotation: preset.rotation }],
    };
    const remainingSolution = LEVEL_01_SOLUTION.slice(1);

    it("预置棋子开局就在棋盘上，且不会把小偷直接围死", () => {
        const session = new GameSession(presetLevel, BoardPieces);
        expect(session.isLocked(preset.pieceId)).toBe(true);
        expect(session.getPresetPoliceIds()).toEqual([preset.pieceId]);
        expect(session.getTrayPoliceIds()).not.toContain(preset.pieceId);
        expect(session.getTrayPoliceIds()).toHaveLength(5);
        expect(session.getPlacement(preset.pieceId)).toEqual({ anchor: preset.anchor, rotation: preset.rotation });
        expect(session.moveCount).toBe(1);
        expect(session.captured).toBe(false);
    });

    it("预置棋子锁定：不能落子、撤下、转向或在托盘预转", () => {
        const session = new GameSession(presetLevel, BoardPieces);
        expect(session.place(preset.pieceId, { x: 0, y: 0 })).toBe(false);
        expect(session.remove(preset.pieceId)).toBe(false);
        expect(session.rotate(preset.pieceId)).toBe(false);
        expect(session.canRotate(preset.pieceId)).toBe(false);
        expect(session.rotateInTray(preset.pieceId)).toBe(false);
        expect(session.canPlaceAt(preset.pieceId, { x: 0, y: 0 })).toBe(false);
    });

    it("预置棋子占住的格子不能被其它棋子重叠", () => {
        const session = new GameSession(presetLevel, BoardPieces);
        // 直接落在预置棋子的 anchor 上必然冲突
        expect(session.place(remainingSolution[0].pieceId, preset.anchor)).toBe(false);
    });

    it("求解器把预置棋子当路障，只让其余警察全部上场即可围住小偷", () => {
        const blocked = fixedBlockedCells(presetLevel);
        expect(blocked.length).toBeGreaterThan(
            level.buildings.flatMap(b => toAbsoluteCells(pieceCells(BoardPieces[b.pieceId], b.rotation), b.anchor)).length,
        );
        const pieces = enumeratePlacements(deployablePoliceCatalog(presetLevel), level.gridSize, level.thief);
        const result = findFullSquadSolutionDetailed(pieces, level.gridSize, level.thief, blocked);
        expect(result.status).toBe("solved");
        expect(result.solution).not.toBeNull();
        // 解里不能再出现预置的那枚棋子
        expect(result.solution!.every(step => step.pieceId !== preset.pieceId)).toBe(true);
        expect(result.solution).toHaveLength(5);

        const session = new GameSession(presetLevel, BoardPieces);
        for (const step of result.solution!) {
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }
        expect(session.moveCount).toBe(6);
        expect(session.won).toBe(true);
    });

    it("预置棋子不进求解目录；重开后预置棋子仍在原位，玩家棋子回托盘", () => {
        const session = new GameSession(presetLevel, BoardPieces);
        for (const step of remainingSolution) {
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }
        expect(session.moveCount).toBe(6);
        session.reset();
        expect(session.moveCount).toBe(1);
        expect(session.getPlacement(preset.pieceId)).toEqual({ anchor: preset.anchor, rotation: preset.rotation });
        expect(session.getPlacement(remainingSolution[0].pieceId)).toBeNull();
    });
});
