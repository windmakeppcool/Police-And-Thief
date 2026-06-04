import { describe, expect, it } from "vitest";
import { canThiefEscape } from "../../assets/GScript/game/rules/EscapePathFinder";
import { isWin } from "../../assets/GScript/game/rules/WinCondition";
import { PieceType, type LevelData, type PlacedPiece, type ShapeCatalog } from "../../assets/GScript/game/domain/GameTypes";

const shapes: ShapeCatalog = {
  wall: { id: "wall", type: PieceType.Building, cells: [{ x: 0, y: 0 }] },
  police: { id: "police", type: PieceType.Police, cells: [{ x: 0, y: 0 }] }
};

function block(id: string, x: number, y: number, type: PieceType): PlacedPiece {
  return { id, shapeId: type === PieceType.Police ? "police" : "wall", type, origin: { x, y }, rotation: 0 };
}

const baseLevel: LevelData = {
  id: "escape_test",
  board: { width: 3, height: 3 },
  thief: { x: 1, y: 1 },
  buildings: [],
  policeInventory: [{ shapeId: "police", count: 4 }]
};

describe("canThiefEscape", () => {
  it("returns canEscape true when thief has an open path to the outside", () => {
    const result = canThiefEscape(shapes, baseLevel, []);

    expect(result.canEscape).toBe(true);
    expect(result.escapeFrom).not.toBeNull();
  });

  it("returns canEscape false when all four directions are blocked", () => {
    const police = [
      block("p_up", 1, 2, PieceType.Police),
      block("p_down", 1, 0, PieceType.Police),
      block("p_left", 0, 1, PieceType.Police),
      block("p_right", 2, 1, PieceType.Police)
    ];

    const result = canThiefEscape(shapes, baseLevel, police);

    expect(result.canEscape).toBe(false);
    expect(result.escapeFrom).toBeNull();
    expect(isWin(result)).toBe(true);
  });
});
