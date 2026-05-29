import {
  type EscapePathResult,
  type LevelData,
  type MoveResult,
  type PlacePoliceInput,
  type PlacedPiece,
  PieceType,
  type ShapeCatalog
} from "../domain/GameTypes";
import { canThiefEscape } from "../rules/EscapePathFinder";
import { validatePolicePlacement } from "../rules/PlacementValidator";
import { isWin } from "../rules/WinCondition";

export type WinCheckResult = Readonly<{
  won: boolean;
  path: EscapePathResult;
}>;

export class GameSession {
  private placedPolice: PlacedPiece[] = [];
  private nextPoliceId = 1;

  constructor(
    private readonly shapes: ShapeCatalog,
    private readonly level: LevelData
  ) {}

  getLevel(): LevelData {
    return this.level;
  }

  getPlacedPolice(): readonly PlacedPiece[] {
    return this.placedPolice;
  }

  placePolice(input: PlacePoliceInput): MoveResult {
    const validation = validatePolicePlacement(this.shapes, this.level, this.placedPolice, input);
    if (!validation.ok) {
      return validation;
    }

    this.placedPolice.push({
      id: `police_${this.nextPoliceId++}`,
      shapeId: input.shapeId,
      type: PieceType.Police,
      origin: input.origin,
      rotation: input.rotation
    });

    return { ok: true, reason: "ok" };
  }

  undo(): MoveResult {
    if (this.placedPolice.length === 0) {
      return { ok: false, reason: "nothing_to_undo" };
    }

    this.placedPolice.pop();
    return { ok: true, reason: "ok" };
  }

  checkWin(): WinCheckResult {
    const path = canThiefEscape(this.shapes, this.level, this.placedPolice);
    return {
      won: isWin(path),
      path
    };
  }
}
