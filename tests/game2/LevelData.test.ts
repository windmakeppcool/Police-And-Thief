import { describe, expect, it } from "vitest";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { enumeratePlacements, findFullSquadSolutionDetailed, minMovesToCapture } from "./helpers/levelSolver";
import {
    LEVEL_01_SOLUTION,
    deployablePoliceCatalog,
    fixedBlockedCells,
    loadLevelFile,
} from "./helpers/levelFixtures";

const level = loadLevelFile("level_01");

describe("关卡数据 level_01", () => {
    const { gridSize, thief, buildings } = level;

    it("基础配置为 6×6 棋盘，小偷在内部坐标 (0,-1)", () => {
        expect(gridSize).toBe(6);
        expect(thief).toEqual({ x: 0, y: -1 });
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

    it("开局时小偷尚未被围住", () => {
        expect(new GameSession(level, BoardPieces).captured).toBe(false);
    });

    it("预置就位后，再部署 1 枚警察即可围住小偷", () => {
        const blocked = fixedBlockedCells(level);
        // 建筑与预置警察都是固定路障，最少步数只统计还需要玩家部署的警察
        const pieces = enumeratePlacements(deployablePoliceCatalog(level), gridSize, thief);

        expect(minMovesToCapture(pieces, gridSize, thief, blocked, 0)).toBeNull();
        expect(minMovesToCapture(pieces, gridSize, thief, blocked, 1)).toBe(1);
    });

    it("参考解摆满全部六枚（3 枚预置 + 3 枚部署）后围住小偷", () => {
        const session = new GameSession(level, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            expect(
                session.place(step.pieceId, step.anchor, step.rotation),
                `${step.pieceId} 落在 (${step.anchor.x}, ${step.anchor.y}) 应当合法`,
            ).toBe(true);
        }
        expect(session.getPoliceIds()).toHaveLength(6);
        expect(session.moveCount).toBe(6);
        expect(session.captured).toBe(true);
        expect(session.won).toBe(true);
    });
});

describe("预置警察棋子", () => {
    const preset = level.police[0];
    const presetCount = level.police.length;
    const [firstStep] = LEVEL_01_SOLUTION;

    it("预置棋子开局就在棋盘上，且不会把小偷直接围死", () => {
        const session = new GameSession(level, BoardPieces);
        expect(session.isLocked(preset.pieceId)).toBe(true);
        expect(session.getPresetPoliceIds()).toHaveLength(presetCount);
        expect(session.getTrayPoliceIds()).not.toContain(preset.pieceId);
        expect(session.getTrayPoliceIds()).toHaveLength(6 - presetCount);
        expect(session.getPlacement(preset.pieceId)).toEqual({ anchor: preset.anchor, rotation: preset.rotation });
        expect(session.moveCount).toBe(presetCount);
        expect(session.captured).toBe(false);
    });

    it("预置棋子锁定：不能落子、撤下、转向或在托盘预转", () => {
        const session = new GameSession(level, BoardPieces);
        expect(session.place(preset.pieceId, { x: 0, y: 0 })).toBe(false);
        expect(session.remove(preset.pieceId)).toBe(false);
        expect(session.rotate(preset.pieceId)).toBe(false);
        expect(session.canRotate(preset.pieceId)).toBe(false);
        expect(session.rotateInTray(preset.pieceId)).toBe(false);
        expect(session.canPlaceAt(preset.pieceId, { x: 0, y: 0 })).toBe(false);
    });

    it("预置棋子占住的格子不能被其它棋子重叠", () => {
        const session = new GameSession(level, BoardPieces);
        // 直接落在预置棋子的 anchor 上必然冲突（anchor 本身也是预置棋子的占格）
        expect(session.place(firstStep.pieceId, preset.anchor, firstStep.rotation)).toBe(false);
    });

    it("求解器把预置棋子当路障，只让其余警察全部上场即可围住小偷", () => {
        const blocked = fixedBlockedCells(level);
        expect(blocked.length).toBeGreaterThan(
            level.buildings.flatMap(b =>
                toAbsoluteCells(pieceCells(BoardPieces[b.pieceId], b.rotation), b.anchor)).length,
        );
        const pieces = enumeratePlacements(deployablePoliceCatalog(level), level.gridSize, level.thief);
        const result = findFullSquadSolutionDetailed(pieces, level.gridSize, level.thief, blocked);
        expect(result.status).toBe("solved");
        expect(result.solution).not.toBeNull();
        // 解里不能再出现预置的那 3 枚棋子
        const presetIds = new Set(level.police.map(p => p.pieceId));
        expect(result.solution!.every(step => !presetIds.has(step.pieceId))).toBe(true);
        expect(result.solution).toHaveLength(6 - presetCount);

        const session = new GameSession(level, BoardPieces);
        for (const step of result.solution!) {
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }
        expect(session.moveCount).toBe(6);
        expect(session.won).toBe(true);
    });

    it("预置棋子不进求解目录；重开后预置棋子仍在原位，玩家棋子回托盘", () => {
        const session = new GameSession(level, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }
        expect(session.moveCount).toBe(6);
        session.reset();
        expect(session.moveCount).toBe(presetCount);
        expect(session.getPlacement(preset.pieceId)).toEqual({ anchor: preset.anchor, rotation: preset.rotation });
        expect(session.getPlacement(firstStep.pieceId)).toBeNull();
    });
});
