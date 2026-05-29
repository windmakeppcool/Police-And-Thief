import { PieceType, type LevelData, type ShapeCatalog } from "../domain/GameTypes";

export const EXAMPLE_SHAPES: ShapeCatalog = {
  police_1x1: {
    id: "police_1x1",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }]
  },
  building_1x1: {
    id: "building_1x1",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }]
  },
  building_001: {
    id: "building_001",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -2 }, { x: 1, y: -2 }]
  },
  building_002: {
    id: "building_002",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -2 }, { x: 1, y: -2 }]
  },
  building_003: {
    id: "building_003",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -2 }]
  },
  building_004: {
    id: "building_004",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }]
  }
};

export const EXAMPLE_LEVEL: LevelData = {
  id: "dev_level_001",
  board: { width: 6, height: 6 },
  thief: { x: 1, y: 1 },
  buildings: [],
  policeInventory: [{ shapeId: "police_1x1", count: 4 }]
};
