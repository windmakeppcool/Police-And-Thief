import { _decorator, Color, Component, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { GameSession } from '../../game2/common/GameSession';
import { Coord, PieceColors } from '../common/GameTypes';
const { ccclass, property } = _decorator;

@ccclass('BoardGrid')
export class BoardGrid extends Component {
    static readonly viewLayer = EViewLayer.Scene;

    @property(SpriteFrame) public cellSpriteFrame: SpriteFrame = null!;

    private _cellSize = 64;
    private _cellPadSize = 2;
    private innerSize = this._cellSize - this._cellPadSize * 2;
    private _gridSize = 6;
    private cellNodes: Node[] = [];

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

    protected onLoad(): void {

    }

    renderGrid(session: GameSession) {
        const level = session.getLevel();

        for (let i = -this._gridSize / 2; i < this._gridSize / 2; i++) {
            for (let j = -this._gridSize / 2; j < this._gridSize / 2; j++) {
                if (i === level.thief.x && j === level.thief.y) {
                    this.renderSingleCell({ x: i, y: j }, PieceColors.COLOR_THIEF, PieceColors.COLOR_STROKE);
                } else {
                    this.renderSingleCell({ x: i, y: j }, PieceColors.COLOR_EMPTY, PieceColors.COLOR_STROKE);
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

    renderSingleCell(coord: Coord, fillColor: Color, borderColor: Color) {
        // 外层 = 边框色
        const pos = this.cellToLocal(coord);
        const boardNodeName = `Cell_${coord.x}-${coord.y}_border`;
        const boardNode = new Node(boardNodeName);
        boardNode.parent = this.node;
        const cellSprite = boardNode.addComponent(Sprite);
        cellSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        cellSprite.trim = false;
        cellSprite.spriteFrame = this.cellSpriteFrame;
        cellSprite.color = borderColor;
        const borderTrans = boardNode.getComponent(UITransform) || boardNode.addComponent(UITransform);
        borderTrans.setContentSize(this._cellSize, this._cellSize);
        boardNode.setPosition(pos);

        // 内层 = 填充色
        const innerNodeName = `Cell_${coord.x}-${coord.y}_inner`;
        const innerNode = new Node(innerNodeName);
        innerNode.parent = this.node;
        const innerSprite = innerNode.addComponent(Sprite);
        innerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        innerSprite.trim = false;
        innerSprite.spriteFrame = this.cellSpriteFrame;
        innerSprite.color = fillColor;
        const innerTrans = innerNode.getComponent(UITransform) || innerNode.addComponent(UITransform);
        innerTrans.setContentSize(this.innerSize, this.innerSize);
        // innerNode.setPosition(pos);

        boardNode.addChild(innerNode);

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


