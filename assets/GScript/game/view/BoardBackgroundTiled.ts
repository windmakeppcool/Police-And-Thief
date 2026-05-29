import { _decorator, Component, Size, UITransform } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
const { ccclass, property } = _decorator;

@ccclass('BoardBackgroundTiled')
export class BoardBackgroundTiled extends Component {
    /** 所属 UI 层级：棋盘背景属于场景底图，挂载到 Scene 层 */
    static readonly viewLayer = EViewLayer.Scene;

    @property(Number) public gridSizeH: number = 6;
    @property(Number) public gridSizeW: number = 6;
    @property(Number) public tilePixelSize: number = 64;

    protected onLoad(): void {
        this.resizeToGrid();
    }

    protected start(): void {
        // UIManager.open 会在挂载后把节点尺寸覆盖为全屏 G_VIEW_SIZE，
        // 这里在 start 中再次校正回 gridSize × tilePixelSize，避免棋盘被拉伸成铺满背景。
        this.resizeToGrid();
    }

    private resizeToGrid() {
        const ui = this.getComponent(UITransform) || this.addComponent(UITransform);
        const w = this.gridSizeW * this.tilePixelSize;
        const h = this.gridSizeH * this.tilePixelSize;
        ui.setContentSize(new Size(w, h));
    }
}
