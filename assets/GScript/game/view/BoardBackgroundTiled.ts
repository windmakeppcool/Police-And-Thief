import { _decorator, Component, Node, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
const { ccclass, property } = _decorator;

@ccclass('BoardBackgroundTiled')
export class BoardBackgroundTiled extends Component {
    /** 所属 UI 层级：棋盘背景属于场景底图，挂载到 Scene 层 */
    static readonly viewLayer = EViewLayer.Scene;

    @property({ type: SpriteFrame }) public tileSpriteFrame: SpriteFrame | null = null;
    @property(Number) public gridSizeH: number = 8;
    @property(Number) public gridSizeW: number = 8;
    @property(Number) public tilePixelSize: number = 64;

    protected onLoad(): void {
        this.apply();
    }

    protected start(): void {
        // UIManager.open 会在挂载后把节点尺寸覆盖为全屏 G_VIEW_SIZE，
        // 这里在 start 中再次校正回 gridSize × tilePixelSize，避免棋盘被拉伸成铺满背景。
        this.resizeToGrid();
    }

    public apply() {
        if (!this.tileSpriteFrame) {
            console.error("请在BoardBackgroundTiled组件上添加SpriteFrame组件");
            return;
        }

        const sprite = this.getOrAdd(Sprite);
        this.getOrAdd(UITransform);

        sprite.spriteFrame = this.tileSpriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.TILED;
        this.resizeToGrid();
    }

    private resizeToGrid() {
        const ui = this.getOrAdd(UITransform);
        const w = this.gridSizeW * this.tilePixelSize;
        const h = this.gridSizeH * this.tilePixelSize;
        ui.setContentSize(new Size(w, h));
    }

    private getOrAdd<T extends Component>(Ctor: new () => T): T {
        const existed = this.getComponent(Ctor);
        if (existed) return existed;
        return this.addComponent(Ctor);
    }

}


