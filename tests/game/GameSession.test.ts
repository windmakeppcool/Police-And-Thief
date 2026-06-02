import { describe, expect, it } from "vitest";
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from "../../assets/GScript/game/level/LevelExamples";
import { GameSession } from "../../assets/GScript/game/service/GameSession";
import { PieceType, type LevelData } from "../../assets/GScript/game/domain/GameTypes";

describe("GameSession", () => {
  it("places police and reports win when thief is surrounded", () => {
    // 使用简化的关卡，用 police_1x1 围住小偷
    const level: LevelData = {
      id: "test_win",
      board: { width: 3, height: 3 },
      thief: { x: 1, y: 1 },
      buildings: [],
      policeInventory: [{ shapeId: "police_1x1", count: 4 }],
    };
    const session = new GameSession(EXAMPLE_SHAPES, level);
    expect(session.checkWin().won).toBe(false);

    expect(session.placePolice({ shapeId: "police_1x1", origin: { x: 1, y: 2 }, rotation: 0 }).ok).toBe(true);
    expect(session.placePolice({ shapeId: "police_1x1", origin: { x: 1, y: 0 }, rotation: 0 }).ok).toBe(true);
    expect(session.placePolice({ shapeId: "police_1x1", origin: { x: 0, y: 1 }, rotation: 0 }).ok).toBe(true);
    expect(session.placePolice({ shapeId: "police_1x1", origin: { x: 2, y: 1 }, rotation: 0 }).ok).toBe(true);

    expect(session.getPlacedPolice()).toHaveLength(4);
    expect(session.checkWin().won).toBe(true);
  });

  it("undo removes the most recent police piece", () => {
    const session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);

    session.placePolice({ shapeId: "police_003", origin: { x: 3, y: 1 }, rotation: 0 });
    session.placePolice({ shapeId: "police_002", origin: { x: 0, y: 2 }, rotation: 0 });

    expect(session.getPlacedPolice()).toHaveLength(2);
    expect(session.undo()).toEqual({ ok: true, reason: "ok" });
    expect(session.getPlacedPolice()).toHaveLength(1);
  });

  it("placePoliceWithId upserts an existing police piece", () => {
    const session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);

    expect(session.placePoliceWithId({ id: "p1", shapeId: "police_003", origin: { x: 3, y: 1 }, rotation: 0 }).ok).toBe(true);
    expect(session.getPlacedPolice()).toHaveLength(1);

    expect(session.placePoliceWithId({ id: "p1", shapeId: "police_003", origin: { x: 3, y: 2 }, rotation: 0 }).ok).toBe(true);
    expect(session.getPlacedPolice()).toHaveLength(1);
    expect(session.getPlacedPolice()[0].origin).toEqual({ x: 3, y: 2 });
  });

  it("removePolice removes a specific police piece by id", () => {
    const session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);

    session.placePoliceWithId({ id: "p1", shapeId: "police_003", origin: { x: 3, y: 1 }, rotation: 0 });
    session.placePoliceWithId({ id: "p2", shapeId: "police_002", origin: { x: 0, y: 2 }, rotation: 0 });

    expect(session.getPlacedPolice()).toHaveLength(2);
    session.removePolice("p1");
    expect(session.getPlacedPolice()).toHaveLength(1);
    expect(session.getPlacedPolice()[0].id).toBe("p2");
  });
});
