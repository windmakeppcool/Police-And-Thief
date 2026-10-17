import { describe, expect, it } from "vitest";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import { PieceType, type LevelData, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import { LEVEL_01_SOLUTION, fixedBlockedCells, loadLevelFile } from "./helpers/levelFixtures";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { TEST_CATALOG } from "./helpers/levelSolver";

const LEVEL_01 = loadLevelFile("level_01");

const EMPTY_LEVEL: LevelData = {
    id: 'unit',
    gridSize: 6,
    thief: { x: 1, y: 1 },
    buildings: [],
    police: [],
};

const CATALOG: PieceCatalog = { ...TEST_CATALOG };

/** 给 CATALOG 补一枚单格建筑，返回带该建筑的关卡 */
function levelWithBuilding(anchor: { x: number; y: number }): {
    level: LevelData;
    catalog: PieceCatalog;
} {
    const catalog: PieceCatalog = {
        ...CATALOG,
        'Building-A': {
            id: 'Building-A',
            type: PieceType.Building,
            cells: [{ name: 'white-00', coord: { x: 0, y: 0 } }],
            origin: 0,
            rotation: 0,
        },
    };
    const level: LevelData = { ...EMPTY_LEVEL, buildings: [{ pieceId: 'Building-A', anchor, rotation: 0 }] };
    return { level, catalog };
}

/**
 * 用 TEST_CATALOG 的 3 枚警察 + 4 枚单格建筑拼一个「开局小偷已被围住、
 * 但还有警察留在托盘」的关卡，用来验证开局围住并不会直接结束游戏。
 */
function capturedStartLevel(): { level: LevelData; catalog: PieceCatalog } {
    const buildingIds = ["Building-1", "Building-2", "Building-3", "Building-4"];
    const exits = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const buildings = exits.map((anchor, i) => ({ pieceId: buildingIds[i], anchor, rotation: 0 as const }));
    const catalog: PieceCatalog = {
        ...CATALOG,
        ...Object.fromEntries(
            buildingIds.map(id => [
                id,
                {
                    id,
                    type: PieceType.Building,
                    cells: [{ name: 'white-00', coord: { x: 0, y: 0 } }],
                    origin: 0,
                    rotation: 0 as const,
                },
            ]),
        ),
    };
    return {
        level: { id: 'captured-start', gridSize: 6, thief: { x: 0, y: 0 }, buildings, police: [] },
        catalog,
    };
}

describe("GameSession 基础操作", () => {
    it("列出可操作的警察棋子", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.getPoliceIds()).toEqual(['Police-A', 'Police-B', 'Police-C']);
        expect(session.moveCount).toBe(0);
        expect(session.undoCount).toBe(0);
    });

    it("拒绝越界、踩小偷与重叠的落点", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);

        expect(session.canPlaceAt('Police-A', { x: 2, y: 2 })).toBe(false);
        expect(session.place('Police-A', { x: 2, y: 2 })).toBe(false);
        expect(session.place('Police-A', { x: 1, y: 1 })).toBe(false);

        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        expect(session.place('Police-A', { x: -2, y: 0 })).toBe(false);
        expect(session.moveCount).toBe(1);
    });

    it("只有首次上岗才计入步数", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        expect(session.moveCount).toBe(1);

        expect(session.place('Police-C', { x: 1, y: -2 })).toBe(true);
        expect(session.moveCount).toBe(1);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: 1, y: -2 });
    });

    it("原地旋转保持 anchor 不变，越界时旋转失败", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        session.place('Police-C', { x: -2, y: 0 });
        expect(session.getRotation('Police-C')).toBe(0);
        expect(session.canRotate('Police-C')).toBe(true);
        expect(session.rotate('Police-C')).toBe(true);
        expect(session.getRotation('Police-C')).toBe(90);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: -2, y: 0 });
        expect(session.cellsAt('Police-C', { x: -2, y: 0 })).toEqual([
            { x: -2, y: -1 }, { x: -2, y: 0 }, { x: -2, y: 1 },
        ]);

        // 贴着下边界，旋转后会出界
        expect(session.place('Police-B', { x: -3, y: -3 })).toBe(true);
        expect(session.canRotate('Police-B')).toBe(false);
        expect(session.rotate('Police-B')).toBe(false);
        expect(session.getRotation('Police-B')).toBe(0);
    });

    it("原地放回同一格不产生撤销记录", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        expect(session.undoCount).toBe(1);

        // 拖起来又放回原处：位置与朝向都没变，不应污染撤销
        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        expect(session.undoCount).toBe(1);
        expect(session.moveCount).toBe(1);
    });

    it("撤销可以退回托盘，也可以还原到上一个落点", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        session.place('Police-C', { x: -2, y: 0 });
        session.rotate('Police-C');
        session.place('Police-C', { x: 1, y: -2 });
        // 放置、场上旋转、挪位各一条历史
        expect(session.undoCount).toBe(3);

        // 撤销挪位：回到旋转后的落点，朝向保留
        expect(session.undo()).toBe(true);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: -2, y: 0 });
        expect(session.getRotation('Police-C')).toBe(90);
        expect(session.moveCount).toBe(1);

        // 撤销旋转：原地不动，只回退朝向
        expect(session.undo()).toBe(true);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: -2, y: 0 });
        expect(session.getRotation('Police-C')).toBe(0);

        // 撤销放置：退回托盘
        expect(session.undo()).toBe(true);
        expect(session.getPlacement('Police-C')).toBeNull();
        expect(session.getRotation('Police-C')).toBe(0);
        expect(session.moveCount).toBe(0);
        expect(session.undo()).toBe(false);
    });

    it("重开清空全部落点与步数", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        session.place('Police-C', { x: -2, y: 0 });
        session.rotate('Police-C');
        session.reset();

        expect(session.moveCount).toBe(0);
        expect(session.undoCount).toBe(0);
        expect(session.getPlacement('Police-C')).toBeNull();
        expect(session.getRotation('Police-C')).toBe(0);
    });
});

