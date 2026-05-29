import { _decorator, Color, Component, Layers, Node, Size, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { type Coord, type ShapeCatalog } from '../domain/GameTypes';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from './BoardGridView';
const { ccclass, property } = _decorator;

const COLOR_EMPTY    = new Color(230, 233, 240, 255);  // 浅灰蓝
const COLOR_BUILDING = new Color(148, 163, 184, 255);  // 暖灰
const COLOR_THIEF    = new Color(239, 68, 68, 255);    // 红
const COLOR_POLICE   = new Color(59, 130, 246, 255);   // 蓝
const COLOR_STROKE   = new Color(203, 213, 225, 255);  // 淡边框

/** 创建 1x1 白色 SpriteFrame，配合 Sprite.color tint 实现纯色方块 */
let _whiteFrame: SpriteFrame | null = null;
function getWhiteFrame(): SpriteFrame {
    if (_whiteFrame) return _whiteFrame;

    // 创建 1x1 白色 canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1, 1);

    // 创建纹理并上传
    const tex = new Texture2D();
    tex.create(1, 1);
    tex.uploadData(canvas);

    const sf = new SpriteFrame();
    sf.texture = tex;
    _whiteFrame = sf;
    return sf;
}

@ccclass('DebugBoardRenderer')
export class DebugBoardRenderer extends Component {
    @property(Number) public cellPadding = 2;

    private cellNodes: Node[] = [];
    private _inited = false;

    /** 用色彩区块重建棋盘 */
    renderSession(session: GameSession, shapes: ShapeCatalog): void {
        const level = session.getLevel();
        const gridView = this.getOrAdd(BoardGridView);
        gridView.cellSize = 64;

        if (!this._inited) {
            gridView.resizeBoard(level.board);
            this._inited = true;
        }

        // 清理旧格子
        for (const n of this.cellNodes) {
            if (n.isValid) n.destroy();
        }
        this.cellNodes = [];

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

    private addCellNode(
        gridView: BoardGridView,
        board: { width: number; height: number },
        coord: Coord,
        fillColor: Color,
        borderColor: Color
    ): void {
        const center = gridView.boardToLocal(coord, board);
        const borderSize = gridView.cellSize - this.cellPadding * 2;
        const innerSize = borderSize - 4;

        // 外层 = 边框色
        const borderNode = new Node(`cell_${coord.x}_${coord.y}_border`);
        borderNode.layer = Layers.Enum.UI_2D;
        borderNode.parent = this.node;
        const borderTrans = borderNode.addComponent(UITransform);
        borderTrans.setContentSize(new Size(borderSize, borderSize));
        const borderSprite = borderNode.addComponent(Sprite);
        borderSprite.spriteFrame = getWhiteFrame();
        borderSprite.color = borderColor;
        borderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        borderNode.setPosition(center.x, center.y, 0);

        // 内层 = 填充色
        const innerNode = new Node(`cell_${coord.x}_${coord.y}_fill`);
        innerNode.layer = Layers.Enum.UI_2D;
        innerNode.parent = borderNode;
        const innerTrans = innerNode.addComponent(UITransform);
        innerTrans.setContentSize(new Size(innerSize, innerSize));
        const innerSprite = innerNode.addComponent(Sprite);
        innerSprite.spriteFrame = getWhiteFrame();
        innerSprite.color = fillColor;
        innerSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        this.cellNodes.push(borderNode);
    }

    private getOrAdd<T extends Component>(Ctor: new () => T): T {
        const existed = this.getComponent(Ctor);
        if (existed) return existed;
        return this.addComponent(Ctor);
    }
}
