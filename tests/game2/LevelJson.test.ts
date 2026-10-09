import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PieceType, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { isThiefCaptured } from "../../assets/GScript/game/rules/WinCondition";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { parseLevel, parseLevelIndex } from "../../assets/GScript/game/level/LevelParser";
import { enumeratePlacements, minMovesToCapture } from "./helpers/levelSolver";

const LEVELS_DIR = fileURLToPath(new URL("../../assets/Game/levels/", import.meta.url));

const readJson = (name: string): unknown =>
    JSON.parse(readFileSync(join(LEVELS_DIR, name), "utf8"));

/**
 * 只用警察棋子求解：建筑是固定路障，不能算作玩家可落的子，
 * 否则「可解」会被建筑棋子的落点误判为成立。
 */
const POLICE_ONLY: PieceCatalog = Object.fromEntries(
    Object.entries(BoardPieces).filter(([, piece]) => piece.type === PieceType.Police),
);

/** 三星线：步数 ≤4 即三星，关卡至少要在这条线内可解 */
const SOLVE_LIMIT = 4;

describe("关卡 JSON 资料", () => {
    const levelFiles = readdirSync(LEVELS_DIR)
        .filter(name => /^level_.*\.json$/.test(name))
        .sort();

    it("levels.json 与磁盘上的关卡文件一一对应", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        expect(index.map(id => `${id}.json`).sort()).toEqual(levelFiles);
    });

    it("每关都能通过结构与几何校验，且文件名与内部 id 一致", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        expect(index.length).toBeGreaterThan(0);
        for (const levelId of index) {
            const level = parseLevel(readJson(`${levelId}.json`), BoardPieces);
            expect(level.id).toBe(levelId);
        }
    });

    it("每关开局小偷尚未被围死，且在三星线内可解", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        for (const levelId of index) {
            const level = parseLevel(readJson(`${levelId}.json`), BoardPieces);
            const blocked = level.buildings.flatMap(b =>
                toAbsoluteCells(pieceCells(BoardPieces[b.pieceId], b.rotation), b.anchor),
            );

            const occupancy = new Map<string, string>();
            blocked.forEach(cell => occupancy.set(coordKey(cell), "building"));
            expect(
                isThiefCaptured(level.gridSize, level.thief, occupancy),
                `${levelId} 开局不应已被围死`,
            ).toBe(false);

            const solverPieces = enumeratePlacements(POLICE_ONLY, level.gridSize, level.thief);
            const min = minMovesToCapture(solverPieces, level.gridSize, level.thief, blocked, SOLVE_LIMIT);
            expect(min, `${levelId} 在 ${SOLVE_LIMIT} 步内应可解`).not.toBeNull();
            expect(min as number).toBeGreaterThanOrEqual(1);
        }
    });
});
