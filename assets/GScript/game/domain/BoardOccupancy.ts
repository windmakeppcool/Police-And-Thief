import { cellKey, PieceType, type PlacedPiece, type ShapeCatalog } from "./GameTypes";
import { getAbsoluteCells } from "./PieceGeometry";

export type OccupiedCell = Readonly<{
  pieceId: string;
  shapeId: string;
  type: PieceType;
}>;

export type BoardOccupancy = Readonly<{
  byCell: Map<string, OccupiedCell>;
  blocked: Set<string>;
}>;

export function buildOccupancy(shapes: ShapeCatalog, pieces: readonly PlacedPiece[]): BoardOccupancy {
  const byCell = new Map<string, OccupiedCell>();
  const blocked = new Set<string>();

  for (const piece of pieces) {
    for (const cell of getAbsoluteCells(shapes, piece)) {
      const key = cellKey(cell);
      byCell.set(key, {
        pieceId: piece.id,
        shapeId: piece.shapeId,
        type: piece.type
      });
      if (piece.type === PieceType.Building || piece.type === PieceType.Police) {
        blocked.add(key);
      }
    }
  }

  return { byCell, blocked };
}
