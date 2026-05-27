import { _decorator, Component, Node, Size, Sprite, SpriteFrame, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BoardBackgroundTiled')
export class BoardBackgroundTiled extends Component {
    @property({type: SpriteFrame}) public tileSpriteFrame: SpriteFrame | null = null;
    @property(Number) public gridSizeH: number = 8;
    @property(Number) public gridSizeW: number = 8;
    @property(Number) public tilePixelSize: number = 64;

    protected onLoad(): void {
        this.apply();
    }

    public apply() {
        if (!this.tileSpriteFrame) {
            console.error("请在BoardBackgroundTiled组件上添加SpriteFrame组件");
            return;
        }
        
        const sprite = this.getOrAdd(Sprite);
        const ui = this.getOrAdd(UITransform);

        sprite.spriteFrame = this.tileSpriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.TILED;
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


