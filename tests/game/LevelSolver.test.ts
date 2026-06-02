import { describe, expect, it } from "vitest";
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from "../../assets/GScript/game/level/LevelExamples";
import { buildPlacementCandidates, solveLevel } from "../../assets/GScript/game/level/LevelSolver";
import { PieceType, type LevelData } from "../../assets/GScript/game/domain/GameTypes";

describe("buildPlacementCandidates", () => {
  it("builds in-bounds candidate placements for available police inventory", () => {
    const candidates = buildPlacementCandidates(EXAMPLE_SHAPES, EXAMPLE_LEVEL, [0]);

    expect(candidates.length).toBeGreaterThan(100);
    expect(candidates).toContainEqual({ shapeId: "police_002", origin: { x: 0, y: 0 }, rotation: 0 });
    expect(candidates).toContainEqual({ shapeId: "police_003", origin: { x: 4, y: 5 }, rotation: 0 });
    // police_001 左侧越界，origin=(0,0) 不合法
    expect(candidates).not.toContainEqual({ shapeId: "police_001", origin: { x: 0, y: 0 }, rotation: 0 });
  });
});

describe("solveLevel", () => {
  it("finds a winning sequence for the built-in development level", () => {
    const result = solveLevel(EXAMPLE_SHAPES, EXAMPLE_LEVEL, { maxDepth: 4, rotations: [0] });

    expect(result.solved).toBe(true);
    expect(result.placements.length).toBeGreaterThanOrEqual(1);
  });

  it("reports unsolved when inventory cannot block all escape paths", () => {
    const impossibleLevel: LevelData = {
      ...EXAMPLE_LEVEL,
      policeInventory: [{ shapeId: "police_006", count: 2 }]
    };

    const result = solveLevel(EXAMPLE_SHAPES, impossibleLevel, { maxDepth: 2, rotations: [0] });

    expect(result).toEqual({ solved: false, placements: [] });
  });

  it("uses buildings as fixed blockers while solving", () => {
    // 用 police_1x1 测试建筑辅助求解，逻辑最简单
    const level: LevelData = {
      id: "test_buildings",
      board: { width: 3, height: 3 },
      thief: { x: 1, y: 1 },
      buildings: [
        { id: "b_up", shapeId: "building_1x1", type: PieceType.Building, origin: { x: 1, y: 2 }, rotation: 0 },
        { id: "b_down", shapeId: "building_1x1", type: PieceType.Building, origin: { x: 1, y: 0 }, rotation: 0 }
      ],
      policeInventory: [{ shapeId: "police_1x1", count: 2 }]
    };

    const result = solveLevel(EXAMPLE_SHAPES, level, { maxDepth: 2, rotations: [0] });

    expect(result.solved).toBe(true);
    expect(result.placements).toHaveLength(2);
    expect(result.placements).toEqual(
      expect.arrayContaining([
        { shapeId: "police_1x1", origin: { x: 0, y: 1 }, rotation: 0 },
        { shapeId: "police_1x1", origin: { x: 2, y: 1 }, rotation: 0 }
      ])
    );
  });
});
