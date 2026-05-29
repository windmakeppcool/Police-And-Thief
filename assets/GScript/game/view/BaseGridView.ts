import { _decorator, Color, Component, Layers, Node, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { type Coord } from '../domain/GameTypes';
import { BoardGridView } from './BoardGridView';
const { ccclass, property } = _decorator;

@ccclass('BaseGridView')
export class BaseGridView extends Component {
    @property(Number) public cellPadding = 2;

    /** 用于纯色填充的白色 SpriteFrame，在 Cocos 编辑器里手动拖入 */
    @property(SpriteFrame) public whiteFrame: SpriteFrame | null = null;

    protected cellNodes: Node[] = [];

    /** 清理已生成的格子节点 */
    protected clearCellNodes(): void {
        for (const n of this.cellNodes) {
            if (n.isValid) n.destroy();
        }
        this.cellNodes = [];
    }

    /**
     * 基础格子绘制：外层 = borderColor，内层 = fillColor。
     * @param gridView 棋盘坐标 -> 本地坐标转换
     * @param board 棋盘尺寸
     * @param coord 当前格子坐标
     * @param fillColor 内层颜色
     * @param borderColor 外层颜色
     * @param sf 可选：覆盖默认的 whiteFrame
     * @returns 创建的 border 节点；若没有可用 SpriteFrame，返回 null
     */
    protected addCellNode(
        gridView: BoardGridView,
        board: { width: number; height: number },
        coord: Coord,
        fillColor: Color,
        borderColor: Color,
        sf: SpriteFrame | null = this.whiteFrame
    ): Node | null {
        if (!sf) {
            console.error('[BaseGridView] whiteFrame 未绑定，请在编辑器里把白色 SpriteFrame 拖到组件上');
            return null;
        }
        const center = gridView.boardToLocal(coord, board);
        const borderSize = gridView.cellSize;
        const innerSize = Math.max(0, borderSize - this.cellPadding * 2);

        // 外层 = 边框色
        const borderNode = new Node(`cell_${coord.x}_${coord.y}_border`);
        borderNode.layer = Layers.Enum.UI_2D;
        borderNode.parent = this.node;
        const borderSprite = borderNode.addComponent(Sprite);
        borderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        borderSprite.trim = false;
        borderSprite.spriteFrame = sf;
        borderSprite.color = borderColor;
        const borderTrans = borderNode.getComponent(UITransform) || borderNode.addComponent(UITransform);
        borderTrans.setContentSize(new Size(borderSize, borderSize));
        borderNode.setPosition(center.x, center.y, 0);

        // 内层 = 填充色
        const innerNode = new Node(`cell_${coord.x}_${coord.y}_fill`);
        innerNode.layer = Layers.Enum.UI_2D;
        innerNode.parent = borderNode;
        const innerSprite = innerNode.addComponent(Sprite);
        innerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        innerSprite.trim = false;
        innerSprite.spriteFrame = sf;
        innerSprite.color = fillColor;
        const innerTrans = innerNode.getComponent(UITransform) || innerNode.addComponent(UITransform);
        innerTrans.setContentSize(new Size(innerSize, innerSize));

        this.cellNodes.push(borderNode);
        return borderNode;
    }
}
