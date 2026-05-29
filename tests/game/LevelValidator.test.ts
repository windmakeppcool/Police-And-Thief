import { describe, expect, it } from "vitest";
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from "../../assets/GScript/game/level/LevelExamples";
import { validateLevel } from "../../assets/GScript/game/level/LevelValidator";
import { PieceType, type LevelData, type ShapeCatalog } from "../../assets/GScript/game/domain/GameTypes";

describe("validateLevel", () => {
  it("accepts the built-in development level", () => {
    expect(validateLevel(EXAMPLE_SHAPES, EXAMPLE_LEVEL)).toEqual({ ok: true, errors: [] });
  });

  it("reports invalid board and thief coordinates", () => {
    const invalidLevel: LevelData = {
      ...EXAMPLE_LEVEL,
      board: { width: 0, height: 3 },
      thief: { x: 4, y: 1 }
    };

    const result = validateLevel(EXAMPLE_SHAPES, invalidLevel);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("board_width_invalid");
    expect(result.errors).toContain("thief_out_of_bounds");
  });

  it("reports building collisions with the thief", () => {
    const level: LevelData = {
      ...EXAMPLE_LEVEL,
      buildings: [{ id: "b1", shapeId: "building_1x1", type: PieceType.Building, origin: { x: 1, y: 1 }, rotation: 0 }]
    };

    const result = validateLevel(EXAMPLE_SHAPES, level);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("building_overlaps_thief:b1:1,1");
  });

  it("reports inventory entries that are missing or not police shapes", () => {
    const shapes: ShapeCatalog = {
      ...EXAMPLE_SHAPES,
      wall: { id: "wall", type: PieceType.Building, cells: [{ x: 0, y: 0 }] }
    };
    const level: LevelData = {
      ...EXAMPLE_LEVEL,
      policeInventory: [
        { shapeId: "missing", count: 1 },
        { shapeId: "wall", count: 1 },
        { shapeId: "police_1x1", count: -1 }
      ]
    };

    const result = validateLevel(shapes, level);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("police_inventory_unknown_shape:missing");
    expect(result.errors).toContain("police_inventory_not_police:wall");
    expect(result.errors).toContain("police_inventory_count_invalid:police_1x1");
  });
});