describe("GameSession 撤销历史与旋转", () => {
    it("托盘预转向后放置，撤销时恢复预转向；再撤销回到更早的托盘朝向", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);

        // 托盘里预转向两次：0 -> 90 -> 180
        expect(session.rotateInTray('Police-C')).toBe(true);
        expect(session.rotateInTray('Police-C')).toBe(true);
        expect(session.getRotation('Police-C')).toBe(180);
        expect(session.undoCount).toBe(2);

        // 带着预转向落子
        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        expect(session.getRotation('Police-C')).toBe(180);

        // 撤销落子：回托盘且保留预转向 180
        expect(session.undo()).toBe(true);
        expect(session.getPlacement('Police-C')).toBeNull();
        expect(session.getRotation('Police-C')).toBe(180);
        expect(session.moveCount).toBe(0);

        // 继续撤销：托盘朝向逐次回退
        expect(session.undo()).toBe(true);
        expect(session.getRotation('Police-C')).toBe(90);
        expect(session.undo()).toBe(true);
        expect(session.getRotation('Police-C')).toBe(0);
        expect(session.undo()).toBe(false);
    });

    it("连续两次场上旋转后连续撤销：朝向逐次回退，anchor 始终不变", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        const anchor = { x: 0, y: 0 };
        expect(session.place('Police-C', anchor)).toBe(true);

        expect(session.rotate('Police-C')).toBe(true);
        expect(session.rotate('Police-C')).toBe(true);
        expect(session.getRotation('Police-C')).toBe(180);
        expect(session.getPlacement('Police-C')?.anchor).toEqual(anchor);
        expect(session.undoCount).toBe(3);

        expect(session.undo()).toBe(true);
        expect(session.getRotation('Police-C')).toBe(90);
        expect(session.getPlacement('Police-C')?.anchor).toEqual(anchor);

        expect(session.undo()).toBe(true);
        expect(session.getRotation('Police-C')).toBe(0);
        expect(session.getPlacement('Police-C')?.anchor).toEqual(anchor);
    });

    it("移动后只做一次旋转再撤销：只回退旋转，位置保持移动后的状态", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        // 挪到 (-2,-2)：横条与转 90° 后的竖条都不越界、不压小偷 (1,1)
        expect(session.place('Police-C', { x: -2, y: -2 })).toBe(true);
        expect(session.rotate('Police-C')).toBe(true);
        expect(session.getRotation('Police-C')).toBe(90);

        expect(session.undo()).toBe(true);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: -2, y: -2 });
        expect(session.getRotation('Police-C')).toBe(0);
        expect(session.moveCount).toBe(1);
    });

    it("建筑棋子调用 place/remove/rotate 一律返回 false 且状态不变", () => {
        const { level, catalog } = levelWithBuilding({ x: -3, y: -3 });
        const session = new GameSession(level, catalog);

        expect(session.canPlaceAt('Building-A', { x: 2, y: 2 })).toBe(false);
        expect(session.place('Building-A', { x: 2, y: 2 })).toBe(false);
        expect(session.canRotate('Building-A')).toBe(false);
        expect(session.rotate('Building-A')).toBe(false);
        expect(session.remove('Building-A')).toBe(false);

        // 建筑仍按关卡配置占据格子，状态未被搅动；没有任何历史产生
        expect(session.undoCount).toBe(0);
        expect(session.moveCount).toBe(0);
        expect(session.canPlaceAt('Police-C', { x: -3, y: -3 })).toBe(false);
    });

    it("已上场棋子旋转撞上其他棋子：旋转失败、朝向不变、撤销历史不增", () => {
        // 建筑在 (0,1)：Police-C 横条 rotation=0 占 (-1,0)(0,0)(1,0)，不碰建筑；
        // 顺时针转 90° 后竖条占 (0,-1)(0,0)(0,1)，顶端正好撞上建筑
        const { level, catalog } = levelWithBuilding({ x: 0, y: 1 });
        const session = new GameSession(level, catalog);

        expect(session.place('Police-C', { x: 0, y: 0 })).toBe(true);
        expect(session.undoCount).toBe(1);
        expect(session.canRotate('Police-C')).toBe(false);
        expect(session.rotate('Police-C')).toBe(false);
        expect(session.getRotation('Police-C')).toBe(0);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: 0, y: 0 });
        expect(session.undoCount).toBe(1);
    });

    it("已上场棋子挪到非法落点：返回 false，anchor/rotation 保留，撤销历史不增", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.place('Police-C', { x: -2, y: 0 })).toBe(true);
        expect(session.rotate('Police-C')).toBe(true);
        expect(session.getRotation('Police-C')).toBe(90);
        const undoBefore = session.undoCount;

        // 挪到越界位置：当前朝向是竖条（占 (x,y-1)(x,y)(x,y+1)），x=-3 时整列出界
        expect(session.place('Police-C', { x: -4, y: 0 })).toBe(false);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: -2, y: 0 });
        expect(session.getRotation('Police-C')).toBe(90);
        expect(session.moveCount).toBe(1);
        expect(session.undoCount).toBe(undoBefore);
    });
});

