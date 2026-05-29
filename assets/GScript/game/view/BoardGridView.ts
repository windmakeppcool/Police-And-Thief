import { _decorator, Component, Node, Size, SpriteFrame, UITransform, Vec3 } from 'cc';
import { type BoardSize, type Coord } from '../domain/GameTypes';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { BaseGridView } from './BaseGridView';
const { ccclass, property } = _decorator;

@ccclass('BoardGridView')
export class BoardGridView extends BaseGridView {
    static readonly viewLayer = EViewLayer.Scene;

    @property(Number) public cellSize = 64;
    @property(Node) public cellRoot: Node | null = null;

    gridSize: number = 6;

    protected start(): void {
        this.resizeToGrid();
    }

    private resizeToGrid() {
        const ui = this.getComponent(UITransform) || this.addComponent(UITransform);
        const w = this.gridSize * this.cellSize;
        const h = this.gridSize * this.cellSize;
        ui.setContentSize(new Size(w, h));
    }

    boardToLocal(coord: Coord, board: BoardSize): Vec3 {
        const left = -((board.width - 1) * this.cellSize) / 2;
        const bottom = -((board.height - 1) * this.cellSize) / 2;
        return new Vec3(left + coord.x * this.cellSize, bottom + coord.y * this.cellSize, 0);
    }

    resizeBoard(board: BoardSize): void {
        const transform = this.getComponent(UITransform) || this.addComponent(UITransform);
        transform.setContentSize(board.width * this.cellSize, board.height * this.cellSize);
    }
}
