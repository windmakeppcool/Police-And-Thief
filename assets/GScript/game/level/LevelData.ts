import type { BuildingPlacement, LevelData } from "../common/GameTypes";

/**
 * 示例关卡：6×6 棋盘，小偷在 (1,1)。
 *
 * 建筑障碍由关卡数据自动摆放（见 buildings），不参与玩家操作，
 * 只作为围堵小偷的固定路障。
 *
 * 关卡难度：两步内无法围住，最少需要 3 步（≤4 步即三星），
 * 参考解见 EXAMPLE_SOLUTION，由 tests/game2/LevelData.test.ts 校验。
 */
export const EXAMPLE_LEVEL: LevelData = {
    id: "level_01",
    gridSize: 6,
    thief: { x: 1, y: 1 },
    buildings: [
        { pieceId: "Structure-001", anchor: { x: -2, y: 1 }, rotation: 180 },
        { pieceId: "Structure-002", anchor: { x: 0, y: -2 }, rotation: 0 },
        { pieceId: "Structure-003", anchor: { x: -1, y: 2 }, rotation: 90 },
        { pieceId: "Structure-004", anchor: { x: -1, y: -3 }, rotation: 0 },
    ],
};

/** 示例关卡的参考解：3 步围住小偷（三星） */
export const EXAMPLE_SOLUTION: ReadonlyArray<BuildingPlacement> = [
    { pieceId: "PoliceUI-002", anchor: { x: 1, y: -1 }, rotation: 0 },
    { pieceId: "PoliceUI-004", anchor: { x: 2, y: 2 }, rotation: 180 },
    { pieceId: "PoliceUI-006", anchor: { x: -1, y: 1 }, rotation: 180 },
];