describe("GameSession 关卡规则", () => {
    it("开局时建筑与预置警察已占用格子且未被围住", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        const blocked = fixedBlockedCells(LEVEL_01);

        expect(blocked.length).toBeGreaterThan(0);
        expect(session.occupancy().size).toBe(blocked.length);
        expect(session.moveCount).toBe(LEVEL_01.police.length);
        expect(session.captured).toBe(false);
        expect(session.deployed).toBe(false);
    });

    it("不能把警力放到建筑、预置警察或小偷所在格", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        const building = LEVEL_01.buildings[0];
        const preset = LEVEL_01.police[0];
        expect(session.canPlaceAt("PoliceUI-001", building.anchor)).toBe(false);
        expect(session.place("PoliceUI-001", LEVEL_01.thief)).toBe(false);
        expect(session.place("PoliceUI-001", preset.anchor)).toBe(false);
    });

    it("按参考解补放其余警察后，六枚全部上场并围住小偷", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            expect(session.canPlaceAt(step.pieceId, step.anchor, step.rotation)).toBe(true);
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }

        expect(session.getPoliceIds()).toHaveLength(6);
        expect(session.moveCount).toBe(6);
        expect(session.captured).toBe(true);
        expect(session.deployed).toBe(true);
        expect(session.won).toBe(true);
    });

    it("没摆满六枚之前，即便已围住小偷也不算赢", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        // 关卡预置了 3 枚；参考解第一枚落下后，小偷的四条去路就全被堵上了
        const [first, ...rest] = LEVEL_01_SOLUTION;
        expect(session.place(first.pieceId, first.anchor, first.rotation)).toBe(true);
        expect(session.captured).toBe(true);
        expect(session.deployed).toBe(false);
        expect(session.won).toBe(false);

        for (const step of rest) {
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }
        expect(session.deployed).toBe(true);
        expect(session.won).toBe(true);
    });

    it("按 UI 的操作方式（托盘预转向 + 落子）也能用满六个棋子通关", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            // 玩家在托盘里点按棋子调好朝向（每点一次顺时针 90°）
            while (session.getRotation(step.pieceId) !== step.rotation) {
                expect(session.rotateInTray(step.pieceId)).toBe(true);
            }
            expect(session.place(step.pieceId, step.anchor)).toBe(true);
        }

        expect(session.moveCount).toBe(6);
        expect(session.won).toBe(true);
    });

    it("托盘预转向不影响已上场的棋子，也只对警察生效", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.rotateInTray('Police-A')).toBe(true);
        expect(session.getRotation('Police-A')).toBe(90);

        session.place('Police-A', { x: -2, y: 0 });
        expect(session.rotateInTray('Police-A')).toBe(false);

        const { level, catalog } = levelWithBuilding({ x: -3, y: -3 });
        const withBuilding = new GameSession(level, catalog);
        expect(withBuilding.rotateInTray('Building-A')).toBe(false);
    });
});

