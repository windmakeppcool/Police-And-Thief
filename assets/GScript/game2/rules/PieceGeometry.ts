import type { Coord, Piece, Rotation } from "../common/GameTypes";

/** 单步旋转：与设计稿一致的 (x, y) -> (-y, x)，绕原点 cell 旋转 */
export function rotateCell(cell: Coord, origin: Coord, steps = 1): Coord {
    let x = cell.x - origin.x;
    let y = cell.y - origin.y;
    for (let i = 0; i < ((steps % 4) + 4) % 4; i++) {
        const nx = -y;
        y = x;
        x = nx;
    }
    return { x: origin.x + x, y: origin.y + y };
}

/** 按旋转步数（90 度一档）旋转一组相对坐标 */
export function rotateCells(cells: readonly Coord[], origin: Coord, steps: number): Coord[] {
    return cells.map(cell => rotateCell(cell, origin, steps));
}

/** 旋转角度 -> 步数 */
export function stepsOf(rotation: Rotation): number {
    return (rotation / 90) % 4;
}

/** 下一旋转角度 (0→90→180→270→0) */
export function nextRotation(rotation: Rotation): Rotation {
    return ((rotation + 90) % 360) as Rotation;
}

/** 棋子在指定旋转下的相对 cell 坐标 */
export function pieceCells(piece: Piece, rotation: Rotation): Coord[] {
    const origin = piece.cells[piece.origin]?.coord ?? { x: 0, y: 0 };
    return rotateCells(piece.cells.map(c => c.coord), origin, stepsOf(rotation));
}

/** 相对坐标平移为棋盘绝对坐标 */
export function toAbsoluteCells(relative: readonly Coord[], anchor: Coord): Coord[] {
    return relative.map(c => ({ x: anchor.x + c.x, y: anchor.y + c.y }));
}
