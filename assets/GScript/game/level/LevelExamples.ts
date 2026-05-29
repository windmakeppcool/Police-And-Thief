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
  }
};

export const EXAMPLE_LEVEL: LevelData = {
  id: "dev_level_001",
  board: { width: 3, height: 3 },
  thief: { x: 1, y: 1 },
  buildings: [],
  policeInventory: [{ shapeId: "police_1x1", count: 4 }]
};
