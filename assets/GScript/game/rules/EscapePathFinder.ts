import { buildOccupancy } from "../domain/BoardOccupancy";
import {
  cellKey,
  isInsideBoard,
  type Coord,
  type EscapePathResult,
  type LevelData,
  type PlacedPiece,
  type ShapeCatalog
} from "../domain/GameTypes";

const DIRECTIONS: readonly Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function canThiefEscape(
  shapes: ShapeCatalog,
  level: LevelData,
  placedPolice: readonly PlacedPiece[]
): EscapePathResult {
  const occupancy = buildOccupancy(shapes, [...level.buildings, ...placedPolice]);
  const queue: Coord[] = [level.thief];
  const visitedKeys = new Set<string>([cellKey(level.thief)]);
  const visited: Coord[] = [level.thief];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of DIRECTIONS) {
      const next: Coord = {
        x: current.x + direction.x,
        y: current.y + direction.y
      };

      if (!isInsideBoard(level.board, next)) {
        return {
          canEscape: true,
          visited,
          escapeFrom: current
        };
      }

      const key = cellKey(next);
      if (visitedKeys.has(key)) {
        continue;
      }
      if (occupancy.blocked.has(key)) {
        continue;
      }

      visitedKeys.add(key);
      visited.push(next);
      queue.push(next);
    }
  }

  return {
    canEscape: false,
    visited,
    escapeFrom: null
  };
}
