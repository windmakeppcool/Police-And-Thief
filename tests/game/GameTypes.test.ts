import { describe, expect, it } from "vitest";
import { cellKey, sameCoord, type BoardSize, type Coord } from "../../assets/GScript/game/domain/GameTypes";

describe("GameTypes", () => {
  it("serializes coordinates into stable keys", () => {
    expect(cellKey({ x: 3, y: 5 })).toBe("3,5");
  });

  it("compares coordinates by value", () => {
    const a: Coord = { x: 2, y: 1 };
    const b: Coord = { x: 2, y: 1 };
    const c: Coord = { x: 1, y: 2 };

    expect(sameCoord(a, b)).toBe(true);
    expect(sameCoord(a, c)).toBe(false);
  });

  it("allows rectangular board sizes for future level variants", () => {
    const size: BoardSize = { width: 8, height: 8 };
    expect(size.width * size.height).toBe(64);
  });
});
