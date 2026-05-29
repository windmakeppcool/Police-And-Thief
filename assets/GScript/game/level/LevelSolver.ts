import { getAbsoluteCells } from "../domain/PieceGeometry";
import {
  type Coord,
  type LevelData,
  type PlacePoliceInput,
  type PlacedPiece,
  type Rotation,
  type ShapeCatalog
} from "../domain/GameTypes";
import { GameSession } from "../service/GameSession";

export type SolveLevelOptions = Readonly<{
  maxDepth?: number;
  rotations?: readonly Rotation[];
}>;

export type SolveLevelResult = Readonly<{
  solved: boolean;
  placements: readonly PlacePoliceInput[];
}>;

const DEFAULT_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

export function solveLevel(
  shapes: ShapeCatalog,
  level: LevelData,
  options: SolveLevelOptions = {}
): SolveLevelResult {
  const candidates = buildPlacementCandidates(shapes, level, options.rotations ?? DEFAULT_ROTATIONS);
  const maxDepth = options.maxDepth ?? level.policeInventory.reduce((sum, item) => sum + item.count, 0);
  const result = search(shapes, level, candidates, [], maxDepth, new Set<string>());

  return result ?? { solved: false, placements: [] };
}

export function buildPlacementCandidates(
  shapes: ShapeCatalog,
  level: LevelData,
  rotations: readonly Rotation[] = DEFAULT_ROTATIONS
): PlacePoliceInput[] {
  const candidates: PlacePoliceInput[] = [];

  for (const item of level.policeInventory) {
    const shape = shapes[item.shapeId];
    if (!shape || item.count <= 0) {
      continue;
    }

    for (let x = 0; x < level.board.width; x++) {
      for (let y = 0; y < level.board.height; y++) {
        for (const rotation of rotations) {
          const input: PlacePoliceInput = {
            shapeId: item.shapeId,
            origin: { x, y },
            rotation
          };
          if (isCandidateInsideBoard(shapes, level, input)) {
            candidates.push(input);
          }
        }
      }
    }
  }

  return dedupeCandidates(candidates);
}

function isCandidateInsideBoard(shapes: ShapeCatalog, level: LevelData, input: PlacePoliceInput): boolean {
  const candidate: PlacedPiece = {
    id: "candidate",
    shapeId: input.shapeId,
    type: shapes[input.shapeId].type,
    origin: input.origin,
    rotation: input.rotation
  };

  return getAbsoluteCells(shapes, candidate).every((cell) => {
    return cell.x >= 0 && cell.y >= 0 && cell.x < level.board.width && cell.y < level.board.height;
  });
}

function search(
  shapes: ShapeCatalog,
  level: LevelData,
  candidates: readonly PlacePoliceInput[],
  placements: readonly PlacePoliceInput[],
  maxDepth: number,
  seen: Set<string>
): SolveLevelResult | null {
  const session = replaySession(shapes, level, placements);
  if (session.checkWin().won) {
    return { solved: true, placements };
  }
  if (placements.length >= maxDepth) {
    return null;
  }

  const stateKey = placements.map(placementKey).sort().join("|");
  if (seen.has(stateKey)) {
    return null;
  }
  seen.add(stateKey);

  for (const candidate of candidates) {
    if (placements.some((placed) => placementKey(placed) === placementKey(candidate))) {
      continue;
    }

    const nextSession = replaySession(shapes, level, placements);
    const move = nextSession.placePolice(candidate);
    if (!move.ok) {
      continue;
    }

    const result = search(shapes, level, candidates, [...placements, candidate], maxDepth, seen);
    if (result) {
      return result;
    }
  }

  return null;
}

function replaySession(shapes: ShapeCatalog, level: LevelData, placements: readonly PlacePoliceInput[]): GameSession {
  const session = new GameSession(shapes, level);
  for (const placement of placements) {
    const result = session.placePolice(placement);
    if (!result.ok) {
      break;
    }
  }
  return session;
}

function dedupeCandidates(candidates: readonly PlacePoliceInput[]): PlacePoliceInput[] {
  const seen = new Set<string>();
  const result: PlacePoliceInput[] = [];

  for (const candidate of candidates) {
    const key = placementKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function placementKey(input: PlacePoliceInput): string {
  return `${input.shapeId}:${input.origin.x},${input.origin.y}:${input.rotation}`;
}
