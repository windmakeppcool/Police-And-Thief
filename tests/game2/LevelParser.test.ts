import { describe, expect, it } from "vitest";
import { PieceType, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import {
    LevelParseError,
    parseLevel,
    toGridCoord,
    toJsonCoord,
} from "../../assets/GScript/game/level/LevelParser";

/** 只放一个 L 形建筑和一个警察，够跑结构/几何用例 */
const CATALOG: PieceCatalog = {
    "Structure-001": {
        id: "Structure-001",
        type: PieceType.Building,
        cells: [
            { name: "white-00", coord: { x: 0, y: 2 } },
            { name: "white-01", coord: { x: 0, y: 1 } },
            { name: "white-02", coord: { x: 0, y: 0 } },
            { name: "white-03", coord: { x: 1, y: 0 } },
        ],
        origin: 2,
        rotation: 0,
    },
    "PoliceUI-002": {
        id: "PoliceUI-002",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 1, y: 0 } },
        ],
        origin: 1,
        rotation: 0,
        policeAt: 1,
    },
};

const baseLevel = () => ({
    id: "level_test",
    gridSize: 6,
    thief: { x: 4, y: 1 },
    buildings: [] as unknown[],
});

/** 断言解析失败并返回收集到的错误列表 */
function parseErrors(raw: unknown): string[] {
    try {
        parseLevel(raw, CATALOG);
    } catch (e) {
        if (e instanceof LevelParseError) return [...e.errors];
        throw e;
    }
    throw new Error("期望抛出 LevelParseError，但解析成功了");
}

describe("坐标换算", () => {
    it("左上原点列/行换算为内部网格坐标", () => {
        // gridSize=6：JSON (0,0) 左上 -> 内部 (-3, 2)；(5,5) 右下 -> 内部 (2, -3)
        expect(toGridCoord({ x: 0, y: 0 }, 6)).toEqual({ x: -3, y: 2 });
        expect(toGridCoord({ x: 5, y: 5 }, 6)).toEqual({ x: 2, y: -3 });
        expect(toGridCoord({ x: 4, y: 1 }, 6)).toEqual({ x: 1, y: 1 });
    });

    it("逆变换回到 JSON 坐标", () => {
        for (const json of [{ x: 0, y: 0 }, { x: 2, y: 5 }, { x: 4, y: 1 }, { x: 3, y: 3 }]) {
            expect(toJsonCoord(toGridCoord(json, 6), 6)).toEqual(json);
        }
    });
});

describe("结构校验", () => {
    it("合法关卡解析为 LevelData，坐标已换算", () => {
        const level = parseLevel(baseLevel(), CATALOG);
        expect(level).toEqual({
            id: "level_test",
            gridSize: 6,
            thief: { x: 1, y: 1 },
            buildings: [],
        });
    });

    it("建筑 anchor 换算为内部坐标且保留 rotation", () => {
        const level = parseLevel(
            { ...baseLevel(), buildings: [{ pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 180 }] },
            CATALOG,
        );
        expect(level.buildings).toEqual([
            { pieceId: "Structure-001", anchor: { x: -2, y: 1 }, rotation: 180 },
        ]);
    });

    it("顶层未知字段报错", () => {
        const errors = parseErrors({ ...baseLevel(), gridSizee: 6 });
        expect(errors.some(e => e.includes('"gridSizee"'))).toBe(true);
    });

    it("buildings 内未知字段报错", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 0, note: "x" }],
        });
        expect(errors.some(e => e.includes('buildings[0]') && e.includes('"note"'))).toBe(true);
    });

    it("id 必须是非空字符串", () => {
        expect(parseErrors({ ...baseLevel(), id: "" }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), id: 42 }).length).toBeGreaterThan(0);
    });

    it("gridSize 必须是不小于 2 的偶数", () => {
        expect(parseErrors({ ...baseLevel(), gridSize: 5 }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), gridSize: 0 }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), gridSize: 6.5 }).length).toBeGreaterThan(0);
    });

    it("thief 必须是整数坐标对象", () => {
        expect(parseErrors({ ...baseLevel(), thief: { x: 1.5, y: 1 } }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), thief: null }).length).toBeGreaterThan(0);
    });

    it("buildings 必须是数组", () => {
        expect(parseErrors({ ...baseLevel(), buildings: {} }).length).toBeGreaterThan(0);
    });

    it("pieceId 必须存在于目录且是建筑棋子", () => {
        const missing = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-999", anchor: { x: 1, y: 1 }, rotation: 0 }],
        });
        expect(missing.some(e => e.includes("buildings[0].pieceId"))).toBe(true);

        const notBuilding = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "PoliceUI-002", anchor: { x: 1, y: 1 }, rotation: 0 }],
        });
        expect(notBuilding.some(e => e.includes("不是建筑棋子"))).toBe(true);
    });

    it("rotation 只接受 0/90/180/270", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 45 }],
        });
        expect(errors.some(e => e.includes("buildings[0].rotation") && e.includes("45"))).toBe(true);
    });

    it("anchor 必须是棋盘内的整数坐标", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 9, y: 1 }, rotation: 0 }],
        });
        expect(errors.some(e => e.includes("buildings[0].anchor") && e.includes("(9, 1)"))).toBe(true);
    });

    it("一次收集全部错误，不 fail-fast", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [
                { pieceId: "Structure-999", anchor: { x: 1, y: 1 }, rotation: 0 },
                { pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 45 },
            ],
        });
        expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it("顶层字段非法时仍收集 buildings 内的独立错误", () => {
        const errors = parseErrors({
            ...baseLevel(),
            id: "",
            gridSize: 5,
            buildings: [{ pieceId: "Structure-999", anchor: { x: 1, y: 1 }, rotation: 45 }],
        });
        expect(errors.length).toBeGreaterThanOrEqual(4);
        expect(errors.some(e => e.startsWith("id:"))).toBe(true);
        expect(errors.some(e => e.startsWith("gridSize:"))).toBe(true);
        expect(errors.some(e => e.includes("buildings[0].pieceId") && e.includes("Structure-999"))).toBe(true);
        expect(errors.some(e => e.includes("buildings[0].rotation") && e.includes("45"))).toBe(true);
    });

    it("entry 的 pieceId 非法时仍收集同 entry 的 anchor / rotation 错误", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-999", anchor: { x: 9, y: 1 }, rotation: 45 }],
        });
        expect(errors.length).toBeGreaterThanOrEqual(3);
        expect(errors.some(e => e.includes("buildings[0].pieceId"))).toBe(true);
        expect(errors.some(e => e.includes("buildings[0].rotation") && e.includes("45"))).toBe(true);
        expect(errors.some(e => e.includes("buildings[0].anchor") && e.includes("(9, 1)"))).toBe(true);
    });

    it("错误消息里的坐标是 JSON 列/行，不是内部坐标", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 9, y: 1 }, rotation: 0 }],
        });
        expect(errors.some(e => e.includes("(9, 1)"))).toBe(true);
        expect(errors.some(e => e.includes("(6, 1)"))).toBe(false);
    });
});