describe("GameSession 开局已被围住", () => {
    it("开局围住但还有棋子没放：游戏不会结束，放满全部棋子后才算赢", () => {
        const { level, catalog } = capturedStartLevel();
        const session = new GameSession(level, catalog);

        expect(session.captured).toBe(true);
        expect(session.deployed).toBe(false);
        expect(session.won).toBe(false);

        expect(session.place("Police-A", { x: -2, y: 1 })).toBe(true);
        expect(session.won).toBe(false);
        expect(session.place("Police-B", { x: 1, y: -2 })).toBe(true);
        expect(session.won).toBe(false);
        expect(session.place("Police-C", { x: -2, y: -2 })).toBe(true);
        expect(session.deployed).toBe(true);
        expect(session.won).toBe(true);
    });
});

describe("GameSession 撤下棋子", () => {
    const presetCount = LEVEL_01.police.length;
    const [firstStep] = LEVEL_01_SOLUTION;
    const lastStep = LEVEL_01_SOLUTION[LEVEL_01_SOLUTION.length - 1];

    it("撤下已上场的棋子：回到托盘，在场数下降", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        expect(session.place(firstStep.pieceId, firstStep.anchor, firstStep.rotation)).toBe(true);
        expect(session.moveCount).toBe(presetCount + 1);
        expect(session.getPlacement(firstStep.pieceId)).not.toBeNull();

        expect(session.remove(firstStep.pieceId)).toBe(true);
        expect(session.getPlacement(firstStep.pieceId)).toBeNull();
        expect(session.moveCount).toBe(presetCount);
    });

    it("撤下尚未上场的棋子返回 false", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        expect(session.remove(firstStep.pieceId)).toBe(false);
        expect(session.moveCount).toBe(presetCount);
    });

    it("撤下保留当前朝向，方便换个位置再摆", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        expect(session.place(firstStep.pieceId, firstStep.anchor, firstStep.rotation)).toBe(true);
        expect(session.getRotation(firstStep.pieceId)).toBe(firstStep.rotation);

        expect(session.remove(firstStep.pieceId)).toBe(true);
        expect(session.getRotation(firstStep.pieceId)).toBe(firstStep.rotation);
    });

    it("撤销可以把撤下的棋子原样放回", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        expect(session.place(firstStep.pieceId, firstStep.anchor, firstStep.rotation)).toBe(true);
        expect(session.remove(firstStep.pieceId)).toBe(true);
        expect(session.undoCount).toBe(2);

        expect(session.undo()).toBe(true);
        expect(session.getPlacement(firstStep.pieceId)).toEqual({
            anchor: firstStep.anchor,
            rotation: firstStep.rotation,
        });
    });

    it("撤下不会产生胜利，重新摆满后才赢", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        // 先按参考解补齐 3 枚，和预置的 3 枚合计 6 枚，达成胜利
        for (const step of LEVEL_01_SOLUTION) {
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }
        expect(session.won).toBe(true);

        // 撤下一枚：小偷仍被围住，但六枚没摆满，就不算赢
        expect(session.remove(lastStep.pieceId)).toBe(true);
        expect(session.captured).toBe(true);
        expect(session.deployed).toBe(false);
        expect(session.won).toBe(false);

        // 放回去又赢了
        expect(session.place(lastStep.pieceId, lastStep.anchor, lastStep.rotation)).toBe(true);
        expect(session.won).toBe(true);
    });
});