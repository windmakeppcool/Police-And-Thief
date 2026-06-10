import { PieceCatalog, PieceType } from "../common/GameTypes";


// 建筑类棋子
export const StructuresPieces: PieceCatalog = {
    // L形结构
    "Structure-001": {
        id: "Structure-001",
        type: PieceType.Building,
        cells: [
            { name: "white-00", coord: { x: 0, y: 2 } },
            { name: "white-01", coord: { x: 0, y: 1 } },
            { name: "white-02", coord: { x: 0, y: 0 } },
            { name: "white-03", coord: { x: 1, y: 0 } }
        ],
        origin: 2,
        rotation: 0,
    },
    // L形结构
    "Structure-002": {
        id: "Structure-002",
        type: PieceType.Building,
        cells: [
            { name: "white-00", coord: { x: 0, y: 2 } },
            { name: "white-01", coord: { x: 0, y: 1 } },
            { name: "white-02", coord: { x: 0, y: 0 } },
            { name: "white-03", coord: { x: 1, y: 0 } }
        ],
        origin: 2,
        rotation: 0,
    },
    // 竖条 (3格)
    "Structure-003": {
        id: "Structure-003",
        type: PieceType.Building,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 0, y: -1 } }
        ],
        origin: 1,
        rotation: 0,
    },
    // 小L形 (3格)
    "Structure-004": {
        id: "Structure-004",
        type: PieceType.Building,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 1, y: 0 } }
        ],
        origin: 1,
        rotation: 0,
    }
};

// 警察类棋子
export const PolicePieces: PieceCatalog = {
    // T形：上方三格 + 中心向下一格，警察位在 origin
    "PoliceUI-001": {
        id: "PoliceUI-001",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: -1, y: 0 } },
            { name: "white-03", coord: { x: 1, y: 0 } }
        ],
        origin: 1,
        rotation: 0,
        policeAt: 0  // white-00 有警察
    },
    // L形，直角在左下，警察位在白色01位置
    "PoliceUI-002": {
        id: "PoliceUI-002",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 1, y: 0 } }
        ],
        origin: 1,
        rotation: 0,
        policeAt: 1  // white-01 有警察
    },
    // 横条，三格水平排列，警察位在中间
    "PoliceUI-003": {
        id: "PoliceUI-003",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: -1, y: 0 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 1, y: 0 } }
        ],
        origin: 1,
        rotation: 0,
        policeAt: 1  // white-01 有警察
    },
    // L形，与 PoliceUI-002 形状相同，但警察位不同（视觉区分）
    "PoliceUI-004": {
        id: "PoliceUI-004",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 1, y: 0 } }
        ],
        origin: 1,
        rotation: 0,
        policeAt: 0  // white-00 有警察
    },
    // L形，竖线向下，右拐，警察位在顶端
    "PoliceUI-005": {
        id: "PoliceUI-005",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 2 } },
            { name: "white-01", coord: { x: 0, y: 1 } },
            { name: "white-02", coord: { x: 0, y: 0 } },
            { name: "white-03", coord: { x: 1, y: 0 } }
        ],
        origin: 2,
        rotation: 0,
        policeAt: 0  // white-00 有警察
    },
    // 反L形，竖线向下，左拐，警察位在下端
    "PoliceUI-006": {
        id: "PoliceUI-006",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 2 } },
            { name: "white-01", coord: { x: 0, y: 1 } },
            { name: "white-02", coord: { x: 0, y: 0 } },
            { name: "white-03", coord: { x: -1, y: 0 } }
        ],
        origin: 2,
        rotation: 0,
        policeAt: 2  // white-02 有警察
    }
};