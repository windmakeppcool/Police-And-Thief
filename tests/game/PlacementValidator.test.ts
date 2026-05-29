import { describe, expect, it } from "vitest";
import { validatePolicePlacement } from "../../assets/GScript/game/rules/PlacementValidator";
import { PieceType, type LevelData, type PlacedPiece, type ShapeCatalog } from "../../assets/GScript/game/domain/GameTypes";

const shapes: ShapeCatalog = {
  police_1x2: { id: "police_1x2", type: PieceType.Police, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  building_1x1: { id: "building_1x1", type: PieceType.Building, cells: [{ x: 0, y: 0 }] }
};

const building: PlacedPiece = {
  id: "b1",
  shapeId: "building_1x1",
  type: PieceType.Building,
  origin: { x: 1, y: 1 },
  rotation: 0
};

const level: LevelData = {
  id: "level_test",
  board: { width: 4, height: 4 },
  thief: { x: 0, y: 0 },
  buildings: [building],
  policeInventory: [{ shapeId: "police_1x2", count: 1 }]
};

describe("validatePolicePlacement", () => {
  it("accepts an in-bounds non-colliding police placement", () => {
    const result = validatePolicePlacement(shapes, level, [], {
      shapeId: "police_1x2",
      origin: { x: 2, y: 2 },
      rotation: 0
    });

    expect(result).toEqual({ ok: true, reason: "ok" });
  });

  it("rejects placement outside the board", () => {
    const result = validatePolicePlacement(shapes, level, [], {
      shapeId: "police_1x2",
      origin: { x: 3, y: 0 },
      rotation: 0
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("out_of_bounds");
  });

  it("rejects placement colliding with a building", () => {
    const result = validatePolicePlacement(shapes, level, [], {
      shapeId: "police_1x2",
      origin: { x: 1, y: 1 },
      rotation: 0
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cell_occupied");
  });

  it("rejects placement when inventory count is exhausted", () => {
    const placed: PlacedPiece = {
      id: "p_existing",
      shapeId: "police_1x2",
      type: PieceType.Police,
      origin: { x: 2, y: 2 },
      rotation: 0
    };

    const result = validatePolicePlacement(shapes, level, [placed], {
      shapeId: "police_1x2",
      origin: { x: 0, y: 2 },
      rotation: 0
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("inventory_exhausted");
  });
});
