import { _decorator, Color, Component } from 'cc';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { type ShapeCatalog } from '../domain/GameTypes';
import { GameSession } from '../service/GameSession';
import { BaseGridView } from './BaseGridView';
import { BoardGridView } from './BoardGridView';
const { ccclass } = _decorator;

const COLOR_EMPTY = new Color(230, 233, 240, 255);  // 浅灰蓝
const COLOR_BUILDING = new Color(148, 163, 184, 255);  // 暖灰
const COLOR_THIEF = new Color(239, 68, 68, 255);    // 红
const COLOR_POLICE = new Color(59, 130, 246, 255);   // 蓝
const COLOR_STROKE = new Color(203, 213, 225, 255);  // 淡边框

@ccclass('DebugBoardRenderer')
export class DebugBoardRenderer extends BaseGridView {
    /** 渲染当前 session（whiteFrame 需要在编辑器里手动绑定到本组件） */
    render(session: GameSession, shapes: ShapeCatalog): void {
        if (!this.whiteFrame) {
            console.error('[DebugBoardRenderer] whiteFrame 未绑定，请在编辑器里把白色 SpriteFrame 拖到组件上');
            return;
        }
        this.renderSession(session, shapes);
    }

    /** 兼容旧调用名 */
    refreshRender(session: GameSession, shapes: ShapeCatalog): void {
        this.render(session, shapes);
    }

    private renderSession(session: GameSession, shapes: ShapeCatalog): void {
        const level = session.getLevel();
        const gridView = this.getOrAdd(BoardGridView);
        gridView.cellSize = 64;
        gridView.resizeBoard(level.board);

        // 清理旧格子
        this.clearCellNodes();

        // 先画全部空格
        for (let y = 0; y < level.board.height; y++) {
            for (let x = 0; x < level.board.width; x++) {
                this.addCellNode(gridView, level.board, { x, y }, COLOR_EMPTY, COLOR_STROKE);
            }
        }

        // 建筑
        for (const building of level.buildings) {
            for (const cell of getAbsoluteCells(shapes, building)) {
                this.addCellNode(gridView, level.board, cell, COLOR_BUILDING, COLOR_STROKE);
            }
        }

        // 已放置警察
        for (const police of session.getPlacedPolice()) {
            for (const cell of getAbsoluteCells(shapes, police)) {
                this.addCellNode(gridView, level.board, cell, COLOR_POLICE, COLOR_STROKE);
            }
        }

        // 小偷（最后画，覆盖在上面）
        this.addCellNode(gridView, level.board, level.thief, COLOR_THIEF, COLOR_STROKE);
    }

    private getOrAdd<T extends Component>(Ctor: new () => T): T {
        const existed = this.getComponent(Ctor);
        if (existed) return existed;
        return this.addComponent(Ctor);
    }
}
