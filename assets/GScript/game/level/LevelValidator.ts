import { buildOccupancy } from "../domain/BoardOccupancy";
import { getAbsoluteCells } from "../domain/PieceGeometry";
import {
  cellKey,
  isInsideBoard,
  PieceType,
  type LevelData,
  type PlacedPiece,
  type ShapeCatalog
} from "../domain/GameTypes";

export type LevelValidationResult = Readonly<{
  ok: boolean;
  errors: readonly string[];
}>;

export function validateLevel(shapes: ShapeCatalog, level: LevelData): LevelValidationResult {
  const errors: string[] = [];

  if (!level.id.trim()) {
    errors.push("level_id_empty");
  }
  if (!Number.isInteger(level.board.width) || level.board.width <= 0) {
    errors.push("board_width_invalid");
  }
  if (!Number.isInteger(level.board.height) || level.board.height <= 0) {
    errors.push("board_height_invalid");
  }
  if (!isInsideBoard(level.board, level.thief)) {
    errors.push("thief_out_of_bounds");
  }

  validateShapeCatalog(shapes, errors);
  validateBuildings(shapes, level, errors);
  validatePoliceInventory(shapes, level, errors);

  return {
    ok: errors.length === 0,
    errors
  };
}

function validateShapeCatalog(shapes: ShapeCatalog, errors: string[]): void {
  for (const [key, shape] of Object.entries(shapes)) {
    if (key !== shape.id) {
      errors.push(`shape_key_mismatch:${key}:${shape.id}`);
    }
    if (!Object.values(PieceType).includes(shape.type)) {
      errors.push(`shape_type_invalid:${shape.id}`);
    }
    if (shape.cells.length === 0) {
      errors.push(`shape_empty:${shape.id}`);
    }

    const seen = new Set<string>();
    for (const cell of shape.cells) {
      if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
        errors.push(`shape_cell_not_integer:${shape.id}`);
      }
      const key = cellKey(cell);
      if (seen.has(key)) {
        errors.push(`shape_duplicate_cell:${shape.id}:${key}`);
      }
      seen.add(key);
    }
  }
}

function validateBuildings(shapes: ShapeCatalog, level: LevelData, errors: string[]): void {
  const seenPieceIds = new Set<string>();
  const buildingCells = new Set<string>();

  for (const building of level.buildings) {
    validatePlacedPieceBasics(shapes, building, PieceType.Building, seenPieceIds, errors);

    let cells = [] as ReturnType<typeof getAbsoluteCells>;
    try {
      cells = getAbsoluteCells(shapes, building);
    } catch {
      continue;
    }

    for (const cell of cells) {
      const key = cellKey(cell);
      if (!isInsideBoard(level.board, cell)) {
        errors.push(`building_out_of_bounds:${building.id}:${key}`);
      }
      if (cell.x === level.thief.x && cell.y === level.thief.y) {
        errors.push(`building_overlaps_thief:${building.id}:${key}`);
      }
      if (buildingCells.has(key)) {
        errors.push(`building_overlap:${building.id}:${key}`);
      }
      buildingCells.add(key);
    }
  }

  const occupancy = buildOccupancy(shapes, level.buildings);
  if (occupancy.byCell.size !== buildingCells.size) {
    errors.push("building_occupancy_collision");
  }
}

function validatePlacedPieceBasics(
  shapes: ShapeCatalog,
  piece: PlacedPiece,
  expectedType: PieceType,
  seenPieceIds: Set<string>,
  errors: string[]
): void {
  if (!piece.id.trim()) {
    errors.push("piece_id_empty");
  }
  if (seenPieceIds.has(piece.id)) {
    errors.push(`piece_id_duplicate:${piece.id}`);
  }
  seenPieceIds.add(piece.id);

  const shape = shapes[piece.shapeId];
  if (!shape) {
    errors.push(`piece_unknown_shape:${piece.id}:${piece.shapeId}`);
    return;
  }
  if (piece.type !== expectedType) {
    errors.push(`piece_type_invalid:${piece.id}:${piece.type}`);
  }
  if (shape.type !== expectedType) {
    errors.push(`piece_shape_type_invalid:${piece.id}:${shape.type}`);
  }
}

function validatePoliceInventory(shapes: ShapeCatalog, level: LevelData, errors: string[]): void {
  const seenShapeIds = new Set<string>();

  for (const item of level.policeInventory) {
    if (seenShapeIds.has(item.shapeId)) {
      errors.push(`police_inventory_duplicate:${item.shapeId}`);
    }
    seenShapeIds.add(item.shapeId);

    const shape = shapes[item.shapeId];
    if (!shape) {
      errors.push(`police_inventory_unknown_shape:${item.shapeId}`);
      continue;
    }
    if (shape.type !== PieceType.Police) {
      errors.push(`police_inventory_not_police:${item.shapeId}`);
    }
    if (!Number.isInteger(item.count) || item.count < 0) {
      errors.push(`police_inventory_count_invalid:${item.shapeId}`);
    }
  }
}
