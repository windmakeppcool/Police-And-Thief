import { describe, expect, it } from "vitest";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import { PieceType, type LevelData, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import { LEVEL_01_SOLUTION, loadLevelFile } from "./helpers/levelFixtures";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { TEST_CATALOG } from "./helpers/levelSolver";

const LEVEL_01 = loadLevelFile("level_01");

const EMPTY_LEVEL: LevelData = {
    id: 'unit',
    gridSize: 6,
    thief: { x: 1, y: 1 },
    buildings: [],
};

const CATALOG: PieceCatalog = { ...TEST_CATALOG };

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
        expect(session.undoCount).toBe(2);

        expect(session.undo()).toBe(true);
        expect(session.getPlacement('Police-C')?.anchor).toEqual({ x: -2, y: 0 });
        expect(session.getRotation('Police-C')).toBe(90);
        expect(session.moveCount).toBe(1);

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

describe("GameSession 关卡规则", () => {
    it("开局时建筑已占用格子且未被围住", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        const occupancy = session.occupancy();
        const buildingCells = LEVEL_01.buildings.flatMap(b => session.cellsAt(b.pieceId, b.anchor, b.rotation));

        expect(buildingCells.length).toBe(14);
        expect(occupancy.size).toBe(14);
        expect(session.captured).toBe(false);
        expect(session.moveCount).toBe(0);
    });

    it("不能把警力放到建筑或小偷所在格", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        const building = LEVEL_01.buildings[0];
        expect(session.canPlaceAt(building.pieceId, building.anchor)).toBe(false);
        expect(session.place('PoliceUI-003', LEVEL_01.thief)).toBe(false);
    });

    it("按参考解可以三步围住小偷并拿到三星（纯逻辑层）", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            expect(session.canPlaceAt(step.pieceId, step.anchor, step.rotation)).toBe(true);
            expect(session.place(step.pieceId, step.anchor, step.rotation)).toBe(true);
        }

        expect(session.moveCount).toBe(3);
        expect(session.captured).toBe(true);
        expect(session.stars).toBe(3);
    });

    it("按 UI 的操作方式（托盘预转向 + 落子）也能三步通关", () => {
        const session = new GameSession(LEVEL_01, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            // 玩家在托盘里点按棋子调好朝向（每点一次顺时针 90°）
            while (session.getRotation(step.pieceId) !== step.rotation) {
                expect(session.rotateInTray(step.pieceId)).toBe(true);
            }
            expect(session.place(step.pieceId, step.anchor)).toBe(true);
        }

        expect(session.moveCount).toBe(3);
        expect(session.captured).toBe(true);
        expect(session.stars).toBe(3);
    });

    it("托盘预转向不影响已上场的棋子，也只对警察生效", () => {
        const session = new GameSession(EMPTY_LEVEL, CATALOG);
        expect(session.rotateInTray('Police-A')).toBe(true);
        expect(session.getRotation('Police-A')).toBe(90);

        session.place('Police-A', { x: -2, y: 0 });
        expect(session.rotateInTray('Police-A')).toBe(false);

        const levelWithBuilding: LevelData = {
            ...EMPTY_LEVEL,
            buildings: [{ pieceId: 'Building-A', anchor: { x: -3, y: -3 }, rotation: 0 }],
        };
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
        const withBuilding = new GameSession(levelWithBuilding, catalog);
        expect(withBuilding.rotateInTray('Building-A')).toBe(false);
    });
});
