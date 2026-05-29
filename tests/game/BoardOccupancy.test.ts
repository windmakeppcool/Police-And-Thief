import { describe, expect, it } from "vitest";
import { buildOccupancy } from "../../assets/GScript/game/domain/BoardOccupancy";
import { getAbsoluteCells, rotateCell } from "../../assets/GScript/game/domain/PieceGeometry";
import { PieceType, type PlacedPiece, type ShapeCatalog } from "../../assets/GScript/game/domain/GameTypes";

const shapes: ShapeCatalog = {
  police_1x2: {
    id: "police_1x2",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }]
  },
  building_1x1: {
    id: "building_1x1",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }]
  }
};

describe("PieceGeometry", () => {
  it("rotates a shape cell around origin", () => {
    expect(rotateCell({ x: 1, y: 0 }, 0)).toEqual({ x: 1, y: 0 });
    expect(rotateCell({ x: 1, y: 0 }, 90)).toEqual({ x: 0, y: 1 });
    expect(rotateCell({ x: 1, y: 0 }, 180)).toEqual({ x: -1, y: 0 });
    expect(rotateCell({ x: 1, y: 0 }, 270)).toEqual({ x: 0, y: -1 });
  });

  it("expands placed piece cells into board coordinates", () => {
    const placed: PlacedPiece = {
      id: "p1",
      shapeId: "police_1x2",
      type: PieceType.Police,
      origin: { x: 2, y: 3 },
      rotation: 90
    };

    expect(getAbsoluteCells(shapes, placed)).toEqual([{ x: 2, y: 3 }, { x: 2, y: 4 }]);
  });
});

describe("BoardOccupancy", () => {
  it("marks occupied cells by piece id and type", () => {
    const building: PlacedPiece = {
      id: "b1",
      shapeId: "building_1x1",
      type: PieceType.Building,
      origin: { x: 1, y: 1 },
      rotation: 0
    };
    const police: PlacedPiece = {
      id: "p1",
      shapeId: "police_1x2",
      type: PieceType.Police,
      origin: { x: 2, y: 0 },
      rotation: 0
    };

    const occupancy = buildOccupancy(shapes, [building, police]);

    expect(occupancy.blocked.has("1,1")).toBe(true);
    expect(occupancy.blocked.has("2,0")).toBe(true);
    expect(occupancy.blocked.has("3,0")).toBe(true);
    expect(occupancy.byCell.get("3,0")?.pieceId).toBe("p1");
    expect(occupancy.byCell.get("3,0")?.type).toBe(PieceType.Police);
  });
});
