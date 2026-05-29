import { describe, expect, it } from "vitest";
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from "../../assets/GScript/game/level/LevelExamples";
import { GameSession } from "../../assets/GScript/game/service/GameSession";

describe("GameSession", () => {
  it("places police and reports win when thief is surrounded", () => {
    const session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);

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

    session.placePolice({ shapeId: "police_1x1", origin: { x: 1, y: 2 }, rotation: 0 });
    session.placePolice({ shapeId: "police_1x1", origin: { x: 1, y: 0 }, rotation: 0 });

    expect(session.getPlacedPolice()).toHaveLength(2);
    expect(session.undo()).toEqual({ ok: true, reason: "ok" });
    expect(session.getPlacedPolice()).toHaveLength(1);
  });
});
