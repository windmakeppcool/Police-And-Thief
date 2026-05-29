import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { type BoardSize, type Coord } from '../domain/GameTypes';
const { ccclass, property } = _decorator;

@ccclass('BoardGridView')
export class BoardGridView extends Component {
    @property(Number) public cellSize = 64;
    @property(Node) public cellRoot: Node | null = null;

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
