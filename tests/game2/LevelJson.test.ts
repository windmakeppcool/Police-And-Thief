import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { parseLevel, parseLevelIndex } from "../../assets/GScript/game/level/LevelParser";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import { findFullSquadSolutionDetailed, enumeratePlacements, SOLVER_NODE_BUDGET } from "./helpers/levelSolver";
import { deployablePoliceCatalog, fixedBlockedCells } from "./helpers/levelFixtures";

const LEVELS_DIR = fileURLToPath(new URL("../../assets/Game/levels/", import.meta.url));

const readJson = (name: string): unknown =>
    JSON.parse(readFileSync(join(LEVELS_DIR, name), "utf8"));

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

    it("每关结构合法，且预置之外的警察全部上场即可解", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        for (const levelId of index) {
            const level = parseLevel(readJson(`${levelId}.json`), BoardPieces);
            // 固定路障 = 建筑 + 预置警察；预置警察开局就在棋盘上，不能算作玩家可落的子
            const blocked = fixedBlockedCells(level);

            // 开局是否已被围住不影响可解性判定：围住时求解只要求剩余警察能全部合法放下
            // （游戏仍要求六枚全部上场才判胜，所以「围住 + 放不满」同样无解）
            // 只用「关卡没有预置」的警察棋子求解：预置棋子已作为路障计入 blocked
            const solverPieces = enumeratePlacements(deployablePoliceCatalog(level), level.gridSize, level.thief);
            const result = findFullSquadSolutionDetailed(solverPieces, level.gridSize, level.thief, blocked);

            // 搜索节点不应逼近预算：超过一半说明该关已接近当前求解能力的上限
            expect(
                result.nodes,
                `${levelId} 求解访问 ${result.nodes} 个节点，超过预算 ${SOLVER_NODE_BUDGET} 的 50%，请关注求解性能`,
            ).toBeLessThanOrEqual(SOLVER_NODE_BUDGET * 0.5);

            expect(
                result.status,
                result.status === 'unknown'
                    ? `${levelId} 求解预算不足：访问节点超过 ${SOLVER_NODE_BUDGET}，无法判定是否可解`
                    : `${levelId} 关卡无解：穷尽摆法后不存在「预置棋子就位 + 其余警察全部上场」的围捕解`,
            ).toBe('solved');
            expect(result.solution, `${levelId} 应当存在「其余警察全部上场」的围捕解`).not.toBeNull();

            // 把解交给 GameSession 落一遍，确保求解器的模型与真实规则一致
            const session = new GameSession(level, BoardPieces);
            for (const step of result.solution!) {
                expect(
                    session.place(step.pieceId, step.anchor, step.rotation),
                    `${levelId}: ${step.pieceId} 落在 (${step.anchor.x}, ${step.anchor.y}) 应当合法`,
                ).toBe(true);
            }
            expect(session.moveCount, `${levelId} 解完应当六枚警察全部在场`).toBe(
                session.getPoliceIds().length,
            );
            expect(session.won, `${levelId} 预置就位、其余警察摆满并围住小偷后应当获胜`).toBe(true);
        }
    });
});