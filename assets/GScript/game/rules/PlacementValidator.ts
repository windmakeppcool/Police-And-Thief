import { buildOccupancy } from "../domain/BoardOccupancy";
import { getAbsoluteCells } from "../domain/PieceGeometry";
import {
  cellKey,
  isInsideBoard,
  PieceType,
  type LevelData,
  type MoveResult,
  type PlacePoliceInput,
  type PlacedPiece,
  type ShapeCatalog
} from "../domain/GameTypes";

export function validatePolicePlacement(
  shapes: ShapeCatalog,
  level: LevelData,
  placedPolice: readonly PlacedPiece[],
  input: PlacePoliceInput
): MoveResult {
  const shape = shapes[input.shapeId];
  if (!shape) {
    return { ok: false, reason: "unknown_shape" };
  }
  if (shape.type !== PieceType.Police) {
    return { ok: false, reason: "not_police_shape" };
  }

  const inventoryItem = level.policeInventory.find((item) => item.shapeId === input.shapeId);
  if (!inventoryItem) {
    return { ok: false, reason: "not_in_inventory" };
  }

  const usedCount = placedPolice.filter((piece) => piece.shapeId === input.shapeId).length;
  if (usedCount >= inventoryItem.count) {
    return { ok: false, reason: "inventory_exhausted" };
  }

  const candidate: PlacedPiece = {
    id: "candidate",
    shapeId: input.shapeId,
    type: PieceType.Police,
    origin: input.origin,
    rotation: input.rotation
  };

  const candidateCells = getAbsoluteCells(shapes, candidate);
  for (const cell of candidateCells) {
    if (!isInsideBoard(level.board, cell)) {
      return { ok: false, reason: "out_of_bounds" };
    }
    if (cell.x === level.thief.x && cell.y === level.thief.y) {
      return { ok: false, reason: "cell_occupied" };
    }
  }

  const occupancy = buildOccupancy(shapes, [...level.buildings, ...placedPolice]);
  for (const cell of candidateCells) {
    if (occupancy.blocked.has(cellKey(cell))) {
      return { ok: false, reason: "cell_occupied" };
    }
  }

  return { ok: true, reason: "ok" };
}
