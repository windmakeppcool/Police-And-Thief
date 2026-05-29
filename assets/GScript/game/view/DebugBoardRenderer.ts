import { _decorator, Color, Component, Graphics } from 'cc';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { type BoardSize, type Coord, type ShapeCatalog } from '../domain/GameTypes';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from './BoardGridView';
const { ccclass, property } = _decorator;

@ccclass('DebugBoardRenderer')
export class DebugBoardRenderer extends Component {
    @property(Number) public cellPadding = 3;

    private readonly emptyColor = new Color(226, 232, 240, 255);
    private readonly buildingColor = new Color(100, 116, 139, 255);
    private readonly thiefColor = new Color(239, 68, 68, 255);
    private readonly policeColor = new Color(59, 130, 246, 255);
    private readonly strokeColor = new Color(15, 23, 42, 255);

    renderSession(session: GameSession, shapes: ShapeCatalog): void {
        const level = session.getLevel();
        const gridView = this.getOrAdd(BoardGridView);
        const graphics = this.getOrAdd(Graphics);

        gridView.resizeBoard(level.board);
        graphics.clear();
        graphics.lineWidth = 1;

        for (let y = 0; y < level.board.height; y++) {
            for (let x = 0; x < level.board.width; x++) {
                this.drawCell(graphics, gridView, level.board, { x, y }, this.emptyColor);
            }
        }

        for (const building of level.buildings) {
            for (const cell of getAbsoluteCells(shapes, building)) {
                this.drawCell(graphics, gridView, level.board, cell, this.buildingColor);
            }
        }

        for (const police of session.getPlacedPolice()) {
            for (const cell of getAbsoluteCells(shapes, police)) {
                this.drawCell(graphics, gridView, level.board, cell, this.policeColor);
            }
        }

        this.drawCell(graphics, gridView, level.board, level.thief, this.thiefColor);
    }

    private drawCell(graphics: Graphics, gridView: BoardGridView, board: BoardSize, coord: Coord, fillColor: Color): void {
        const center = gridView.boardToLocal(coord, board);
        const size = gridView.cellSize - this.cellPadding * 2;
        const left = center.x - size / 2;
        const bottom = center.y - size / 2;

        graphics.fillColor = fillColor;
        graphics.strokeColor = this.strokeColor;
        graphics.rect(left, bottom, size, size);
        graphics.fill();
        graphics.stroke();
    }

    private getOrAdd<T extends Component>(Ctor: new () => T): T {
        const existed = this.getComponent(Ctor);
        if (existed) return existed;
        return this.addComponent(Ctor);
    }
}
