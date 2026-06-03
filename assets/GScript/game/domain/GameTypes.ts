export type Coord = Readonly<{
  x: number;
  y: number;
}>;

export type BoardSize = Readonly<{
  width: number;
  height: number;
}>;

export type Rotation = 0 | 90 | 180 | 270;

export enum PieceType {
  Thief = "thief",
  Police = "police",
  Building = "building",
  Empty = "empty",
  Stroke = "stroke"
}

export type PieceShape = Readonly<{
  id: string;
  type: PieceType;
  /** 数学坐标系，Y轴向上，cells[i] 对应 prefab 的第 i 个子节点 */
  cells: readonly Coord[];
  /** 可选：prefab 子节点按层级顺序排列的映射，index 0 = 预制体的第1个子节点 */
  prefabChildren?: ReadonlyArray<{ name: string; coord: Coord }>;
  /** 可选：policeAt 在 prefabChildren/cells 数组中的索引，表示该格子有警察站立位 */
  policeAt?: number;
}>;

export type PlacedPiece = Readonly<{
  id: string;
  shapeId: string;
  type: PieceType;
  origin: Coord;
  rotation: Rotation;
}>;

export type LevelPoliceInventoryItem = Readonly<{
  shapeId: string;
  count: number;
}>;

export type LevelData = Readonly<{
  id: string;
  board: BoardSize;
  thief: Coord;
  buildings: readonly PlacedPiece[];
  policeInventory: readonly LevelPoliceInventoryItem[];
}>;

export type ShapeCatalog = Readonly<Record<string, PieceShape>>;

export type PlacePoliceInput = Readonly<{
  shapeId: string;
  origin: Coord;
  rotation: Rotation;
}>;

export type MoveResult = Readonly<{
  ok: boolean;
  reason: string;
}>;

export type EscapePathResult = Readonly<{
  canEscape: boolean;
  visited: readonly Coord[];
  escapeFrom: Coord | null;
}>;

export function cellKey(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInsideBoard(board: BoardSize, coord: Coord): boolean {
  return coord.x >= 0 && coord.y >= 0 && coord.x < board.width && coord.y < board.height;
}
