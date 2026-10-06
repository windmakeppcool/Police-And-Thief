/** 网格坐标（Y 轴向上，与 Cocos 一致） */
export type Coord = Readonly<{
    x: number;
    y: number;
}>;

/** 棋子旋转角度，按 90 度递增 */
export type Rotation = 0 | 90 | 180 | 270;

export enum PieceType {
    Thief = "thief",
    Police = "police",
    Building = "building",
}

export type Piece = Readonly<{
    id: string;
    type: PieceType;
    /** 组成棋子的 cell：名称与坐标，顺序与预制体子节点一致，index 0 = 预制体的第 1 个子节点 */
    cells: Array<{ name: string; coord: Coord }>;
    /** 棋子旋转中心 cell，在 cells 数组中的索引 */
    origin: number;
    /** 棋子的初始旋转角度 */
    rotation: Rotation;
    /** 警察站位格在 cells 数组中的索引，仅 Police 有效 */
    policeAt?: number;
}>;

export type PieceCatalog = Readonly<Record<string, Piece>>;

/** 关卡自动摆放的建筑障碍 */
export type BuildingPlacement = Readonly<{
    pieceId: string;
    anchor: Coord;
    rotation: Rotation;
}>;

export type LevelData = Readonly<{
    id: string;
    /** 棋盘边长（格数），坐标范围 -gridSize/2 .. gridSize/2-1 */
    gridSize: number;
    /** 小偷所在格 */
    thief: Coord;
    /** 关卡生成时自动摆放的建筑障碍 */
    buildings: ReadonlyArray<BuildingPlacement>;
}>;
