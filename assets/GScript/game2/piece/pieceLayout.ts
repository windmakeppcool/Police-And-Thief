import { Node } from 'cc';
import type { Piece, Rotation } from '../common/GameTypes';
import { rotateCells, stepsOf } from '../rules/PieceGeometry';

/**
 * 按棋子的 cells 摆放预制体子节点：旋转围绕 origin cell，
 * 旋转后 origin cell 始终落在节点本地原点 (0,0)。
 *
 * 说明：这里不直接使用 node.angle，保证棋子视觉效果与
 * GameSession 的格子占用计算完全一致（两者共用 PieceGeometry）。
 */
export function applyPieceLayout(node: Node, piece: Piece, rotation: Rotation, cellSize: number): void {
    const origin = piece.cells[piece.origin]?.coord ?? { x: 0, y: 0 };
    const rotated = rotateCells(piece.cells.map(c => c.coord), origin, stepsOf(rotation));
    piece.cells.forEach((cell, index) => {
        const child = node.getChildByName(cell.name);
        if (!child) return;
        child.setPosition(
            (rotated[index].x - origin.x) * cellSize,
            (rotated[index].y - origin.y) * cellSize,
            0,
        );
    });
}

/** 棋子当前旋转下的包围盒（格数） */
export function pieceBounds(piece: Piece, rotation: Rotation): { width: number; height: number } {
    const origin = piece.cells[piece.origin]?.coord ?? { x: 0, y: 0 };
    const rotated = rotateCells(piece.cells.map(c => c.coord), origin, stepsOf(rotation));
    const xs = rotated.map(c => c.x);
    const ys = rotated.map(c => c.y);
    return {
        width: Math.max(...xs) - Math.min(...xs) + 1,
        height: Math.max(...ys) - Math.min(...ys) + 1,
    };
}

/** 包围盒中心相对 origin cell 的偏移（格数），用于托盘居中展示 */
export function pieceCenterOffset(piece: Piece, rotation: Rotation): { x: number; y: number } {
    const origin = piece.cells[piece.origin]?.coord ?? { x: 0, y: 0 };
    const rotated = rotateCells(piece.cells.map(c => c.coord), origin, stepsOf(rotation));
    const xs = rotated.map(c => c.x - origin.x);
    const ys = rotated.map(c => c.y - origin.y);
    return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
}
