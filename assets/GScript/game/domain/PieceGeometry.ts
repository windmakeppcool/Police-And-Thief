import { type Coord, type PlacedPiece, type Rotation, type ShapeCatalog } from "./GameTypes";

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function coord(x: number, y: number): Coord {
  return { x: normalizeZero(x), y: normalizeZero(y) };
}

export function rotateCell(cell: Coord, rotation: Rotation): Coord {
  switch (rotation) {
    case 0:
      return coord(cell.x, cell.y);
    case 90:
      return coord(-cell.y, cell.x);
    case 180:
      return coord(-cell.x, -cell.y);
    case 270:
      return coord(cell.y, -cell.x);
  }
}

export function getAbsoluteCells(shapes: ShapeCatalog, piece: PlacedPiece): Coord[] {
  const shape = shapes[piece.shapeId];
  if (!shape) {
    throw new Error(`Unknown shapeId: ${piece.shapeId}`);
  }

  return shape.cells.map((cell) => {
    const rotated = rotateCell(cell, piece.rotation);
    return {
      x: piece.origin.x + rotated.x,
      y: piece.origin.y + rotated.y
    };
  });
}
