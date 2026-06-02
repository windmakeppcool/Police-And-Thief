import { PieceType, type LevelData, type ShapeCatalog } from "../domain/GameTypes";

export const EXAMPLE_SHAPES: ShapeCatalog = {
  police_1x1: {
    id: "police_1x1",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }]
  },
  police_001: {
    id: "police_001",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: 1, y: 1 }]
  },
  police_002: {
    id: "police_002",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
  },
  police_003: {
    id: "police_003",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
  },
  police_004: {
    id: "police_004",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
  },
  police_005: {
    id: "police_005",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: -1, y: 2 }]
  },
  police_006: {
    id: "police_006",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]
  },
  building_1x1: {
    id: "building_1x1",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }]
  },
  building_001: {
    id: "building_001",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }]
  },
  building_002: {
    id: "building_002",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }]
  },
  building_003: {
    id: "building_003",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]
  },
  building_004: {
    id: "building_004",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]
  }
};

export const EXAMPLE_LEVEL: LevelData = {
  id: "dev_level_001",
  board: { width: 6, height: 6 },
  thief: { x: 1, y: 1 },
  buildings: [],
  policeInventory: [
    { shapeId: "police_001", count: 1 },
    { shapeId: "police_002", count: 1 },
    { shapeId: "police_003", count: 1 },
    { shapeId: "police_004", count: 1 },
    { shapeId: "police_005", count: 1 },
    { shapeId: "police_006", count: 1 },
  ]
};
