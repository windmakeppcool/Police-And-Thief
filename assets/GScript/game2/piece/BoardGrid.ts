import { _decorator, Color, Component, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { GameSession } from '../../game2/common/GameSession';
import { Coord, PieceColors } from '../common/GameTypes';
const { ccclass, property } = _decorator;

@ccclass('BoardGrid')
export class BoardGrid extends Component {
    static readonly viewLayer = EViewLayer.Scene;

    @property(SpriteFrame) public boardSpriteFrame: SpriteFrame = null!;
    @property(SpriteFrame) public thiefSpriteFrame: SpriteFrame = null!;

    private _cellSize = 64;
    private _cellPadSize = 2;
    private innerSize = this._cellSize - this._cellPadSize * 2;
    private _gridSize = 6;
    private cellNodes: Node[] = [];
    private thiefCoord: Coord | null = null;

    public get cellSize(): number { return this._cellSize; }
    public get cellPadSize(): number { return this._cellPadSize; }
    public get gridSize(): number { return this._gridSize; }

    /** 判断网格坐标是否在棋盘有效范围内 */
    public isValidCoord(coord: Coord): boolean {
        const half = this._gridSize / 2;
        return coord.x >= -half && coord.x < half && coord.y >= -half && coord.y < half;
    }

    /** 将像素位置（棋盘节点本地坐标）反算为最近的网格坐标 */
    public localToCell(localPos: Vec3): Coord {
        return {
            x: Math.round((localPos.x - this._cellSize / 2) / this._cellSize),
            y: Math.round((localPos.y - this._cellSize / 2) / this._cellSize),
        };
    }

    public isBlockedByThief(coord: Coord): boolean {
        return this.thiefCoord?.x === coord.x && this.thiefCoord.y === coord.y;
    }

    protected onLoad(): void {

    }

    renderGrid(session: GameSession) {
        const level = session.getLevel();
        this.thiefCoord = level.thief;

        for (let i = -this._gridSize / 2; i < this._gridSize / 2; i++) {
            for (let j = -this._gridSize / 2; j < this._gridSize / 2; j++) {
                if (i === level.thief.x && j === level.thief.y) {
                    this.renderSingleCell({ x: i, y: j }, this.thiefSpriteFrame);
                } else {
                    this.renderSingleCell({ x: i, y: j }, this.boardSpriteFrame);
                }
            }
        }
    }
    /**
     * 将网格坐标转换为本地坐标
     */
    cellToLocal(coord: Coord) {
        return new Vec3(
            coord.x * this._cellSize + this._cellSize / 2,
            coord.y * this._cellSize + this._cellSize / 2,
            0);
    }

    renderSingleCell(coord: Coord, spriteFrame: SpriteFrame) {
        const pos = this.cellToLocal(coord);
        const boardNodeName = `Cell_${coord.x}-${coord.y}_border`;
        const boardNode = new Node(boardNodeName);
        boardNode.parent = this.node;
        const cellSprite = boardNode.addComponent(Sprite);
        cellSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        cellSprite.trim = false;
        cellSprite.spriteFrame = spriteFrame;
        // cellSprite.color = borderColor;
        const borderTrans = boardNode.getComponent(UITransform) || boardNode.addComponent(UITransform);
        borderTrans.setContentSize(this._cellSize, this._cellSize);
        boardNode.setPosition(pos);

        this.cellNodes.push(boardNode);
    }

    /** 清理已生成的格子节点 */
    protected clearCellNodes(): void {
        for (const n of this.cellNodes) {
            if (n.isValid) n.destroy();
        }
        this.cellNodes = [];
    }

    onDestroy() {
        this.clearCellNodes();
    }
}


