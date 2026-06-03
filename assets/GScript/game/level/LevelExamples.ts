import { PieceType, type LevelData, type ShapeCatalog } from "../domain/GameTypes";

export const EXAMPLE_SHAPES: ShapeCatalog = {
  police_1x1: {
    id: "police_1x1",
    type: PieceType.Police,
    cells: [{ x: 0, y: 0 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } }
    ],
    policeAt: 0  // 第1个格子有警察
  },
  police_001: {
    id: "police_001",
    type: PieceType.Police,
    // T形：上方三格 + 中心向下一格，policeAt 在 (0,0)
    // Shape Y+向上 ↔ Prefab local(x, -y*64)
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: 1, y: 1 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },   // origin (0,0) - 有警察
      { name: "white-01", coord: { x: 0, y: 1 } },   // (0,+1) → local(0, -64)
      { name: "white-02", coord: { x: -1, y: 1 } },  // (-1,+1) → local(-64, -64)
      { name: "white-03", coord: { x: 1, y: 1 } }    // (+1,+1) → local(+64, -64)
    ],
    policeAt: 0  // white-00 有警察
  },
  police_002: {
    id: "police_002",
    type: PieceType.Police,
    // L形，直角在左下
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },   // origin
      { name: "white-01", coord: { x: 0, y: 1 } },   // (0,+1) → local(0, -64) - 有警察
      { name: "white-02", coord: { x: 1, y: 1 } }     // (+1,+1) → local(+64, -64)
    ],
    policeAt: 1  // white-01 有警察
  },
  police_003: {
    id: "police_003",
    type: PieceType.Police,
    // 横条，三格水平排列
    cells: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },   // origin，在中间 - 有警察
      { name: "white-01", coord: { x: -1, y: 0 } },  // (-1,0) → local(-64, 0)
      { name: "white-02", coord: { x: 1, y: 0 } }     // (+1,0) → local(+64, 0)
    ],
    policeAt: 0  // white-00 有警察
  },
  police_004: {
    id: "police_004",
    type: PieceType.Police,
    // L形，与 police_002 形状相同，但 policeAt 不同（视觉上需要区分）
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },
      { name: "white-01", coord: { x: 0, y: 1 } },   // 有警察
      { name: "white-02", coord: { x: 1, y: 1 } }
    ],
    policeAt: 1  // white-01 有警察
  },
  police_005: {
    id: "police_005",
    type: PieceType.Police,
    // 反L形，竖线向下，左拐
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },   // origin
      { name: "white-01", coord: { x: 0, y: 1 } },   // (0,+1) → local(0, -64)
      { name: "white-02", coord: { x: 0, y: 2 } },   // (0,+2) → local(0, -128) - 有警察
      { name: "white-03", coord: { x: -1, y: 2 } }   // (-1,+2) → local(-64, -128)
    ],
    policeAt: 2  // white-02 有警察
  },
  police_006: {
    id: "police_006",
    type: PieceType.Police,
    // 反L形，竖线向下，右拐
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },
      { name: "white-01", coord: { x: 0, y: 1 } },
      { name: "white-02", coord: { x: 0, y: 2 } },   // 有警察
      { name: "white-03", coord: { x: 1, y: 2 } }
    ],
    policeAt: 2  // white-02 有警察
  },
  building_1x1: {
    id: "building_1x1",
    type: PieceType.Building,
    cells: [{ x: 0, y: 0 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } }
    ]
  },
  building_001: {
    id: "building_001",
    type: PieceType.Building,
    // L形结构（与 StructureUI-001 对应）
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },   // origin
      { name: "white-01", coord: { x: 0, y: 1 } },   // (0,+1) → local(0, -64)
      { name: "white-02", coord: { x: 0, y: 2 } },   // (0,+2) → local(0, -128)
      { name: "white-03", coord: { x: 1, y: 0 } }    // (+1,0) → local(+64, 0)
    ]
  },
  building_002: {
    id: "building_002",
    type: PieceType.Building,
    // 与 building_001 相同的 L 形
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },
      { name: "white-01", coord: { x: 0, y: 1 } },
      { name: "white-02", coord: { x: 0, y: 2 } },
      { name: "white-03", coord: { x: 1, y: 0 } }
    ]
  },
  building_003: {
    id: "building_003",
    type: PieceType.Building,
    // 竖条
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },
      { name: "white-01", coord: { x: 0, y: 1 } },
      { name: "white-02", coord: { x: 0, y: 2 } }
    ]
  },
  building_004: {
    id: "building_004",
    type: PieceType.Building,
    // 小L形
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
    prefabChildren: [
      { name: "white-00", coord: { x: 0, y: 0 } },
      { name: "white-01", coord: { x: 0, y: 1 } },
      { name: "white-02", coord: { x: 1, y: 0 } }
    ]
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
