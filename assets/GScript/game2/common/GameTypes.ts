export type Coord = Readonly<{
    x: number;
    y: number;
}>;

export type Rotation = 0 | 90 | 180 | 270;

export enum PieceType {
    Thief = "thief",
    Police = "police",
    Building = "building",
    Empty = "empty",
    Stroke = "stroke"
}

export type Piece = Readonly<{
    id: string;
    type: PieceType
    /** 组成棋子的cell，对应名称和坐标，按层级顺序排列的映射，index 0 = 预制体的第1个子节点*/
    cells: Array<{ name: string; coord: Coord }>;
    /** 棋子旋转的中心cell，在 cells 数组中的索引 */
    origin: number;
    /** 棋子的原始旋转角度 */
    rotation: Rotation;
    /** 可选：policeAt 在 cells 数组中的索引，表示该格子有警察站立位
     * 仅在 type 为 Police 时有效
     */
    policeAt?: number;
}>;

export type PieceCatalog = Readonly<Record<string, Piece>>;